export const pluginGallery = [
  {
    id: 'com.twilight.hello',
    name: 'Twilight Hello',
    description: 'Ships with two sample nodes: a greeting card and a renderer-only canvas node identical to the native CanvasNode.',
    manifestUrl: '/plugins/twilight-hello/manifest.json',
    version: '0.2.0',
    tags: ['demo', 'starter', 'canvas'],
    maintainer: 'Twilight Lab',
    permissions: ['graph.read', 'selection.read'],
    status: 'beta',
    homepage: 'https://example.com/twilight'
  },
  {
    id: 'io.breadboard.sockets',
    name: 'Breadboard Socket Toolkit',
    description: 'Provides the socket nodes and renderer used by the breadboard template so anyone can build their own board.',
    manifestUrl: '/plugins/breadboard-sockets/manifest.json',
    version: '0.1.0',
    tags: ['breadboard', 'hardware'],
    maintainer: 'NodeGraph',
    permissions: [],
    status: 'stable',
    homepage: 'https://example.com/breadboard'
  }
];

export default pluginGallery;
