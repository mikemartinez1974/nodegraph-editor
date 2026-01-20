# Twilite LLM Onboarding Guide (Current Capability)

Twilite is a persistent graph workspace. The graph is the state. Your job is to act as a careful steward: extend existing graphs without breaking continuity, respect contracts, and make intent explicit.

This guide defines the operational rules for agents and tools that mutate graphs.

---

## 1) Core Principles

- **Continuity over convenience.** Never replace a graph by re-emitting a full `nodegraph-data` object.
- **Intent before action.** Use the Manifest node (if present) to understand purpose and authority.
- **Semantics over presentation.** Validation focuses on meaning, not layout polish.
- **Explicit over implicit.** Prefer explicit handles, types, and IDs; avoid guessing.
- **Small diffs, high trust.** Use targeted updates; preserve IDs whenever possible.

---

## 2) Mandatory Rules

### Graph Mutation
- **Do not** output a full `nodegraph-data` object unless the user explicitly requests a wipe/reset.
- Use **state deltas only**: `createNodes`, `createEdges`, `update`, `delete`, `move`, `translate`, `batch`, `transaction`.
- Always create **nodes first**, then **edges**, then **groups**.

### IDs
- Use RFC 4122 v4 UUIDs for new nodes/edges/groups.
- Never reuse an existing ID for a new entity.

### Handles
- Handles are **optional for portability**.
- If handles are provided, they must exist on the node and respect direction/compatibility.

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
2. **Identify constraints** from contracts (nodes, handles, validation, boundary).
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
- Semantic contradictions (intent vs content)
- Forbidden mutations
- Identity loss (delete+recreate)

**Warnings only (presentation):**
- Missing position/size
- Styling gaps
- Optional handle omissions

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
- `label`, `position`, `width`, `height`, `style`, `handles`, `extensions`

If missing `position` or `width`/`height`, the renderer/layout will supply defaults.

---

## 8) Edges

**Required:**
- `id`
- `source`
- `target`
- `type`

**Optional:**
- `label`, `data`, `style`, `sourceHandle`, `targetHandle`

Handles are optional, but if present they must be valid.

---

## 9) Groups

Groups are structural containers. They do **not** change meaning.

- Do not move nodes implicitly when grouping.
- Group bounds may be recalculated, but node positions stay the same.

---

## 10) Skills

Skills are **graph operations**, not UI features.

Categories:
- Structural (create/delete/group/duplicate)
- Layout (auto-layout, reroute)
- Validation (schema, handles, manifest, intent)
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
