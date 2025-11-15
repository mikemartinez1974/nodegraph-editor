// Node/Edge schema for NodeGraph logic system

/**
 * Node handle/port definition
 * @typedef {Object} NodeHandle
 * @property {string} key - Unique key for this handle
 * @property {string} label - Label for UI
 * @property {string} type - 'trigger', 'value', 'number', 'string', etc.
 * @property {string=} dataType - Optional, for advanced type checking
 */

/**
 * Node definition
 * @typedef {Object} Node
 * @property {string} id
 * @property {string} type
 * @property {string} label
 * @property {{x:number, y:number}} position
 * @property {Object} data
 * @property {NodeHandle[]} inputs
 * @property {NodeHandle[]} outputs
 */

/**
 * Edge definition
 * @typedef {Object} Edge
 * @property {string} id
 * @property {{nodeId:string, handleKey:string}} source
 * @property {{nodeId:string, handleKey:string}} target
 * @property {string=} type
 */

// Factory helpers
function createNode({id, type, label, position, data, inputs, outputs}) {
  return { id, type, label, position, data: data || {}, inputs: inputs || [], outputs: outputs || [] };
}

function createEdge({id, source, target, type}) {
  return { id, source, target, type };
}

// Validation helpers
function isValidEdge(edge, nodes) {
  if (!edge || !edge.source || !edge.target) return false;
  if (edge.source.nodeId === edge.target.nodeId) return false; // no self-loop
  const sourceNode = nodes.find(n => n.id === edge.source.nodeId);
  const targetNode = nodes.find(n => n.id === edge.target.nodeId);
  if (!sourceNode || !targetNode) return false;
  const sourceHandle = sourceNode.outputs.find(h => h.key === edge.source.handleKey);
  const targetHandle = targetNode.inputs.find(h => h.key === edge.target.handleKey);
  if (!sourceHandle || !targetHandle) return false;
  // Only allow output->input
  if (!sourceNode.outputs.some(h => h.key === edge.source.handleKey)) return false;
  if (!targetNode.inputs.some(h => h.key === edge.target.handleKey)) return false;
  // Optionally: type compatibility
  if (sourceHandle.type !== targetHandle.type && sourceHandle.type !== 'trigger' && targetHandle.type !== 'trigger') return false;
  return true;
}

// Sample node and edge
const sampleNode = createNode({
  id: 'node-1',
  type: 'TimerNode',
  label: 'Timer',
  position: { x: 100, y: 100 },
  data: { interval: 1000 },
  inputs: [ { key: 'reset', label: 'Reset', type: 'trigger' } ],
  outputs: [ { key: 'tick', label: 'Tick', type: 'trigger' } ]
});

const sampleEdge = createEdge({
  id: 'edge-1',
  source: { nodeId: 'node-1', handleKey: 'tick' },
  target: { nodeId: 'node-2', handleKey: 'trigger' },
  type: 'trigger'
});

module.exports = {
  createNode,
  createEdge,
  isValidEdge,
  // types for reference
  // NodeHandle, Node, Edge,
  sampleNode,
  sampleEdge
};
