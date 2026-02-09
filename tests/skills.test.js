import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { attachSkills } from '../hooks/skills/index.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const mergeShallow = (target, patch = {}) => {
  const next = { ...target };
  Object.keys(patch).forEach((key) => {
    const value = patch[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = { ...(target[key] || {}), ...clone(value) };
    } else {
      next[key] = clone(value);
    }
  });
  return next;
};

function createGraphApiFixture({ nodes = [], edges = [], groups = [] } = {}) {
  const state = {
    nodes: clone(nodes),
    edges: clone(edges),
    clusters: clone(groups)
  };

  const findNodeIndex = (id) => state.nodes.findIndex((node) => node.id === id);
  const findEdgeIndex = (id) => state.edges.findIndex((edge) => edge.id === id);
  const findGroupIndex = (id) => state.clusters.findIndex((group) => group.id === id);

  const ensureNode = (id) => {
    const index = findNodeIndex(id);
    if (index === -1) {
      throw new Error(`Node ${id} not found`);
    }
    return { node: state.nodes[index], index };
  };

  const ensureGroup = (id) => {
    const index = findGroupIndex(id);
    if (index === -1) {
      throw new Error(`Group ${id} not found`);
    }
    return { group: state.clusters[index], index };
  };

  let copyCounter = 0;

  const api = {
    getNodes: () => clone(state.nodes),
    getEdges: () => clone(state.edges),
    getGroups: () => clone(state.clusters),
    createNodes: (nodesToCreate = []) => {
      const created = nodesToCreate.map((node) => {
        const next = clone(node);
        state.nodes.push(next);
        return clone(next);
      });
      return { success: true, data: { created } };
    },
    createEdges: (edgesToCreate = []) => {
      const created = edgesToCreate.map((edge) => {
        const next = clone(edge);
        state.edges.push(next);
        return clone(next);
      });
      return { success: true, data: { created } };
    },
    createEdge: (edge) => {
      const next = clone(edge);
      state.edges.push(next);
      return { success: true, data: clone(next) };
    },
    updateNode: (id, patch = {}) => {
      const { node, index } = ensureNode(id);
      const next = mergeShallow(node, patch);
      state.nodes[index] = next;
      return { success: true, data: clone(next) };
    },
    updateNodes: (ids = [], patch = {}) => {
      ids.forEach((id) => api.updateNode(id, patch));
      return { success: true, data: { ids: [...ids] } };
    },
    updateEdge: (id, patch = {}) => {
      const index = findEdgeIndex(id);
      if (index === -1) {
        return { success: false, error: `Edge ${id} not found` };
      }
      const next = mergeShallow(state.edges[index], patch);
      state.edges[index] = next;
      return { success: true, data: clone(next) };
    },
    updateEdges: (ids = [], patch = {}) => {
      ids.forEach((id) => api.updateEdge(id, patch));
      return { success: true, data: { ids: [...ids] } };
    },
    deleteNode: (id) => {
      const index = findNodeIndex(id);
      if (index === -1) {
        return { success: false, error: `Node ${id} not found` };
      }
      state.nodes.splice(index, 1);
      state.edges = state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      );
      state.clusters.forEach((group) => {
        group.nodeIds = (group.nodeIds || []).filter((nodeId) => nodeId !== id);
      });
      return { success: true, data: { id } };
    },
    translateNodes: (ids = [], delta = {}) => {
      ids.forEach((id) => {
        const { node, index } = ensureNode(id);
        const position = node.position || { x: 0, y: 0 };
        const next = {
          ...node,
          position: {
            x: position.x + (delta.x || 0),
            y: position.y + (delta.y || 0)
          }
        };
        state.nodes[index] = next;
      });
      return { success: true, data: { ids: [...ids], delta: clone(delta) } };
    },
    createGroups: (groupsToCreate = []) => {
      const created = groupsToCreate.map((group) => {
        const next = clone(group);
        if (!next.nodeIds) {
          next.nodeIds = [];
        }
        state.clusters.push(next);
        return clone(next);
      });
      return { success: true, data: { created } };
    },
    deleteGroup: (id) => {
      const index = findGroupIndex(id);
      if (index === -1) {
        return { success: false, error: `Group ${id} not found` };
      }
      state.clusters.splice(index, 1);
      return { success: true, data: { deletedGroupId: id } };
    },
    addNodesToGroup: (clusterId, nodeIds = []) => {
      const { group, index } = ensureGroup(clusterId);
      const nodeSet = new Set(group.nodeIds || []);
      nodeIds.forEach((id) => nodeSet.add(id));
      const updated = { ...group, nodeIds: Array.from(nodeSet) };
      state.clusters[index] = updated;
      return { success: true, data: clone(updated) };
    },
    removeNodesFromGroup: (clusterId, nodeIds = []) => {
      const { group, index } = ensureGroup(clusterId);
      const updated = {
        ...group,
        nodeIds: (group.nodeIds || []).filter((id) => !nodeIds.includes(id))
      };
      state.clusters[index] = updated;
      return { success: true, data: clone(updated) };
    },
    setGroupNodes: (clusterId, nodeIds = []) => {
      const { group, index } = ensureGroup(clusterId);
      const updated = { ...group, nodeIds: [...nodeIds] };
      state.clusters[index] = updated;
      return { success: true, data: clone(updated) };
    },
    updateGroup: (clusterId, patch = {}) => {
      const { group, index } = ensureGroup(clusterId);
      const updated = mergeShallow(group, patch);
      state.clusters[index] = updated;
      return { success: true, data: clone(updated) };
    },
    readGroup: (clusterId) => {
      const index = findGroupIndex(clusterId);
      if (index === -1) {
        return { success: false, error: `Group ${clusterId} not found` };
      }
      return { success: true, data: clone(state.clusters[index]) };
    },
    duplicateNodes: (nodeIds = [], options = {}) => {
      const offset = options.offset || { x: 40, y: 40 };
      const created = nodeIds.map((nodeId) => {
        const { node } = ensureNode(nodeId);
        let newId;
        do {
          copyCounter += 1;
          newId = `${nodeId}-copy${copyCounter}`;
        } while (findNodeIndex(newId) !== -1);
        const position = node.position || { x: 0, y: 0 };
        const next = {
          ...clone(node),
          id: newId,
          position: {
            x: position.x + (offset.x || 0),
            y: position.y + (offset.y || 0)
          }
        };
        state.nodes.push(next);
        return clone(next);
      });
      return { success: true, data: { nodes: created, edges: [] } };
    }
  };

  return { api, state };
}

