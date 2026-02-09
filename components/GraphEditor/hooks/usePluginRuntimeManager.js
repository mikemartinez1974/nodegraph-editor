"use client";

import { useEffect, useRef } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import {
  getInstalledPlugins,
  subscribe,
  setPluginRuntimeData,
  clearPluginRuntimeData
} from '../plugins/pluginRegistry';
import PluginRuntimeHost from '../plugins/pluginRuntimeHost';

const ensureString = (value, fallback = null) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
};

const ensureNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const cloneObject = (value) =>
  value && typeof value === 'object' ? { ...value } : undefined;

const normalizeHandleList = (value) =>
  Array.isArray(value)
    ? value.filter(Boolean).map((handle) => ({ ...handle }))
    : undefined;

const normalizeRuntimeNodeDefinition = (pluginId, definition, manifestNode) => {
  if (!pluginId || !definition || typeof definition !== 'object') return null;
  const pluginType = ensureString(definition.type);
  if (!pluginType) return null;
  const manifestFallback = manifestNode || {};
  const label =
    ensureString(definition.label) ||
    ensureString(manifestFallback.label) ||
    pluginType;
  const category =
    ensureString(definition.category) ||
    ensureString(manifestFallback.category) ||
    'plugin';
  const icon =
    ensureString(definition.icon) ||
    ensureString(manifestFallback.icon) ||
    'Extension';
  const description =
    ensureString(definition.description) ||
    ensureString(manifestFallback.description) ||
    '';

  const rendererEntry =
    ensureString(definition.renderer?.entry) ||
    ensureString(manifestFallback.renderer?.entry) ||
    ensureString(definition.entry) ||
    ensureString(manifestFallback.entry) ||
    null;

  return {
    pluginType,
    type: `${pluginId}:${pluginType}`,
    label,
    description,
    category,
    icon,
    defaultWidth:
      ensureNumber(definition.defaultWidth) ??
      ensureNumber(manifestFallback.defaultWidth),
    defaultHeight:
      ensureNumber(definition.defaultHeight) ??
      ensureNumber(manifestFallback.defaultHeight),
    defaultData: cloneObject(definition.defaultData),
    ports: normalizeHandleList(definition.ports),
    inputs:
      normalizeHandleList(definition.inputs) ||
      normalizeHandleList(definition.ports?.inputs),
    outputs:
      normalizeHandleList(definition.outputs) ||
      normalizeHandleList(definition.ports?.outputs),
    state: cloneObject(definition.state),
    extensions: cloneObject(definition.extensions),
    entry: ensureString(definition.entry) || ensureString(manifestFallback.entry),
    renderer: rendererEntry ? { entry: rendererEntry } : undefined
  };
};

const syncPluginNodeDefinitions = async (plugin, host) => {
  const pluginId = plugin?.id;
  if (!pluginId || !host) return;
  try {
    const methods = host.availableMethods || [];
    if (methods.length > 0 && !methods.includes('plugin:listNodes')) {
      setPluginRuntimeData(pluginId, {
        nodes: [],
        nodesByType: {},
        syncedAt: new Date().toISOString()
      });
      return;
    }
    const response = await host.call('plugin:listNodes', {});
    const manifestMap = Array.isArray(plugin?.nodes)
      ? plugin.nodes.reduce((acc, node) => {
          if (node?.type) {
            acc[node.type] = node;
          }
          return acc;
        }, {})
      : {};
    const normalized = Array.isArray(response)
      ? response
          .map((nodeDef) =>
            normalizeRuntimeNodeDefinition(
              pluginId,
              nodeDef,
              manifestMap[nodeDef?.type]
            )
          )
          .filter(Boolean)
      : [];
    const nodesByType = normalized.reduce((acc, nodeDef) => {
      acc[nodeDef.pluginType] = nodeDef;
      return acc;
    }, {});
    setPluginRuntimeData(pluginId, {
      nodes: normalized,
      nodesByType,
      syncedAt: new Date().toISOString()
    });
  } catch (err) {
    setPluginRuntimeData(pluginId, {
      nodes: [],
      nodesByType: {},
      error: err?.message || 'Failed to fetch plugin node definitions',
      syncedAt: new Date().toISOString()
    });
  }
};

/**
 * usePluginRuntimeManager
 * ----------------------
 * Loads enabled plugins into sandboxed runtimes, forwards RPC calls through the
 * global event bus, and emits telemetry/status events for UI consumers.
 */
