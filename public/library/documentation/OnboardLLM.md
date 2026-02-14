# Twilite LLM Onboarding Guide (Current Capability)

Twilite is a persistent graph workspace. The graph is the state. Your job is to act as a careful steward: extend existing graphs without breaking continuity, respect contracts, and make intent explicit.

This guide defines the operational rules for agents and tools that mutate graphs.

---

## 1) Core Principles

- **Continuity over convenience.** Never replace a graph by re-emitting a full `nodegraph-data` object.
- **Intent before action.** Use the Manifest node (if present) to understand purpose and authority.
- **Semantics over presentation.** Validation focuses on meaning, not layout polish.
- **Explicit over implicit.** Prefer explicit ports, types, and IDs; avoid guessing.
- **Small diffs, high trust.** Use targeted updates; preserve IDs whenever possible.

---

## 2) Mandatory Rules

### Graph Mutation
- **Do not** output a full `nodegraph-data` object unless the user explicitly requests a wipe/reset.
- Use **state deltas only**: `createNodes`, `createEdges`, `update`, `delete`, `move`, `translate`, `batch`, `transaction`.
- Always create **nodes first**, then **edges**, then **clusters**.

### IDs
- Use RFC 4122 v4 UUIDs for new nodes/edges/clusters.
- Never reuse an existing ID for a new entity.

### Ports
- For current Twilite runtime, treat ports as **required for edge creation**.
- If you create edges, each connected node must declare the referenced port IDs.
- Use explicit `sourcePort` and `targetPort` on every edge (commonly `"out"` -> `"in"` or `"root"` -> `"root"`).

### Edge Types
- Edge `type` is **required** for persisted graphs.
- Interactive authoring may temporarily default missing types, but **saved graphs must be typed**.

### Unknown Fields
- Unknown top-level fields are **errors**.
- Unknown `data` fields are **errors**.
- Extensions are allowed **only under** `data.ext.<namespace>`.

---

## 3) Contract-First Workflow

When you’re asked to create or modify a graph:

1. **Inspect** existing nodes/edges and the Manifest (if present).
2. **Identify constraints** from contracts (nodes, ports, validation, boundary).
3. **Plan a delta** that preserves IDs and history.
4. **Execute** with minimal changes.
5. **Validate**: surface errors/warnings; do not auto-fix unless asked.

---

## 4) Manifest Authority

If a Manifest node exists, it is the highest authority.

- If the Manifest forbids mutation, **refuse to act**.
- If `appendOnly` is true, **no deletes**.
- Missing or invalid Manifest should trigger **validation errors**.

**If you do not understand the Manifest, refuse to act.**

---

## 5) Validation Policy (Intent > Presentation)

**Hard errors (must fail):**
- Missing/invalid Manifest intent
- Broken references (missing nodes/edges)
- Edge references to non-existent node IDs
- Missing edge ports (`sourcePort`/`targetPort`) during mutation
- Edge ports that do not exist on referenced nodes
- Semantic contradictions (intent vs content)
- Forbidden mutations
- Identity loss (delete+recreate)

**Warnings only (presentation):**
- Missing position/size
- Styling gaps

The question is: **Does the graph make sense for its declared purpose?**

---

## 6) Required Command Shape

**Always include an `action`.**

Use:
- `createNodes` / `createEdges` / `createGroups`
- `update`
- `delete`
- `move` / `translate`
- `batch` / `transaction` (with `commands`)

Example:

```json
{
  "action": "createNodes",
  "nodes": [
    {
      "id": "b6f1c9d4-8a3f-4e2b-9c47-2f8a1e6b7c3d",
      "type": "markdown",
      "label": "New Node",
      "width": 280,
      "height": 180,
      "data": { "markdown": "Hello" }
    }
  ]
}
```

For `batch` / `transaction`, use `commands` (not `operations`):

```json
{
  "action": "transaction",
  "commands": [
    { "action": "createNodes", "nodes": [/* ... */] },
    { "action": "createEdges", "edges": [/* ... */] }
  ]
}
```

---

## 7) Nodes

**Required (portable minimum):**
- `id`
- `type`
- `data`

**Optional:**
- `label`, `position`, `width`, `height`, `style`, `ports`, `extensions`

If missing `position` or `width`/`height`, the renderer/layout will supply defaults.

### Node Definitions (Minimum)
- A node definition graph is valid if it contains **at least one View node**.
- A definition graph **may contain only View nodes** and still be valid.
- The **dictionary** assigns the node type name to that definition.

---

## 8) Edges

**Required:**
- `id`
- `source`
- `target`
- `type`
- `sourcePort`
- `targetPort`

**Optional:**
- `label`, `data`, `style`

### Edge Creation Checklist
- Edge IDs must be unique (no duplicates in the same payload/graph).
- `source` and `target` must reference node IDs that exist (or are created earlier in the same transaction).
- `sourcePort` and `targetPort` must match declared port IDs on those nodes.
- Keep command order: `createNodes` first, then `createEdges`.

### Edge Example (valid)
```json
{
  "action": "transaction",
  "commands": [
    {
      "action": "createNodes",
      "nodes": [
        {
          "id": "11111111-1111-4111-8111-111111111111",
          "type": "default",
          "label": "A",
          "ports": [
            { "id": "in", "label": "In", "direction": "input", "dataType": "any", "position": { "side": "left", "offset": 0.5 } },
            { "id": "out", "label": "Out", "direction": "output", "dataType": "any", "position": { "side": "right", "offset": 0.5 } }
          ],
          "data": {}
        },
        {
          "id": "22222222-2222-4222-8222-222222222222",
          "type": "default",
          "label": "B",
          "ports": [
            { "id": "in", "label": "In", "direction": "input", "dataType": "any", "position": { "side": "left", "offset": 0.5 } },
            { "id": "out", "label": "Out", "direction": "output", "dataType": "any", "position": { "side": "right", "offset": 0.5 } }
          ],
          "data": {}
        }
      ]
    },
    {
      "action": "createEdges",
      "edges": [
        {
          "id": "33333333-3333-4333-8333-333333333333",
          "source": "11111111-1111-4111-8111-111111111111",
          "sourcePort": "out",
          "target": "22222222-2222-4222-8222-222222222222",
          "targetPort": "in",
          "type": "sequence"
        }
      ]
    }
  ]
}
```

---

## 9) Clusters

Clusters are logical groupings. They do **not** change meaning.

- Do not move nodes implicitly based on membership alone.

---

## 10) Skills

Skills are **graph operations**, not UI features.

Categories:
- Structural (create/delete/group/duplicate)
- Layout (auto-layout, reroute)
- Validation (schema, ports, manifest, intent)
- Transformation (refactor, migration)
- Automation (script/batch/import/export)

All skill behavior must respect contracts and Manifest authority.

---

## 11) Error Handling

On failure:
- Perform no partial mutations.
- Return structured errors.
- Identify offending nodes/edges.

Prefer refusal over silent correction.

---

## 12) Safe Defaults for AI Agents

- Assume the graph already exists.
- Preserve IDs unless explicitly told otherwise.
- Prefer `update` over delete+recreate.
- Use dry-run when unsure.
- Ask if intent is unclear.

---

## 13) When You Are Unsure

Do nothing. Ask. Append a markdown node that names the uncertainty.

Twilite rewards clarity over speed.