function setupSkills(initialState = {}) {
  const { api } = createGraphApiFixture(initialState);
  const events = [];
  const eventBus = {
    emit(type, payload) {
      events.push({ type, payload });
    }
  };
  const registry = attachSkills({ graphAPI: api, context: { eventBus } });
  return { graphAPI: api, registry, events };
}

const expectedSkillIds = [
  'struct.createNodes',
  'struct.createEdges',
  'struct.grouping',
  'struct.reparent',
  'struct.duplicate',
  'struct.extractSubgraph',
  'layout.autoLayout',
  'layout.rerouteEdges',
  'layout.avoidCollisions',
  'layout.alignDistribute',
  'layout.normalizeSpacing',
  'validation.schema',
  'validation.ports',
  'validation.dependencies',
  'validation.orphans',
  'validation.unsafeMutation',
  'transform.refactor',
  'transform.normalize',
  'transform.typeMigration',
  'transform.schemaUpgrade',
  'transform.inlineExtract',
  'automation.scriptExecution',
  'automation.batchMutation',
  'automation.proceduralGeneration',
  'automation.simulationStep',
  'automation.compileArtifact',
  'automation.importExport'
];

describe('Skill registry', () => {
  it('registers all expected skills', async () => {
    const { graphAPI, registry } = setupSkills();
    const listed = registry.listSkills().map((item) => item.id).sort();
    const describeOne = registry.describeSkill('struct.createNodes');
    assert.deepEqual(listed, [...expectedSkillIds].sort());
    assert.ok(describeOne);
    const result = await graphAPI.executeSkill('struct.createNodes', {
      nodes: [{ id: 'node-a', width: 120, height: 80 }]
    });
    assert.equal(result.success, true);
  });
});

