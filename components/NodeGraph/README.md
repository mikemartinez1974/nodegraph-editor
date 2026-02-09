# NodeGraph Component

A production-grade, interactive node/edge graph visualization component built with React, Canvas API, and Material-UI. Designed for high-performance rendering of large graphs (1000+ nodes) with smooth drag-and-drop, pan/zoom, and extensible node/edge types.

## Architecture

**Layered rendering system** for optimal performance:
- **EdgeLayer** (Canvas): High-performance edge rendering with bezier curves, hit detection, and label support
- **HandleLayer** (Canvas): Connection point visualization with proximity-based activation and drag preview
- **NodeLayer** (React/DOM): Interactive node components with selection, hover, and resize support
- **GroupLayer** (SVG): Visual grouping with auto-calculated bounds, collapse/expand, and drag-to-move
- **PanZoomLayer** (SVG overlay): Unified viewport transform with mouse/touch support and marquee selection

**Event Bus**: Decoupled cross-layer communication via `eventBus.js` for clean separation of concerns.

**Handle System**: Context-aware handle positioning with real-time updates during drag operations (no React re-renders).

## Features

### Core Functionality
- ✅ **Drag & Drop**: Smooth 60fps node dragging with RAF batching and DOM transform manipulation
- ✅ **Pan & Zoom**: Mouse wheel zoom, drag-to-pan, with HiDPI canvas support
- ✅ **Multi-Select**: Marquee selection (Shift+drag) with bulk operations
- ✅ **Undo/Redo**: Full history management with debounced batching
- ✅ **Clusters**: Visual node grouping with collapse/expand and drag-to-move-all
- ✅ **Edge Types**: Straight, curved, child/parent (vertical), peer (horizontal), orthogonal
- ✅ **Handle Animation**: Smooth extension/retraction with progress-based rendering
- ✅ **Accessibility**: ARIA labels, keyboard navigation (Tab, Ctrl+Arrows), focus management

### Performance Optimizations
- Canvas rendering for edges and ports (not React)
- Transient DOM transforms during drag (React state only on drop)
- Virtualized node/group lists for large graphs
- RAF-batched redraws and debounced state updates
- Proximity-based handle sensor activation (pointer-events optimization)

### Customization
- Theme-aware (inherits MUI theme or accepts `theme` prop)
- Extensible node types via `nodeTypes` prop
- Custom edge styles (color, width, dash patterns, labels)
- Resizable nodes with drag ports
- Markdown support in node memos

## Props

### Required
- **`nodes`** (array): Node objects with:
  ```javascript
  {
    id: string,              // Unique identifier
    label: string,           // Display text
    position: { x, y },      // World coordinates
    width: number,           // Optional, defaults to 60
    height: number,          // Optional, defaults to 60
    type: 'default' | string, // Node type for custom rendering
    data: {                  // Optional metadata
      memo: string,          // Markdown-formatted notes
      link: string,          // URL link
    }
  }
  ```

- **`edges`** (array): Edge objects with:
  ```javascript
  {
    id: string,              // Optional, auto-generated if missing
    source: string,          // Source node id
    target: string,          // Target node id
    type: 'curved' | 'straight' | 'child' | 'parent' | 'peer',
    label: string,           // Optional display label
    style: {                 // Optional styling
      color: string,
      width: number,
      dash: [number, number],
    }
  }
  ```

### Optional
- **`clusters`** (array): Group objects for visual organization
- **`edgeTypes`** (object): Edge type configuration with style defaults
- **`nodeTypes`** (object): Custom node component mapping
- **`selectedNodeId`** (string): Currently selected node
- **`selectedEdgeId`** (string): Currently selected edge
- **`hoveredNodeId`**, **`hoveredEdgeId`** (string): Hover state
- **`onNodeClick`**, **`onEdgeClick`**, **`onBackgroundClick`** (functions): Event handlers
- **`onNodeMove`**, **`onNodeDragStart`**, **`onNodeDragEnd`** (functions): Drag callbacks
- **`pan`**, **`zoom`**, **`setPan`**, **`setZoom`**: Viewport state (or use internal state)
- **`draggingInfoRef`**: Ref for tracking active drag operations
- **`draggingGroupId`**, **`groupDragOffset`**: Group drag state

## Example Usage

```jsx
import NodeGraph from './components/NodeGraph/NodeGraph';
import DefaultNode from './components/NodeGraph/nodes/DefaultNode';

const edgeTypes = {
  child: { style: { color: '#1976d2' } },
  peer: { style: { color: '#9c27b0' } },
};

const nodeTypes = {
  default: DefaultNode,
  // Add custom node types here
};

<NodeGraph
  nodes={nodes}
  edges={edges}
  clusters={clusters}
  edgeTypes={edgeTypes}
  nodeTypes={nodeTypes}
  selectedNodeId={selectedNodeId}
  onNodeClick={handleNodeClick}
  onEdgeClick={handleEdgeClick}
  onNodeMove={handleNodeMove}
  pan={pan}
  zoom={zoom}
  setPan={setPan}
  setZoom={setZoom}
/>
```

## Event Bus

Use the event bus for cross-component communication:

```javascript
import eventBus from './components/NodeGraph/eventBus';

// Emit events
eventBus.emit('nodeClick', { nodeId });
eventBus.emit('edgeHover', { edgeId });

// Listen to events
eventBus.on('handleDrop', ({ sourceNode, targetNode, edgeType }) => {
  // Create new edge
});
```

**Available events**: `nodeClick`, `edgeClick`, `backgroundClick`, `nodeHover`, `edgeHover`, `handleDragStart`, `handleDragEnd`, `handleDrop`, `nodeProximity`

