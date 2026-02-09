export const BUILTIN_PLUGIN_MANIFESTS = [
  {
    id: 'io.breadboard.sockets',
    version: '0.1.4',
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
        ports: {
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
        ports: {
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
      ,
      {
        type: 'skin',
        label: 'Breadboard Skin',
        description: 'Visual baseplate template art that sits under the socket/rail nodes.',
        category: 'breadboard',
        icon: 'GridOn',
        entry: '/plugins/breadboard-sockets/socketPlugin.js#BoardSkinNode',
        defaultWidth: 780,
        defaultHeight: 360,
        defaultData: {
          rows: 10,
          columns: 30,
          rowPitch: 1,
          columnPitch: 1,
          railInset: 32,
          railThickness: 24,
          gapHeight: 96
        },
        renderer: {
          entry: '/plugins/breadboard-sockets/skinRenderer.js'
        },
        extensions: {
          layout: {
            hideChrome: true,
            padding: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0
          }
        }
      },
      {
        type: 'bus',
        label: 'Breadboard Bus',
        description: 'Invisible node that represents the continuous rail net.',
        category: 'breadboard',
        icon: 'CallSplit',
        entry: '/plugins/breadboard-sockets/socketPlugin.js#BusNode',
        defaultWidth: 28,
        defaultHeight: 20,
        defaultData: {
          channel: 'top',
          polarity: 'positive'
        },
        ports: {
          outputs: [
            { id: 'positive', label: 'V+', dataType: 'value' },
            { id: 'negative', label: 'GND', dataType: 'value' }
          ]
        },
        renderer: {
          entry: '/plugins/breadboard-sockets/busRenderer.js'
        },
        extensions: {
          layout: {
            hideChrome: true,
            padding: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0
          }
        }
      }
    ],
    metadata: {
      author: { name: 'NodeGraph' },
      homepage: 'https://example.com/breadboard',
      license: 'MIT'
    }
  }
  ,
  {
    id: 'io.breadboard.components',
    version: '0.1.0',
    name: 'Breadboard Component Pack',
    description: 'Provides resistor, LED, and jumper nodes tailored for the breadboard template.',
    permissions: [],
    bundle: {
      url: '/plugins/breadboard-components/componentPlugin.js',
      sandbox: 'iframe',
      integrity: ''
    },
    nodes: [
      {
        type: 'resistor',
        label: 'Resistor',
        description: 'Simple two-pin resistor node with breadboard pin metadata.',
        category: 'breadboard',
        icon: 'SettingsEthernet',
        entry: '/plugins/breadboard-components/componentPlugin.js#ResistorNode',
        defaultWidth: 32,
        defaultHeight: 18,
        defaultData: {
          pins: [
            { id: 'pinA', row: 'A', column: null, polarity: 'neutral', columnOffset: 0 },
            { id: 'pinB', row: 'A', column: null, polarity: 'neutral', columnOffset: 1 }
          ],
          footprint: { rows: 1, columns: 2, rowPitch: 1, columnPitch: 1, width: 2, height: 1 }
        },
        ports: {
          outputs: [
            { id: 'pinA', label: 'Pin A', dataType: 'value' },
            { id: 'pinB', label: 'Pin B', dataType: 'value' }
          ]
        },
        renderer: {
          entry: '/plugins/breadboard-components/resistorRenderer.js'
        },
        extensions: {
          layout: { hideChrome: true, padding: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 }
        }
      },
      {
        type: 'led',
        label: 'LED',
        description: 'Polarized LED node with anode/cathode ports.',
        category: 'breadboard',
        icon: 'LightMode',
        entry: '/plugins/breadboard-components/componentPlugin.js#LEDNode',
        defaultWidth: 140,
        defaultHeight: 60,
        defaultData: {
          pins: [
            { id: 'anode', row: 'A', column: null, columnOffset: 0, polarity: 'anode', segmentPreference: 'top' },
            { id: 'cathode', row: 'F', column: null, columnOffset: 0, polarity: 'cathode', segmentPreference: 'bottom' }
          ],
          footprint: { rows: 2, columns: 1, rowPitch: 1, columnPitch: 1, width: 1, height: 2 }
        },
        ports: {
          outputs: [
            { id: 'anode', label: 'Anode', dataType: 'value' },
            { id: 'cathode', label: 'Cathode', dataType: 'value' }
          ]
        },
        renderer: {
          entry: '/plugins/breadboard-components/ledRenderer.js'
        },
        extensions: {
          layout: { hideChrome: true, padding: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 }
        }
      },
      {
        type: 'jumper',
        label: 'Jumper Wire',
        description: 'Flexible jumper that connects two sockets or rails.',
        category: 'breadboard',
        icon: 'CallSplit',
        entry: '/plugins/breadboard-components/componentPlugin.js#JumperNode',
        defaultWidth: 120,
        defaultHeight: 48,
        defaultData: {
          pins: [
            { id: 'wireA', row: 'E', column: 1, polarity: 'neutral' },
            { id: 'wireB', row: 'G', column: 1, polarity: 'neutral' }
          ],
          footprint: { rows: 1, columns: 2, rowPitch: 1, columnPitch: 1, width: 2, height: 1 }
        },
        ports: {
          outputs: [
            { id: 'wireA', label: 'Wire A', dataType: 'value' },
            { id: 'wireB', label: 'Wire B', dataType: 'value' }
          ]
        },
        renderer: {
          entry: '/plugins/breadboard-components/jumperRenderer.js'
        },
        extensions: {
          layout: { hideChrome: true, padding: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 }
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
