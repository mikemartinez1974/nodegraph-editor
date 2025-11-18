"use client";

import { PLUGIN_RUNTIME_SDK_SOURCE } from './sdkSource';

/**
 * PluginRuntimeHost
 * -----------------
 * Loads third-party plugin bundles inside a hardened sandbox (iframe or worker),
 * negotiates RPC capabilities, proxies method calls, and exposes a whitelist of
 * Graph API helpers back to the plugin runtime.
 */

const DEFAULT_HANDSHAKE_TIMEOUT = 8000;
const DEFAULT_RPC_TIMEOUT = 6000;
const DEFAULT_LOG_PREFIX = '[PluginRuntimeHost]';

const noop = () => {};

const generateToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const cloneForRpc = (value) => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // fall back below
    }
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    throw new Error(
      'cloneForRpc: Failed to clone value for RPC. Value is not serializable via structuredClone or JSON. ' +
      'This may allow shared mutable references to cross the RPC boundary. ' +
      'Original error: ' + (err && err.message ? err.message : err)
    );
  }
};

const normalizePermissions = (plugin) => {
  const array = Array.isArray(plugin?.permissions) ? plugin.permissions : [];
  return new Set(array.filter(Boolean));
};

const ensureGraphApi = (getGraphApi) => {
  const api = typeof getGraphApi === 'function' ? getGraphApi() : null;
  if (!api) {
    throw new Error('Graph API surface is not available yet');
  }
  return api;
};

const buildDefaultHostMethods = (plugin, options = {}) => {
  const permissions = normalizePermissions(plugin);
  const getGraphApi = options.getGraphApi || (() => null);
  const getSelectionState =
    options.getSelectionState ||
    (() => ({ nodeIds: [], edgeIds: [], groupIds: [] }));
  const emitEvent = options.emitEvent || noop;

  const requirePermission = (permission) => {
    if (!permissions.has(permission)) {
      throw new Error(`Plugin lacks required permission "${permission}"`);
    }
  };

  const methods = {
    'graph:getNodes': () => {
        throw new Error(
          result?.error ||
            `Failed to read nodes in plugin "${plugin.id || plugin.name || 'unknown'}" (method: graph:getNodes)`
        );
      const api = ensureGraphApi(getGraphApi);
      const result = api.readNode?.();
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to read nodes');
      }
      return cloneForRpc(result.data || []);
    },
    'graph:getNode': ({ id }) => {
      requirePermission('graph.read');
      if (!id) {
        throw new Error('graph:getNode requires id');
      }
      const api = ensureGraphApi(getGraphApi);
      const result = api.readNode?.(id);
      if (!result?.success) {
        throw new Error(result?.error || `Failed to read node ${id}`);
      }
      return cloneForRpc(result.data);
    },
    'graph:getEdges': () => {
      requirePermission('graph.read');
      const api = ensureGraphApi(getGraphApi);
      const result = api.readEdge?.();
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to read edges');
      }
      return cloneForRpc(result.data || []);
    },
    'graph:getEdge': ({ id }) => {
      requirePermission('graph.read');
      if (!id) {
        throw new Error('graph:getEdge requires id');
      }
      const api = ensureGraphApi(getGraphApi);
      const result = api.readEdge?.(id);
      if (!result?.success) {
        throw new Error(result?.error || `Failed to read edge ${id}`);
      }
      return cloneForRpc(result.data);
    },
    'selection:get': () => {
      requirePermission('selection.read');
      return cloneForRpc(
        getSelectionState?.() || { nodeIds: [], edgeIds: [], groupIds: [] }
      );
    },
    'events:emit': ({ event, payload }) => {
      requirePermission('events.emit');
      if (!event || typeof event !== 'string') {
        throw new Error('events:emit requires an event name');
      }
      emitEvent(event, payload);
      return true;
    }
  };

  if (permissions.has('graph.write')) {
    methods['graph:updateNode'] = ({ id, updates }) => {
      if (!id) throw new Error('graph:updateNode requires id');
      const api = ensureGraphApi(getGraphApi);
      const result = api.updateNode?.(id, updates || {});
      if (!result?.success) {
        throw new Error(result?.error || `Failed to update node ${id}`);
      }
      return cloneForRpc(result.data);
    };
    methods['graph:updateEdge'] = ({ id, updates }) => {
      if (!id) throw new Error('graph:updateEdge requires id');
      const api = ensureGraphApi(getGraphApi);
      const result = api.updateEdge?.(id, updates || {});
      if (!result?.success) {
        throw new Error(result?.error || `Failed to update edge ${id}`);
      }
      return cloneForRpc(result.data);
    };
  }

  return methods;
};

