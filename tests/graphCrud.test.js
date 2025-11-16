import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import GraphCRUD from '../components/GraphEditor/GraphCrud.js';

const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

function createCrudFixture({
  nodes = [],
  edges = [],
  groups = [],
} = {}) {
  let nodeState = clone(nodes);
  let edgeState = clone(edges);
  let groupState = clone(groups);

  const history = [];

  const nodesRef = { current: nodeState };
  const edgesRef = { current: edgeState };
  const groupsRef = { current: groupState };

  const getNodes = () => nodeState;
  const getEdges = () => edgeState;
  const getGroups = () => groupState;

  const setNodes = (next) => {
    nodeState = typeof next === 'function' ? next(nodeState) : next;
    nodesRef.current = nodeState;
  };

  const setEdges = (next) => {
    edgeState = typeof next === 'function' ? next(edgeState) : next;
    edgesRef.current = edgeState;
  };

  const setGroups = (next) => {
    groupState = typeof next === 'function' ? next(groupState) : next;
    groupsRef.current = groupState;
  };

  const saveToHistory = (nodesSnapshot, edgesSnapshot) => {
    history.push({
      nodes: clone(nodesSnapshot),
      edges: clone(edgesSnapshot),
    });
  };

  const crud = new GraphCRUD(
    getNodes,
    setNodes,
    getEdges,
    setEdges,
    saveToHistory,
    nodesRef,
    edgesRef,
    getGroups,
    setGroups,
    groupsRef
  );

  return {
    crud,
    get nodes() {
      return nodeState;
    },
    get edges() {
      return edgeState;
    },
    get groups() {
      return groupState;
    },
    history,
  };
}

