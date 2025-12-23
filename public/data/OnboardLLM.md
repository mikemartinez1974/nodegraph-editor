# Chatbot Onboarding Guide for Twilight OS

Twilight is no longer just a diagramming surface—it is a persistent, executable workspace. A graph is a living cluster that keeps state across sessions, automates its own growth, and expects contributors (humans and AIs) to evolve it safely. Use this guide whenever you generate JSON commands for Twilight OS.

---

## Mindset: Steward, Not Draftsman

- **Preserve continuity.** Your commands extend an existing system; never assume a blank canvas.
- **Automate when possible.** ScriptNodes, Background RPC, and loaders can fabricate or mutate hundreds of nodes in one action.
- **Respect topology.** Handle keys, socket schemas, and groups are domain-specific contracts (breadboards, logic ICs, spatial rigs, etc.). Use them precisely.
- **Version intentionally.** Think in terms of state transitions that can be committed to Git/GitHub, not disposable exports.

---

## Operational Workflow

1. **Inspect context.** Read the current node metadata (type, handles, data, extensions) and note whether automation or Git checkpoints are active.
2. **Plan the delta.** Decide whether to issue a `create`, `update`, `script`, or mixed command. Prefer incremental updates over wholesale rewrites.
3. **Emit precise JSON.** Use UUIDs, declare every handle, and mention the cluster/group you are touching when relevant.
4. **Let Twilight run it.** The user pastes the JSON; Twilight applies it, updates history, and (if configured) records the new state in Git.
5. **Iterate.** React to validation feedback, telemetry, or user direction.

> Twilight’s value is “not having to start over.” Your job is to keep the workspace coherent so unfinished work survives.

---

## First Five Minutes: Ignition

When you drop into an empty cluster, the only wrong move is doing nothing. Start anywhere:

- Add a **Markdown** node and write the question that brought you here. That alone is a valid graph.
- Drop a **Default** node, label it “Next step?”, and connect it to anything—even if the edge has no meaning yet.
- Leave one node floating on the side as a scratchpad. Twilight keeps it safe; you can rearrange later.

Messy beginnings are expected. Crooked nodes, half-finished thoughts, and dangling edges are invitations to grow, not warnings. Twilight remembers every change, so nothing you add in the first minutes is permanent or dangerous. If you feel stuck, add one more node that names the unknown (“What powers this?”, “Need data here”). The workspace will still be here when you return—continuity is the default.

---

## Command Essentials

- Always include an `action`.
- Use RFC 4122 v4 UUIDs for every `id`. Example: `b6f1c9d4-8a3f-4e2b-9c47-2f8a1e6b7c3d`.
- **Declare handles explicitly.** Every edge must specify both `sourceHandle` and `targetHandle`. Many nodes expose multiple sockets (`anode`/`cathode`, `inputA`/`inputB`, etc.). Match the published handle keys exactly.
- **No implicit handles.** Twilight does not auto-create `in`/`out` handles. Nodes must explicitly declare their handles, and edges must reference those exact keys.
- **Handles must be declared before use.** If you want `sourceHandle: "out"` and `targetHandle: "in"`, the nodes must explicitly declare those handle keys (via `handles`, or `inputs`/`outputs` that map to handles).
- **Edges without handle keys will not attach to handles.** If you omit `sourceHandle`/`targetHandle`, Twilight falls back to node-boundary rendering.
- Target the right container. When writing to nested systems (e.g., a breadboard group), include the appropriate group/context references so the user can keep components compartmentalized.
- **Colors are first-class.** You can set `node.color` or `edge.color` with any CSS color string (hex, rgb, hsl). Use color to encode state, ownership, or priority.
- **Edge routing is configurable.** Use `edge.style.route: "orthogonal"` (or `edge.style.orthogonal: true`) to force right-angled paths; set `edge.style.curved: true` for bezier curves. The user can also override routing in Document Properties.
- **Creation order matters.** Always create `nodes` first, then `edges`, then `groups` (every pass). If using `batch`/`transaction`, ensure each command respects this order.

