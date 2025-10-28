# Graph Editor

## Overview

This folder implements a highly-interactive node/edge graph editor built with React and Material-UI (MUI). The editor supports pan/zoom, layered rendering (nodes, edges, handles), draggable nodes, resizable nodes, and an event bus for cross-component communication.

## Purpose

Use this editor to visually build and manipulate node graphs (workflows, diagrams, outlines). The components are modular so you can extend node and edge types, add UI panels, or hook in scripting and automation.

## Key Concepts

- Nodes: Rendered via per-type node components (`DefaultNode`, `MarkdownNode`, `DivNode`, `SvgNode`, `FixedNode`). Nodes hold layout (position, width, height) and data (memo, html, svg, text).
- Edges: Simple connection objects with type and optional styling.
- Layers: Rendering is split into layers (Pan/Zoom, EdgeLayer, NodeLayer, HandleLayer) for clarity and performance.
- Event Bus: A lightweight pub/sub (`eventBus`) is used for decoupled events like selection, resizing, node/edge lifecycle events.
- Hooks: Custom hooks encapsulate pan/zoom, editor state, selection, history, and keyboard shortcuts.

## Where to look (key files)

- `GraphEditor.js` — Main orchestrator and integration point.
- `nodeTypeRegistry.js` — Maps node types to components.
- `DefaultNode.js` — Base node UI (resizing, labels, styles).
- `DivNode.js`, `MarkdownNode.js`, `SvgNode.js`, `FixedNode.js` — Built-in node implementations.
- `eventBus.js` — Pub/sub used throughout the editor.
- `hooks/` — Reusable hooks (useGraphEditorState, useGraphHistory, usePanZoom, useSelection, etc.).
- `components/` — UI panels (NodePropertiesPanel, EdgePropertiesPanel, GroupManager, Toolbar, etc.).
- `handlers/` — GraphEditor event and paste handlers.

## Node types and behaviour

- `default`: Resizable node with label and optional memo icons. Emits `nodeResize`/`nodeResizeEnd` events when resized.
- `fixed`: Same as default but not resizable.
- `markdown`: Renders stored memo as Markdown (safe, read-only display).
- `div`: Renders HTML or memo content (uses sanitization and markdown rendering where appropriate).
- `svg`: Renders raw SVG from `node.data.svg`.

## Security & sanitization

Nodes that render raw HTML or Markdown use rehype/remark sanitization to prevent XSS. The sanitize schema can be extended where needed (e.g., allow a custom protocol). Avoid storing executable scripts in node content — the application intentionally strips JS/event attributes.

## Resizing & Persistence

`DefaultNode` exposes an interactive resize handle. During resize it emits `nodeResize` events with width/height (in node space). The GraphEditor (or host) should listen and persist size changes (typically on `nodeResizeEnd`).

## Extending the editor

- Add a node type: create a component under `Nodes/`, register it in `nodeTypeRegistry.js`, and follow the existing props/positioning conventions.
- Add a new panel: add a component in `components/` and wire it into `GraphEditor.js` or the `Toolbar`.
- Customize appearance: `DefaultNode` uses MUI theme and supports gradients/colors via `node.color`.

## Scripting & automation (design notes)

For user scripts that operate on graphs, prefer a sandboxed runner (iframe or web worker) exposing a limited API such as `getNodes`, `updateNode`, `createEdge`, `deleteNode`, `on(event)`. Host-side validation, timeouts, and dry-run modes are recommended to keep scripts safe and reversible.

## Developer notes

- Use the provided hooks for editor state and to avoid duplicating logic.
- `nodeRefs` is a `Map`-like ref that registers node DOM elements for measurements and handle positioning.
- Keep heavy DOM parsing (markdown/html) memoized or performed at save-time to avoid render-time performance hits.

## Troubleshooting

- If links or HTML render as plain text, confirm the node type and that content is stored in `node.data.html` or `node.data.memo`.
- If sanitization strips needed attributes, extend the sanitize schema in the node component carefully.

## License & Contributing

This project follows the repository's standard license. Contributions are welcome — open issues for feature requests or submit PRs for bug fixes and new node types.

