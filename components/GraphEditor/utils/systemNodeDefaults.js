const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
};

const nowIso = () => new Date().toISOString();

export const createDefaultManifestNode = ({ kind = 'graph' } = {}) => {
  const now = nowIso();
  return {
    id: makeId(),
    label: 'Manifest',
    type: 'manifest',
    position: { x: -260, y: -160 },
    width: 360,
    height: 220,
    data: {
      identity: {
        graphId: makeId(),
        name: 'Untitled Graph',
        version: '0.1.0',
        description: '',
        createdAt: now,
        updatedAt: now
      },
      intent: {
        kind,
        scope: 'mixed'
      },
      dependencies: {
        nodeTypes: ['manifest', 'legend', 'dictionary', 'default', 'markdown'],
        portContracts: ['core'],
        skills: [],
        schemaVersions: {
          nodes: '>=1.0.0',
          ports: '>=1.0.0'
        },
        optional: []
      },
      authority: {
        mutation: {
          allowCreate: true,
          allowUpdate: true,
          allowDelete: true,
          appendOnly: false
        },
        actors: {
          humans: true,
          agents: true,
          tools: true
        },
        styleAuthority: 'descriptive',
        history: {
          rewriteAllowed: false,
          squashAllowed: false
        }
      },
      document: {
        url: ''
      },
      settings: {
        theme: null,
        backgroundImage: null,
        defaultNodeColor: '#1976d2',
        defaultEdgeColor: '#666666',
        snapToGrid: false,
        gridSize: 20,
        edgeRouting: 'auto',
        layout: null,
        github: {
          repo: '',
          path: '',
          branch: 'main'
        },
        autoSave: false
      }
    }
  };
};

export const createDefaultLegendNode = () => ({
  id: makeId(),
  label: 'Legend',
  type: 'legend',
  position: { x: 140, y: 100 },
  width: 340,
  height: 220,
  data: {
    entries: [
      {
        key: 'default',
        intent: 'placeholder',
        implementation: 'default renderer',
        dictionaryKey: 'default'
      }
    ],
    markdown: '## Legend\\n- default: placeholder'
  }
});

export const createDefaultDictionaryNode = () => ({
  id: makeId(),
  label: 'Dictionary',
  type: 'dictionary',
  position: { x: -260, y: 100 },
  width: 320,
  height: 220,
  data: {
    nodeDefs: [],
    skills: [],
    views: []
  }
});

export const findSystemNode = (nodes = [], type) => {
  if (!Array.isArray(nodes)) return null;
  return nodes.find((node) => node?.type === type) || null;
};
