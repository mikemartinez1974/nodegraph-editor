# Copilot Instructions for NodeGraph Editor

## Project Architecture
- The app is a React + Material-UI (MUI) node/edge graph editor.
- Main orchestrator: `components/NodeGraph/GraphEditor.js` manages state, event handling, and UI panels.
- Rendering is split into layers: `NodeLayer`, `EdgeLayer`, `HandleLayer`, `PanZoomLayer` (see `components/NodeGraph/`).
- Core rendering and pan/zoom logic is in `NodeGraph.js`, which receives nodes/edges/groups as props.

## State & Data Flow
- Nodes, edges, and groups are kept in local state and refs for performance and undo/redo.
- All pan/zoom coordinates are transformed via the `usePanZoom` hook.
- Selection state: only one node/edge/group selected at a time; managed locally and via event handlers.
- Undo/redo/history: see `hooks/useGraphHistory.js` and usage in `GraphEditor.js`.

## Event Bus & Communication
- Cross-component events use a custom event bus (`components/NodeGraph/eventBus.js`).
- Examples: node/edge clicks, drags, drops, background/document changes, script proposals.
- To add new events, extend the event bus and register listeners in `GraphEditor.js` or relevant layer/component.

## Layered Rendering & Interactivity
- Visuals are split: Canvas for edges/debug, SVG/DOM for nodes/handles/overlays.
- Drag-and-drop (nodes, handles, edges) uses global mouse listeners and local state. Always clean up listeners.
- Handle extension/animation is managed via a progress map and animation loop.

## Panels & UI
- Node, group, and properties panels are managed via state and event bus triggers.
- Toolbar actions (undo, redo, add node, layout, minimap toggle) are handled in `Toolbar.js` and `GraphEditor.js`.

## Extending & Customization
- Add node/edge types by creating components and passing via `nodeTypes`/`edgeTypes` props.
- Use the event bus for new interactive behaviors and cross-layer communication.
- For new visuals, choose Canvas for performance or SVG/DOM for interactivity.

## Scripting & Automation
- ScriptRunner and ScriptPanel allow external scripts to read/mutate graph state via a host RPC handler in `GraphEditor.js`.
- Script proposals are applied via the event bus and update state/history.

## Debugging & Non-Obvious Workflows
- Canvas draws debug circles for node positions (see `NodeGraph.js`).
- Drag-and-drop and background/document changes use imperceptible pan nudges and forced redraws for reliable UI updates.
- Keyboard shortcuts: e.g., Ctrl/Cmd+B toggles background interactivity.

## Key Files & Directories
- `components/NodeGraph/GraphEditor.js`: Main state/event orchestrator.
- `components/NodeGraph/NodeGraph.js`: Layered rendering, pan/zoom, event handling.
- `components/NodeGraph/eventBus.js`: Event bus for decoupled communication.
- `components/NodeGraph/utils.js`: Geometry and handle utilities.
- `components/NodeGraph/hooks/`: Custom hooks for state, selection, history, modes, group management.
- `components/NodeGraph/components/`: Panels, toolbar, and UI elements.

## Example: Adding a Custom Node Type
1. Create a new node component in `components/NodeGraph/`.
2. Pass it via the `nodeTypes` prop to `NodeGraph`.
3. Register any custom event handlers in `GraphEditor.js` or via the event bus.

---

For questions or to extend these instructions, review the main files above and follow the established patterns for state, events, and rendering. If any section is unclear or missing, please provide feedback to iterate and improve these guidelines.
