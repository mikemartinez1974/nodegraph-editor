(function () {
  const sdk =
    (typeof window !== 'undefined' ? window.NodeGraphPluginSDK : null) ||
    (typeof self !== 'undefined' ? self.NodeGraphPluginSDK : null);
  if (!sdk || typeof sdk.createPluginRuntime !== 'function') {
    console.error('[BreadboardSocketPlugin] SDK not available');
    return;
  }

  const PLUGIN_ID = 'io.breadboard.sockets';
  const VERSION = '0.1.0';

  const runtime = sdk.createPluginRuntime({
    capabilities: {
      runtime: 'breadboard-sockets',
      version: VERSION
    }
  });

  runtime.registerMethod('plugin:getInfo', async () => ({
    id: PLUGIN_ID,
    version: VERSION
  }));

  runtime.registerMethod('plugin:listNodes', () => {
    // Manifest already declares the socket node; returning [] keeps things simple.
    return [];
  });

  runtime.registerMethod('plugin:ping', () => 'breadboard-socket-pong');
})();
