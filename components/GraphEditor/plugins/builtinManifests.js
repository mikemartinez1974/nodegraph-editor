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
        defaultWidth: 24,
        defaultHeight: 54,
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
      },
      {
        type: 'railSocket',
        label: 'Rail Socket',
        description: 'Single column of power-rail sockets (two connected holes).',
        category: 'breadboard',
        icon: 'FlashOn',
        entry: '/plugins/breadboard-sockets/socketPlugin.js#RailSocketNode',
        defaultWidth: 24,
        defaultHeight: 44,
        defaultData: {
          channel: 'top',
          column: 1,
          rails: [
            { railId: 'rail-top-negative', polarity: 'negative', label: 'GND', slot: 0 },
            { railId: 'rail-top-positive', polarity: 'positive', label: 'V+', slot: 1 }
          ]
        },
        handles: {
          outputs: [
            { id: 'positive', label: 'V+', dataType: 'value' },
            { id: 'negative', label: 'GND', dataType: 'value' }
          ]
        },
        renderer: {
          entry: '/plugins/breadboard-sockets/railSocketRenderer.js'
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
