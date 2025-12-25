# Twilight OS User Manual  
_“The operating system for the in-between.”_

Twilight is a persistent, executable workspace. Every graph is a living system that remembers where you left off, automates its own growth, and invites you (and your AI copilots) to keep building without starting over. This manual explains how to operate that workspace with confidence.

---

## 1. Core Principles

1. **Persistent State** – Clusters preserve unfinished work, live data, and history. Closing the tab does not reset your canvas.  
2. **Executable Nodes** – Nodes are applications: they fetch data, run scripts, drive breadboards, render 3D scenes, and fire triggers.  
3. **Systemic Layout** – Groups act like OS containers. Handles, sockets, and edges are contracts between subsystems.  
4. **Versioned Reality** – Save and commit clusters through Git/GitHub to maintain a chain of state transitions instead of brittle snapshots.  
5. **Automation First** – ScriptNodes, Background RPC, and procedural loaders construct or mutate graphs at scale.

Remember: Twilight’s value is _not having to start over_. Work with that continuity in mind.

---

## 2. Getting Started Fast

### Step 1 – Sync Your AI
1. Open **📋 Onboard LLM** in the toolbar.  
2. Paste the generated prompt into your AI assistant.  
3. The AI can now emit valid Twilight JSON commands that respect handles, groups, and automation.

### Step 2 – Load / Resume
- Use the Browser address bar to open a `.node` or `tlz://` cluster.  
- Twilight restores the last-saved state (layout, groups, selections).  
- Version-enabled workspaces can pull/push directly from Git using the Browser drawer commands.

### Step 3 – Iterate
1. Paste JSON (`Ctrl+V` or **📋 Paste**) to apply AI or scripted changes.  
2. Use **Undo/Redo** while refining.  
3. Save checkpoints or commit to Git when a milestone is met.

---

## 3. Twilight Shell & Toolbar

| Zone | Purpose |
| --- | --- |
| **Browser App Bar** | Navigation history, Template Gallery, Git actions, bookmarks, theme controls. |
| **Graph Toolbar** | Context-sensitive controls for nodes, edges, automation, history, view, scripting. |
| **Properties Panel** | Edit node/edge/group metadata, markdown, handles, automation toggles. |
| **Panels & Drawers** | Node palette, plugin manager, scripting console, plugin runtime diagnostics. |

Key toolbar actions:

- **Automation** – Launch ScriptNodes, run Background RPC calls, or trigger graph macros.  
- **Mode Switcher** – Manual edit, Navigation-only, Auto-layout (with multiple layout presets).  
- **History Timeline** – Scroll through reversible checkpoints, diff changes, or create named restore points.  
- **Git Controls** – Stage/commit/branch graph files without leaving Twilight.

---

## 4. Persistent State & Versioning

### Auto-Save & Checkpoints
- Twilight records every command into an undo/redo stack.
- Named checkpoints (History Timeline) capture the full graph plus metadata.

### Git / GitHub Integration
- The Browser drawer exposes **Pull**, **Commit**, and **Push** for the active workspace.  
- Commits record JSON diffs of the cluster plus optional notes.  
- Use small, descriptive commits (“Wire LED row to rails”) so other collaborators (or future you) can replay the evolution.

---

## 5. Node Catalog (Executable Components)

| Category | Node | Highlights |
| --- | --- | --- |
| **Visual & Docs** | **MarkdownNode** | Renders `data.markdown` (falls back to `data.memo`). Supports live previews, documentation cards, and rich formatting. |
|  | **DivNode / SvgNode** | Custom HTML/SVG surfaces for bespoke controls or dashboards. |
| **Logic & Flow** | **ValueTrigger Node** | Converts value changes into rising/falling edge triggers. Configure thresholds, debounce, and outputs for chaining automation. |
|  | **Toggle Node** | Supports latching (persistent) and momentary (spring) behavior. Expose handles for ON/OFF events. |
|  | **Gate Node** | Multi-handle logic (AND/OR/XOR). Handles `inputA`, `inputB`, `output`. Works with ValueTrigger for edge detection. |
|  | **Delay Node** | Queues or throttles trigger propagation. Parameters for delay ms, repeat, cancel. |
| **Automation** | **ScriptNode** | Executes stored scripts to generate or mutate graphs, hit APIs, or drive breadboards. Script output can place nodes, edit data, and emit telemetry. |
|  | **Background RPC Node** | Bridges to iframe/worker runtimes. Use `testBackgroundRpc()` from the console to verify exposed methods. |
| **Data & APIs** | **APINode** | Full REST support: choose method (GET/POST/PUT/DELETE), headers, body, auth tokens, and preview responses. Pipe results into downstream nodes. |
| **Stateful Components** | **Counter Node** | Tracks increments/decrements with optional triggers on thresholds. |
|  | **Timer Node** | Stopwatch or countdown with bindings to toggles, scripts, or UI elements. |
| **Spatial / 3D** | **3D Node / Spatial Canvas** | Renders Three.js scenes inside Twilight. Connect handles for camera control, data feeds, and signal events. |
| **Hardware / Breadboard** | **Breadboard Sockets, Rails, Components** | Domain-specific nodes with precise handle schemas (`socket`, `positive`, `negative`, `pinA`, `pinB`). Combine with autowire runtimes for rapid prototyping. |

> Tip: Use the Node Palette search to browse plugin-provided nodes. Each entry shows handle definitions, default data, and categories.

---

## 6. Edge Types & Handle Contracts

