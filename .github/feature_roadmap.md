# Feature Roadmap

## Feature Ideas

- [ ] **Realtime Collaboration**  
      Sync cursors, selections, and undo history across clients so shared graphs update live (`components/NodeGraph/eventBus.js:6`, `components/GraphEditor/GraphCrud.js:11`).

- [x] **Template Gallery**  
      Browser now includes a curated template gallery with search, TLS-first links, and one-click loading (`components/Browser/Browser.js:54`, `components/Browser/TemplateGallery.js:1`).

- [x] **Background RPC Integrations**  
      Expose handshake methods as connectable graph inputs/outputs (`components/GraphEditor/GraphEditor.js:106`, `components/GraphEditor/components/BackgroundFrame.js:47`).

- [ ] **Automation Platform**  
      Extend ScriptPanel/ScriptNode with scheduling, parameters, and logging (`components/GraphEditor/Scripting/ScriptPanel.js:1`, `components/GraphEditor/Nodes/ScriptNode.js:5`).

- [x] **Plugin Node Registry**  
      Turn `nodeTypeRegistry` into an extensible plugin API with validation and lazy loading (`components/GraphEditor/nodeTypeRegistry.js:19`).
      - [ ] Publish plugin API contract (manifest schema, exports, lifecycle hooks).
      - [ ] Build secure loader with origin allow-list and bundle validation.
      - [ ] Implement runtime registry with register/unregister, caching, persistence.
      - [ ] Ship plugin manager UI for install/update/disable and Add Node integration.
      - [ ] Integrate plugin nodes with CRUD, serialization, theming, scripting.
      - [ ] Provide developer tooling: starter template, docs, types, sample tests.

- [ ] **Operational Dashboards**  
      Use graph stats to build health dashboards and alerts (`components/GraphEditor/GraphCrud.js:637`).

- [x] **Node/Component Palette**  
      Replace the dropdown Add Node menu with a docked palette that supports search, tags, favorites, and drag-placement for hundreds of node types (breadboard components, plugins, core nodes). Acts as the “asset browser” for future apps and plugin packs.

## [x] Core Schema Modernization

- [x] **Phase 1 – Specification**  
      Lock down the expanded node/edge/group schema (handles, state flags, extensions) and update contracts in `components/NodeGraph/schema.js` + docs.
  - [x] Document node handles/capabilities, state (locked, collapsed), plugin `extensions`, and group metadata.
  - [x] Define global graph options (grid, snap, theme) and persist group/board structures.
  - [x] Publish migration guidance in `components/GraphEditor/GraphAPIdocumentation.md`.

- [x] **Phase 2 – Validation & CRUD**  
      Teach `validationGuards`, `GraphCrud`, and serialization helpers about the new schema pieces.
  - [x] Update `components/NodeGraph/validationGuards.js` to validate handles, extensions, and groups.
  - [x] Extend `components/GraphEditor/GraphCrud.js` to read/write the new fields and keep history/export compatible.
  - [ ] Add/adjust unit tests in `tests/graphCrud.test.js`.

- [x] **Phase 3 – Consumer Updates**  
      Align UI/components with the new schema.
  - [x] Refresh `PropertiesPanel`, handlers, and node/edge components to expose new fields safely.
  - [x] Update plugin onboarding (`.github/Requirements.md`, `GraphAPIdocumentation.md`) with schema expectations.
  - [ ] Ensure breadboard/plugin efforts use only the documented extensions.

> **Note:** This modernization unblocks the plugin platform and breadboard work by giving third parties a stable, extensible schema surface.

## [ ] Plugin Platform Roadmap

- [x] **Phase 0 – Discovery & Guardrails**  
      Document plugin goals (3rd-party nodes, breadboard demo), threat model, and API boundaries in `.github/Requirements.md` + `components/GraphEditor/GraphAPIdocumentation.md`.
  - [x] Define success metrics (external teams can author/render nodes without forking core).
  - [x] List supported extension points (node types, panels, RPC hooks) and out-of-scope areas.
  - [x] Capture security constraints (origin allowlist, sandbox type, capability-based APIs).

- [x] **Phase 1 – Manifest & Registry**  
      Ship a manifest schema and runtime registry that discovers, validates, and stores plugin metadata.
  - [x] Author JSON schema for plugin manifest (id, version, bundle URL, exposed nodes/panels, permissions).
  - [x] Add registry persistence + CRUD (install, update, disable) in `components/GraphEditor/nodeTypeRegistry.js`.
  - [ ] Build validation + signature checks before loading remote bundles.

