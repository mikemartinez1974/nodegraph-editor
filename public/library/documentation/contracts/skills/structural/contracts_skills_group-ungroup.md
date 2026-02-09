# Skill Contract: Cluster / Ungroup

**Skill name:** `groupNodes` / `ungroupNodes`  
**Category:** Structural Skills  
**Intent:** Create or dissolve structural containment without changing graph meaning.

---

## Purpose

This skill manages **structural grouping**.

Clusters define **containment, scope, and organization**, not semantics.  
They must never change interpretation, relationships, or data meaning.

Grouping is how humans and tools perceive structure without altering truth.

---

## Scope

This skill:
- Creates new cluster containers
- Adds or removes nodes from clusters
- Preserves node identity, edges, and data
- Preserves relative spatial positions
- Updates cluster bounds explicitly

This skill does **not**:
- Create or delete nodes
- Create or delete edges
- Change node types
- Change layout or routing
- Infer meaning from grouping

---

## Preconditions

Before execution:

### For grouping
1. **All target nodes exist**
   - Node IDs must be valid and present

2. **Nodes are not already grouped (unless re-grouping is explicit)**
   - Implicit removal from prior clusters is forbidden

3. **Cluster container is explicit**
   - Either:
     - A new cluster is created, or
     - An existing cluster ID is provided

4. **Graph is mutable**
   - If a Manifest exists and forbids mutation, fail

### For ungrouping
1. **Cluster exists**
2. **Cluster contains nodes**
3. **Ungrouping is explicit**
   - Partial ungrouping must list node IDs

---

## Inputs

```ts
{
  mode: "group" | "ungroup",
  clusterId?: string,
  nodes: string[],
  createGroup?: boolean,
  groupData?: object
}
```

---

## Postconditions

After successful execution:

### Grouping
- All listed nodes are members of the target cluster
- No nodes are moved spatially
- Cluster bounds reflect contained nodes
- No edges or data are modified

### Ungrouping
- Listed nodes are removed from the cluster
- Cluster remains if nodes remain
- Cluster is deleted only if explicitly requested
- Spatial positions are unchanged

---

## Forbidden Actions

This skill must never:

- Move nodes implicitly
- Delete nodes
- Delete edges
- Reparent nodes implicitly
- Merge or split clusters automatically
- Infer grouping from proximity
- Trigger layout or rerouting
- Alter node data or type

---

## Failure Behavior

On failure:

- No partial mutations may occur
- Return structured, machine-readable errors
- Identify offending node or cluster IDs
- Prefer rejection over silent correction

Optional:
- Emit a markdown validation node explaining failure

---

## Dry Run Behavior

When `dryRun: true`:
- All validations execute
- No grouping changes occur
- Result indicates success or failure
- Cluster creation is simulated only

---

## Idempotency & Agent Safety

This skill is **not idempotent**.

Agents must:
- Track cluster membership explicitly
- Avoid retrying blindly
- Treat failure as a planning signal

---

## Notes

Clusters are scaffolding, not structure.  
They help minds, not meaning.

This skill must remain conservative, explicit, and boring.
