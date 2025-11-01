# Node Type Registry & Extension Guide

## Purpose

Document how node components are registered and how to add new node types.

## Where registry lives

- `components/GraphEditor/nodeTypeRegistry.js` maps `node.type` strings to React components used by NodeLayer.

## How to register a new node type

1. Create your node component in `components/GraphEditor/Nodes/MyNode.js`. Follow the existing nodes' props and positioning conventions: accept `{ node, pan, zoom, style, isSelected, onMouseDown, onClick, onDoubleClick, children, draggingHandle, nodeRefs }` and use `node.position`/`width`/`height`.
2. Export your component as default.
3. Open `components/GraphEditor/nodeTypeRegistry.js` and add an entry:

    ```js
    import MyNode from './Nodes/MyNode';

    export default {
      // ...existingTypes,
      mytype: MyNode
    }
    ```

4. Add samples and ensure GraphEditor or data uses `node.type = 'mytype'`.

## Recommended conventions

- Compose with `DefaultNode` when possible for consistent resizing, selection, and theme behavior.
- Register any new events your node emits with `eventBus` and document payload shapes in `EVENT_BUS.md`.
- Keep DOM refs registered in `nodeRefs` where measurement or handle positioning is required.

## Example minimal node

Create `Nodes/BadgeNode.js` that renders a small badge and registers in registry under `badge`.