describe('Structural skills', () => {
  let graphAPI;

  beforeEach(() => {
    ({ graphAPI } = setupSkills({
      nodes: [
        { id: 'node-1', width: 160, height: 80, position: { x: 0, y: 0 } },
        { id: 'node-2', width: 160, height: 80, position: { x: 100, y: 0 } },
        { id: 'node-3', width: 160, height: 80, position: { x: 200, y: 0 } }
      ],
      edges: [],
      clusters: []
    }));
  });

  it('creates nodes safely', async () => {
    const result = await graphAPI.executeSkill('struct.createNodes', {
      nodes: [{ id: 'node-4', width: 120, height: 80 }]
    });
    assert.equal(result.success, true);
    assert.equal(graphAPI.getNodes().length, 4);
  });

  it('creates edges between existing nodes', async () => {
    const result = await graphAPI.executeSkill('struct.createEdges', {
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }]
    });
    assert.equal(result.success, true);
    assert.equal(graphAPI.getEdges().length, 1);
  });

  it('creates groups without moving nodes', async () => {
    const outcome = await graphAPI.executeSkill('struct.grouping', {
      action: 'create',
      clusterId: 'group-1',
      label: 'Test Group',
      nodeIds: ['node-1', 'node-2']
    });
    assert.equal(outcome.success, true);
    const groups = graphAPI.getGroups();
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].nodeIds.sort(), ['node-1', 'node-2']);
  });

  it('reparents nodes between groups', async () => {
    await graphAPI.executeSkill('struct.grouping', {
      action: 'create',
      clusterId: 'group-1',
      nodeIds: ['node-1', 'node-2']
    });
    await graphAPI.executeSkill('struct.grouping', {
      action: 'create',
      clusterId: 'group-2',
      nodeIds: ['node-2', 'node-3']
    });
    const res = await graphAPI.executeSkill('struct.reparent', {
      nodeIds: ['node-1'],
      targetGroupId: 'group-2'
    });
    assert.equal(res.success, true, res.error || JSON.stringify(res.data));
    const groupOne = graphAPI.getGroups().find((group) => group.id === 'group-1');
    const groupTwo = graphAPI.getGroups().find((group) => group.id === 'group-2');
    assert(!groupOne.nodeIds.includes('node-1'));
    assert(groupTwo.nodeIds.includes('node-1'));
  });

  it('provides duplicate plan during dry run', async () => {
    const result = await graphAPI.executeSkill('struct.duplicate', {
      nodeIds: ['node-1'],
      dryRun: true
    });
    assert.equal(result.success, true);
    assert.equal(result.data.planned.count, 1);
  });

  it('extracts a subgraph payload', async () => {
    const result = await graphAPI.executeSkill('struct.extractSubgraph', {
      nodeIds: ['node-1', 'node-2'],
      dryRun: true
    });
    assert.equal(result.success, true);
    assert.equal(result.data.nodes.length, 2);
  });
});

describe('Layout skills', () => {
  let graphAPI;
  let events;

  beforeEach(() => {
    ({ graphAPI, events } = setupSkills({
      nodes: [
        { id: 'layout-1', width: 100, height: 60, position: { x: 0, y: 0 } },
        { id: 'layout-2', width: 100, height: 60, position: { x: 0, y: 0 } },
        { id: 'layout-3', width: 100, height: 60, position: { x: 200, y: 50 } }
      ]
    }));
  });

  it('emits event for auto layout', async () => {
    const res = await graphAPI.executeSkill('layout.autoLayout', {});
    assert.equal(res.success, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'edgeIntentCaptured');
  });

  it('emits event for reroute edges', async () => {
    events.length = 0;
    const res = await graphAPI.executeSkill('layout.rerouteEdges', {});
    assert.equal(res.success, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'edgeIntentCaptured');
  });

  it('resolves collisions by shifting nodes', async () => {
    const res = await graphAPI.executeSkill('layout.avoidCollisions', {
      nodeIds: ['layout-1', 'layout-2'],
      axis: 'x',
      spacing: 80
    });
    assert.equal(res.success, true);
    const nodes = graphAPI.getNodes().filter((node) => node.id.startsWith('layout-'));
    const xPositions = nodes
      .filter((node) => node.id === 'layout-1' || node.id === 'layout-2')
      .map((node) => node.position.x);
    assert.notEqual(xPositions[0], xPositions[1]);
  });

  it('aligns nodes on the left edge', async () => {
    await graphAPI.executeSkill('layout.alignDistribute', {
      nodeIds: ['layout-1', 'layout-3'],
      mode: 'left'
    });
    const nodes = graphAPI
      .getNodes()
      .filter((node) => node.id === 'layout-1' || node.id === 'layout-3');
    const leftValues = nodes.map((node) => node.position.x);
    assert.equal(new Set(leftValues).size, 1);
  });

  it('normalizes spacing across nodes', async () => {
    await graphAPI.executeSkill('layout.normalizeSpacing', {
      nodeIds: ['layout-1', 'layout-3'],
      axis: 'x',
      spacing: 50
    });
    const nodes = graphAPI
      .getNodes()
      .filter((node) => node.id === 'layout-1' || node.id === 'layout-3')
      .sort((a, b) => a.position.x - b.position.x);
    const delta = nodes[1].position.x - nodes[0].position.x;
    assert.equal(delta, 50);
  });
});

