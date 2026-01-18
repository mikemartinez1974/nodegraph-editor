# Skill Contract: Group / Ungroup

**Skill name:** `groupNodes` / `ungroupNodes`  
**Category:** Structural Skills  
**Intent:** Create or dissolve structural containment without changing graph meaning.

---

## Purpose

This skill manages **structural grouping**.

Groups define **containment, scope, and organization**, not semantics.  
They must never change interpretation, relationships, or data meaning.

Grouping is how humans and tools perceive structure without altering truth.

---

## Scope

This skill:
- Creates new group containers
- Adds or removes nodes from groups
- Preserves node identity, edges, and data
- Preserves relative spatial positions
- Updates group bounds explicitly

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
   - Implicit removal from prior groups is forbidden

3. **Group container is explicit**
   - Either:
     - A new group is created, or
     - An existing group ID is provided

4. **Graph is mutable**
   - If a Manifest exists and forbids mutation, fail

### For ungrouping
1. **Group exists**
2. **Group contains nodes**
3. **Ungrouping is explicit**
   - Partial ungrouping must list node IDs

---

## Inputs

```ts
{
  mode: "group" | "ungroup",
  groupId?: string,
  nodes: string[],
  createGroup?: boolean,
  groupData?: object
}
```

---

## Postconditions

After successful execution:

### Grouping
- All listed nodes are members of the target group
- No nodes are moved spatially
- Group bounds reflect contained nodes
- No edges or data are modified

### Ungrouping
- Listed nodes are removed from the group
- Group remains if nodes remain
- Group is deleted only if explicitly requested
- Spatial positions are unchanged

---

## Forbidden Actions

This skill must never:

- Move nodes implicitly
- Delete nodes
- Delete edges
- Reparent nodes implicitly
- Merge or split groups automatically
- Infer grouping from proximity
- Trigger layout or rerouting
- Alter node data or type

---

## Failure Behavior

On failure:

- No partial mutations may occur
- Return structured, machine-readable errors
- Identify offending node or group IDs
- Prefer rejection over silent correction

Optional:
- Emit a markdown validation node explaining failure

---

## Dry Run Behavior

When `dryRun: true`:
- All validations execute
- No grouping changes occur
- Result indicates success or failure
- Group creation is simulated only

---

## Idempotency & Agent Safety

This skill is **not idempotent**.

Agents must:
- Track group membership explicitly
- Avoid retrying blindly
- Treat failure as a planning signal

---

## Notes

Groups are scaffolding, not structure.  
They help minds, not meaning.

This skill must remain conservative, explicit, and boring.
