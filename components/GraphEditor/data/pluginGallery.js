export const pluginGallery = [
  {
    id: 'com.twilight.hello',
    name: 'Twilight Hello',
    description: 'Sample plugin that ships with the repo and demonstrates the sandbox runtime, declarative node definitions, and SDK usage.',
    manifestUrl: '/plugins/twilight-hello/manifest.json',
    version: '0.1.0',
    tags: ['demo', 'starter'],
    maintainer: 'Twilight Lab',
    permissions: ['graph.read', 'selection.read'],
    status: 'beta',
    homepage: 'https://example.com/twilight'
  },
  {
    id: 'com.example.signal',
    name: 'Signal Inspector',
    description: 'Visualize trigger frequencies, latencies, and recent payloads for any edge to help debug complex graphs.',
    manifestUrl: 'https://plugins.example.com/signal-inspector/manifest.json',
    version: '1.2.3',
    tags: ['observability', 'monitoring'],
    maintainer: 'Example Labs',
    permissions: ['graph.read', 'selection.read', 'events.emit'],
    status: 'stable',
    homepage: 'https://plugins.example.com/signal-inspector'
  },
  {
    id: 'com.example.automation',
    name: 'Automation Toolkit',
    description: 'Adds cron-style schedulers, HTTP webhooks, and templated notifications as drop-in plugin nodes.',
    manifestUrl: 'https://plugins.example.com/automation/manifest.json',
    version: '0.9.0',
    tags: ['automation', 'trigger'],
    maintainer: 'Example Labs',
    permissions: ['graph.read', 'graph.write'],
    status: 'alpha',
    homepage: 'https://plugins.example.com/automation'
  }
];

export default pluginGallery;
