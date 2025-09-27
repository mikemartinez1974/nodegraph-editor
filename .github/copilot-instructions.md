# Copilot Instructions for NodeGraph Editor

## Project Overview
- This project implements a highly interactive node/edge graph editor using React and Material-UI (MUI).

- The core component is `Graph Editor` (`components/NodeGraph/GraphEditor.js`),
which manages the arrays that comprise the node map.  It manages adding/removing nodes and edges, as well as handling drag-and-drop from a sidebar.  It orchestrates state, and event handling for nodes, edges, handles, and
and uses `NodeGraph` (`components/NodeGraph/NodeGraph.js`) for rendering and pan/zoom.

- The UI is composed of multiple layers: `NodeLayer`, `EdgeLayer`, `HandleLayer`, and `PanZoomLayer`, each responsible for a specific aspect of the graph.

## Architecture & Data Flow
- **Nodes and Edges**: Passed as props to `NodeGraph`, maintained in local state for interactivity. Node/edge types can be extended via the `nodeTypes` prop.
- **Event Bus**: Cross-component communication is handled via a custom `eventBus` (see `components/NodeGraph/eventBus.js`). Use this for decoupled event handling (e.g., node/edge clicks, drags, drops).
- **Pan/Zoom**: Managed via the `usePanZoom` hook and `PanZoomLayer`. All coordinates are transformed by current pan/zoom state.
- **Handle/Edge Dragging**: Drag-and-drop for handles/edges is managed with local state and global mouse event listeners. See `onHandleDragStart`, `onHandleDragMove`, `onHandleDragEnd` in `NodeGraph.js`.
- **Animated Handle Extension**: Handle visibility/extension is animated using a `handleProgressMap` state and a short-duration animation loop.

## Key Patterns & Conventions
- **Layered Rendering**: Each visual aspect (nodes, edges, handles) is rendered in its own React component/layer. Canvas is used for performance-critical drawing (edges, debug nodes), while SVG/DOM is used for overlays and interaction.
- **Event Handling**: Mouse and drag events are handled at the layer/component level, with cross-layer effects coordinated via the event bus and shared state.
- **Node/Edge Selection**: Selection state is managed locally in `NodeGraph` and updated via event handlers. Only one node or edge can be selected at a time.
- **Handle Hover/Animation**: Hovering a node or handle triggers handle extension via animated progress. Retraction is delayed to allow smooth UX.
- **Customizable Node/Edge Types**: Extend node/edge rendering by passing custom types/components via props.

## Integration Points
- **Material-UI**: Theming and palette are accessed via `useTheme()` and used for all color/styling logic.
- **Hooks**: Custom hooks (`usePanZoom`, `useCanvasSize`, etc.) encapsulate reusable logic for state and event management.
- **External Events**: To add new event types or cross-component behaviors, extend the event bus and register handlers in `NodeGraph.js`.

## Extending the Project
- To add new node/edge types, update the `nodeTypes` prop and provide corresponding components.
- To add new interactive behaviors, use the event bus for decoupled communication and update the relevant layer/component.
- For new visual features, consider whether to use Canvas (for performance) or SVG/DOM (for interactivity).

## Example: Adding a Custom Node Type
1. Create a new node component in `components/NodeGraph/`.
2. Pass it via the `nodeTypes` prop to `NodeGraph`.
3. Update event handling if the new node type requires custom interaction.

## Key Files
- `components/NodeGraph/NodeGraph.js`: Main orchestrator, state, and event logic.
- `components/NodeGraph/EdgeLayer.js`, `NodeLayer.js`, `HandleLayer.js`, `PanZoomLayer.js`: Layered rendering and interaction.
- `components/NodeGraph/eventBus.js`: Event bus for decoupled communication.
- `components/NodeGraph/utils.js`: Utility functions for geometry, handle positions, etc.

## Non-Obvious Workflows
- **Drag-and-drop**: Uses global mouse listeners for smooth dragging. Always clean up listeners on drag end.
- **Handle animation**: Driven by a short-duration animation loop for smooth UI.
- **Debugging**: Canvas draws debug circles for node positions; remove or extend as needed.

---

For questions or to extend these instructions, review the main files above and follow the established patterns for state, events, and rendering.
