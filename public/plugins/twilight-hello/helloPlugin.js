(function () {
  const pluginInfo = {
    id: 'com.twilight.hello',
    version: '0.1.0'
  };

  const helloNodeDefinition = {
    type: 'twilight-hello',
    label: 'Twilight Hello',
    description: 'A sample plugin node that waves hello from the Twilight Zone.',
    handles: {
      inputs: [{ id: 'trigger', label: 'Trigger', direction: 'input', dataType: 'trigger' }],
      outputs: [{ id: 'greeting', label: 'Greeting', direction: 'output', dataType: 'value' }]
    },
    defaultData: {
      greeting: 'Hello, from the Twilight Zone!'
    }
  };

  let hostWindow = null;
  let hostOrigin = '*';
  let sessionToken = null;
  const pendingHostRequests = new Map();

  const postToHost = (payload, targetOrigin) => {
    if (!hostWindow) return;
    let origin = targetOrigin;
    if (!origin) {
      // Only allow sending if hostOrigin is a valid, specific origin
      if (
        !hostOrigin ||
        hostOrigin === '*' ||
        hostOrigin === 'null'
      ) {
        console.warn(
          '[twilight-hello] Refusing to postMessage: hostOrigin is not set to a specific origin.',
          { payload, hostOrigin }
        );
        return;
      }
      origin = hostOrigin;
    }
    hostWindow.postMessage({ ...payload, token: sessionToken }, origin);
  };

  const callHost = (method, args = {}, timeout = 4000) => {
    if (!method) return Promise.reject(new Error('Host RPC requires method'));
    const requestId = `host_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingHostRequests.delete(requestId);
        reject(new Error(`Host RPC timeout: ${method}`));
      }, timeout);
      pendingHostRequests.set(requestId, { resolve, reject, timer });
      postToHost({
        type: 'host:rpc',
        requestId,
        method,
        args
      });
    });
  };

  const methods = {
    'plugin:getInfo': async () => {
      let selection = null;
      try {
        selection = await callHost('selection:get');
      } catch (err) {
        selection = { error: err?.message || 'selection unavailable' };
      }
      return { ...pluginInfo, selection };
    },
    'plugin:listNodes': () => [helloNodeDefinition],
    'plugin:ping': () => 'twilight-pong'
  };

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (event.source && event.source !== window && event.source !== hostWindow) {
      hostWindow = event.source;
      hostOrigin = event.origin || '*';
    }

    if (msg.type === 'handshake:probe') {
      sessionToken = msg.token;
      postToHost({
        type: 'handshake',
        methods: Object.keys(methods),
        capabilities: {
          runtime: 'twilight-hello',
          version: pluginInfo.version
        }
      });
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
      const pending = pendingHostRequests.get(msg.requestId);
      if (!pending) return;
      pendingHostRequests.delete(msg.requestId);
      clearTimeout(pending.timer);
      if (msg.ok === false || msg.error) {
        pending.reject(new Error(msg.error || 'Host RPC error'));
      } else {
        pending.resolve(msg.result);
      }
    }
  });
})();
