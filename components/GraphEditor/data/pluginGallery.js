export const pluginGallery = [
  {
    id: 'com.Twilite.hello',
    name: 'Twilite Hello',
    description: 'Ships with two sample nodes: a greeting card and a renderer-only canvas node identical to the native CanvasNode.',
    manifestUrl: '/plugins/Twilite-hello/manifest.json',
    version: '0.2.0',
    tags: ['demo', 'starter', 'canvas'],
    maintainer: 'Twilite Lab',
    permissions: ['graph.read', 'selection.read'],
    status: 'beta',
    homepage: 'https://example.com/Twilite'
  },
  {
    id: 'io.breadboard.sockets',
    name: 'Breadboard Socket Toolkit',
    description: 'Provides the socket nodes and renderer used by the breadboard template so anyone can build their own board.',
    manifestUrl: '/plugins/breadboard-sockets/manifest.json?v=1',
    version: '0.1.0',
    tags: ['breadboard', 'hardware'],
    maintainer: 'NodeGraph',
    permissions: [],
    status: 'stable',
    homepage: 'https://example.com/breadboard'
  }
  ,
  {
    id: 'io.breadboard.components',
    name: 'Breadboard Component Pack',
    description: 'Contains resistor, LED, and jumper nodes for building the starter circuit.',
    manifestUrl: '/plugins/breadboard-components/manifest.json?v=1',
    version: '0.1.0',
    tags: ['breadboard', 'components'],
    maintainer: 'NodeGraph',
    permissions: [],
    status: 'beta',
    homepage: 'https://example.com/breadboard'
  }
];

export default pluginGallery;
