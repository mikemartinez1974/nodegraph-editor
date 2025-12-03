"use client";

// Inline copies of the plugin SDK helpers. These are injected directly into
// sandboxed iframes so plugins/renderers always receive the bridge even if the
// external /plugins/sdk/*.js assets fail to load (for example when using
// srcdoc iframes in development).

export const NODE_RENDERER_SDK_SOURCE = `(function initNodeGraphPluginRenderer(globalContext) {
  const root =
    globalContext ||
    (typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
      ? self
      : undefined);
  if (!root) return;

  const createRenderer = (options = {}) => {
    if (typeof options.render !== 'function') {
      throw new Error('[NodeGraphPluginRenderer] render(options) callback is required');
    }
    const render = options.render;
    const onError = typeof options.onError === 'function' ? options.onError : null;
    const onReady = typeof options.onReady === 'function' ? options.onReady : null;
    const autoHeight = options.autoHeight !== false;

    let sessionToken = null;
    let latestPayload = null;

    const postMessage = (payload) => {
      if (!sessionToken) return;
      try {
        root.parent.postMessage({ ...payload, token: sessionToken }, '*');
      } catch (err) {
        console.error('[NodeGraphPluginRenderer] Failed to post message', err);
      }
    };

    const emitReady = () => {
      postMessage({ type: 'renderer:ready' });
      if (onReady) {
        try {
          onReady(latestPayload);
        } catch (err) {
          console.error('[NodeGraphPluginRenderer] onReady error', err);
        }
      }
    };

    const emitError = (error) => {
      const message = typeof error === 'string' ? error : error?.message || 'Renderer error';
      postMessage({ type: 'renderer:error', error: message });
      if (onError) {
        try {
          onError(message);
        } catch (err) {
          console.error('[NodeGraphPluginRenderer] onError callback failed', err);
        }
      }
    };

    const updateHeight = () => {
      if (!autoHeight) return;
      try {
        const height = document.body?.scrollHeight || document.documentElement?.scrollHeight;
        if (height) {
          postMessage({ type: 'renderer:height', height });
        }
      } catch (err) {
        /* ignore */
      }
    };

    const handlePayload = (payload) => {
      latestPayload = payload;
      try {
        render(payload, {
          updateHeight,
          emitEvent: (event, detail) => postMessage({ type: 'renderer:event', event, detail })
        });
        updateHeight();
      } catch (err) {
        emitError(err);
      }
    };

    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'node:init') {
        sessionToken = msg.token;
        handlePayload(msg.payload || {});
        emitReady();
        return;
      }
      if (msg.token !== sessionToken) return;
      if (msg.type === 'node:update') {
        handlePayload(msg.payload || {});
        return;
      }
    };

    root.addEventListener('message', handleMessage);
    postMessage({ type: 'renderer:hello' });

    return {
      destroy() {
        root.removeEventListener('message', handleMessage);
      }
    };
  };

  root.NodeGraphPluginRenderer = {
    createRenderer
  };
})(typeof window !== 'undefined' ? window : undefined);`;

