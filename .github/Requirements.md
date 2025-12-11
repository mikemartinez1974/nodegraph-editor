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
      Schema-wise, plugin authors should stick to the new `handles`, `state`, `logic`, and `extensions` fields when defining behavior. Any plugin-specific data must live under a namespaced key inside `extensions` (e.g., `extensions["my.lab.plugin"] = {...}`) so core code can preserve unknown metadata safely.

3. **Security & Isolation**
   - What sandbox model do we rely on (iframe, worker, WASM) and what policies (CSP, origin allowlist) apply?
   - How do plugins request capabilities and how do we enforce least privilege?
   - How do we prevent runaway plugins (timeouts, resource quotas, error boundaries)?

      Plan is to treat every third-party plugin like an untrusted script: it runs in a sandboxed iframe (or Web Worker when UI is not needed) with a strict message-bridge. The host page stays locked down with a conservative CSP; the iframe origin must be explicitly whitelisted in the plugin manifest before we ever load it. Plugins don’t get direct references to GraphCRUD— they request capabilities (`graph.read`, `graph.mutate`, `eventBus.emit`, `storage`, etc.) and the loader only grants the minimal subset declared in the manifest. Calls are proxied over `postMessage`, which lets us enforce timeouts, rate limits, and mutation budgets. If a plugin exceeds CPU or memory thresholds, throws repeatedly, or ignores the contract, we tear down the iframe/worker and surface a warning to the user. This keeps the platform permissive for creative extensions while preserving control of the host app.

4. **Manifest & Distribution**
   - What metadata must a plugin declare (id, version, bundle URL, permissions, exposed nodes/panels)?
   - How do we verify manifests/bundles (signatures, checksum, HTTPS requirements)?
   - What is the install/update/disable lifecycle and where is it stored?

      Each plugin ships a manifest (JSON) that describes the package: `id` (reverse-DNS string), `version`, human-friendly name/description, author, bundle URL(s), declared capabilities (graph.read, graph.mutate, backgroundRPC, custom panels, etc.), and the node/panel types it exposes (with schema refs for handles/data/state). The manifest points at a single entry bundle (ESM) which the loader mounts in a sandbox; breadboard can ship as one manifest with multiple node definitions (board surface, wires, components) and supporting panels. Manifests must be served over HTTPS and may include optional signatures/checksums so we can verify integrity before caching. Install/update metadata (installed version, enabled/disabled state, granted capabilities, last checksum) is stored alongside editor settings (e.g., in IndexedDB/localStorage or a config file) so the host can rehydrate plugins on launch, roll back to a previous version, or disable a plugin without uninstalling it. The lifecycle: user provides manifest URL → loader validates manifest + checksum → sandbox loads bundle with requested capabilities → state persists until user disables/uninstalls via the Plugin Manager.

5. **Runtime APIs**
   - Which GraphCRUD/eventBus/hooks can plugins access, and through what interface (postMessage bridge, SDK)?
   - How do plugins register node definitions, property panels, and background workers?
   - How do we handle async operations, teardown, and error reporting?

      Plugins interact with the host through a typed SDK that rides over `postMessage`. The SDK exposes a curated subset of GraphCRUD (read/query, optional mutate if permitted), eventBus subscription/emission, and a registry API for declaring nodes/panels/background workers. Node registration returns a token and includes metadata (handles schema, default data/state, React component entrypoints) so the host can render nodes inside the sandboxed iframe via shared component contracts. Property panels/backdrops are registered similarly with capability-scoped callbacks. Long-running/background work happens in dedicated workers spawned by the plugin bundle; communication still flows through the capability bridge so the host can throttle or cancel work. Every async request has a timeout—if a plugin exceeds its budget or throws, we report the error via the SDK (console + UI toast) and tear down the sandbox so the graph stays stable. This gives plugins full power to manipulate the graph they own while keeping unrelated canvases safe.

6. **Authoring Experience**
   - What tooling/templates/docs do plugin authors need (CLI, dev server, TypeScript types)?
   - How do we support local development (hot reload, sandbox inspector)?
   - What publishing workflow exists (gallery submission, private installs)?

      Ship a starter toolkit so plugin authors don’t have to reverse-engineer the host: a CLI (`nodegraph-plugin create`) that scaffolds a manifest, TypeScript config, and sample node/panel components; TypeScript types for the SDK so handles/data/state are strongly typed; and docs/walkthroughs covering manifests, schema expectations, and deployment. For local dev, provide a dev server that spins up the sandbox iframe with hot reload (e.g., `npm run plugin:dev`), plus a “sandbox inspector” panel inside the host that shows logs, capability usage, and lifecycle events. Publishing flows should support both private installs (paste manifest URL, confirm permissions) and a curated gallery (submit manifest, run automated checks, reviewers approve → manifest added to official catalog). The plugin manager UI stores installed plugins locally, handles updates (respecting semantic version + changelog prompts), and lets users disable, uninstall, or roll back versions.

