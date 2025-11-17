# Platform Requirements — Discovery Questions

Use these prompts to capture answers during Phase 1 discovery for both the plugin system and the breadboard showcase plugin.

## Plugin Platform

1. **Goals & Success Criteria**
   - Why do we need a plugin platform (3rd-party nodes, breadboard demo, community ecosystem)?
   - What outcomes prove the platform works (external team builds/shares a node without touching core)?

      We need user nodes because that's how users will describe things.  Building the breadboard will show that useable logic can be built with the system to an audience that can make good use of the platform.

2. **Extension Surface**
   - Which areas can plugins extend (node types, panels, background RPC, graph hooks)?
   - What remains off-limits for now (routing, auth, kernel)?

      General app security should always be a consideration, but hacking the internet through the node network is just not the best way to get anything done, and I don't see any reason to be paranoid about it.  Users should be able to define an edge, node, or group, and render it as they wish.  Any code that is written should be sandboxed just like any other script attached to graph.

3. **Security & Isolation**
   - What sandbox model do we rely on (iframe, worker, WASM) and what policies (CSP, origin allowlist) apply?
   - How do plugins request capabilities and how do we enforce least privilege?
   - How do we prevent runaway plugins (timeouts, resource quotas, error boundaries)?

4. **Manifest & Distribution**
   - What metadata must a plugin declare (id, version, bundle URL, permissions, exposed nodes/panels)?
   - How do we verify manifests/bundles (signatures, checksum, HTTPS requirements)?
   - What is the install/update/disable lifecycle and where is it stored?

5. **Runtime APIs**
   - Which GraphCRUD/eventBus/hooks can plugins access, and through what interface (postMessage bridge, SDK)?
   - How do plugins register node definitions, property panels, and background workers?
   - How do we handle async operations, teardown, and error reporting?

6. **Authoring Experience**
   - What tooling/templates/docs do plugin authors need (CLI, dev server, TypeScript types)?
   - How do we support local development (hot reload, sandbox inspector)?
   - What publishing workflow exists (gallery submission, private installs)?

7. **User Experience**
   - How do end-users discover, install, trust, and manage plugins (UI placement, permission prompts)?
   - What telemetry/diagnostics help them debug plugin issues?

8. **Constraints & Risks**
   - Performance or memory ceilings for loaded plugins?
   - Legal/compliance considerations (licensing, signed bundles)?
   - Rollout plan (feature flag, pilot program) and success metrics?

## Breadboard Plugin Requirements

1. **Personas & Success Criteria**
   - Who are we building the breadboard for (education, prototyping, logic design)?
   - What outcomes define success for those users?

   The breadboard is for engineering students for use in simple logic design.  It must double as a proof that third parties can author complex nodes/plugins without touching core.  Success means a plugin author can build, share, and run the breadboard entirely through the public plugin APIs while the experience feels reliable enough for classroom demos.

2. **Component Catalog**
   - Which components/footprints must ship in the first release?
   - What metadata (pins, spacing, ratings) does each require?
   - Will users add custom components, and how?

   I'm aiming for a basic breadboard because this is really just a demo.  A small handful of components will be adequate, and the ability to add custom components seems like an obvious thing to add.  

3. **Rails & Power Semantics**
   - How many rails/buses do we support and how are they labeled?
   - What voltage/logic level presets or constraints apply?
   - How do users configure power sources and grounding?

4. **Interaction Model**
   - How does a user enter/exit breadboard mode?
   - What does placement, snapping, rotation, and wiring feel like?
   - How do palettes/toolbars differ from the free-form editor?

5. **Schema & Validation Impact**
   - What additions are needed for nodes/edges/groups (pins, footprints, board metadata)?
   - How do we enforce socket occupancy, collision rules, and rail constraints?
   - How does breadboard state integrate with GraphCRUD/history?

6. **Simulation & Measurement**
   - What fidelity do we target (logic only vs. analog)?
   - Where does the simulation run (ScriptNode, background worker, external service)?
   - What telemetry (voltages, logic states, warnings) does the UI need?

7. **Onboarding & Documentation**
   - What tutorials, tooltips, or guided flows are required?
   - How do we surface troubleshooting (short detection, measurement tools)?

8. **Constraints & Risks**
   - Performance limits (node count, rendering load) we must plan for?
   - Compatibility concerns with existing graphs/projects?
   - Rollout strategy (feature flag, beta cohort) and success metrics?