- [x] **Phase 2 – Sandbox & Runtime Loader**  
      Create a hardened loader (iframe/worker) that evaluates plugin bundles and exposes a minimal Graph API surface.
  - [x] Implement loader host (BackgroundFrame or new worker) with handshake, capability negotiation, and timeout enforcement.
  - [x] Whitelist APIs (GraphCRUD, eventBus, selection) and proxy events/messages through typed bridges.
  - [x] Add crash isolation + telemetry so faulty plugins fail gracefully.

- [x] **Phase 3 – Node Definition APIs**  
      Give plugin authors declarative ways to define nodes, handles, and panels that render inside NodeGraph.
  - [x] Publish node definition contract (props, data schema, handles, property panel hooks).
  - [x] Provide helper SDK (React hooks + TypeScript types) so developers can register custom node components.
  - [x] Support plugin-provided styles/assets while enforcing theming + sanitization rules.

- [x] **Phase 4 – Tooling & Distribution**  
      Deliver authoring tooling and UX for discovering/installing plugins.
  - [x] Release a starter template/CLI to scaffold plugin projects with lint/tests.
  - [x] Build Plugin Manager UI (install from URL, browse gallery) integrated into Toolbar/AddNodeMenu.
  - [x] Surface permission prompts, changelog notices, and version pinning.

- [ ] **Phase 5 – QA, Docs, Rollout**  
      Validate the platform and prep public launch.
  - [ ] Add automated tests covering manifest validation, sandboxed execution, and node rendering lifecycle.
  - [ ] Document plugin author guide + API reference in `components/GraphEditor/GraphAPIdocumentation.md` and `.github/CONTRIBUTING.md`.
  - [ ] Ship behind feature flag, onboard pilot partners, collect feedback before GA.

> **Dependency:** Breadboard roadmap remains intact but is blocked on Phases 0–3 of the plugin platform so the breadboard ships as a showcase plugin rather than core-only code.

## Engineering Backlog (Plugin Platform)

A focused engineering backlog to harden and ship the plugin platform. Items are prioritized and include a short effort estimate.

- [ ] Fix critical host-method bug in PluginRuntimeHost (graph:getNodes) — Effort: small
  - Correct the thrown error and ensure host methods consistently call a normalized GraphAPI adapter.

- [ ] Add GraphAPI adapter/wrapper — Effort: small → medium
  - Provide a single place that normalizes readNode/readEdge/create/update/delete return shapes and errors for both host and plugin runtimes.

- [ ] Harden manifest validation & sandbox checks — Effort: small

  - Enforce allowed sandbox values ("iframe" | "worker"), validate renderer.entry URLs, and provide clearer error messages.