const buildHostCapabilities = (hostMethods, plugin) => ({
  version: 1,
  hostMethods: Object.keys(hostMethods),
  permissions: Array.from(normalizePermissions(plugin))
});

export default class PluginRuntimeHost {
  constructor(pluginRecord, options = {}) {
    this.plugin = pluginRecord;
    this.options = {
      handshakeTimeoutMs: options.handshakeTimeoutMs || DEFAULT_HANDSHAKE_TIMEOUT,
      rpcTimeoutMs: options.rpcTimeoutMs || DEFAULT_RPC_TIMEOUT,
      getGraphApi: options.getGraphApi,
      getSelectionState: options.getSelectionState,
      emitEvent: options.emitEvent,
      onStatusChange: options.onStatusChange || noop,
      onTelemetry: options.onTelemetry || noop,
      hostMethods: options.hostMethods,
      sdkSource: options.sdkSource || PLUGIN_RUNTIME_SDK_SOURCE
    };

    this.status = 'idle';
    this.sessionToken = generateToken();
    this.pendingCalls = new Map();
    this.availableMethods = [];
    this.pluginCapabilities = null;
    this._handshakePromise = null;
    this._handshakeTimer = null;

    this.hostMethods =
      this.options.hostMethods ||
      buildDefaultHostMethods(this.plugin, {
        getGraphApi: this.options.getGraphApi,
        getSelectionState: this.options.getSelectionState,
        emitEvent: this.options.emitEvent
      });
    this.capabilities = buildHostCapabilities(this.hostMethods, this.plugin);

    this._handleWindowMessage = this._handleWindowMessage.bind(this);
    this._handleWorkerMessage = this._handleWorkerMessage.bind(this);
  }

  ensureReady() {
    if (this.status === 'ready' && this.availableMethods.length > 0) {
      return Promise.resolve({
        methods: this.availableMethods,
        capabilities: this.pluginCapabilities
      });
    }
    if (this._handshakePromise) {
      return this._handshakePromise;
    }
    this._handshakePromise = new Promise((resolve, reject) => {
      this._handshakeResolve = resolve;
      this._handshakeReject = reject;
    });
    this._startSandbox();
    return this._handshakePromise;
  }

