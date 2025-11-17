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

- [ ] **Plugin Node Registry**  
      Turn `nodeTypeRegistry` into an extensible plugin API with validation and lazy loading (`components/GraphEditor/nodeTypeRegistry.js:19`).
      - [ ] Publish plugin API contract (manifest schema, exports, lifecycle hooks).
      - [ ] Build secure loader with origin allow-list and bundle validation.
      - [ ] Implement runtime registry with register/unregister, caching, persistence.
      - [ ] Ship plugin manager UI for install/update/disable and Add Node integration.
      - [ ] Integrate plugin nodes with CRUD, serialization, theming, scripting.
      - [ ] Provide developer tooling: starter template, docs, types, sample tests.

- [ ] **Operational Dashboards**  
      Use graph stats to build health dashboards and alerts (`components/GraphEditor/GraphCrud.js:637`).

## Polish & Developer Experience

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
  - [ ] **Edge Creation Parity**  
        Update the GraphEditor `handleDrop` flow to rely solely on resolved handles and route everything through GraphCRUD so auto-created nodes/edges also get proper handle keys (`components/GraphEditor/GraphEditor.js`, `components/GraphEditor/handlers/graphEditorHandlers.js`).
  - [x] **Unified Handle Docs & Tests**  
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

## VR Integration TODO

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
  - [ ] Add smoke tests for VR node (non-XR + mocked WebXR).

- [ ] **Phase 6 – Expansion Paths**
  - [ ] Plan multi-user VR leveraging realtime collaboration.
  - [ ] Connect VR rooms to gallery/template pipeline (`components/Browser/Browser.js:54`).
  - [ ] Expose WebXR session data to scripting (`components/GraphEditor/Scripting/ScriptPanel.js:1`).
