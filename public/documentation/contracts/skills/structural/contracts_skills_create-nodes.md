# Skill Contract: Create Nodes

## Skill Name
create-nodes

## Category
Structural Skill

---

## Purpose

Create new nodes in a graph **at any stage of maturity**, from exploratory sketches to fully operational systems.

This skill is permissive by design: it must support incomplete, broken, or evolving graphs without blocking creation, while providing stronger guarantees when more context is available.

---

## Acts On

- Graph node list
- Node identity (new IDs only)
- Node structural fields (type, size, position)
- Node data payload (initial only)

---

## Operating Modes

This skill adapts to graph maturity automatically.

### Bootstrap Mode (default)
Applies when:
- No Manifest node exists, or
- Schema contracts are absent, or
- Graph is explicitly exploratory

Behavior:
- Minimal validation
- Creation is always allowed
- Missing contracts are tolerated
- No versioning or certification enforced

### Operational Mode
Applies when:
- A valid Manifest node exists, and
- Schema contracts are available, and
- Graph passes validation

Behavior:
- Full schema validation
- Manifest invariants preserved
- Version and timestamps updated
- Strong failure semantics enforced

---

## Preconditions

### Required (always)
- Node IDs provided are unique within the graph
- Width and height are provided or derivable
- Input payload is syntactically valid JSON

### Conditional (when context exists)
- If schema contracts exist, node types must be valid
- If a manifest exists, manifest authority rules must not be violated
- If running inside a transaction, transactional guarantees apply

Failure of conditional checks MUST downgrade behavior, not block creation, unless explicitly forbidden by manifest policy.

---

## Postconditions

### Always
- New nodes exist in the graph with stable IDs
- Existing nodes are unchanged
- Existing edges are unchanged
- No node IDs are reused

### When Operational Mode is active
- Graph remains schema-valid
- Graph remains manifest-valid
- Graph version is incremented
- updatedAt timestamp is updated
- Validation state is refreshed

---

## Required Inputs

```json
{
  "nodes": [
    {
      "id": "uuid-v4",
      "type": "string",
      "position": { "x": "number", "y": "number" },
      "width": "number",
      "height": "number",
      "data": {}
    }
  ]
}
```

---

## Optional Inputs

- `position` may be omitted to allow auto-layout
- `data` may be empty if schema allows defaults
- `label` may be omitted if schema allows
- `groupId` may be provided to assign membership

---

## Forbidden Actions (NON-NEGOTIABLE)

This skill MUST NOT:

- Modify existing nodes
- Modify existing edges
- Modify existing groups
- Delete any node
- Recreate nodes with existing IDs
- Infer or guess schema fields
- Auto-generate handles
- Mutate semantic data of other nodes
- Apply layout to existing nodes
- Create edges (use create-edges skill)

---

## Failure Behavior

- In Bootstrap Mode: failure MUST be reported but creation SHOULD proceed when safe
- In Operational Mode: failure MUST abort the mutation
- Errors MUST be explicit and machine-readable
- Silent failure is forbidden

If rollback infrastructure exists, it MUST be used.

---

## Dry Run Behavior

When `dryRun = true`:

- No mutation occurs
- All available validations must still run
- Mode (bootstrap vs operational) must be reported
- A diff preview MAY be returned

---

## Idempotency

This skill is **not idempotent**.

Repeated calls with the same IDs MUST fail due to collision.

---

## Agent Safety Notes

Agents using this skill:

- MUST supply explicit IDs
- MUST read schema contracts if present
- MUST respect manifest authority if present
- MUST tolerate downgrade to bootstrap mode
- MUST NOT assume creation implies validity

---

## Human Safety Notes

Humans invoking this skill should:

- Expect incomplete graphs to be allowed
- Use validation skills to check readiness
- Add manifests when graphs mature
- Treat warnings as guidance, not errors

---

## Rationale

Editors exist to support becoming, not just correctness.

This skill prioritizes:
- continuity
- creative flow
- safety through layering
- emergence over enforcement

Validation and execution are separate concerns.

A graph may be *created* before it is *ready*.
