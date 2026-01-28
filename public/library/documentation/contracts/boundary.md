# Data vs UI Boundary Contract

## Purpose
Define what belongs in graph data versus editor-only state.

If this boundary blurs, portability and safety collapse.

## Meaning Ownership Test
If removing the editor changes interpretation, it is data.

## Portability Test
If a graph is exported, reloaded, and still works, the data is correct.

## Graph Data Includes
- Nodes, edges, groups
- Handles and semantics
- Schema versions
- Manifest and intent
- Execution-relevant metadata

## UI State Includes
- Selection
- Pan/zoom
- View modes
- Temporary highlights
- Layout previews

## Diff Hygiene Rules
- UI state must never appear in diffs
- Graph diffs must be human-readable
- Meaning changes must be obvious

If it affects interpretation, it belongs in data.