### Supported Actions

| Action | Notes |
| --- | --- |
| `create` | One payload that may include `nodes`, `edges`, `groups`. Nodes are created first, then edges, then groups. |
| `createNodes` / `createEdges` / `createGroups` | Bulk operations for a single entity type. |
| `update` | Accepts `id` or `ids` (array) for nodes, edges, and groups. Use to mutate type, size, data, markdown, sockets, etc. |
| `delete` | Remove nodes/edges/groups (remember: deleting a node also detaches its edges). |
| `read` | Fetch a node/edge/group by id for diagnostics. |
| `addNodesToGroup` / `removeNodesFromGroup` / `setGroupNodes` | Edit group membership by node IDs. |
| `translate` / `move` | Move nodes or groups by a `{x,y}` delta. |
| `duplicate` | Clone nodes (optionally clone edges between them with `includeEdges`). |
| `batch` / `transaction` | Execute multiple commands in order (array in `commands`). |
| `findNodes` / `findEdges` | Query subsets (e.g., “all markdown nodes in group A”). |
| `getStats` | Retrieve counts, bounding boxes, or other metrics. |
| `clearGraph` | Rarely used; wipes the cluster. |

> Deprecated actions such as `add` are rejected. Always use the verbs above.

Tip: Any command can include `"dryRun": true` to validate intent without mutating the graph.

---

## Documentation Nodes and Handles (Important)

Markdown, Canvas, and other documentation-style nodes **do not expose input/output handles by default**.

If you want to connect edges to a documentation node, you must explicitly declare its handles (for example, `in` and/or `out`) using the node’s handle schema (`handles`, or mapped `inputs`/`outputs`). Twilight will not infer or auto-create handles for documentation nodes.

If a node does not declare a handle, **edges referencing that handle will fail**.

If a documentation node is intended to participate in a conceptual or logical flow, declare its handles explicitly.  
If it is purely descriptive, leave it unconnected or organize it using groups instead of edges.

**Do not assume** that a node supports `in` / `out`. Always inspect or define the handle contract before wiring edges.

**Important schema details:**

- `handles` must be an **array** of handle objects (not a map/object). Each handle should include `id`, `label`, `direction`, `dataType`, and `position`.
- Markdown content belongs in `data.markdown` (or `data.memo`), not a top-level `markdown` field.
- Handle `direction` must be `input`, `output`, or `bidirectional` (not `source`/`target`).
- Handle `position` must be an object like `{ "side": "left|right|top|bottom", "offset": 0.5 }` (not a string).
- `sourceHandle` / `targetHandle` must match the handle `id` values you declare.
- `update` requires a target: include `id` or `ids` for nodes/edges/groups. There is no implicit “update all.”

---

## Automation & Procedural Generation

Twilight treats ScriptNodes as first-class builders. Document this when emitting commands:

- **ScriptNodes** can manufacture entire boards: spawn nodes, wire edges, toggle state, emit telemetry.
- Scripts may mutate existing graphs—adjust positions, update data, or swap node types—without recreating them.
- When emitting scripts, include metadata (`data.memo`, `data.markdown`) describing inputs/outputs so future agents understand the routine.

Example: installing a ScriptNode that stitches 200 resistors to a breadboard should describe the handle schema it expects (`sourceHandles: ['wireA','wireB']`) and the group or cluster it will operate in.

---

## Advanced Handle & Socket Models

Document the full handle contract whenever you introduce or modify nodes:

- **Multi-socket nodes:** GateNodes expose `inputA`, `inputB`, `output`. Breadboard sockets use row+column semantics (`A1`, `B1`, …).
- **Skinned sockets:** Breadboard rails use semantic handles (`positive`, `negative`). Custom components may define `pinA`, `pinB`, `shield`, etc.
- **Canvas/3D nodes:** Spatial nodes often provide `signal`, `camera`, or `transform` handles for integration with simulations.

When unsure, ask the user for the node definition or inspect `node.handles` via `read` commands before emitting edges.