export default function usePluginRuntimeManager({
  graphApiRef,
  selectionRef
}) {
  const hostsRef = useRef(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const getGraphApi = () => {
      if (typeof window !== 'undefined' && window.graphAPI) {
        return window.graphAPI;
      }
      return graphApiRef?.current || null;
    };
    const getSelectionState = () =>
      (selectionRef?.current || { nodeIds: [], edgeIds: [], groupIds: [] });

    const baseOptions = {
      getGraphApi,
      getSelectionState,
      emitEvent: (event, payload) => {
        eventBus.emit(event, payload);
      },
      onStatusChange: (status) => {
        eventBus.emit('pluginRuntime:status', status);
      },
      onTelemetry: (telemetry) => {
        eventBus.emit('pluginRuntime:telemetry', telemetry);
      }
    };

    const syncHosts = (pluginsSnapshot = []) => {
      const activeIds = new Set();
      pluginsSnapshot.forEach((plugin) => {
        if (!plugin || plugin.enabled === false) return;
        const bundleUrl =
          plugin.bundle?.url || plugin.manifest?.bundle?.url || null;
        if (!bundleUrl) return;
        activeIds.add(plugin.id);
        let host = hostsRef.current.get(plugin.id);
        if (!host) {
          host = new PluginRuntimeHost(plugin, baseOptions);
          hostsRef.current.set(plugin.id, host);
          host
            .ensureReady()
            .then(() => syncPluginNodeDefinitions(plugin, host))
            .catch((err) => {
              eventBus.emit('pluginRuntime:error', {
                pluginId: plugin.id,
                error: err?.message || String(err)
              });
            });
        } else {
          host.updatePlugin(plugin);
          if (!Array.isArray(plugin?.runtime?.nodes)) {
            host
              .ensureReady()
              .then(() => syncPluginNodeDefinitions(plugin, host))
              .catch((err) => {
                eventBus.emit('pluginRuntime:error', {
                  pluginId: plugin.id,
                  error: err?.message || String(err)
                });
              });
          }
        }
      });

      Array.from(hostsRef.current.keys()).forEach((pluginId) => {
        if (!activeIds.has(pluginId)) {
          const host = hostsRef.current.get(pluginId);
          host?.destroy();
          hostsRef.current.delete(pluginId);
          eventBus.emit('pluginRuntime:status', {
            pluginId,
            status: 'removed'
          });
          clearPluginRuntimeData(pluginId);
        }
      });
    };

    const unsubscribe = subscribe(syncHosts);
    syncHosts(getInstalledPlugins());

    return () => {
      unsubscribe?.();
      hostsRef.current.forEach((host) => host.destroy());
      hostsRef.current.clear();
    };
  }, [graphApiRef, selectionRef]);

  useEffect(() => {
    const handleCall = async (payload = {}) => {
      const { pluginId, method, args, timeout, requestId } = payload;
      if (!pluginId || !method) return;
      const host = hostsRef.current.get(pluginId);
      if (!host) {
        eventBus.emit('pluginRuntime:error', {
          pluginId,
          requestId,
          error: 'Plugin runtime not loaded'
        });
        return;
      }
      try {
        const result = await host.call(method, args, timeout);
        eventBus.emit('pluginRuntime:response', {
          pluginId,
          requestId,
          result
        });
      } catch (err) {
        eventBus.emit('pluginRuntime:error', {
          pluginId,
          requestId,
          error: err?.message || String(err)
        });
      }
    };

    const handleReload = ({ pluginId } = {}) => {
      if (!pluginId) return;
      const host = hostsRef.current.get(pluginId);
      if (!host) return;
      host
        .reload()
        .then(() => {
          const plugins = getInstalledPlugins();
          const pluginRecord =
            Array.isArray(plugins) &&
            plugins.find((entry) => entry.id === pluginId);
          syncPluginNodeDefinitions(pluginRecord || { id: pluginId }, host);
        })
        .catch((err) => {
          eventBus.emit('pluginRuntime:error', {
            pluginId,
            error: err?.message || String(err)
          });
        });
    };

    const unsubscribeCall = eventBus.on('pluginRuntime:call', handleCall);
    const unsubscribeReload = eventBus.on(
      'pluginRuntime:reload',
      handleReload
    );

    return () => {
      unsubscribeCall?.();
      unsubscribeReload?.();
    };
  }, []);

  const getHost = (pluginId) => hostsRef.current.get(pluginId) || null;

  return { getHost };
}
