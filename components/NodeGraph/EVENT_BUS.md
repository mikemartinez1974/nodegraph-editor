# Event Bus Reference

## Purpose

A lightweight pub/sub used across the editor for decoupled communication between layers, node components, and UI panels. Handlers should subscribe via `eventBus.on(...)` and emit via `eventBus.emit(...)`.

## Common events and payloads

- `nodeMouseDown`

  - emitted: when a node receives pointer down
  - payload: `{ id: string, event: MouseEvent }`

- `nodeClick`

  - emitted: when a node is clicked
  - payload: `{ id: string, event: MouseEvent }`

- `nodeDoubleClick`

  - emitted: when a node is double-clicked
  - payload: `{ id: string, event: MouseEvent }`

- `nodeMouseEnter` / `nodeMouseLeave`

  - emitted: hover in/out
  - payload: `{ id: string, event: MouseEvent }`

- `nodeResize`

  - emitted: during resizing (continuous)
  - payload: `{ id: string, width: number, height: number }`
  - Notes: width/height are in node-space (not zoomed)

- `nodeResizeEnd`

  - emitted: when resize completes
  - payload: `{ id: string }`
  - Notes: host should persist the `node.width`/`node.height` on this event

- `nodeAdded` / `nodeRemoved` / `nodeUpdated`

  - emitted: graph CRUD lifecycle
  - payload: `{ node: object }` for `nodeAdded`/`nodeUpdated`; `{ id: string }` for `nodeRemoved`

- `edgeAdded` / `edgeRemoved` / `edgeUpdated`

  - payload: analogous with edge objects or id

- `selectionChanged`

  - emitted: when selection set changes
  - payload: `{ selectedNodeIds: string[], selectedEdgeIds: string[] }`

- `panZoomChanged`

  - emitted: when viewport pan/zoom changes
  - payload: `{ pan: {x:number,y:number}, zoom: number }`

- `handleDragStart` / `handleDragMove` / `handleDragEnd`

  - for connecting edges via handles
  - payloads include `{ nodeId, handleId, x, y }` coordinates in screen or graph space (documented by the emitter)

## Best practices

- Keep event payloads small and serializable.
- Use event namespacing where useful (e.g., `editor:node:resize`) if adding many custom events.
- Always validate incoming payloads in subscribers — do not assume perfect shape.
- Unsubscribe handlers on component unmount to avoid leaks.

## Example usage

- Subscribe:

  ```js
  eventBus.on('nodeResizeEnd', ({ id }) => {
    // persist size
  });
  ```

- Emit:

  ```js
  eventBus.emit('nodeClick', { id: node.id, event: e });
  ```

# Event Bus Schema

This document lists the canonical events used across the editor, who typically emits them, and the expected payload shapes. Use these types as the source of truth when integrating components or writing handlers.

Format: each entry contains:

- `name` — string event name
- `emittedBy` — typical emitter(s)
- `when` — short description of when it is emitted
- `payload` — JSON schema / example
- `notes` — additional context

---

## Node interaction events

### nodeMouseDown

- **emittedBy:** Node components (DefaultNode, DivNode, etc.)
- **when:** user presses pointer down on a node
- **payload:**

  ```json
  { "id": "nodeId", "event": "<MouseEvent|PointerEvent>" }
  ```

- **notes:** Used to start drag/selection. Event is the original DOM event — handlers should stopPropagation safely if needed.

### nodeClick

- **emittedBy:** Node components
- **when:** user clicks a node
- **payload:**

  ```json
  { "id": "nodeId", "event": "<MouseEvent|PointerEvent>" }
  ```

- **notes:** Selection logic typically handled by GraphEditor in response to this event.

### nodeDoubleClick

- **emittedBy:** Node components
- **when:** user double-clicks a node
- **payload:**

  ```json
  { "id": "nodeId", "event": "<MouseEvent|PointerEvent>" }
  ```

- **notes:** Reserved for edit actions (open properties, edit label).

### nodeMouseEnter / nodeMouseLeave

- **emittedBy:** Node components
- **when:** pointer enters/leaves node
- **payload:**

  ```json
  { "id": "nodeId", "event": "<MouseEvent|PointerEvent>" }
  ```

- **notes:** Useful for hover UI (handles, tooltips).

---

## Node lifecycle (CRUD)

### nodeAdded

- **emittedBy:** Graph CRUD layer (GraphCrud, handlers)
- **when:** node created and added to graph state
- **payload:**

  ```json
  { "node": { /* full node object */ } }
  ```

- **notes:** Consumers should update views/indices.

### nodeUpdated

