"use client";
import { useMemo, useRef, useCallback, useEffect } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import GraphCRUD from '../GraphCrud';
import { useBackgroundRpc } from './useBackgroundRpc';
import usePluginRuntimeManager from './usePluginRuntimeManager';

const MAX_SCRIPT_RPC_CALLS = 200;
const MAX_SCRIPT_MUTATIONS = 100;
const MUTATION_METHODS = new Set(['createNode', 'updateNode', 'deleteNode', 'createEdge', 'deleteEdge']);

const safeClone = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    throw new Error('Unable to serialize script payload');
  }
};

const ensureScriptId = (raw) => (raw ? String(raw) : null);

export default function usePluginRuntime({
  state,
  historyHook,
  graphAPI,
  selectionSnapshotRef,
  setSnackbar
}) {
  const {
    nodes,
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    setGroups,
    groups,
    groupsRef,
    groupManager,
    defaultNodeColor,
    defaultEdgeColor
  } = state || {};

  const scriptRunStatsRef = useRef(new Map());
  const scriptEventSubscriptionsRef = useRef(new Map());

  const emitScriptEventPayload = useCallback((eventName, payload) => {
    if (!eventName || typeof window === 'undefined') return;
    const runner = window.__scriptRunner;
    if (!runner || typeof runner.emitEvent !== 'function') return;
    try {
      runner.emitEvent(eventName, payload);
    } catch (err) {
      console.warn('[GraphEditor] Failed to emit script event', eventName, err);
    }
  }, []);

  const buildScriptEventPayload = useCallback(
    (eventName, payload) => {
      const base = payload && typeof payload === 'object' ? { ...payload } : {};
      const latestNodes = nodesRef?.current || nodes || [];

      const cloneNodes = (list = []) =>
        list
          .map((id) => latestNodes.find((node) => node && node.id === id))
          .filter(Boolean)
          .map((node) => safeClone(node));

      if (eventName === 'nodeDragEnd' || eventName === 'nodeDragStart') {
        const nodeIds = Array.isArray(base.nodeIds)
          ? base.nodeIds.filter((id) => typeof id === 'string' && id)
          : base.nodeId
          ? [base.nodeId]
          : [];
        base.nodeIds = nodeIds;
        base.nodes = cloneNodes(nodeIds);
      } else if (eventName === 'nodeAdded' || eventName === 'nodeDataChanged') {
        if (base.node && typeof base.node === 'object') {
          base.node = safeClone(base.node);
        } else {
          const nodeId = (base.node && base.node.id) || base.nodeId || base.id || null;
          if (nodeId) {
            const node = latestNodes.find((entry) => entry && entry.id === nodeId);
            if (node) {
              base.node = safeClone(node);
            }
          }
        }
      }
      return base;
    },
    [nodes, nodesRef]
  );

  const emitExecutionIntent = useCallback((proposals, meta = {}) => {
    const list = Array.isArray(proposals) ? proposals : [proposals];
    try {
      eventBus.emit('executionIntent', {
        trigger: meta.trigger || 'scriptRuntime',
        proposals: list,
        source: meta.source || 'scriptRuntime',
        meta
      });
    } catch (err) {
      console.warn('[GraphEditor] Failed to emit executionIntent', err);
    }
  }, []);

  const clearScriptEventSubscriptions = useCallback(() => {
    const map = scriptEventSubscriptionsRef.current;
    map.forEach((entry, key) => {
      try {
        entry?.off?.();
      } catch (err) {
        console.warn('[GraphEditor] Failed to clear script event subscription', key, err);
      }
    });
    map.clear();
  }, []);

  useEffect(() => {
    const handleReset = () => clearScriptEventSubscriptions();
    window.addEventListener('scriptRunnerReset', handleReset);
    return () => {
      window.removeEventListener('scriptRunnerReset', handleReset);
      clearScriptEventSubscriptions();
    };
  }, [clearScriptEventSubscriptions]);

  const {
    bgRef,
    rpc,
    postEvent,
    isReady,
    methods,
    handleHandshakeComplete
  } = useBackgroundRpc();

  const graphCRUD = useMemo(() => {
    return new GraphCRUD(
      () => nodesRef.current || [],
      setNodes,
      () => edgesRef.current || [],
      setEdges,
      historyHook.saveToHistory,
      nodesRef,
      edgesRef,
      () => groupsRef?.current || groups || [],
      setGroups,
      groupsRef,
      groupManager
    );
  }, [setNodes, setEdges, setGroups, historyHook.saveToHistory, groups, groupsRef, groupManager]);

  const handleScriptRequest = useCallback(async (method, args = [], meta = {}) => {
    try {
      const isDry = meta && meta.dry === true;
      const allowMutations = meta && meta.allowMutations === true;
      const runId = ensureScriptId(meta?.runId);

      if (runId) {
        const current = scriptRunStatsRef.current.get(runId) || { calls: 0, mutations: 0 };
        current.calls += 1;
        if (current.calls > MAX_SCRIPT_RPC_CALLS) {
          scriptRunStatsRef.current.delete(runId);
          throw new Error('Script exceeded RPC call budget');
        }
        if (MUTATION_METHODS.has(method)) {
          current.mutations += 1;
          if (current.mutations > MAX_SCRIPT_MUTATIONS) {
            scriptRunStatsRef.current.delete(runId);
            throw new Error('Script exceeded mutation allowance');
          }
        }
        scriptRunStatsRef.current.set(runId, current);
      }

      switch (method) {
        case 'getNodes':
          return safeClone(nodesRef.current || []);
        case 'getNode': {
          const [id] = args;
          const node = (nodesRef.current || []).find((n) => n.id === id) || null;
          return node ? safeClone(node) : null;
        }
        case 'getEdges':
          return safeClone(edgesRef.current || []);
        case 'createNode': {
          if (isDry && !allowMutations) {
            return { simulated: true };
          }
          const [nodeData = {}] = args || [{}];
          if (!nodeData || typeof nodeData !== 'object') {
            throw new Error('createNode expects a node object');
          }
          const newNode = {
            id:
              typeof nodeData.id === 'string' && nodeData.id.trim()
                ? nodeData.id.trim()
                : `node_${Date.now()}`,
            type: typeof nodeData.type === 'string' ? nodeData.type : 'default',
            label: typeof nodeData.label === 'string' ? nodeData.label : 'New Node',
            position:
              nodeData.position && typeof nodeData.position === 'object'
                ? { x: Number(nodeData.position.x) || 0, y: Number(nodeData.position.y) || 0 }
                : { x: 0, y: 0 },
            width: Number(nodeData.width) || 200,
            height: Number(nodeData.height) || 120,
            data: nodeData.data && typeof nodeData.data === 'object' ? safeClone(nodeData.data) : {},
            color: nodeData.color || defaultNodeColor || '#1976d2'
          };
          emitExecutionIntent({ action: 'createNode', node: newNode });
          return safeClone(newNode);
        }
        case 'createEdge': {
          if (isDry && !allowMutations) {
            return { simulated: true };
          }
          const [edgeData = {}] = args || [{}];
          if (!edgeData || typeof edgeData !== 'object') {
            throw new Error('createEdge expects an edge object');
          }
          const newEdge = {
            id:
              typeof edgeData.id === 'string' && edgeData.id.trim()
                ? edgeData.id.trim()
                : `edge_${Date.now()}`,
            source: edgeData.source,
            target: edgeData.target,
            sourceHandle: edgeData.sourceHandle || edgeData.handle,
            targetHandle: edgeData.targetHandle || edgeData.handle,
            type: edgeData.type || 'default',
            data: edgeData.data && typeof edgeData.data === 'object' ? safeClone(edgeData.data) : {},
            color: edgeData.color || defaultEdgeColor || '#666666'
          };
          emitExecutionIntent({ action: 'createEdge', edge: newEdge });
          return safeClone(newEdge);
        }
        case 'deleteNode': {
          if (isDry && !allowMutations) {
            return { simulated: true };
          }
          const [id] = args;
          if (!id) {
            throw new Error('deleteNode requires an id');
          }
          emitExecutionIntent({ action: 'deleteNode', id });
          return { id };
        }
        case 'updateNode': {
          if (isDry && !allowMutations) {
            return { simulated: true };
          }
          const [id, updates = {}] = args;
          if (!id) {
            throw new Error('updateNode requires an id');
          }
          if (!updates || typeof updates !== 'object') {
            throw new Error('updateNode requires an updates object');
          }
          emitExecutionIntent({ action: 'updateNode', id, patch: safeClone(updates) });
          return { id, ...safeClone(updates) };
        }
        case 'deleteEdge': {
          if (isDry && !allowMutations) {
            return { simulated: true };
          }
          const [id] = args;
          if (!id) {
            throw new Error('deleteEdge requires an id');
          }
          emitExecutionIntent({ action: 'deleteEdge', id });
          return { id };
        }
        case 'applyScriptPatch': {
          const [payload = {}] = args || [{}];
          const { nodeId, patch } = payload;
          if (!nodeId || !patch) {
            throw new Error('applyScriptPatch requires nodeId and patch');
          }
          emitExecutionIntent({ action: 'updateNode', id: nodeId, patch: safeClone(patch) });
          return { nodeId };
        }
        case 'bridge:subscribeEvent': {
          const [rawName] = args || [];
          const eventName = typeof rawName === 'string' ? rawName.trim() : '';
          if (!eventName) {
            throw new Error('bridge:subscribeEvent requires an event name');
          }
          const map = scriptEventSubscriptionsRef.current;
          const existing = map.get(eventName);
          if (existing) {
            existing.count += 1;
            map.set(eventName, existing);
            return { subscribed: true, count: existing.count };
          }
          const handler = (payload) =>
            emitScriptEventPayload(
              eventName,
              buildScriptEventPayload(eventName, payload)
            );
          let unsubscribe = null;
          try {
            unsubscribe = eventBus.on(eventName, handler);
          } catch (err) {
            console.warn('[GraphEditor] Failed to subscribe script to event', eventName, err);
            throw err;
          }
          const cleanup = () => {
            try {
              if (typeof unsubscribe === 'function') {
                unsubscribe();
              } else {
                eventBus.off(eventName, handler);
              }
            } catch (err) {
              console.warn('[GraphEditor] Failed to cleanup script event listener', eventName, err);
            }
          };
          map.set(eventName, { count: 1, off: cleanup });
          return { subscribed: true, count: 1 };
        }
        case 'bridge:unsubscribeEvent': {
          const [rawName] = args || [];
          const eventName = typeof rawName === 'string' ? rawName.trim() : '';
          if (!eventName) {
            throw new Error('bridge:unsubscribeEvent requires an event name');
          }
          const map = scriptEventSubscriptionsRef.current;
          const entry = map.get(eventName);
          if (!entry) {
            return { subscribed: false, count: 0 };
          }
          entry.count = Math.max(0, (entry.count || 1) - 1);
          if (entry.count === 0) {
            try {
              entry.off?.();
            } catch (err) {
              console.warn('[GraphEditor] Failed to cleanup script event listener', eventName, err);
            }
            map.delete(eventName);
            return { subscribed: false, count: 0 };
          }
          map.set(eventName, entry);
          return { subscribed: true, count: entry.count };
        }
        default:
          throw new Error('Unknown method: ' + method);
      }
    } catch (err) {
      console.error('Script RPC error', method, err);
      throw err;
    }
  }, [
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    historyHook,
    defaultNodeColor,
    defaultEdgeColor
  ]);

  useEffect(() => {
    const handleScriptResult = (event) => {
      const detail = event.detail || event;
      if (!detail || detail.type !== 'scriptResult') return;

      if (detail.runId) {
        scriptRunStatsRef.current.delete(String(detail.runId));
      } else {
        scriptRunStatsRef.current.clear();
      }

      if (detail.success) {
        setSnackbar({ open: true, message: 'Script executed successfully', severity: 'success' });
      } else if (detail.success === false) {
        setSnackbar({ open: true, message: detail.error || 'Script execution failed', severity: 'error' });
      }
    };

    window.addEventListener('scriptRunnerResult', handleScriptResult);
    return () => window.removeEventListener('scriptRunnerResult', handleScriptResult);
  }, [setSnackbar]);

  useEffect(() => {
    const handleApplyProposals = ({ proposals = [], sourceId } = {}) => {
      if (!proposals.length) return;
      try {
        eventBus.emit('executionIntent', {
          trigger: 'applyScriptProposals',
          proposals,
          sourceId,
          source: 'script'
        });
        setSnackbar({ open: true, message: 'Script changes queued', severity: 'info' });
      } catch (err) {
        console.error('Failed to queue script proposals', err);
        setSnackbar({ open: true, message: 'Failed to queue script proposals', severity: 'error' });
      }
    };

    eventBus.on('applyScriptProposals', handleApplyProposals);
    return () => eventBus.off('applyScriptProposals', handleApplyProposals);
  }, [setSnackbar]);

  const pluginRuntime = usePluginRuntimeManager({
    graphApiRef: graphAPI,
    selectionRef: selectionSnapshotRef
  });

  const pluginRuntimeMemo = useMemo(
    () => ({
      getHost: pluginRuntime?.getHost
    }),
    [pluginRuntime]
  );

  return useMemo(
    () => ({
      graphCRUD,
      handleScriptRequest,
      backgroundRpc: rpc,
      backgroundRpcReady: isReady,
      backgroundPostEvent: postEvent,
      backgroundRpcMethods: methods,
      bgRef,
      handleHandshakeComplete,
      pluginRuntime: pluginRuntimeMemo
    }),
    [
      graphCRUD,
      handleScriptRequest,
      rpc,
      isReady,
      postEvent,
      methods,
      bgRef,
      handleHandshakeComplete,
      pluginRuntimeMemo
    ]
  );
}
