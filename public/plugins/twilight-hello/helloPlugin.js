(function () {
  const pluginInfo = {
    id: 'com.Twilite.hello',
    version: '0.2.0'
  };

  const sdk = (typeof window !== 'undefined' ? window.NodeGraphPluginSDK : null) ||
    (typeof self !== 'undefined' ? self.NodeGraphPluginSDK : null);
  if (!sdk || typeof sdk.createPluginRuntime !== 'function') {
    console.error('[TwilitePlugin] Plugin SDK is not available');
    return;
  }

  const runtime = sdk.createPluginRuntime({
    capabilities: {
      runtime: 'Twilite-hello',
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
      type: 'Twilite-hello',
      label: 'Twilite Hello (runtime)',
      description: 'Returned from the running plugin bundle.',
      category: 'demo',
      icon: 'WavingHand',
      defaultWidth: 240,
      defaultHeight: 160,
      defaultData: {
        greeting: 'Hello, from the Twilite Zone!',
        tagline: 'Friendly signal from another dimension',
        mood: 'calm',
        emphasis: false
      },
      renderer: {
        entry: '/plugins/Twilite-hello/helloRenderer.js'
      },
      handles: {
        inputs: [{ id: 'trigger', label: 'Trigger', dataType: 'trigger' }],
        outputs: [{ id: 'greeting', label: 'Greeting', dataType: 'value' }]
      }
    },
    {
      type: 'Twilite-canvas',
      label: 'Twilite Canvas (runtime)',
      description: 'Canvas-rendered plugin node without host chrome.',
      category: 'advanced',
      icon: 'Gesture',
      defaultWidth: 220,
      defaultHeight: 140,
      defaultData: {
        style: 'wave',
        caption: 'Renderer Canvas Node',
        palette: ['#6C63FF', '#2CB67D', '#FFB020', '#FF5C8D']
      },
      handles: {
        inputs: [{ id: 'signal', label: 'Signal', dataType: 'value' }],
        outputs: [{ id: 'out', label: 'Out', dataType: 'value' }]
      },
      renderer: {
        entry: '/plugins/Twilite-hello/canvasRenderer.js'
      },
      extensions: {
        layout: {
          handleExtension: 4,
          hideChrome: true,
          padding: 0,
          paddingBottom: 0
        }
      }
    }
  ]);

  runtime.registerMethod('plugin:ping', () => 'Twilite-pong');
})();
