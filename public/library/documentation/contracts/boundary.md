# Data vs UI Boundary Contract

## Purpose
Define what belongs in graph data versus editor-only state.

If this boundary blurs, portability and safety collapse.

## Meaning Ownership Test
If removing the editor changes interpretation, it is data.

## Portability Test
If a graph is exported, reloaded, and still works, the data is correct.

## Graph Data Includes
- Nodes, edges, clusters
- Ports and semantics
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

## View Boundary (Multi-Dev Contract)
Views are the lowest-level graph-defined unit.

Everything above views is graph-defined. Everything below views is code-defined.

### Graph-Defined (above the line)
- Dictionaries (nodeDefs, skills, views)
- Node classes and schemas
- View declarations (intent + payload)
- Task graphs and workflows
- Node instances and data

### Code-Defined (below the line)
- Rendering runtime and components
- Event plumbing and UI wiring
- Security/sanitization
- Performance and caching

### Reasoning
- Views act as stable API surfaces across teams.
- Graphs are declarative, reviewable, and portable.
- Runtime stays centralized for correctness and policy.

If you’re unsure: if it changes what the view **is**, it’s graph-defined. If it changes how the view **renders**, it’s code-defined.