describe('Validation skills', () => {
  let graphAPI;

  beforeEach(() => {
    ({ graphAPI } = setupSkills({
      nodes: [
        {
          id: 'validator-node',
          type: 'note',
          width: 160,
          height: 80,
          label: 'Validator',
          position: { x: 0, y: 0 },
          ports: [{ id: 'out', direction: 'output', dataType: 'value' }]
        },
    {
      id: 'isolated-node',
      type: 'note',
      width: 160,
      height: 80,
      label: 'Isolated',
      position: { x: 200, y: 0 }
    },
    {
      id: 'lonely-node',
      type: 'note',
      width: 160,
      height: 80,
      label: 'Lonely',
      position: { x: 400, y: 0 }
    }
  ],
  edges: [
        {
          id: 'edge-valid',
          source: 'validator-node',
          target: 'isolated-node',
          sourcePort: 'out'
        }
      ]
    }));
  });

  it('validates schema', async () => {
    const res = await graphAPI.executeSkill('validation.schema', {});
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.data.nodeErrors));
  });

  it('detects handle mismatches', async () => {
    const res = await graphAPI.executeSkill('validation.ports', {
      edges: [
        {
          id: 'bad-edge',
          source: 'validator-node',
          target: 'isolated-node',
          sourcePort: 'missing-handle'
        }
      ]
    });
    assert.equal(res.success, false);
    assert.equal(res.data.errors[0].code, 'MISSING_HANDLE');
  });

  it('reports missing dependencies', async () => {
    const res = await graphAPI.executeSkill('validation.dependencies', {
      requiredSkills: ['nonexistent.skill']
    });
    assert.equal(res.success, false);
    assert.deepEqual(res.data.missingSkills, ['nonexistent.skill']);
  });

  it('finds orphaned nodes', async () => {
    const res = await graphAPI.executeSkill('validation.orphans', {});
    const orphanIds = res.data.orphans.map((node) => node.id);
    assert(orphanIds.includes('lonely-node'));
  });

  it('flags unsafe mutation commands', async () => {
    const res = await graphAPI.executeSkill('validation.unsafeMutation', {
      commands: [{ action: 'replace' }]
    });
    assert.equal(res.success, false);
    assert(res.data.issues.join(' ').includes('replace'));
  });
});