## Extending NodeGraph

### Custom Node Types
Create a custom node component and register it:

```jsx
// MyCustomNode.js
export default function MyCustomNode({ node, isSelected, isHovered, theme }) {
  return (
    <div style={{ 
      width: node.width, 
      height: node.height,
      backgroundColor: theme.palette.primary.main 
    }}>
      {node.label}
    </div>
  );
}

// Register it
const nodeTypes = { custom: MyCustomNode };
<NodeGraph nodeTypes={nodeTypes} nodes={[{ type: 'custom', ... }]} />
```

### Custom Edge Styles
Configure edge appearance via `edgeTypes`:

```javascript
const edgeTypes = {
  important: { 
    style: { 
      color: '#ff0000', 
      width: 3,
      dash: [10, 5],
    } 
  },
};
```

## Theming

NodeGraph inherits MUI theme via `useTheme()`:
- **Palette**: Node backgrounds, edge colors, text colors
- **Dark mode**: Automatically adjusts based on `theme.palette.mode`
- **Custom colors**: Use `theme.palette.primary`, `secondary`, etc.

## Performance Notes

- **Large graphs**: Tested with 1000+ nodes, 2000+ edges
- **Canvas rendering**: Edges/ports drawn on canvas (not DOM)
- **RAF batching**: Drag updates batched via requestAnimationFrame
- **Virtualization**: Node/group list panels use react-window
- **HiDPI support**: Canvas scaled for retina displays
- **Lazy rendering**: Ports only rendered when near nodes

## Files

### Core Components
- `NodeGraph.js` - Main orchestrator, state management, event coordination
- `EdgeLayer.js` - Canvas-based edge rendering with hit detection
- `NodeLayer.js` - React-based node rendering with drag/resize
- `HandleLayer.js` - Canvas-based handle rendering with proximity activation
- `GroupLayer.js` - SVG-based group visualization with bounds calculation
- `PanZoomLayer.js` - Viewport transform and marquee selection

### Utilities
- `eventBus.js` - Event emitter for cross-component communication
- `canvasUtils.js` - Canvas helpers (HiDPI setup, context management)
- `edgeUtils.js` - Edge path calculation (bezier, straight, orthogonal)
- `dragHandlers.js` - Drag event handlers with RAF batching
- `marqueeSelection.js` - Rectangular selection logic
- `historyManager.js` - Undo/redo state management

## Best Practices

1. **Use the event bus** for cross-layer communication (don't pass callbacks through 5 layers)
2. **Keep state in GraphEditor** (or parent), NodeGraph is a presentation component
3. **Batch updates** - Use history manager's `saveToHistory()` instead of updating on every keystroke
4. **Clean up listeners** - Always remove global mouse/wheel listeners on unmount
5. **Theme-aware colors** - Use `theme.palette` instead of hardcoded hex values
6. **Refs for real-time updates** - Use refs for drag offsets that change 60fps, React state for final positions

# NodeGraph Overview

This folder contains the core rendering and interaction logic for the node/edge graph: pan/zoom, layered rendering (canvas/SVG/DOM), selection, handle/edge dragging, marquee selection, and event dispatching.

## Primary responsibilities

- Render nodes and edges efficiently using separate layers (NodeLayer, EdgeLayer, HandleLayer, PanZoomLayer).
- Manage user interactions: dragging nodes, creating/dragging edges, resizing nodes, marquee multi-select, and keyboard shortcuts.
- Provide a stable, testable event bus and helper hooks for other components to subscribe to editor events.

## Key files

- `NodeGraph.js` — Main orchestrator: composes layers and wires hooks and event handlers.
- `NodeLayer.js` — Renders node components and manages node DOM refs for measurement and hit-testing.
- `EdgeLayer.js` — Canvas/SVG drawing for edges with performance-oriented utilities.
- `HandleLayer.js` — Renders ports and manages drag interactions for connections.
- `PanZoomLayer.js` — Provides pan/zoom transforms and pointer handling.
- `eventBus.js` — Pub/sub used for decoupled communication between nodes, UI panels, and other systems.
- `utils/coords.js`, `edgeUtils.js`, `dragUtils.js` — Geometry and interaction utilities used across the graph.

## Hooks

- `usePanZoom` — Manage viewport pan/zoom state and provides helper transforms to convert coordinates between graph space and screen space.
- `useCanvasSize` — High-DPI aware canvas sizing helpers.
- `useNodeHover`, `useEdgeHover`, `useHandleProgress` — Encapsulate hover/animation logic.
- `useNodeGraphEvents`, `useEventBusHandlers` — Register and handle higher-level editor events.

## Extension points

- Register new node types in the nodeType registry (`components/GraphEditor/nodeTypeRegistry.js`).
- Add custom edge styles by extending `edgeStyleUtils` and passing types into the `EdgeLayer`.
- Subscribe to events via `eventBus` to implement custom tooling (pan-to-node, selection sync, telemetry).

## Performance considerations

- Use canvas for large numbers of edges; keep node DOMs lightweight.
- Avoid heavyweight parsing (markdown/html) in render loop — do it on save or memoize results.
- Use `requestAnimationFrame` for animations and batch DOM reads/writes.

## Security & sanitization

- Node content that renders HTML/Markdown is sanitized (rehype/remark). Do not allow raw scripts in node content.

## Troubleshooting

- If hit-testing seems off, check nodeRefs registration and pan/zoom transforms.
- If edges look clipped or blurry, verify canvas scaling via `useHiDPICanvas`.

## Contributing

Follow existing hooks and utilities; register new functionality through the event bus and nodeType registry for minimal coupling.
