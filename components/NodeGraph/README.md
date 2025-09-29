# NodeGraph Component

A reusable, extensible React component for rendering and managing interactive node/edge graphs. Built for integration with Material-UI (MUI) and designed for use in modern React/Next.js projects.

## Features
- Layered rendering: nodes, edges, handles, and pan/zoom overlays
- Customizable node and edge types via the `nodeTypes` prop
- Material-UI theming support (inherits theme from context or via prop)
- Animated handle extension and smooth drag-and-drop
- Pan and zoom with mouse or touch
- Event bus for decoupled cross-component communication
- Responsive and resizable canvas

## Props
- `nodes` (array): List of node objects. Each node should have:
  - `id` (string, required): Unique identifier
  - `label` (string, optional): Display label
  - `position` (object, required): `{ x, y }` coordinates
  - `type` (string, optional): Node type key for custom rendering
  - `width`, `height` (number, optional): Node dimensions
  - Any additional custom properties
- `edges` (array): List of edge objects. Each edge should have:
  - `id` (string, optional): Unique identifier
  - `source` (string, required): Source node id
  - `target` (string, required): Target node id
  - `label` (string, optional): Display label
  - `style` (object, optional): Edge style (color, width, dash, curved, etc.)
- `nodeTypes` (object): Mapping of node type keys to React components
- `selectedNodeId` (string, optional): Currently selected node id
- `onNodeClick` (function, optional): Callback for node click events
- `onBackgroundClick` (function, optional): Callback for background click
- `pan`, `zoom`, `setPan`, `setZoom` (object/function, optional): Pan/zoom state and setters
- `onNodeMove`, `onEdgeClick`, `onEdgeHover`, `onNodeHover` (function, optional): Event callbacks
- `hoveredEdgeId`, `hoveredEdgeSource`, `hoveredEdgeTarget` (string, optional): Hover state

## Example Usage
```jsx
import NodeGraph from './components/NodeGraph/NodeGraph';
import MyCustomNode from './components/NodeGraph/MyCustomNode';

const nodeTypes = {
  default: MyCustomNode,
  // ...other custom node types
};

<NodeGraph
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  onNodeClick={handleNodeClick}
  onEdgeClick={handleEdgeClick}
  // ...other props
/>
```

## Theming
- Inherits the current MUI theme via `useTheme()` or accepts a `theme` prop
- Uses theme palette for node backgrounds, edge colors, and text
- Supports semantic text colors and gradients for modern, accessible UIs

## Extending
- **Custom Node Types:** Pass a `nodeTypes` mapping to render custom React components for different node types.
- **Custom Edge Styles:** Use the `style` property on edges for color, width, dash, and curved/straight lines.
- **Event Handling:** Use the event bus and callback props for advanced interactivity.

## Best Practices
- Use theme palette and textColors for all color and text styling
- Keep node/edge logic in the editor layer, and rendering logic in NodeGraph/NodeLayer/EdgeLayer
- Use the event bus for cross-layer communication
- Clean up global event listeners on drag end

## See Also
- [GraphEditor](../GraphEditor/GraphEditor.js): Example of orchestrating NodeGraph in a full-featured editor
- [themes.js](../../Header/themes.js): Theme definitions and customization

---
For more details, see code comments and follow the established patterns for state, events, and rendering.