describe('Transformation skills', () => {
  let graphAPI;

  beforeEach(() => {
    ({ graphAPI } = setupSkills({
      nodes: [
        {
          id: 'transform-node',
          type: 'composite',
          label: 'Composite',
          width: 200,
          height: 120,
          data: { memo: 'original', items: ['a', 'a', 'b'] },
          position: { x: 0, y: 0 }
        }
      ],
      edges: []
    }));
  });

  it('plans refactor split during dry run', async () => {
    const res = await graphAPI.executeSkill('transform.refactor', {
      dryRun: true,
      split: {
        sourceId: 'transform-node',
        removeOriginal: false,
        parts: [
          {
            id: 'transform-part-a',
            label: 'Part A',
            replaceData: true,
            data: { memo: 'part a' }
          }
        ]
      }
    });
    assert.equal(res.success, true);
    assert(res.data.createdNodes.includes('transform-part-a'));
  });

  it('normalizes duplicate data entries', async () => {
    const res = await graphAPI.executeSkill('transform.normalize', {
      dryRun: true,
      operations: [
        {
          type: 'removeDuplicates',
          nodeId: 'transform-node',
          fieldPath: 'items'
        }
      ]
    });
    assert.equal(res.success, true);
    assert(res.data.updatedNodes.includes('transform-node'));
  });

  it('plans type migration updates', async () => {
    const res = await graphAPI.executeSkill('transform.typeMigration', {
      dryRun: true,
      migrations: [
        {
          nodeId: 'transform-node',
          targetType: 'upgraded',
          fieldMap: { 'meta.text': 'memo' },
          data: { version: 2 }
        }
      ]
    });
    assert.equal(res.success, true);
    assert(res.data.updatedNodes.includes('transform-node'));
  });

  it('tracks schema upgrade patches', async () => {
    const res = await graphAPI.executeSkill('transform.schemaUpgrade', {
      dryRun: true,
      patches: [
        {
          nodeId: 'transform-node',
          data: { memo: 'upgraded' }
        }
      ],
      targetVersion: '2.0.0'
    });
    assert.equal(res.success, true);
    assert.equal(res.data.contractVersion, '2.0.0');
  });

  it('prepares inline/extract operations', async () => {
    const res = await graphAPI.executeSkill('transform.inlineExtract', {
      dryRun: true,
      operations: [
        {
          type: 'extract',
          sourceNodeId: 'transform-node',
          fields: ['memo'],
          newNode: { id: 'extracted', label: 'Extracted' }
        }
      ]
    });
    assert.equal(res.success, true);
    assert(res.data.createdNodes.includes('extracted'));
  });
});

describe('Automation skills', () => {
  let graphAPI;

  beforeEach(() => {
    ({ graphAPI } = setupSkills({
      nodes: [
        {
          id: 'auto-node',
          type: 'note',
          label: 'Auto',
          width: 120,
          height: 80,
          position: { x: 10, y: 20 }
        }
      ],
      edges: []
    }));
  });

  it('reports script runner availability during dry run', async () => {
    const res = await graphAPI.executeSkill('automation.scriptExecution', {
      script: 'return 1;',
      dryRun: true
    });
    assert.equal(res.success, false);
    assert.equal(res.data.available, false);
  });

  it('summarizes batch mutations in dry run', async () => {
    const res = await graphAPI.executeSkill('automation.batchMutation', {
      dryRun: true,
      commands: [
        {
          action: 'createNodes',
          nodes: [{ id: 'auto-created', width: 100, height: 60 }]
        }
      ]
    });
    assert.equal(res.success, true);
    assert(res.data.createdNodes.includes('auto-created'));
  });

  it('generates procedural nodes without mutating state during dry run', async () => {
    const res = await graphAPI.executeSkill('automation.proceduralGeneration', {
      dryRun: true,
      blueprint: {
        count: 2,
        nodes: [{ id: 'blueprint-node-{{index}}', width: 80, height: 80 }]
      }
    });
    assert.equal(res.success, true);
    assert.equal(res.data.createdNodes.length, 2);
    assert.equal(graphAPI.getNodes().some((node) => node.id.startsWith('blueprint')), false);
  });

  it('records simulation step metadata in dry run', async () => {
    const res = await graphAPI.executeSkill('automation.simulationStep', {
      dryRun: true,
      stepId: 'step-1',
      mutations: [
        {
          action: 'updateNode',
          id: 'auto-node',
          updates: { label: 'Updated' }
        }
      ]
    });
    assert.equal(res.success, true);
    assert.equal(res.data.stepId, 'step-1');
    assert.ok(res.data.before['auto-node']);
  });

  it('compiles graph into markdown artifact', async () => {
    const res = await graphAPI.executeSkill('automation.compileArtifact', {
      format: 'markdown',
      manifest: { title: 'Test Artifact' }
    });
    assert.equal(res.success, true);
    assert.ok(res.data.artifact.includes('# Graph Artifact'));
  });

  it('exports graph payload', async () => {
    const res = await graphAPI.executeSkill('automation.importExport', {
      direction: 'export',
      nodeIds: ['auto-node']
    });
    assert.equal(res.success, true);
    assert.equal(res.data.nodes.length, 1);
  });
});