describe('GraphCRUD core CRUD flows', () => {
  it('creates nodes with sensible defaults and unique ids', () => {
    const fixture = createCrudFixture();

    const first = fixture.crud.createNode({ label: 'First node' });
    assert.equal(first.success, true);
    assert.ok(first.data.id);
    assert.equal(first.data.label, 'First node');
    assert.equal(first.data.width, 80);
    assert.equal(first.data.height, 48);
    assert.equal(fixture.nodes.length, 1);
    assert.equal(fixture.history.length, 1);

    const second = fixture.crud.createNode({ id: first.data.id, label: 'Duplicate id attempt' });
    assert.equal(second.success, true);
    assert.notEqual(second.data.id, first.data.id, 'auto-generated id should avoid collisions');
    assert.equal(fixture.nodes.length, 2);
    assert.equal(fixture.history.length, 2);
  });

  it('persists provided handle schemas when creating nodes', () => {
    const fixture = createCrudFixture();
    const customInputs = [{ key: 'in1', label: 'Input', type: 'value' }];
    const customOutputs = [
      { key: 'out1', label: 'Trigger', type: 'trigger' },
      { key: 'out2', label: 'Value', type: 'value' }
    ];

    const created = fixture.crud.createNode({
      label: 'Schema Node',
      inputs: customInputs,
      outputs: customOutputs
    });

    assert.equal(created.success, true);
    const stored = fixture.nodes[0];
    assert.deepEqual(stored.inputs, customInputs);
    assert.deepEqual(stored.outputs, customOutputs);
  });

  it('updates node fields while preserving existing nested data', () => {
    const fixture = createCrudFixture({
      nodes: [
        {
          id: 'node-1',
          type: 'default',
          label: 'Original',
          position: { x: 50, y: 75 },
          data: { memo: 'memo', link: 'https://example.com' },
        },
      ],
    });

    const result = fixture.crud.updateNode('node-1', {
      label: 'Updated',
      position: { x: 120 },
      data: { memo: 'updated memo' },
    });

    assert.equal(result.success, true);
    const node = fixture.nodes[0];
    assert.equal(node.label, 'Updated');
    assert.deepEqual(node.position, { x: 120, y: 75 }, 'position merges rather than replacing');
    assert.deepEqual(node.data, { memo: 'updated memo', link: 'https://example.com' });
    assert.equal(fixture.history.length, 1, 'update saves a history entry');
  });

  it('deletes nodes and any connected edges', () => {
    const fixture = createCrudFixture({
      nodes: [
        { id: 'a', label: 'A', data: {} },
        { id: 'b', label: 'B', data: {} },
      ],
      edges: [
        { id: 'edge-1', source: 'a', target: 'b', type: 'child' },
        { id: 'edge-2', source: 'b', target: 'a', type: 'child' },
      ],
    });

    const result = fixture.crud.deleteNode('a');
    assert.equal(result.success, true);
    assert.equal(fixture.nodes.length, 1);
    assert.equal(fixture.nodes[0].id, 'b');
    assert.equal(fixture.edges.length, 0, 'edges connected to deleted node are removed');
    assert.equal(result.data.affectedEdges, 2);
  });

  it('creates edges between existing nodes and validates missing nodes', () => {
    const fixture = createCrudFixture({
      nodes: [
        {
          id: 'source',
          label: 'Source',
          data: {},
          outputs: [{ key: 'tick', label: 'Tick', type: 'trigger' }],
        },
        {
          id: 'target',
          label: 'Target',
          data: {},
          inputs: [{ key: 'fire', label: 'Fire', type: 'trigger' }],
        },
      ],
    });

    const invalid = fixture.crud.createEdge({
      source: 'source',
      target: { nodeId: 'missing', handleKey: 'fire' },
      sourceHandle: 'tick',
      targetHandle: 'fire',
    });
    assert.equal(invalid.success, false);
    assert.match(invalid.error, /not found/);

    const created = fixture.crud.createEdge({
      source: 'source',
      target: 'target',
      sourceHandle: 'tick',
      targetHandle: 'fire',
      label: 'Edge',
    });
    assert.equal(created.success, true);
    assert.equal(fixture.edges.length, 1);
    assert.equal(fixture.edges[0].label, 'Edge');
    assert.equal(fixture.edges[0].sourceHandle, 'tick');
    assert.equal(fixture.edges[0].targetHandle, 'fire');
    assert.equal(fixture.history.length, 1);
  });

  it('bulk creates handle-aware edges and surfaces invalid entries', () => {
    const fixture = createCrudFixture({
      nodes: [
        {
          id: 'a',
          label: 'A',
          data: {},
          outputs: [{ key: 'out', label: 'Out', type: 'trigger' }],
        },
        {
          id: 'b',
          label: 'B',
          data: {},
          inputs: [{ key: 'in', label: 'In', type: 'trigger' }],
          outputs: [{ key: 'pass', label: 'Pass', type: 'trigger' }],
        },
        {
          id: 'c',
          label: 'C',
          data: {},
          inputs: [{ key: 'in', label: 'In', type: 'trigger' }],
        },
      ],
    });

    const result = fixture.crud.createEdges([
      { source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
      { source: 'b', target: 'c', sourceHandle: 'pass', targetHandle: 'missing' },
    ]);

    assert.equal(result.success, true);
    assert.equal(result.data.created.length, 1);
    assert.equal(fixture.edges.length, 1);
    assert.ok(result.data.warnings);
    assert.match(result.data.warnings[0], /Edge 1: Input handle "missing"/);
  });

  it('rejects edges without explicit handle keys or mismatched handle types', () => {
    const fixture = createCrudFixture({
      nodes: [
        {
          id: 'source',
          label: 'Source',
          data: {},
          outputs: [
            { key: 'tick', label: 'Tick', type: 'trigger' },
            { key: 'value', label: 'Value', type: 'value' },
          ],
        },
        {
          id: 'target',
          label: 'Target',
          data: {},
          inputs: [
            { key: 'trigger', label: 'Trigger', type: 'trigger' },
            { key: 'val', label: 'Val', type: 'number' },
          ],
        },
      ],
    });

    const missingHandle = fixture.crud.createEdge({
      source: 'source',
      target: 'target',
      sourceHandle: 'tick',
      // targetHandle omitted intentionally
    });
    assert.equal(missingHandle.success, false);
    assert.match(missingHandle.error, /targetHandle is required/i);

    const typeMismatch = fixture.crud.createEdge({
      source: 'source',
      target: 'target',
      sourceHandle: 'value',
      targetHandle: 'trigger',
    });
    assert.equal(typeMismatch.success, false);
    assert.match(typeMismatch.error, /Handle types do not match/i);
  });
});

describe('GraphCRUD search helpers', () => {
  const sampleNodes = [
    {
      id: 'alpha',
      type: 'default',
      label: 'Alpha Node',
      data: { memo: 'Notes about alpha', link: '' },
      width: 120,
      height: 80,
    },
    {
      id: 'beta',
      type: 'markdown',
      label: 'Beta Node',
      data: { memo: '', link: 'https://example.com' },
      width: 240,
      height: 160,
    },
    {
      id: 'gamma',
      type: 'default',
      label: 'Hidden Node',
      data: { memo: 'Secret', link: '' },
      visible: false,
      width: 60,
      height: 40,
    },
  ];

  it('filters nodes using combined criteria', () => {
    const fixture = createCrudFixture({ nodes: sampleNodes });

    const typeFilter = fixture.crud.findNodes({ type: 'markdown' });
    assert.equal(typeFilter.success, true);
    assert.deepEqual(typeFilter.data.map(n => n.id), ['beta']);

    const textFilter = fixture.crud.findNodes({ text: 'alpha' });
    assert.deepEqual(textFilter.data.map(n => n.id), ['alpha']);

    const memoFilter = fixture.crud.findNodes({ hasMemo: true });
    assert.deepEqual(memoFilter.data.map(n => n.id).sort(), ['alpha', 'gamma']);

    const hiddenOnly = fixture.crud.findNodes({ includeVisible: false, includeHidden: true });
    assert.deepEqual(hiddenOnly.data.map(n => n.id), ['gamma']);

    const widthFilter = fixture.crud.findNodes({ minWidth: 200 });
    assert.deepEqual(widthFilter.data.map(n => n.id), ['beta']);

    const combined = fixture.crud.findNodes({
      types: ['default'],
      text: 'node',
      hasMemo: true,
      includeHidden: true,
      includeVisible: true,
      maxHeight: 90,
    });
    assert.deepEqual(combined.data.map(n => n.id), ['alpha']);
  });

  it('supports edge queries and stats aggregation', () => {
    const fixture = createCrudFixture({
      nodes: sampleNodes,
      edges: [
        { id: 'ab', source: 'alpha', target: 'beta', type: 'child' },
        { id: 'bc', source: 'beta', target: 'gamma', type: 'peer' },
      ],
    });

    const edgesFromBeta = fixture.crud.findEdges({ source: 'beta' });
    assert.equal(edgesFromBeta.success, true);
    assert.deepEqual(edgesFromBeta.data.map(e => e.id), ['bc']);

    const stats = fixture.crud.getStats();
    assert.equal(stats.success, true);
    assert.deepEqual(stats.data, {
      nodeCount: 3,
      edgeCount: 2,
      nodeTypes: ['default', 'markdown'],
      edgeTypes: ['child', 'peer'],
      nodesWithMemo: 2,
      nodesWithLink: 1,
    });
  });
});
