# Resizing lifecycle

## Overview

The `DefaultNode` component provides an interactive resize handle. During a user resize the component emits continuous `nodeResize` events and a final `nodeResizeEnd` when the user releases the mouse.

## Events

- `nodeResize`

  - Emitted continuously while the user drags the resize handle.
  - Payload: `{ id: string, width: number, height: number }`
  - Units: width/height are in logical node-space (pre-zoom). Hosts should treat values as suggestions until `nodeResizeEnd`.

- `nodeResizeEnd`

  - Emitted once when resizing completes.
  - Payload: `{ id: string }`

## Host responsibilities

1. Listen for `nodeResize` to show live previews or sync UI elements (optional).
2. On `nodeResizeEnd` persist the `node.width` and `node.height` on your graph state and trigger any necessary reflow or history snapshot.

### Example handler (pseudo)

```js
eventBus.on('nodeResize', ({ id, width, height }) => {
  // optional: update a transient preview state
})

eventBus.on('nodeResizeEnd', ({ id }) => {
  const node = findNodeById(id)
  // read final width/height from last nodeResize payload or from nodeRefs if stored
  persistNode({ ...node, width: node.width, height: node.height })
})
```

## Best practices

- Enforce minimum sizes (DefaultNode uses 60x40 minimum in its handler) on the host to prevent layout breakage.
- Save sizes as part of normal graph state (so they persist across reloads).
- If you support undo/redo, record a history step on `nodeResizeEnd` rather than every `nodeResize` event to avoid noisy history entries.

