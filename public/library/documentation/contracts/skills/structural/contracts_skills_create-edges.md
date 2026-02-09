# Skill Contract: Create Edges

**Skill name:** `createEdges`  
**Category:** Structural Skills  
**Intent:** Safely create new relationships between existing nodes without altering existing meaning.

---

## Purpose

This skill creates **edges as meaning-bearing relationships** between nodes.  
Edges are semantic commitments. They are not layout hints, UI wires, or visual decoration.

This contract defines how edges may be added **without corrupting identity, history, or interpretation**.

---

## Scope

This skill:
- Creates new edges only
- Never mutates existing nodes, edges, or clusters
- Never infers semantics
- Never rewires existing relationships

This skill does **not**:
- Auto-create nodes
- Auto-create ports
- Delete or replace edges
- Change meaning implicitly

---

## Preconditions

Before execution, the following must be true:

1. **Source and target nodes exist**
   - Both node IDs must already be present in the graph
   - Missing nodes must cause failure

2. **Port contracts are respected (if used)**
   - If `sourcePort` or `targetPort` is provided:
     - The port ID must exist on the node type
     - Direction must be valid
     - Compatibility rules must pass
   - If ports are omitted:
     - The edge must be semantically neutral (documentation, grouping, reference)

3. **Edge identity is unique**
   - Edge IDs must not already exist
   - No delete+recreate patterns allowed

4. **No implicit rewiring**
   - Existing edges between the same nodes must not be removed or replaced
   - Multiplicity is allowed unless forbidden by schema

5. **Graph must be mutable**
   - If a Manifest node exists and forbids mutation, execution must fail
   - If no Manifest exists, mutation is allowed (editor-level graph)

---

## Inputs

```ts
{
  edges: Array<{
    id: string
    source: string
    target: string
    sourcePort?: string
    targetPort?: string
    type?: string
    label?: string
    data?: object
  }>
}
```

---

## Postconditions

After successful execution:

1. **All edges exist**
   - Each edge appears exactly once
   - No other edges are modified

2. **Meaning is strictly additive**
   - The graph has more information, never less
   - Existing interpretation remains valid

3. **Ordering is preserved**
   - Edges are created after nodes
   - Edge creation does not trigger layout or rerouting

4. **Auditability is preserved**
   - Operation can be replayed safely
   - Diffs are minimal and meaningful

---

## Forbidden Actions

This skill must never:

- Delete or modify existing edges
- Guess or invent ports
- Auto-connect “nearby” nodes
- Infer intent from position
- Create nodes implicitly
- Change layout, routes, or grouping
- Create edges with missing endpoints

---

## Failure Behavior

On failure, the skill must:

- Perform **no partial mutations**
- Return structured, machine-readable errors
- Identify the exact edge(s) that failed
- Prefer rejection over silent correction

Optional:
- Emit a validation markdown node explaining the failure

---

## Dry Run Behavior

When `dryRun: true`:
- All validations must execute
- No edges are created
- The result must indicate whether execution would succeed
- No graph mutation may occur

---

## Idempotency & Agent Safety

This skill is **not idempotent**.

Agents must:
- Generate stable IDs
- Check for prior existence before retrying
- Treat failure as a signal to re-plan, not retry blindly

---

## Notes

Edges are the grammar of graphs.  
If nodes are words, edges are sentences.

This skill must be boring, strict, and trustworthy — always.