7. **User Experience**
   - How do end-users discover, install, trust, and manage plugins (UI placement, permission prompts)?
   - What telemetry/diagnostics help them debug plugin issues?

      Discovery happens through a built-in Plugin Gallery (curated + searchable) and “ambient” avenues (custom Twilight Zone portals, shared manifests/links). Either way, installs funnel through the same Plugin Manager UI: if the plugin comes from the gallery, we show ratings/changelog and the permissions it requests; if it comes from an external link/door, we still show the manifest + permission prompt so the user can accept or reject intentionally. After installation, users manage plugins from one place (enable/disable, update, uninstall, view granted capabilities, see version history). Diagnostics live in a “Plugin Console” drawer showing sandbox logs, capability usage, error stacks, and telemetry like CPU/timeouts—so when a plugin misbehaves, creators and users can see what happened and disable/rollback quickly.

8. **Constraints & Risks**
   - Performance or memory ceilings for loaded plugins?
   - Legal/compliance considerations (licensing, signed bundles)?
   - Rollout plan (feature flag, pilot program) and success metrics?

      Each sandbox (iframe/worker) gets resource guards: max heap, CPU budget, and concurrency limits—configurable but sane defaults (e.g., 256MB RAM, 60s cumulative CPU per minute). If a plugin exceeds limits, it’s throttled or torn down so one runaway plugin can’t exhaust the page. Plugin authors are responsible for their own licensing/compliance; manifests can include license metadata, but we require bundles to be served over HTTPS and strongly recommend signing manifests/checksums for trust. Rollout will start behind a feature flag and a pilot “creator” program; once tooling and telemetry look solid, we open the Plugin Gallery. Success metrics: number of active plugins, install/enable rates, crash/budget violations per plugin, and adoption of the breadboard showcase.

## Breadboard App Requirements

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

   Well, how many are on a real breadboard?  Our breadboard should look and behave like any other.  A power source is a component or a node.  I'm not an engineer, and have not much experience with breadboards, but if grounding or not grounding is a variable, it seems like a toggle on the power supply should suffice.

4. **Interaction Model**
   - How does a user enter/exit breadboard mode?
   - What does placement, snapping, rotation, and wiring feel like?
   - How do palettes/toolbars differ from the free-form editor?

   Since the breadboard is an app/page/graph on the web, the user enters "breadboard mode" by navigating to it.  

   Treat every component as a regular node with adjustable width/height; dragging handles or using a simple resize affordance lets the user stretch a resistor/LED footprint so its pins drop into any two sockets. That keeps placement predictable and leverages the resizing logic you already have.

   For easier placement, let the first click drop the component at a default size, then provide a “pin grab” affordance: click on pin A to anchor it to a socket, then drag pin B to the desired socket (the node stretches as needed). Under the hood you’re just updating node width + handle offsets.

   To make it friendlier, snap pins to sockets via handle snapping (similar to what you built for edges). When the user drags a pin handle near a socket, highlight and snap so they know the lead is seated correctly. The component box resizes automatically to keep both pins aligned with their sockets.

   add numeric inputs in the Properties Panel (“Pin A column”, “Pin B column”) so users can type coordinates; the node updates its position/size accordingly. This complements the visual drag/resize flow and makes it easy to span non-adjacent rows precisely.

5. **Schema & Validation Impact**
   - What additions are needed for nodes/edges/groups (pins, footprints, board metadata)?
   - How do we enforce socket occupancy, collision rules, and rail constraints?
   - How does breadboard state integrate with GraphCRUD/history?

   Breadboard nodes use extensions.breadboard for pin footprints and graph.extensions.breadboard for board metadata. Validation hooks read that data to warn about collisions/socket conflicts, but no new history plumbing is required—GraphCRUD already captures undo/redo because everything is standard node data.

