(function initNodeGraphPluginSDK(globalContext) {
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
      const requestId = `host_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingHostCalls.delete(requestId);
          reject(new Error(`Host RPC timeout: ${method}`));
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
            error: `Unknown method: ${msg.method}`
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
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : undefined);
