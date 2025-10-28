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

This file documents the canonical events emitted and listened on the project's eventBus.

Notes
- All payloads are JSON-serializable plain objects.
- Use the eventBus for cross-component communication only — do not expose internal instances or DOM nodes.

Events

1) Node lifecycle
- nodeAdded
  - emitter: GraphEditor / node creation UI
  - payload: { node: Node }

- nodeUpdated
  - emitter: GraphCrud / GraphEditor
  - payload: { id: string, patch: Partial<Node>, source?: string }

- nodeDeleted
  - emitter: GraphEditor / Node remove UI
  - payload: { id: string }

2) Edge lifecycle
- edgeAdded
  - emitter: GraphEditor
  - payload: { edge: Edge }

- edgeUpdated
  - emitter: GraphCrud / GraphEditor
  - payload: { id: string, patch: Partial<Edge> }

- edgeDeleted
  - emitter: GraphEditor
  - payload: { id: string }

3) Selection & UI
- selectionChanged
  - emitter: NodeGraph / UI panels
  - payload: { nodeIds: string[], edgeIds: string[], groupIds?: string[] }

- nodeClick
  - emitter: Node components
  - payload: { id: string, eventType?: 'click'|'double'|'context', meta?: any }

4) Resize / layout
- nodeResize
  - emitter: DefaultNode resizing logic
  - payload: { id: string, width: number, height: number, interim?: boolean }

- nodeResizeEnd
  - emitter: DefaultNode resizing logic
  - payload: { id: string, width: number, height: number }

5) Viewport / document
- loadSaveFile
  - emitter: File load handlers
  - payload: { settings?: object, viewport?: { pan, zoom }, nodes?: [], edges?: [] }

- applyThemeFromSave
  - emitter: GraphEditor load handler
  - payload: { theme: object }

- setDocument
  - emitter: ThemeDrawer / BackgroundControls
  - payload: { document: { type: 'url'|'html', url?: string, html?: string, interactive?: boolean } }

- clearDocument
  - emitter: ThemeDrawer / BackgroundControls
  - payload: {}

- backgroundLoadFailed
  - emitter: NodeGraph iframe handler
  - payload: { url?: string, reason?: string }

6) Export / persistence
- exportGraph
  - emitter: UI (Toolbar/Commands)
  - payload: { format?: 'node'|'json' }

- graphSaved
  - emitter: Toolbar / save handler
  - payload: { filename: string, sizeBytes?: number }

7) Scripting (runtime)
- scriptStarted
  - emitter: ScriptRunner (host)
  - payload: { id: string, scriptName?: string }

- scriptEnded
  - emitter: ScriptRunner (host)
  - payload: { id: string, success: boolean, result?: any, error?: string }

- rpcRequest (iframe -> host)
  - emitter: ScriptRunner (iframe)
  - payload: { id: string, method: string, args: any[] }

- rpcResponse (host -> iframe)
  - emitter: ScriptRunner host
  - payload: { id: string, result?: any, error?: string }

8) Misc
- fetchUrl
  - emitter: Toolbar / header controls
  - payload: { url: string }

- notification
  - emitter: any
  - payload: { message: string, severity?: 'info'|'warning'|'error'|'success' }

Examples
- Emit a node update:
  eventBus.emit('nodeUpdated', { id: 'node_1', patch: { label: 'New' } });

- Listen for document load failures:
  eventBus.on('backgroundLoadFailed', ({ url, reason }) => { ... });

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



feat(background): add configurable webpage background and controls

Add BackgroundControls UI and integrate into ThemeDrawer
Render iframe background in NodeGraph with load/error handling and overlay
Persist background URL in GraphEditor, toggle interactivity, and include in export (.node)
Wire eventBus handlers for set/clear background and export
Update package files (lock/metadata)