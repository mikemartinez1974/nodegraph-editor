export const BUILTIN_PLUGIN_MANIFESTS = [
  {
    id: 'io.breadboard.sockets',
    version: '0.1.1',
    name: 'Breadboard Socket Toolkit',
    description: 'Provides socket nodes for the breadboard template.',
    permissions: [],
    bundle: {
      url: '/plugins/breadboard-sockets/socketPlugin.js',
      sandbox: 'iframe',
      integrity: ''
    },
    nodes: [
      {
        type: 'socket',
        label: 'Breadboard Socket',
        description: 'Locked column of breadboard holes used in breadboard templates.',
        category: 'breadboard',
        icon: 'FiberManualRecord',
        entry: '/plugins/breadboard-sockets/socketPlugin.js#SocketNode',
        defaultWidth: 10,
        defaultHeight: 18,
        defaultData: {
          rows: ['A', 'B', 'C', 'D', 'E'],
          column: 1,
          segment: 'top'
        },
        handles: {
          outputs: [
            { id: 'socket', label: 'Socket', dataType: 'value' }
          ]
        },
        renderer: {
          entry: '/plugins/breadboard-sockets/socketRenderer.js'
        },
        extensions: {
          layout: { hideChrome: true }
        }
      }
    ],
    metadata: {
      author: { name: 'NodeGraph' },
      homepage: 'https://example.com/breadboard',
      license: 'MIT'
    }
  }
];

export default BUILTIN_PLUGIN_MANIFESTS;