- **Child / Parent** – Vertical hierarchy. Handles typically `out` → `in`, but can be custom (e.g., `anode` → `socket`).  
- **Peer** – Lateral relationships; horizontal routing.  
- **Data Flow / Dependency / Reference / Bidirectional / Weak / Strong** – Styled links for flow, prerequisites, citations, or emphasis.  
- **Breadboard Handles** – Use semantic labels like `positive`, `negative`, `pinA`, `shield`. Twilight enforces handle existence during paste/create operations.  
- **Spatial Handles** – Nodes may expose `signal`, `transform`, `camera`, or `pointer` inputs/outputs.

Always inspect `node.handles`, `node.inputs`, and `node.outputs` in the Properties Panel before wiring unfamiliar nodes.

---

## 7. Groups as the OS Layer

Groups do more than declutter—they are structural boundaries:

- **Subsystem Containers** – Encapsulate breadboards, logic circuits, or app modules.  
- **State Isolation** – Hide or lock a group to freeze a subsystem while iterating elsewhere.  
- **Mini Applications** – Combine nodes, scripts, and markdown inside a group to build self-contained tools.  
- **Layout Anchors** – Groups maintain bounds even as inner nodes move, making them perfect for dashboards or labs.  

Use the Group panel to rename, style, collapse, or ungroup as your system evolves.

---

## 8. Automation & Procedural Growth

### ScriptNodes
- Author scripts that read/write the graph via the exposed Graph API.  
- Typical uses: autowire breadboards, generate feature maps, sync with external services, clean up layouts.  
- Scripts can schedule runs, accept parameters, and log output into markdown nodes.

### Background RPC & Plugins
- Plugins run in sandboxed iframes/workers with a minimal Graph API surface.  
- Use `window.testBackgroundRpc(method, args)` to ping plugin methods.  
- Plugins may register custom nodes, panels, or runtime hooks.

### Event Bus Helpers
- The global `window.eventBus` lets advanced users trigger internal events (e.g., `eventBus.emit('toggleTemplateGallery')`).  
- Background runtimes can listen for drag/drop, node move, or clipboard events.

---

## 9. 3D & Spatial Systems

Spatial nodes are live today:

- Render Three.js scenes, animated canvases, or VR previews directly inside nodes.  
- Feed in telemetry from ScriptNodes or ValueTriggers to animate or react to user input.  
- Use groups to partition spatial scenes (“Lab A”, “Simulation Stage”).  
- Combine with Toggle/ValueTrigger nodes to run stateful simulations.

---

## 10. Example Workflows

1. **Breadboard Lab** – Use the Template Gallery to load a breadboard scene. ScriptNodes drop resistors, LEDs, and autowire them. Markdown nodes capture lab notes. ValueTriggers light the LED when rails are powered.  
2. **Product OS** – Organize roadmap clusters in groups (Quarterly, Teams). API nodes fetch metrics, Markdown nodes host planning docs, ScriptNodes sync status from REST endpoints. Git commits track decisions over time.  
3. **Spatial Storyboard** – Combine 3D nodes with Toggle/Timer nodes to storyboard interactions. Markdown nodes narrate scenes, while groups isolate each act.  
4. **Automation Hub** – Build a control room group containing ScriptNodes and ValueTriggers that mutate other groups on schedule (e.g., nightly cleanup, import pipelines).

---

## 11. Troubleshooting & Recovery

| Symptom | Fix |
| --- | --- |
| Paste fails with handle errors | Ensure every edge declares valid handle keys. Inspect node schemas in Properties Panel. |
| Graph looks empty | Use **Auto-Layout**, zoom out, or check if you loaded a new branch without nodes. |
| Markdown doesn’t update | Confirm you’re editing `data.markdown` (Properties Panel does this automatically). |
| ScriptNode error | Open the Script panel log; errors surface there. Fix inputs or update the script, then rerun. |
| Git conflicts | Pull latest, resolve JSON conflicts in the built-in diff viewer, then recommit. |

Validation warnings include skipped nodes/edges with reasons (missing IDs, invalid handles, etc.). Feed those warnings back into your AI prompt so it can correct the JSON next time.

---

## 12. Pro Tips

- **Checkpoint often.** Named history entries make it easy to experiment and roll back.  
- **Narrate with Markdown.** Document playbooks, TODOs, and hypotheses inline.  
- **Use ValueTriggers for instrumentation.** Trigger nodes provide telemetry for dashboards or automation.  
- **Stay modular.** Treat each group as a deployable subsystem. When it graduates, export the `.node` file or branch it in Git.  
- **Leverage the console.** Devtools expose helpers: `window.eventBus`, `window.graphAPI`, `window.backgroundRpcStatus()`, `window.testBackgroundRpc()`.

---

## 13. Glossary

- **Cluster** – A `.node` file loaded in Twilight; comparable to a project or workspace.  
- **Cognitive Runtime** – Twilight’s role as an execution layer for unfinished systems.  
- **Handle** – A named socket on a node that defines connection semantics (type, position, label).  
- **Group** – A structural container acting like an OS window or package.  
- **ScriptNode** – Embedded automation engine for procedural graph mutations.  
- **ValueTrigger** – Node that fires on rising/falling edges, enabling instrumentation and control.  
- **Twilight OS** – The browser + GraphEditor + runtime ecosystem.

---

**Twilight OS: the operating system for the in-between.** Keep building, keep iterating, and never start from zero again.
