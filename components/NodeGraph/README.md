# NodeGraph Component

A reusable React component for rendering and managing node graphs.

## Purpose
NodeGraph is designed to visualize and interact with graphs consisting of nodes and edges. It can be used in any React/Next.js project.

## Props
- `nodes`: Array of node objects. Each node should have:
  - `id` (string, required): Unique identifier
  - `label` (string, optional): Display label
  - `data` (object, optional): Custom data for your app
- `edges`: Array of edge objects. Each edge should have:
  - `source` (string, required): Source node id
  - `target` (string, required): Target node id
  - `label` (string, optional): Display label

## Example Usage
```jsx
import NodeGraph from './components/NodeGraph';

const nodes = [
  { id: 'node1', label: 'Node 1' },
  { id: 'node2', label: 'Node 2' }
];
const edges = [
  { source: 'node1', target: 'node2', label: 'Connects' }
];

<NodeGraph nodes={nodes} edges={edges} />
```

## Extending
You can add more properties to nodes/edges, or extend NodeGraph to support custom rendering, interaction, or layout algorithms.