- **emittedBy:** Graph CRUD layer
- **when:** node properties (position, size, data, color) change
- **payload:**

  ```json
  { "node": { /* full node object */ }, "patch": { /* fields changed */ } }
  ```

- **notes:** `patch` optional but recommended for efficiency.

### nodeRemoved

- **emittedBy:** Graph CRUD layer
- **when:** node deleted
- **payload:**

  ```json
  { "id": "nodeId" }
  ```

---

## Resize / Layout

### nodeResize

- **emittedBy:** DefaultNode (during user resize)
- **when:** user drags resize handle (continuous)
- **payload:**

  ```json
  { "id": "nodeId", "width": number, "height": number }
  ```

- **notes:** values are in logical node-space (pre-zoom). Use for live previews; do not persist as final until `nodeResizeEnd`.

### nodeResizeEnd

- **emittedBy:** DefaultNode
- **when:** user releases resize handle
- **payload:**

  ```json
  { "id": "nodeId" }
  ```

- **notes:** Host should persist final width/height on this event.

---

## Edge lifecycle

### edgeAdded / edgeUpdated / edgeRemoved

- **emittedBy:** Graph CRUD layer
- **when:** edge created/updated/deleted
- **payload for add/update:**

  ```json
  { "edge": { /* full edge object */ } }
  ```

- **payload for remove:**

  ```json
  { "id": "edgeId" }
  ```

---

## Selection & viewport

### selectionChanged

- **emittedBy:** GraphEditor / selection hooks
- **when:** selected nodes/edges change
- **payload:**

  ```json
  { "selectedNodeIds": ["id"], "selectedEdgeIds": ["id"] }
  ```

### panZoomChanged

- **emittedBy:** usePanZoom / PanZoomLayer
- **when:** viewport pan or zoom changes
- **payload:**

  ```json
  { "pan": { "x": number, "y": number }, "zoom": number }
  ```

---

## Handles & connection drag

### handleDragStart

- **emittedBy:** HandleLayer
- **when:** user starts dragging a handle to create or reconnect an edge
- **payload:**

  ```json
  { "nodeId": "id", "handleId": "id", "x": number, "y": number }
  ```

- **notes:** coordinates may be in screen or graph space depending on emitter; check emitter docs.

### handleDragMove

- **emittedBy:** HandleLayer
- **when:** during handle drag
- **payload:** same as `handleDragStart`

### handleDragEnd

- **emittedBy:** HandleLayer
- **when:** user releases handle
- **payload:**

  ```json
  { "nodeId": "id", "handleId": "id", "target": { "nodeId": "id", "handleId": "id" } | null }
  ```

- **notes:** `target` null indicates no connection was made.

---

## Groups

### groupAdded / groupUpdated / groupRemoved

- **emittedBy:** GroupManager
- **when:** group lifecycle changes
- **payloads:** mirror node/edge events: full group object or id.

---

## Clipboard / Paste

### paste

- **emittedBy:** pasteHandler
- **when:** user pastes graph JSON or supported formats
- **payload:**

  ```json
  { "data": any, "source": "string" }
  ```

- **notes:** Handler should validate and emit `nodeAdded`/`edgeAdded` events as appropriate.

---

## History & undo/redo

### historySnapshot

- **emittedBy:** GraphEditor / history manager
- **when:** a new snapshot is recorded (e.g., after a completed user action)
- **payload:**

  ```json
  { "snapshotId": "string", "timestamp": number }
  ```

- **notes:** Used to coordinate undo/redo UI and persistence.

---

## Scripting & automation

### scriptStart / scriptEnd / scriptLog / scriptError

- **emittedBy:** scripting runtime / iframe runner
- **when:** script lifecycle events
- **payloads:**

  ```json
  { "scriptId": "id", "message": "string", "level": "info|warn|error" }
  ```

- **notes:** Provide audit trail for script activity.

---

## Misc / telemetry

### nodeMouseEnterDetailed (example specialized event)

- **emittedBy:** NodeLayer when additional details available
- **payload:**

  ```json
  { "id": "nodeId", "meta": { /* extra info */ } }
  ```

- **notes:** Use sparingly — prefer small payloads.

---

## Best practices / conventions

- Keep payloads small and serializable. Avoid embedding DOM nodes or functions in events.
- Use consistent naming and groupings (e.g., `node*`, `edge*`, `group*`, `handle*`).
- Emit both the full object and a minimal patch when possible: consumers can choose the most efficient path.
- Namespace custom or feature-specific events (e.g. `scripting:run:start`) to avoid collisions.
- Always unsubscribe handlers on component unmount.

---

If you want, I can generate TypeScript types for these events or add an events registry file that re-exports event name constants for use across the codebase.