  call(method, args = {}, timeout) {
    if (!method) {
      return Promise.reject(new Error('Method is required for plugin RPC'));
    }
    return this.ensureReady().then(() => {
      return new Promise((resolve, reject) => {
        const requestId = `rpc_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const timer = setTimeout(() => {
          this.pendingCalls.delete(requestId);
          reject(new Error(`RPC timeout for ${method}`));
        }, timeout || this.options.rpcTimeoutMs);
        this.pendingCalls.set(requestId, { resolve, reject, timer });
        this._postMessage({
          type: 'rpc:request',
          requestId,
          method,
          args
        });
      });
    });
  }

  reload() {
    this._teardownSandbox();
    this.status = 'idle';
    this.sessionToken = generateToken();
    this.availableMethods = [];
    this.pluginCapabilities = null;
    this._handshakePromise = null;
    return this.ensureReady();
  }

  updatePlugin(pluginRecord) {
    this.plugin = pluginRecord;
    if (!this.options.hostMethods) {
      this.hostMethods = buildDefaultHostMethods(this.plugin, {
        getGraphApi: this.options.getGraphApi,
        getSelectionState: this.options.getSelectionState,
        emitEvent: this.options.emitEvent
      });
      this.capabilities = buildHostCapabilities(this.hostMethods, this.plugin);
    }
  }

  destroy() {
    this._teardownSandbox();
    this.availableMethods = [];
    this.pluginCapabilities = null;
    this.pendingCalls.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject?.(new Error('Plugin runtime destroyed'));
    });
    this.pendingCalls.clear();
    this.status = 'destroyed';
  }

  // Internal helpers ---------------------------------------------------------

  _startSandbox() {
    if (typeof window === 'undefined') {
      this._fail('Sandbox cannot start on server');
      return;
    }
    const sandboxType =
      this.plugin?.manifest?.bundle?.sandbox || this.plugin?.bundle?.sandbox;
    this.status = 'loading';
    this.options.onStatusChange({
      pluginId: this.plugin?.id,
      status: 'loading'
    });
    const timeout = this.options.handshakeTimeoutMs;
    this._handshakeTimer = setTimeout(() => {
      this._fail('Handshake timed out');
    }, timeout);

    if (sandboxType === 'worker') {
      this._startWorkerSandbox();
    } else {
      this._startIframeSandbox();
    }
  }

  _startIframeSandbox() {
    const url = this._resolveBundleUrl();
    const integrity =
      this.plugin?.bundle?.integrity ||
      this.plugin?.manifest?.bundle?.integrity ||
      '';
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('aria-hidden', 'true');
    this.iframe.style.position = 'absolute';
    this.iframe.style.width = '0px';
    this.iframe.style.height = '0px';
    this.iframe.style.border = '0';
    this.iframe.style.left = '-10000px';
    this.iframe.style.top = '-10000px';
    this.iframe.sandbox = 'allow-scripts';
    this.iframe.referrerPolicy = 'no-referrer';
    this.iframe.onload = () => {
      setTimeout(() => {
        this._postMessage({
          type: 'handshake:probe',
          capabilities: this.capabilities,
          plugin: {
            id: this.plugin?.id,
            version: this.plugin?.version,
            permissions: Array.from(
              normalizePermissions(this.plugin || { permissions: [] })
            )
          }
        });
      }, 50);
    };
    this.iframe.onerror = (err) => {
      this._fail('Iframe sandbox error', err);
    };

    const baseHref = (() => {
      try {
        const parsed = new URL(url, window.location.origin);
        const dir = parsed.pathname.endsWith('/')
          ? parsed.pathname
          : parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1);
        parsed.pathname = dir;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
      } catch {
        return url;
      }
    })();

    const sdkTag = `<script>${this.options.sdkSource}</script>`;
    const scriptTag = `<script src="${url}"${
      integrity ? ` integrity="${integrity}" crossorigin="anonymous"` : ''
    }></script>`;
    const html = `<!DOCTYPE html><html><head><base href="${baseHref}" /></head><body>${sdkTag}${scriptTag}</body></html>`;
    this.iframe.srcdoc = html;
    window.addEventListener('message', this._handleWindowMessage);
    document.body.appendChild(this.iframe);
    this.options.onTelemetry({
      pluginId: this.plugin?.id,
      level: 'info',
      event: 'sandbox-created',
      type: 'iframe',
      url
    });
  }

  _startWorkerSandbox() {
    const url = this._resolveBundleUrl();
    const bootstrap = `
      const bundleUrl = ${JSON.stringify(url)};
      self.addEventListener('message', (event) => {
        // pass-through to bundle if it installed listeners
      });
      try {
        importScripts(bundleUrl);
      } catch (err) {
        self.postMessage({ type: 'telemetry', level: 'error', detail: String(err) });
      }
    `;
    const blob = new Blob([bootstrap], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(workerUrl, { name: `plugin:${this.plugin?.id}` });
    URL.revokeObjectURL(workerUrl);
    this.worker.addEventListener('message', this._handleWorkerMessage);
    this.worker.addEventListener('error', (err) => {
      this._fail('Worker runtime error', err);
    });
    this._postMessage({
      type: 'handshake:probe',
      capabilities: this.capabilities
    });
    this.options.onTelemetry({
      pluginId: this.plugin?.id,
      level: 'info',
      event: 'sandbox-created',
      type: 'worker',
      url
    });
  }

  _handleWindowMessage(event) {
    if (event.source !== this.iframe?.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.token !== this.sessionToken) {
      return;
    }
    this._handleRuntimeMessage(data, (response) => {
      try {
        event.source?.postMessage(
          { ...response, token: this.sessionToken },
          '*'
        );
      } catch (err) {
        console.error(DEFAULT_LOG_PREFIX, 'Failed to respond to iframe', err);
      }
    });
  }

  _handleWorkerMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object' || data.token !== this.sessionToken) {
      return;
    }
    this._handleRuntimeMessage(data, (response) => {
      try {
        this.worker?.postMessage({ ...response, token: this.sessionToken });
      } catch (err) {
        console.error(DEFAULT_LOG_PREFIX, 'Failed to respond to worker', err);
      }
    });
  }

  _handleRuntimeMessage(message, respond) {
    if (!message || typeof message !== 'object') return;
    switch (message.type) {
      case 'handshake':
        this._handleHandshake(message);
        break;
      case 'rpc:response':
        this._handleRpcResponse(message);
        break;
      case 'host:rpc':
        this._handleHostRpcRequest(message, respond);
        break;
      case 'telemetry':
        this.options.onTelemetry({
          pluginId: this.plugin?.id,
          level: message.level || 'info',
          event: message.event || 'telemetry',
          detail: message.detail
        });
        break;
      case 'sandbox:crash':
        this._fail('Plugin reported crash', message.detail);
        break;
      default:
        break;
    }
  }

  _handleHandshake(message) {
    if (!Array.isArray(message.methods)) {
      this._fail('Invalid handshake payload');
      return;
    }
    this.availableMethods = message.methods;
    this.pluginCapabilities = message.capabilities || null;
    this.status = 'ready';
    clearTimeout(this._handshakeTimer);
    this.options.onStatusChange({
      pluginId: this.plugin?.id,
      status: 'ready',
      methods: this.availableMethods
    });
    this.options.onTelemetry({
      pluginId: this.plugin?.id,
      level: 'info',
      event: 'handshake-success',
      methods: this.availableMethods
    });
    this._handshakeResolve?.({
      methods: this.availableMethods,
      capabilities: this.pluginCapabilities
    });
    this._handshakeResolve = null;
    this._handshakeReject = null;
    this._handshakePromise = null;
  }

  _handleRpcResponse(message) {
    const pending = this.pendingCalls.get(message.requestId);
    if (!pending) return;
    this.pendingCalls.delete(message.requestId);
    clearTimeout(pending.timer);
    if (message.ok === false || message.error) {
      pending.reject(new Error(message.error || 'Plugin RPC error'));
    } else {
      pending.resolve(message.result);
    }
  }

  async _handleHostRpcRequest(message, respond) {
    const { requestId, method, args } = message;
    if (!requestId || !method) return;
    const handler = this.hostMethods[method];
    if (!handler) {
      respond({
        type: 'host:response',
        requestId,
        ok: false,
        error: `host method ${method} not allowed`
      });
      return;
    }
    try {
      const result = await Promise.resolve(handler(args || {}));
      respond({
        type: 'host:response',
        requestId,
        ok: true,
        result
      });
    } catch (err) {
      respond({
        type: 'host:response',
        requestId,
        ok: false,
        error: err?.message || String(err)
      });
    }
  }

  _postMessage(payload) {
    const enriched = { ...payload, token: this.sessionToken };
    if (this.worker) {
      this.worker.postMessage(enriched);
    } else if (this.iframe?.contentWindow) {
      try {
        this.iframe.contentWindow.postMessage(enriched, '*');
      } catch (err) {
        console.warn(DEFAULT_LOG_PREFIX, 'Failed to post message', err);
      }
    }
  }

  _resolveBundleUrl() {
    const raw =
      this.plugin?.bundle?.url ||
      this.plugin?.manifest?.bundle?.url ||
      this.plugin?.manifestUrl ||
      '';
    if (!raw) {
      throw new Error('Plugin manifest missing bundle url');
    }
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    if (typeof window !== 'undefined' && window.location) {
      try {
        return new URL(raw, window.location.origin).toString();
      } catch {
        return raw;
      }
    }
    return raw;
  }

  _fail(message, detail) {
    clearTimeout(this._handshakeTimer);
    this.status = 'error';
    const error = detail instanceof Error ? detail : new Error(message);
    this.options.onStatusChange({
      pluginId: this.plugin?.id,
      status: 'error',
      error: error.message || message
    });
    this.options.onTelemetry({
      pluginId: this.plugin?.id,
      level: 'error',
      event: 'sandbox-error',
      detail: detail || message
    });
    this._handshakeReject?.(error);
    this._handshakeResolve = null;
    this._handshakeReject = null;
    this._handshakePromise = null;
    this.pendingCalls.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(error);
    });
    this.pendingCalls.clear();
    this._teardownSandbox();
  }

  _teardownSandbox() {
    clearTimeout(this._handshakeTimer);
    if (this.worker) {
      this.worker.removeEventListener('message', this._handleWorkerMessage);
      this.worker.terminate();
      this.worker = null;
    }
    if (this.iframe) {
      window.removeEventListener('message', this._handleWindowMessage);
      try {
        this.iframe.remove();
      } catch {
        if (this.iframe.parentNode) {
          this.iframe.parentNode.removeChild(this.iframe);
        }
      }
      this.iframe = null;
    }
  }
}