export const PLUGIN_RUNTIME_SDK_SOURCE = `(function initNodeGraphPluginSDK(globalContext) {
  const root =
    globalContext ||
    (typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
      ? self
      : typeof globalThis !== 'undefined'
      ? globalThis
      : {});
  if (!root) return;

  const isWorkerContext = typeof document === 'undefined';

  function createPluginRuntime(config = {}) {
    const allowedOrigins = Array.isArray(config.allowedOrigins)
      ? config.allowedOrigins.filter(Boolean)
      : null;
    const methods = { ...(config.methods || {}) };
    const pendingHostCalls = new Map();
    let hostTarget = null;
    let hostOrigin = '*';
    let sessionToken = null;

    const cleanupPending = (errorMessage) => {
      pendingHostCalls.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(new Error(errorMessage || 'Plugin runtime stopped'));
      });
      pendingHostCalls.clear();
    };

    const postToHost = (payload) => {
      const message = { ...payload, token: sessionToken };
      if (isWorkerContext) {
        root.postMessage(message);
      } else if (hostTarget) {
        hostTarget.postMessage(message, hostOrigin || '*');
      } else if (root.parent && root.parent !== root) {
        root.parent.postMessage(message, hostOrigin || '*');
      }
    };

    const callHost = (method, args = {}, timeout = 5000) => {
      if (!method) {
        return Promise.reject(new Error('Host RPC requires a method name'));
      }
      const requestId = \`host_\${Date.now().toString(36)}_\${Math.random()
        .toString(36)
        .slice(2, 7)}\`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingHostCalls.delete(requestId);
          reject(new Error(\`Host RPC timeout: \${method}\`));
        }, timeout);
        pendingHostCalls.set(requestId, { resolve, reject, timer });
        postToHost({
          type: 'host:rpc',
          requestId,
          method,
          args
        });
      });
    };

    // compatibility proxy: expose a lightweight window.graphAPI in the sandbox
    // so legacy code that expects window.graphAPI can operate via secure RPC.
    const setupGraphApiProxy = () => {
      try {
        const graphApiProxy = {
          getNodes: (...args) => callHost('graph:getNodes', { args }),
          getNode: (...args) => callHost('graph:getNode', { args }),
          getEdges: (...args) => callHost('graph:getEdges', { args }),
          getEdge: (...args) => callHost('graph:getEdge', { args }),
          createNode: (...args) => callHost('graph:createNode', { args }),
          updateNode: (...args) => callHost('graph:updateNode', { args }),
          deleteNode: (...args) => callHost('graph:deleteNode', { args }),
          createEdge: (...args) => callHost('graph:createEdge', { args }),
          deleteEdge: (...args) => callHost('graph:deleteEdge', { args })
        };
        // expose as root.graphAPI to mimic older integrations
        try { root.graphAPI = graphApiProxy; } catch (e) { /* ignore */ }
      } catch (e) {
        /* ignore */
      }
    };

    const handleMessage = (event) => {
      if (allowedOrigins && allowedOrigins.length > 0) {
        const origin = event.origin || (event.target && event.target.origin);
        if (origin && !allowedOrigins.includes(origin)) {
          return;
        }
      }

      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (!isWorkerContext && event.source && event.source !== root && event.source !== hostTarget) {
        hostTarget = event.source;
        hostOrigin = event.origin || hostOrigin;
      }

      if (msg.type === 'handshake:probe') {
        sessionToken = msg.token;
        if (!isWorkerContext && event.origin) {
          hostOrigin = event.origin;
        }
        if (typeof config.onHandshake === 'function') {
          try {
            config.onHandshake(msg);
          } catch {
            /* ignore */
          }
        }
        // expose compatibility proxy once handshake establishes channel
        setupGraphApiProxy();
        postToHost({
          type: 'handshake',
          methods: Object.keys(methods),
          capabilities: config.capabilities || {}
        });
        return;
      }

      if (sessionToken && msg.token && msg.token !== sessionToken) {
        return;
      }

      if (msg.type === 'rpc:request' && msg.requestId) {
        const handler = methods[msg.method];
        if (!handler) {
          postToHost({
            type: 'rpc:response',
            requestId: msg.requestId,
            ok: false,
            error: \`Unknown method: \${msg.method}\`
          });
          return;
        }
        Promise.resolve()
          .then(() => handler(msg.args || {}))
          .then((result) => {
            postToHost({
              type: 'rpc:response',
              requestId: msg.requestId,
              ok: true,
              result
            });
          })
          .catch((err) => {
            postToHost({
              type: 'rpc:response',
              requestId: msg.requestId,
              ok: false,
              error: err?.message || 'Plugin error'
            });
          });
        return;
      }

      if (msg.type === 'host:response' && msg.requestId) {
        const pending = pendingHostCalls.get(msg.requestId);
        if (!pending) return;
        pendingHostCalls.delete(msg.requestId);
        clearTimeout(pending.timer);
        if (msg.ok === false || msg.error) {
          pending.reject(new Error(msg.error || 'Host RPC error'));
        } else {
          pending.resolve(msg.result);
        }
      }
    };

    const registerMethod = (name, fn) => {
      if (!name || typeof fn !== 'function') {
        throw new Error('registerMethod requires a name and function');
      }
      methods[name] = fn;
    };

    const emitTelemetry = (detail, level = 'info') => {
      postToHost({
        type: 'telemetry',
        level,
        detail
      });
    };

    const emitEvent = (eventName, payload) => {
      return callHost('events:emit', { event: eventName, payload });
    };

    root.addEventListener('message', handleMessage);

    const destroy = () => {
      root.removeEventListener('message', handleMessage);
      cleanupPending('Plugin runtime destroyed');
    };

    return {
      registerMethod,
      callHost,
      emitTelemetry,
      emitEvent,
      destroy,
      getSessionToken: () => sessionToken
    };
  }

  root.NodeGraphPluginSDK = {
    createPluginRuntime
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : undefined);`;

export default PLUGIN_RUNTIME_SDK_SOURCE;
