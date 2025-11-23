(function () {
  const sdk =
    (typeof window !== 'undefined' ? window.NodeGraphPluginSDK : null) ||
    (typeof self !== 'undefined' ? self.NodeGraphPluginSDK : null);
  if (!sdk || typeof sdk.createPluginRuntime !== 'function') {
    console.error('[BreadboardComponentPlugin] SDK not available');
    return;
  }

  const PLUGIN_ID = 'io.breadboard.components';
  const VERSION = '0.1.0';

  const runtime = sdk.createPluginRuntime({
    capabilities: {
      runtime: 'breadboard-components',
      version: VERSION
    }
  });

  runtime.registerMethod('plugin:getInfo', async () => ({
    id: PLUGIN_ID,
    version: VERSION
  }));

  runtime.registerMethod('plugin:listNodes', () => []);
  runtime.registerMethod('plugin:ping', () => 'breadboard-components-pong');
})();
