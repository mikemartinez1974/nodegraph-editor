(function () {
  const pluginInfo = {
    id: 'com.twilight.hello',
    version: '0.1.0'
  };

  const sdk = (typeof window !== 'undefined' ? window.NodeGraphPluginSDK : null) ||
    (typeof self !== 'undefined' ? self.NodeGraphPluginSDK : null);
  if (!sdk || typeof sdk.createPluginRuntime !== 'function') {
    console.error('[TwilightPlugin] Plugin SDK is not available');
    return;
  }

  const runtime = sdk.createPluginRuntime({
    capabilities: {
      runtime: 'twilight-hello',
      version: pluginInfo.version
    }
  });

  runtime.registerMethod('plugin:getInfo', async () => {
    let selection = null;
    try {
      selection = await runtime.callHost('selection:get');
    } catch (err) {
      selection = { error: err?.message || 'selection unavailable' };
    }
    return { ...pluginInfo, selection };
  });

  runtime.registerMethod('plugin:listNodes', () => [
    {
      type: 'twilight-hello',
      label: 'Twilight Hello (runtime)',
      description: 'Returned from the running plugin bundle.',
      category: 'demo',
      icon: 'WavingHand'
    }
  ]);

  runtime.registerMethod('plugin:ping', () => 'twilight-pong');
})();