6. **Simulation & Measurement**
   - What fidelity do we target (logic only vs. analog)?
   - Where does the simulation run (ScriptNode, background worker, external service)?
   - What telemetry (voltages, logic states, warnings) does the UI need?

   Fidelity: Phase 1 targets logic-only (digital) simulation so we can ship quickly. Components expose HIGH/LOW states, and edges propagate boolean signals. Analog (voltage/current) simulation is deferred to Phase 2 once the breadboard UX and plug-in flow are proven, but the schema should leave room for voltage/current metadata so we can swap in an analog engine later.

   Execution: The logic simulator runs inside the existing graph runtime (ScriptNode or a dedicated background worker plugin) so it can read the graph via the plugin SDK and emit updates without blocking the UI. When/if we add analog, it will likely run in a WASM worker or external service, but the bridge/telemetry API remains the same.

   Telemetry: For logic sim we surface node/rail states (HIGH/LOW, high-Z) and timing (basic waveforms, event logs). Measurement nodes (logic probe, simple LED indicators) consume that state. When analog arrives, we extend the same channel with voltages/currents and richer measurement nodes (multimeter, oscilloscope).

7. **Onboarding & Documentation**
   - What tutorials, tooltips, or guided flows are required?
   - How do we surface troubleshooting (short detection, measurement tools)?

   Ship a “Breadboard Starter” template with an inline walkthrough: when the board loads, highlight the palette, wiring interaction, and measurement nodes in a 3-step overlay (place component → wire pins → run logic sim). Keep it lightweight but make sure first‑time users see how to drop a resistor and hook up rails.

   Add contextual tooltips on breadboard-specific nodes (e.g., rails, probe) explaining pin semantics (anode/cathode, power rails) and what metadata fields do. These can appear when the node is selected or from a help icon in the Properties Panel.
   Include a troubleshooting sidebar (or measurement panel) that surfaces validation warnings: “Pin A and Pin B share the same rail,” “Short detected between 5V and GND,” etc. The same panel hosts measurement tools (logic probe, LED indicator) so users can drop them onto nodes to inspect states without hunting for hidden diagnostics.

   Update the docs/User Manual with a breadboard chapter that covers: loading the template, using the palette, wiring conventions, available components, running the logic sim, and interpreting measurement readings. Provide a couple of guided exercises (e.g., build an AND gate, detect a short) to reinforce the workflow.

8. **Constraints & Risks**
   - Performance limits (node count, rendering load) we must plan for?
   - Compatibility concerns with existing graphs/projects?
   - Rollout strategy (feature flag, beta cohort) and success metrics?

   Breadboard graphs don’t need to open in older builds, but they should remain valid .node files that the current editor understands. We’ll set a soft cap (≈200 components / 1,000 edges) until we’ve profiled larger boards; if performance dips we’ll instrument the node/edge layers before GA. Since the breadboard ships as a standalone graph template, rollout is simply publishing the file (and docs) once it’s ready—no feature flag required. Success for this demo is proving an app-level experience can be built entirely from our graph + plugin primitives (custom nodes, renderer hints, runtime sim) without touching core code.

## Core Schema Modernization

1. **Node Schema Expansion**
   - What fields do nodes need beyond today (handles/ports, capabilities, state flags, plugin extensions)?

      I don't think a node should carry around editor data as a primary property.  Editor stuff should be in the data property.  So any data we decide to add or changes we make should keep this mind.

   - How do we represent per-handle metadata (direction, type, allowed edge types) and default data schema?

      existing implicit handles (simple mode) and an explicit handles array for advanced/plugin use, where each handle can declare direction, data type, allowed edge types, position, etc.

   - Which fields must be persisted vs. computed at runtime?

      We persist the entire node/edge/group definition; runtime-only fields are limited to UI state (selection, hover, drag) and evaluation outputs that aren’t saved back.