---

## Versioning & State Continuity

Twilight graphs are typically stored in Git/GitHub. Help users keep history meaningful:

- Describe changes in commit-friendly chunks (“Add breadboard power rail group”, “Update markdown docs for Lab Cluster A”).  
- Avoid destructively recreating nodes when an `update` would suffice—this preserves IDs and diffs cleanly.
- If you reorganize groups or coordinates, mention it so the user can decide whether to checkpoint the state.

---

## Combined Create Example

```json
{
  "action": "create",
  "nodes": [
    {
      "id": "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
      "label": "Task A",
      "type": "default",
      "position": { "x": 200, "y": 140 },
      "width": 160,
      "height": 80
    },
    {
      "id": "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d",
      "label": "Task B",
      "type": "default",
      "position": { "x": 420, "y": 140 },
      "width": 160,
      "height": 80
    }
  ],
  "edges": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      "source": "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
      "sourceHandle": "out",
      "target": "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d",
      "targetHandle": "in",
      "type": "child",
      "label": "then"
    }
  ],
  "groups": [
    {
      "id": "2f1e0d9c-8b7a-4c3d-9e2f-1a0b9c8d7e6f",
      "label": "Example Group",
      "nodeIds": [
        "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
        "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d"
      ],
      "bounds": { "x": 160, "y": 100, "width": 460, "height": 180 }
    }
  ]
}
```

### Edge Wiring Example (Handles Required)

```json
{
  "action": "createEdges",
  "edges": [
    {
      "id": "c6d51f2f-1a63-4e3f-90a5-6f3c2d6c9b21",
      "source": "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
      "sourceHandle": "out",
      "target": "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d",
      "targetHandle": "in",
      "type": "child",
      "label": "then"
    }
  ]
}
```

---

## Bulk Updates & Other Commands

- **Single-node update**

  ```json
  {
    "action": "update",
    "type": "node",
    "id": "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
    "updates": { "label": "Task A — Updated", "color": "#2e7d32" }
  }
  ```

- **Multi-node update**

  ```json
  {
    "action": "update",
    "type": "node",
    "ids": [
      "0f7b9d52-6b7c-4a41-9b9a-7a6e1d9c2f01",
      "a6e3c4f1-1d2a-4e8c-9f3a-6c2b8e4a1d77",
      "c3d0b5a9-2a1f-4f5a-8e6c-7b8f0e9d2c41"
    ],
    "updates": {
      "type": "markdown",
      "width": 280,
      "height": 180
    }
  }
  ```

- **Delete**

  ```json
  { "action": "delete", "type": "node", "id": "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d" }
  ```

- **Find nodes with notes**

  ```json
  { "action": "findNodes", "criteria": { "hasMemo": true } }
  ```

- **Get stats**

  ```json
  { "action": "getStats" }
  ```

---

## Layout, Groups, and the OS Layer

- Space nodes on ~50px multiples to align with the grid and help groups auto-resize.
- Use groups as functional containers (breadboard sections, logic subsystems, spatial scenes). When creating nodes inside a group, mention the desired `groupId` so users can keep the OS layer organized.
- Large markdown or canvas nodes should declare dimensions up front (e.g., 280×180) for better auto-layout.

---

## Error Handling & Telemetry

- Twilight validates every command. Errors include node ID clashes, missing handles, or malformed JSON. Read and react to the warnings rather than retrying blindly.
- When automation fails mid-run (e.g., ScriptNode throws), produce a follow-up `update` that logs the failure inside a markdown node so the next contributor can recover.

---

## Final Reminders

- Be explicit: mention which subsystem, group, or cluster your change touches.
- Keep diffs small enough that the user can Git-commit them meaningfully.
- Prefer updates over re-creation to preserve node IDs and history.
- Document automation: whenever you add or modify a ScriptNode or Background RPC hook, explain what it will do.

Twilight OS is “the operating system for the in-between.” Treat every command as an incremental upgrade to a living workspace, not a one-off illustration.
