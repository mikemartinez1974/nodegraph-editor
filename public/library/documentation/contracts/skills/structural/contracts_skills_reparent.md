# Skill Contract: Reparent Nodes

**Skill name:** `reparentNodes`  
**Category:** Structural Skills  
**Intent:** Move nodes between structural containers explicitly, without implicit meaning change.

---

## Purpose

This skill performs **structural surgery**.

Reparenting changes *where* a node lives, not *what* it means.  
It must be explicit, deliberate, and auditable, because containment implies scope,
ownership, and reading context.

This is one of the few structural skills that can *accidentally change meaning* if done carelessly,
so the contract is intentionally strict.

---

## Scope

This skill:
- Removes nodes from one parent container
- Adds nodes to another parent container
- Preserves node identity, data, edges, and type
- Preserves spatial position (unless explicitly adjusted elsewhere)
- Updates cluster bounds explicitly

This skill does **not**:
- Create or delete nodes
- Create or delete edges
- Change node data or type
- Trigger layout or routing
- Merge or split clusters automatically
- Infer intent

---

## Preconditions

Before execution:

1. **All nodes exist**
   - Node IDs must be valid and present

2. **Target parent exists**
   - Parent cluster or container ID must exist
   - Root-level reparenting must be explicit (`parentId: null`)

3. **Source parent is known**
   - Current parent must be determined before mutation
   - Implicit removal is forbidden

4. **No-op detection**
   - Reparenting to the same parent must be rejected

5. **Graph is mutable**
   - If a Manifest exists and forbids mutation, execution must fail

6. **No cycles introduced**
   - A node may not become ancestor of itself
   - Containment DAG must remain acyclic

---

## Inputs

```ts
{
  nodes: string[],
  fromParentId: string | null,
  toParentId: string | null
}
```

---

## Postconditions

After successful execution:

1. **Parentage is updated**
   - All listed nodes are removed from `fromParentId`
   - All listed nodes are added to `toParentId`

2. **Spatial stability is preserved**
   - Node positions remain unchanged
   - Only container membership changes

3. **Cluster bounds are correct**
   - Both source and target clusters update bounds

4. **Meaning is unchanged**
   - No edges, data, or types are altered
   - Only containment changes

5. **Auditability is preserved**
   - Mutation can be replayed safely
   - Diffs show explicit parent change only

---

## Forbidden Actions

This skill must never:

- Move nodes implicitly
- Change node positions
- Delete or create nodes
- Delete or create edges
- Reparent nodes implicitly via layout
- Infer new structure from proximity
- Reparent during grouping or layout
- Cascade reparenting to children unless explicitly listed

---

## Failure Behavior

On failure:

- No partial mutations may occur
- Return structured, machine-readable errors
- Identify offending node or parent IDs
- Prefer rejection over silent correction

Optional:
- Emit a markdown validation node explaining the failure

---

## Dry Run Behavior

When `dryRun: true`:
- All validations execute
- No mutations occur
- Result indicates success or failure
- Parent graph remains unchanged

---

## Idempotency & Agent Safety

This skill is **not idempotent**.

Agents must:
- Track parentage explicitly
- Avoid retry loops
- Treat failure as a signal to re-plan

---

## Notes

Reparenting is a declaration of scope.  
Scope changes reading. Reading changes meaning.

That is why this skill must be explicit, boring, and slow.