2. **Edge Schema Expansion**
   - What extra edge metadata is required (routing points, evaluation state, plugin extensions)?

      An edge’s functional identity stays the same—source, target, sourceHandle, targetHandle, type (with id for persistence). That encodes direction implicitly via source/target. Everything else is optional metadata we persist when needed:

         – state: flags like enabled/disabled, locked/muted, last evaluation status.
         – logic: conditions, throttles/delays, payload transforms that affect how/when the edge fires.
         – routing/style: control points, label placement, color/dash/arrow/animation info for the editor.
         – extensions: plugin- or breadboard-specific fields (e.g., net names, wire gauges, voltage drop notes).

      These blocks let authors keep simple edges minimal, but give complex workflows/plugins a first-class place to store richer semantics and presentation data.

   - How do we enforce valid handle references while remaining plugin-friendly?

      We let plugins declare handles explicitly, validate edges against those declarations via a shared validator, and fall back to implicit handles when metadata is missing. Errors become warnings in the UI instead of preventing load, so plugins stay flexible but users still get safety nets

   - Do edges need permissions/state flags (locked, muted) and how are they stored?

      Yes—edges may need state flags or permissions (enabled/disabled, locked/muted, read-only, last evaluation status). We’ll keep those optional but give them a well-known place, e.g., an edge.state block with fields like { enabled: true, locked: false, lastStatus: 'ok' }. That keeps the functional data alongside the edge definition so JSON exports/imports preserve it, while styling stays in edge.style. Plugins can still add extra flags in edge.extensions if they need custom behavior.

3. **Group / Board Schema**
   - How are groups/breadboards represented (bounds, nodeIds, style, collapsed state)?
   - What extra metadata (grid layout, rail definitions) must persist with the graph?
   - How do groups integrate with history/export/import?

      Current structure for groups should remain basicaly unchanged.  Editor flags should be stored in a data field, which we should add now if it's not there already.  Included in history/export like nodes/edges, and Breadboard boards would have their own schema (grid/rail metadata) separate from groups to be addressed later, as the breadboard is a seperate app.

4. **Graph-Level Metadata & Options**
   - Which global options belong in the schema (grid size, snap settings, theme, validation flags)?
   - How do we version/migrate graphs as the schema evolves?
   - Where do plugin manifests/registrations hook into the saved graph (if at all)?

      version: already there for migrations.
      metadata: title/description/author (already there).
      Any graph-wide configuration that truly changes how the graph behaves (e.g., validation mode, board presets) if you decide it’s part of the authored artifact.
      For plugin manifests, we can say “plugins reference their own registries; the graph just stores plugin-specific data inside nodes/edges via extensions, not in the top-level document.” That keeps the schema minimal while acknowledging how migrations/plugins hook in.

5. **Extensions & Namespaces**
   - How do we reserve namespaces for plugin-defined data to avoid collisions?
   - What conventions ensure unknown fields are preserved but not executed blindly?
   - How do we document allowed/unsupported customizations for third parties?

      Reserve namespaces: Define dedicated extensions (or pluginData) objects on nodes/edges/groups. Inside, require plugins to prefix keys with their package name (e.g., "extensions": { "acme.widgets": { … } }). Core never writes to that space, so collisions vanish.

      Preserve unknown fields safely: Treat anything under extensions as opaque data—validation only checks that it’s JSON-serializable, and runtime never executes it blindly. When exporting/importing, copy the blob intact. Only the plugin that owns a namespace interprets its content.

      Document supported customizations: Publish the schema contract (fields core owns vs. extension blocks) in GraphAPIdocumentation.md plus a plugin author guide. Spell out naming rules, size limits, and “don’t do this” guidance so third parties know what’s stable, what’s off-limits, and how to keep their data forward-compatible.

6. **Validation & Migration Strategy**
   - How will `validationGuards` evolve to cover the new schema (handles, extensions, groups)?
   - What migration steps are required for existing saves/projects?
   - How do we surface validation errors/warnings to users and plugin authors?

      ValidationGuard evolution: expand the guard to understand the new schema blocks (handles, state, extensions, groups). It should validate node handle definitions (unique ids, direction), ensure edges reference valid handles, and treat extensions as opaque but size-limited. Groups/boards get their own validation (bounds, nodeIds). The guard reports structured warnings/errors so UI/plugins can react.

      Migration steps: bump the schema version, add migration helpers that upgrade old graphs (e.g., default handles for nodes without definitions, wrap legacy fields into new structures). Provide a one-time import path that runs these migrations and surfaces summary logs. Document the steps in GraphAPIdocumentation.

   Surfacing errors/warnings: use existing snackbar/UI messaging for authors, but also emit machine-readable warnings (maybe attached to history entries) so plugin authors see what failed. For plugins, expose validation callbacks via the SDK so they can display their own errors.

## Breadboard Implementation Design

### 1. Canonical Board Schema