- [ ] Manifest ↔ bundle consistency validation — Effort: medium

  - Validate manifest node.entry fragments (#Symbol) match exported plugin-provided entries or relax manifest expectations.

- [ ] Consolidate renderer boilerplate into helper module — Effort: medium

      - Centralize canvas mounting, DPR handling, resize/cleanup helpers and refactor   renderers to use it.

- [ ] Standardize SDK/permission surface & docs — Effort: medium

  - Publish expected Graph API shapes, host-method contracts, permission model and lifecycle examples for plugin authors.

- [ ] Choose canonical autowire runtime and remove legacy copies — Effort: medium

  - Consolidate duplicate autowire scripts, update generator to inject canonical runtime, and archive legacy files.

- [ ] Add automated tests & CI checks for plugins — Effort: medium → large

  - Manifest validation tests, sandbox handshake/handshake-failure tests, and renderer smoke tests. Lint rule to disallow global document mutations in renderers.

- [ ] Integrate telemetry & graceful crash handling — Effort: medium

  - Surface plugin load/handshake errors in diagnostics and fail plugins without impacting host UI.

- [ ] UX: Plugin Manager + permission prompts — Effort: medium

      - Install UI, permission prompts, version pinning, and changelog display.

## [ ] Polish & Developer Experience

- [x] **Alignment Tools**  
      Pair snap-to-grid with align/distribute actions (`components/GraphEditor/GraphEditor.js:516`, `components/GraphEditor/components/Toolbar.js:822`).

- [x] **Advanced Search**  
      Power node list search via GraphCRUD filters and saved queries (`components/GraphEditor/components/NodeListPanel.js:49`, `components/GraphEditor/GraphCrud.js:585`).

- [x] **Project Dashboard**  
      Expand Document Properties into a project hub (`components/GraphEditor/components/DocumentPropertiesDialog.js:103`, `components/GraphEditor/components/BackgroundControls.js:5`).

- [ ] **History Timeline**  
      Add a visible timeline with diff previews and checkpoints (`components/GraphEditor/hooks/useGraphHistory.js:3`, `components/GraphEditor/components/Toolbar.js:690`).

- [ ] **Engineering Backlog**

  - [x] **GraphEditor Decomposition**  
        Break `GraphEditor.js` into focused providers for state, history, RPC, and layout so the main component stops acting as a god object (`components/GraphEditor/GraphEditor.js`).

  - [x] **Safe Event Bus Hooks**  
        Wrap `eventBus` subscriptions in a cleanup-aware hook to prevent leaked listeners when panels mount/unmount (`components/NodeGraph/eventBus.js`, `components/GraphEditor/components/*`).
  
  - [x] **Automated CRUD/Search Tests**  
        Cover `GraphCRUD` create/update/find flows plus the advanced NodeList filters with unit + integration tests (`components/GraphEditor/GraphCrud.js`, `components/GraphEditor/components/NodeListPanel.js`).
  
  - [x] **Accessibility Audit**  
        Add aria labels, keyboard focus management, and screen reader hints across drawers, panels, and icon-only controls (`components/GraphEditor/components/PropertiesPanel.js`, `components/GraphEditor/components/NodeListPanel.js`).
  
  - [ ] **Performance Profiling**  
        Benchmark large graphs, memoise expensive selectors, and investigate worker offloading for heavy search/layout tasks (`components/GraphEditor/GraphEditor.js`, `components/GraphEditor/components/NodeListPanel.js`).
  
  - [x] **Handle-Aware GraphCRUD**  
        Teach Edge CRUD helpers to require `sourceHandle`/`targetHandle`, validate them against node schemas, and persist handle metadata so downstream nodes receive the right inputs (`components/GraphEditor/GraphCrud.js`, `components/GraphEditor/handlers/pasteHandler.js`, `types/logicSchema.js`).
  
  - [x] **Retire Legacy Handle UI**  
        Delete the unused canvas handle components/utilities that predate the unified schema so nobody accidentally revives the wrong API (`components/NodeGraph/Handle.js`, `components/NodeGraph/utils/handleUtils.js`, `components/NodeGraph/portUtils.js`).
  
  - [x] **Edge Creation Parity**  
        Update the GraphEditor `handleDrop` flow to rely solely on resolved handles and route everything through GraphCRUD so auto-created nodes/edges also get proper handle keys (`components/GraphEditor/GraphEditor.js`, `components/GraphEditor/handlers/graphEditorHandlers.js`).
  
  - [ ] **Unified Handle Docs & Tests**  
        Expand the GraphCRUD tests plus contributor docs to cover handle-aware edges and keep plugin authors aligned with the new contract (`tests/graphCrud.test.js`, `components/GraphEditor/GraphAPIdocumentation.md`, `.github/NodeLogicSystem.md`).
  
  - [x] **Script & Plugin Hardening**  
        Enforce origin allowlists, timeouts, and sandboxing for background RPC and script execution before shipping user plugins (`components/GraphEditor/components/BackgroundFrame.js`, `components/GraphEditor/Scripting/ScriptRunner.js`).

- [x] **Responsive Layout**
      Use media-query flags for condensed mobile/tablet UI (`app/page.js:22`, `components/GraphEditor/GraphEditor.js:42`).

      - [x] Ship mobile FAB toolbar variant and migrate primary actions into its menu (`components/GraphEditor/components/Toolbar.js`, `components/GraphEditor/GraphEditor.js`).
      
      - [x] Convert Node/Properties panels into swipeable bottom sheets with touch friendly controls (`components/GraphEditor/components/PropertiesPanel.js`).
      
      - [x] Add touch gesture hook to block native pinch zoom and prep custom zoom handling (`components/NodeGraph/eventHandlers.js`, `components/NodeGraph/NodeGraph.js`).
      
      - [ ] Implement `fitNodesToViewport` helper for mobile-first auto-framing on load (`components/GraphEditor/GraphEditor.js`, `components/GraphEditor/hooks/useGraphEditorSetup.js`).
      
      - [x] Update modal/dialog flows to use full-screen mobile variants (`components/GraphEditor/components/DocumentPropertiesDialog.js`, `components/Browser/ThemeDrawer.js`).
      
## [ ] VR Integration TODO

- [ ] **Phase 0 – Baseline Cleanup**
  
  - [ ] Extract reusable Three.js helpers and lifecycle hooks (`components/GraphEditor/Nodes/ThreeDNode.js:2`).
  
  - [ ] Formalize event payloads for resize/focus/VR on the event bus (`components/NodeGraph/eventBus.js:6`).

- [ ] **Phase 1 – Room Scene Foundation**
  
  - [ ] Replace cube with configurable room scene and scene-config data model (`components/GraphEditor/Nodes/ThreeDNode.js:24`).
  
  - [ ] Add room presets to Properties Panel (`components/GraphEditor/components/PropertiesPanel.js:1`).

- [ ] **Phase 2 – WebXR Enablement**
  
  - [ ] Integrate WebXR helpers/VRButton with an “Enter VR” control.
  
  - [ ] Manage XR lifecycle with OrbitControls fallback (`components/GraphEditor/Nodes/ThreeDNode.js:52`).

- [ ] **Phase 3 – VR Node Type**
  
  - [ ] Register `vr-room` node type for XR-ready scene (`components/GraphEditor/nodeTypeRegistry.js:19`).
  
  - [ ] Expose graph events for asset loading/teleport (`components/GraphEditor/GraphEditor.js:106`).

- [ ] **Phase 4 – Interaction Bridge**
  
  - [ ] Emit controller/hand events via event bus (`components/NodeGraph/eventBus.js:6`).
  
  - [ ] Build VR affordances that translate controller input into graph actions.

- [ ] **Phase 5 – Performance & QA**
  
  - [ ] Profile loops and surface quality settings (`components/GraphEditor/components/PropertiesPanel.js:400`).

## [ ] Graph Editor Slice Plan

- [x] Extract document/metadata providers (`theme`, `project meta`, `grid/pan settings`) from `components/GraphEditor/GraphEditor.js` into standalone hooks so the root component becomes declarative.

- [x] Move pan/zoom, selection, marquee, and drag controller state into a `useGraphInteractions` hook/context and pass only intents to `NodeGraph`.

- [x] Introduce `usePluginRuntime` to encapsulate GraphCRUD limits, background RPC integration, and plugin registry wiring; expose it via `GraphEditorContext`.

- [x] Add unit/smoke coverage for each extracted hook and document the resulting architecture here so it’s clear how the editor refactor ties into the broader plugin/breadboard effort.
  
  - [ ] Add smoke tests for VR node (non-XR + mocked WebXR).

- [ ] **Phase 6 – Expansion Paths**
  
  - [ ] Plan multi-user VR leveraging realtime collaboration.
  
  - [ ] Connect VR rooms to gallery/template pipeline (`components/Browser/Browser.js:54`).
  
  - [ ] Expose WebXR session data to scripting (`components/GraphEditor/Scripting/ScriptPanel.js:1`).

## [ ] Breadboard Roadmap

- [x] **Phase 1 – Discovery & Requirements**  
      Capture personas/use-cases, map current nodes/handles to breadboard concepts, and record UX storyboards + requirements in `components/GraphEditor/GraphAPIdocumentation.md` and `.github/feature_roadmap.md` for alignment.
  
  - [x] Define breadboard component catalog, rails/power semantics, and interaction goals.
  
  - [x] Audit existing validators/CRUD flows for compatibility with breadboard constraints and log deltas.
  
  - [x] Storyboard breadboard mode entry/exit, palettes, and simulation touchpoints in `components/GraphEditor/README.md`.

  Component catalog & rails

      Rails: classic dual power rails (top/bottom) split into two halves each. Default labels VCC1/GND1 on top, VCC2/GND2 on bottom, with configurable voltages (defaults 5 V & 3.3 V). Users can relabel rails or tie them together with jumper wires.
      Socket grid: standard 5-hole columns (A‑E and F‑J), center trench for DIP ICs. Metadata should record row/column indices (A1..J63) so any node can specify which sockets its pins occupy.

      Starter component set:
      Jumpers (single-wire connections spanning any two sockets)
      Resistor (2 pins, optional color bands/value)
      LED (anode/cathode pins with polarity, long/short lead metadata)
      Push button (4 pins bridging center trench)
      DIP‑8 package (template for logic ICs)
      Power source node (ties rails to voltage)
      Logic probe / indicator LED (measurement nodes)
      Components declare extensions.breadboard.footprint with pin offsets and polarity so the renderer and validator know spacing.
      Interaction goals

      Placement: drag components from the palette; they drop at default size with pins aligned to grid. Users can reposition either by dragging the body (snaps so both pins stay in sockets) or grabbing an individual pin handle and dragging to a new socket (node stretches as needed). For precise placement, the properties panel exposes numeric row/column fields per pin.

      Wiring: jumpers are just edges/“wire nodes”; start a wire from any pin handle, move the cursor near another socket, and snap to it (reusing the snapping logic already implemented). Hover highlights show valid targets; invalid ones (occupied socket, rail conflict) flash red with a snackbar warning.

      Measurement/simulation touchpoints: measurement nodes (logic probe, LED indicator) can connect to any pin to display state. A “Run Logic Sim” button toggles evaluation so students see HIGH/LOW badges on rails/pins.

      Validators & CRUD

      Nodes store extensions.breadboard.pins[] = [{ id, row, column, polarity, railLabel }] so GraphCRUD/history already persist placement. Validators check:
            No two pins occupy the same socket unless explicitly allowed (e.g., jumper stacking)
            Pins align to valid row/column coordinates
            Rail connections respect polarity (i.e., LED cathode not tied to VCC)

      These validators run as part of existing validationGuards and surface warnings (not hard failures) in the UI so the user can fix issues.

      Storyboard / flow

      User opens the breadboard template (just a .node file). The Node Palette drawer opens automatically with the “Breadboard” tab selected, guiding them to drag a resistor.
      They drop the resistor; handles appear on each pin. Dragging a handle near a socket snaps it into place; snackbar confirms e.g. “Resistor pins inserted at A5 / F5”.
      To wire, they click a resistor pin handle, drag across the board, and release over another socket or rail; the wire snaps and highlights. If a socket is already occupied, the validator warns “Socket A5 already used by LED”.

      Simulation: user clicks “Run Logic” in the toolbar; logic states appear on rails/pins, measurement nodes (logic probes) show HIGH/LOW, and warnings (short circuits) surface in the troubleshooting sidebar.

- [x] **Phase 2 – Data & Schema Layer**  
      Extend node/group schema plus validation so footprints/pins/board metadata round-trip through GraphCRUD/history.
  - [x] Add `data.pins[]`, footprint dimensions, and board metadata to schema definitions (`components/NodeGraph/schema.js`, `types/logicSchema.js`).
  - [x] Teach `GraphCrud` and `validationGuards` to enforce pin counts, rail constraints, and placement rules; add unit tests in `tests/graphCrud.test.js`.
  - [x] Decide storage for breadboard-level state (board presets, import/export) and document API contracts.

- [ ] **Phase 3 – Canvas & Interaction Layer**  
      Represent the entire breadboard (sockets, rails, background skin) using standard nodes and edges so scale/perf can be validated on a production-sized graph.
  
  - [x] Define socket/rail node types (or grouped “column” nodes) that encode their row/column metadata, are locked in place, and ship inside the template as the physical board substrate (`components/GraphEditor/nodeTypeRegistry.js`, template JSON).
  
  - [x] Author breadboard component nodes (jumpers, resistors, DIP packages) whose handles snap to nearby socket nodes using the existing grid spacing/selection hooks, emitting warnings when sockets are occupied or rail polarity mismatches occur; delivered via the new `io.breadboard.components` plugin (Components: `public/plugins/breadboard-components`).
  
  - [ ] Update drag/selection/handle handlers plus GraphCRUD glue so moving or wiring a component simply reassigns edges between component handles and socket nodes, keeping history/undo intact (`components/GraphEditor/handlers/graphEditorHandlers.js`, `components/NodeGraph/HandleLayer.js`).
  
  - [ ] Add optional “board skin” nodes (canvas node or locked background image) for visuals without introducing custom rendering layers; confirm the graph still performs with ~800 socket nodes + rails.

- [ ] **Phase 4 – Simulation & Tooling**  
      Provide inspection + simulation workflows leveraging ScriptNode/Background RPC.
  
  - [ ] Define simulation API (voltage/logic updates, measurement events) and wire to `components/GraphEditor/components/BackgroundFrame.js` or ScriptNode.
  
  - [ ] Add measurement tool nodes/panels (virtual multimeter, logic analyzer) and hook toolbar controls into board context.
  
  - [ ] Document and implement safety checks (power toggles, shorts detection) surfaced via snackbar/dialog flows.

- [ ] **Phase 5 – Testing, Docs, Rollout**  
      Harden the experience and prepare public launch materials.
  
  - [ ] Add integration tests for board creation, validation errors, and simulation results.
  
  - [ ] Update `README.md`, `public/data/UserManual.md`, and onboarding docs with breadboard tutorials and warnings.
  
  - [ ] Ship behind a feature flag or beta toggle, gather feedback, then graduate to default mode.
