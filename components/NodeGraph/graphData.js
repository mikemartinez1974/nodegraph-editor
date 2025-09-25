// graphData.js
import { createNode, createEdge } from './nodeEdgeBase';

export const nodes = [
  createNode({ id: 'node1', type: 'default', label: 'Start', data: {}, position: { x: 100, y: 100 }, showLabel: true }),
  createNode({ id: 'node2', type: 'default', label: 'Process', data: {}, position: { x: 300, y: 100 }, showLabel: true }),
  createNode({ id: 'node3', type: 'default', label: 'Decision', data: {}, position: { x: 300, y: 300 }, showLabel: true }),
  createNode({ id: 'node4', type: 'default', label: 'End', data: {}, position: { x: 500, y: 200 }, showLabel: true })
];

export const edges = [
  createEdge({ id: 'edge1', source: 'node1', target: 'node2', label: 'Next', type: 'straight' }),
  createEdge({ id: 'edge2', source: 'node2', target: 'node3', label: 'Evaluate', type: 'dashed' }),
  createEdge({ id: 'edge3', source: 'node3', target: 'node4', label: 'Finish', type: 'curved' })
];
