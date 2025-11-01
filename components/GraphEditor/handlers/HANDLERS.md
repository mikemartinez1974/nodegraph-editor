# Handlers folder

## Purpose

Contains event handler modules that wire editor behaviors to application actions: paste handling, graph editor mode changes, and RPC/event plumbing.

## Key files

- `handlers/graphEditorHandlers.js` — Registers core editor event handlers (selection changes, keyboard shortcuts, mode transitions). Extend to add new global behaviors.
- `handlers/pasteHandler.js` — Logic to parse pasted JSON or supported formats and convert them into graph operations. Update when adding new paste formats.

## Extension points

- Add handlers that subscribe to `eventBus` and perform domain-specific actions (e.g., auto-layout, analytics).
- When adding a handler that mutates graph state, prefer centralizing CRUD operations in `GraphCrud.js` so all changes follow the same validation path.

## Best practices

- Keep handlers small and focused; do not import React components into plain handler modules to avoid bundling UI into core logic.
- Validate incoming pasted data before emitting add/update events.

