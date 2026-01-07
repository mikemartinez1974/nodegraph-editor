export const TEMPLATE_GALLERY = [
  {
    id: 'intro-tour',
    title: 'Getting Started Tour',
    description: 'A guided walk-through of the NodeGraph editor with onboarding checkpoints and helper tips.',
    href: 'https://cpwith.me/data/IntroGraph.node',
    preview: '/data/TutorialScreenshot1.png',
    tags: ['onboarding', 'beginner', 'docs'],
    estimatedTime: '5 min',
    publisher: 'Twilite Node Browser'
  },
  {
    id: 'automation-starter',
    title: 'Automation Starter',
    description: 'Template for a simple three-step automation: trigger, action, and follow-up QA.',
    href: '/data/AutomationStarter.node',
    preview: '/background%20art/4.png',
    tags: ['automation', 'ops', 'beginner'],
    estimatedTime: '3 min',
    publisher: 'Internal Library'
  },
  {
    id: 'customer-journey',
    title: 'Customer Journey Map',
    description: 'Map awareness, activation, retention, and advocacy touchpoints with suggested metrics.',
    href: '/data/CustomerJourneyMap.node',
    preview: '/background%20art/8.png',
    tags: ['marketing', 'strategy', 'teams'],
    estimatedTime: '6 min',
    publisher: 'Internal Library'
  },
  {
    id: 'realtime-ops',
    title: 'Realtime Ops Dashboard',
    description: 'Combine metrics ingest, alerting, and incident workflows into a unified operations cockpit.',
    href: '/data/RealtimeOpsDashboard.node',
    preview: '/background%20art/background11.jpg',
    tags: ['operations', 'monitoring', 'advanced'],
    estimatedTime: '7 min',
    publisher: 'Internal Library'
  }
];

export const TEMPLATE_TAGS = Array.from(
  TEMPLATE_GALLERY.reduce((acc, template) => {
    (template.tags || []).forEach(tag => acc.add(tag));
    return acc;
  }, new Set())
).sort();
