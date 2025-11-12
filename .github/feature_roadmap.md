# Feature Roadmap

## Feature Ideas

- [ ] **Realtime Collaboration**  
      Sync cursors, selections, and undo history across clients so shared graphs update live (`components/NodeGraph/eventBus.js:6`, `components/GraphEditor/GraphCrud.js:11`).

- [x] **Template Gallery**  
      Browser now includes a curated template gallery with search, TLS-first links, and one-click loading (`components/Browser/Browser.js:54`, `components/Browser/TemplateGallery.js:1`).

- [ ] **Background RPC Integrations**  
      Expose handshake methods as connectable graph inputs/outputs (`components/GraphEditor/GraphEditor.js:106`, `components/GraphEditor/components/BackgroundFrame.js:47`).

- [ ] **Automation Platform**  
      Extend ScriptPanel/ScriptNode with scheduling, parameters, and logging (`components/GraphEditor/Scripting/ScriptPanel.js:1`, `components/GraphEditor/Nodes/ScriptNode.js:5`).

- [ ] **Plugin Node Registry**  
      Turn `nodeTypeRegistry` into an extensible plugin API with validation and lazy loading (`components/GraphEditor/nodeTypeRegistry.js:19`).

- [ ] **Operational Dashboards**  
      Use graph stats to build health dashboards and alerts (`components/GraphEditor/GraphCrud.js:637`).

## Polish & Developer Experience

- [ ] **Alignment Tools**  
      Pair snap-to-grid with align/distribute actions (`components/GraphEditor/GraphEditor.js:46`, `components/GraphEditor/components/Toolbar.js:922`).

- [ ] **Advanced Search**  
      Power node list search via GraphCRUD filters and saved queries (`components/GraphEditor/components/NodeListPanel.js:49`, `components/GraphEditor/GraphCrud.js:585`).

- [ ] **Project Dashboard**  
      Expand Document Properties into a project hub (`components/GraphEditor/components/DocumentPropertiesDialog.js:103`, `components/GraphEditor/components/BackgroundControls.js:5`).

- [ ] **History Timeline**  
      Add a visible timeline with diff previews and checkpoints (`components/GraphEditor/hooks/useGraphHistory.js:3`, `components/GraphEditor/components/Toolbar.js:690`).

- [ ] **Responsive Layout**  
      Use media-query flags for condensed mobile/tablet UI (`app/page.js:22`, `components/GraphEditor/GraphEditor.js:42`).
      - [x] Ship mobile FAB toolbar variant and migrate primary actions into its menu (`components/GraphEditor/components/Toolbar.js`, `components/GraphEditor/GraphEditor.js`).
      - [ ] Convert Node/Properties panels into swipeable bottom sheets with touch friendly controls (`components/GraphEditor/components/PropertiesPanel.js`).
      - [x] Add touch gesture hook to block native pinch zoom and prep custom zoom handling (`components/NodeGraph/eventHandlers.js`, `components/NodeGraph/NodeGraph.js`).
      - [ ] Implement `fitNodesToViewport` helper for mobile-first auto-framing on load (`components/GraphEditor/GraphEditor.js`, `components/GraphEditor/hooks/useGraphEditorSetup.js`).
      - [ ] Update modal/dialog flows to use full-screen mobile variants (`components/GraphEditor/components/DocumentPropertiesDialog.js`, `components/Browser/ThemeDrawer.js`).

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
