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

  const methods = {
    'plugin:getInfo': () => pluginInfo,
    'plugin:listNodes': () => [helloNodeDefinition],
    'plugin:ping': () => 'twilight-pong'
  };

  const respond = (event, payload) => {
    if (!event.source) return;
    event.source.postMessage(payload, event.origin);
  };

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    const token = msg.token;

    if (msg.type === 'handshake:probe') {
      respond(event, {
        type: 'handshake',
        methods: Object.keys(methods),
        token
      });
      return;
    }

    if (msg.type === 'rpc:call' && msg.requestId && methods[msg.method]) {
      try {
        const result = methods[msg.method](msg.args || {});
        respond(event, {
          type: 'rpc:response',
          requestId: msg.requestId,
          result,
          token
        });
      } catch (err) {
        respond(event, {
          type: 'rpc:response',
          requestId: msg.requestId,
          error: err?.message || 'Plugin error',
          token
        });
      }
    }
  });
})();
