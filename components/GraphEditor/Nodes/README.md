# Nodes — README

## Overview

This folder contains the built-in node components used by the graph editor. Each node component renders a specific kind of content and follows the same positioning/props conventions so they can be used interchangeably via the nodeType registry.

## Node components

- **DefaultNode**

  - Purpose: General-purpose, resizable node with label, memo/link indicators, and built-in styling derived from the MUI theme.
  - Key features: resize handle (emits `nodeResize`/`nodeResizeEnd` via `eventBus`), label rendering, optional memo/link icons, theme-aware color/gradient support.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `children`, `draggingHandle`, `nodeRefs`.
  - Notes: Emits resize events; ensure the host persists `width`/`height` on `nodeResizeEnd`.

- **DivNode**

  - Purpose: Render arbitrary HTML or memo content inside a resizable DefaultNode shell.
  - Key features: Markdown rendering (ReactMarkdown + remark-gfm), optional raw HTML fragments rendered via `rehypeRaw` + `rehypeSanitize`, link handling via `TlzLink`, inherits resizing/interaction from `DefaultNode`.
  - Props: same as DefaultNode plus `node.data.html` / `node.data.memo`.
  - Security: HTML content is sanitized; the sanitize schema can be extended if specific tags/attributes are required.

- **FixedNode**

  - Purpose: Like DefaultNode but not resizable (fixed size). Useful for icons, small labels, or items that should remain stable.
  - Key features: same visual style as DefaultNode but no resize handle and no emitted resize events.
  - Props: same basic props as DefaultNode.

- **MarkdownNode**

  - Purpose: Display-only node optimized for rich content and documentation. Renders `node.data.memo` as markdown in a larger default size.
  - Key features: Markdown rendering with remark/rehype, read-only (no resize handle by default in this implementation), theme-aware styling for blackboard/whiteboard mode.
  - Props: same standard props; content driven primarily by `node.data.memo`.

- **SvgNode**

  - Purpose: Render an SVG graphic provided in `node.data.svg`. Use for icons, small diagrams, or visual indicators.
  - Key features: Renders raw SVG markup (be careful to sanitize or validate SVG input), responds to theme colors if implemented.
  - Props: same standard props plus `node.data.svg`.

## Common conventions

- Positioning: All nodes expect `node.position {x,y}` in graph coordinates. Node components apply the same pan/zoom transforms and center the node on that position.
- Sizing: `width`/`height` are stored on node (user-resizable for DefaultNode). Default fallback sizes exist when `width`/`height` are missing.
- Interaction: Nodes must call `eventBus` events for selection and pointer interactions (`nodeMouseDown`, `nodeClick`, `nodeMouseEnter`, `nodeMouseLeave`) to keep editor state in sync.
- `nodeRefs`: Many nodes register their DOM ref in `nodeRefs` (a Map-like ref) so the editor can measure nodes for edge and handle placement.
- Sanitization: Any node type that renders HTML or SVG should sanitize input to prevent XSS. Default implementations use rehype/remark sanitizers; extend cautiously.

## Extending nodes

- To add a new node type, create a component in this folder, follow the props/positioning conventions, and register it in the nodeType registry (`components/GraphEditor/nodeTypeRegistry.js`).
- Prefer composing with `DefaultNode` for consistent sizing, resizing, and interaction behavior.
- If you need custom resize behavior (edge-resize, aspect-locking), implement the handlers and emit `nodeResize` events consistent with `DefaultNode` so the rest of the system can react.

## Troubleshooting

- No content shown: verify content is stored in `node.memo`, `node.data.memo`, `node.data.html`, or `node.data.text` depending on the node type.
- Links render as plain text: ensure markdown/html rendering is enabled for the node type and that rehype/remark plugins are configured.
- Resizing not persisted: make sure GraphEditor listens for `nodeResizeEnd` and updates `node.width`/`node.height` in state.

