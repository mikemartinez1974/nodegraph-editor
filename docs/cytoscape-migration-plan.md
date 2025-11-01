# Cytoscape Migration Plan

## 1. Baseline Inventory

- Catalogue current NodeGraph capabilities: layered rendering, handle drag/drop, groups, background iframe, scripting hooks, history, minimap, grid, lock states, keyboard shortcuts, and event bus events.
- Document node/edge data shapes, nodeTypes/edgeTypes contracts, and any custom styling expectations.
- Identify performance constraints (frame budget, max node count) and UX requirements (selection, hover, tooltips).

## 2. Spike a Cytoscape Renderer

- Create a temporary `CytoscapeGraph` component under `components/NodeGraph/` to render canned nodes/edges.
- Verify React lifecycle integration (mount/unmount), theme color usage, pan/zoom sync, and hashing of element IDs.
- Evaluate available Cytoscape extensions for handles, edge labels, layouts, minimap, and compound nodes.

## 3. Define Adapter Contracts

- Specify the props the editor will pass (nodes, edges, groups, selection arrays, callbacks, pan/zoom setters).
- Implement translation utilities to map editor node/edge objects to Cytoscape elements, including style mapping and node type metadata.
- Decide how to encode group membership (compound nodes, data tags, or separate overlays).

## 4. Build CytoscapeGraph Component

- Replace the `NodeGraph` render pipeline with Cytoscape initialization and element syncing.
- Wire pan/zoom state updates from Cytoscape events back to `GraphEditor` and vice versa.
- Handle selection, multi-select, hover, and context-click events, emitting the same event bus payloads used today.

## 5. Recreate Interactive Features

- Re-implement handle drag/drop using Cytoscape grab-handles or custom overlays positioned via Cytoscape coordinates.
- Rebuild edge creation, snapping, and preview visuals using Cytoscape edge creation APIs or manual overlays.
- Port group dragging/resizing, lock states, and marquee selection using Cytoscape compound nodes and selection filters.

## 6. Integrate Advanced Behavior

- Connect background document rendering (iframe) so it remains in sync with Cytoscape’s viewport.
- Make history/undo work by translating Cytoscape mutations back into editor state snapshots.
- Ensure ScriptRunner RPC methods issue Cytoscape mutations and still update refs/state used by the editor.

## 7. Feature Parity Checklist

- Build a test harness comparing old vs new renderer behind a feature flag.
- Regression test: undo/redo, import/export, scripting proposals, keyboard shortcuts, locking, edge labels, minimap, snap-to-grid.
- Confirm theme switching, default colors, and node type rendering behave identically.

## 8. Performance & UX Tuning

- Profile pan/zoom and large graph rendering in Cytoscape; adjust style sheets, texture caching, and layout choices.
- Validate edge label readability, hover feedback, and focus states.
- Optimize event frequency (debounce selection, throttle viewport sync) to keep React state updates minimal.

## 9. Rollout & Cleanup

- Ship CytoscapeGraph behind a runtime toggle for beta testing.
- Update developer docs, scripting guidance, and `.github/copilot-instructions.md` after migration is stable.
- Remove obsolete layered rendering components once the Cytoscape path fully replaces them.
