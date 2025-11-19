(function () {
  const pluginInfo = {
    id: 'com.twilight.hello',
    version: '0.2.0'
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
      icon: 'WavingHand',
      defaultWidth: 240,
      defaultHeight: 160,
      defaultData: {
        greeting: 'Hello, from the Twilight Zone!',
        tagline: 'Friendly signal from another dimension',
        mood: 'calm',
        emphasis: false
      },
      renderer: {
        entry: '/plugins/twilight-hello/helloRenderer.js'
      },
      handles: {
        inputs: [{ id: 'trigger', label: 'Trigger', dataType: 'trigger' }],
        outputs: [{ id: 'greeting', label: 'Greeting', dataType: 'value' }]
      }
    },
    {
      type: 'twilight-canvas',
      label: 'Twilight Canvas (runtime)',
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
        entry: '/plugins/twilight-hello/canvasRenderer.js'
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

  runtime.registerMethod('plugin:ping', () => 'twilight-pong');
})();
