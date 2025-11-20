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

   Launch with the “student lab” essentials so the demo feels real: jumpers (single wires), resistors, LEDs, push buttons, DIP‑8 shells (for simple ICs), rail power sources, and measurement helpers (logic probe/indicator LED). Each component publishes `extensions.breadboard` metadata describing its footprint (pin offsets measured in row/column coordinates), pin polarity (e.g., LED anode/cathode), and optional value fields (resistance, voltage). Additional components can be shipped as native nodes or plugins by following the same contract—nothing in core changes.

3. **Rails & Power Semantics**
   - How many rails/buses do we support and how are they labeled?
   - What voltage/logic level presets or constraints apply?
   - How do users configure power sources and grounding?

   Use a classic full-size board: dual power rails on top and bottom, each split into two halves (default labels `VCC1/GND1` and `VCC2/GND2`). A power node lets users set the voltage per rail (defaults 5 V on top, 3.3 V on bottom) and tie halves together if desired. Socket rows follow the standard A–E / F–J columns with the center trench isolated for DIP packages. Rail metadata lives in `graph.extensions.breadboard.rails[]` so it travels with the `.node` file.

4. **Interaction Model**
   - How does a user enter/exit breadboard mode?
   - What does placement, snapping, rotation, and wiring feel like?
   - How do palettes/toolbars differ from the free-form editor?

   The breadboard is “just another graph” — opening the starter `.node` file loads the board overlay and opens the new Node Palette drawer filtered to Breadboard components. Dropping a component places it with default spacing; dragging the body moves it and snaps both pins to the socket grid. Users can grab a specific pin handle to stretch the component so it spans any two sockets (rows need not be adjacent). Wiring uses the existing handle-drag flow: start on a pin, move across the board, snap to a target socket/rail. The palette replaces the old menu, offering search, tags, and drag placement so students feel like they’re picking parts from a bin.

5. **Schema & Validation Impact**
   - What additions are needed for nodes/edges/groups (pins, footprints, board metadata)?
   - How do we enforce socket occupancy, collision rules, and rail constraints?
   - How does breadboard state integrate with GraphCRUD/history?

   Components store everything in existing fields: `node.extensions.breadboard = { footprint: 'resistor', pins: [{ id, row, column, polarity }] }`. Board-level metadata (grid spacing, rail info) lives in `graph.extensions.breadboard`. GraphCRUD/history already preserves `extensions`, so undo/redo works automatically. Validation simply reads that metadata: warn if two pins try to occupy the same socket, if a pin references an invalid row/column, or if a polarized pin is wired to the wrong rail. These checks surface as non-blocking warnings/snackbars so the user can fix issues without corrupting the graph.

6. **Simulation & Measurement**
   - What fidelity do we target (logic only vs. analog)?
   - Where does the simulation run (ScriptNode, background worker, external service)?
   - What telemetry (voltages, logic states, warnings) does the UI need?

   Phase 1 ships with logic-only simulation: components expose HIGH/LOW/high-Z states and the evaluator propagates booleans through edges. The simulator runs inside an existing ScriptNode or plugin worker so it can read the graph via the SDK without freezing the UI. Measurement nodes (logic probe, status LED) subscribe to those updates and display the current state. Analog/SPICE-level simulation is deferred; the schema leaves room (e.g., optional `pin.voltage`) so a future WASM/worker engine can slot in later.

7. **Onboarding & Documentation**
   - What tutorials, tooltips, or guided flows are required?
   - How do we surface troubleshooting (short detection, measurement tools)?

   Include a “Breadboard Starter” file with a 3-step overlay the first time it opens (place resistor → wire LED → run logic sim). Tooltips on breadboard nodes explain pin polarity/rail usage, and the Properties Panel exposes row/column inputs for precise placement. A troubleshooting sidebar lists validation warnings (shorts, duplicate sockets) and houses measurement tools; users can drop a logic probe node from the palette to inspect any pin. Documentation/User Manual gets a Breadboard chapter covering placement, wiring, running the sim, and interpreting probe output.

8. **Constraints & Risks**
   - Performance limits (node count, rendering load) we must plan for?
   - Compatibility concerns with existing graphs/projects?
   - Rollout strategy (feature flag, beta cohort) and success metrics?

   Breadboard graphs are standard `.node` documents, so no migration tricks are needed; older editors simply render the nodes with default chrome. For V1 we target ~200 components / 1 000 edges until we’ve profiled larger boards; the board overlay uses the same NodeGraph layers, so we’ll instrument frame time if performance dips. Rollout is just publishing the template and docs (no feature flag required). Success is demonstrating that a full app experience—palette, snapping, logic sim—can be built entirely on the core graph + plugin primitives without touching editor internals.

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