- Add `graph.extensions.breadboard` that captures every socket/rail once so both plugins and saved JSON agree on geometry.  
  - `sockets`: list of `{ id: "A10", row: "A", column: 10, x, y, segmentId }` with real canvas coordinates generated by `scripts/generateBreadboardTemplate.mjs`.  
  - `segments`: logical groupings (top/bottom halves, rails, buses) that expose metadata such as `kind` (rail, socketColumn, jumperBus) and adjacency (e.g., `peers: ["A10","B10","C10","D10","E10"]`).  
  - `rails`: named nets with defaults (`V+`, `GND`, `floating`) plus voltage metadata so future simulations can attach analog information.  
- Persist this schema inside every breadboard graph export so the runtime never recomputes socket locations heuristically; the generator script can be re-run when the board layout changes.

### 2. Component Metadata & Placement

- Each breadboard component node already carries `data.pins` and `extensions.plugin`. Extend that with an `extensions.breadboard` payload:

  ```jsonc
  {
    "footprint": { "rows": 2, "columns": 1, "rowPitch": 1, "columnPitch": 1 },
    "pins": [
      { "id": "anode", "segmentPreference": "top", "polarity": "anode" },
      { "id": "cathode", "segmentPreference": "bottom", "polarity": "cathode" }
    ],
    "conductivity": {
      "kind": "passiveComponent",
      "connections": [{ "pins": ["anode", "cathode"], "impedance": "resistive" }]
    }
  }
  ```

- Placement flow in the auto-wire helper:
  1. When the user drops a component, emit `BreadboardAutoWire.nodeQueued` with the node id.  
  2. The helper looks up each pin’s intended socket using the drop target metadata (`row`, `column`, `segmentPreference`).  
  3. Snap the node position so the midpoint between its two pin sockets matches the component’s bounding box center; size is derived from socket spacing and footprint pitch, eliminating “averaged” offsets.  
  4. The helper writes the snapped `position`, `width`, and `height` through `graphAPI.updateNode` so exports match what users see.

### 3. Auto-Wire & Edge Management

- Auto-wire owns every edge connected to breadboard component pins. On drag end (or after load), it:
  1. Rebuilds edges between pin handles and the canonical socket nodes declared in `graph.extensions.breadboard.sockets`.  
  2. Deduplicates by socket, ensuring only one logical edge per pin/socket pair.  
  3. Calls `graphAPI.removeEdge` for orphaned connections before new ones are added to avoid the “loop walking the resistor.”  
- Drag/drop queueing ensures only one rebuild runs at a time; any `ReferenceError` or retry is surfaced via the console and the helper backs off until the queue drains.

### 4. Logic Solver & Pin State

- The helper runs a connectivity solver every time an edge is added/removed or a component moves:
  - Build nets by walking sockets and edges using the `conductivity.connections` metadata.  
  - Mark each pin’s `pinState` with `{ touchesVPlus: boolean, touchesGnd: boolean, netId }`.  
  - Emit `eventBus.emit("breadboard.pinStateChanged", { nodeId, pinId, pinState })` so LED renderers or other measurement nodes rerun their “lit/unlit” logic once per mutation.  
- LEDs (and any indicator node) read `pinState` in their renderer to update instantly when rails disconnect, preventing stale-lit components when the ground tap moves.

### 5. Persistence & Template Workflow

- Update `scripts/generateBreadboardTemplate.mjs` to inject the board schema (`graph.extensions.breadboard`) and pre-run the auto-wire snapping so template JSON already contains correct node positions.  
- When a graph loads, the helper should:
  1. Inspect `graph.extensions.breadboard.version`; if missing or outdated, regenerate sockets/edges before allowing edits.  
  2. Immediately queue all nodes for placement + pinState evaluation so the on-canvas layout self-heals even if the saved JSON predates the schema change.  
- Export flow writes back the latest `position`, `pinState`, and `extensions.breadboard` data so the next load requires zero recomputation.

### 6. Open Questions / Follow-Ups

1. **Template Migration:** Decide whether to store the board schema in a dedicated file (imported via template generator) or inline per graph. Current plan is inline for portability.  
2. **Performance Guardrails:** For now we recalc nets on every mutation; if boards grow larger we can batch or debounce solver runs.  
3. **Plugin Hooks:** Expose `window.eventBus` hooks so third-party measurement nodes can subscribe to `breadboard.pinStateChanged` without touching core.  
4. **Testing:** Add fixture graphs exercising LEDs, resistors, taps, and jumpers plus a Jest test that asserts `pinState` results for a known circuit.

This design gives us deterministic placement, reliable edge rebuilding, and a logic surface that any component can interrogate, fulfilling the “baked in” expectation for the breadboard experience.
