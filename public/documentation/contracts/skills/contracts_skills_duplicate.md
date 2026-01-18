# Duplicate Skill Contract

**Skill name:** duplicate  
**Category:** Structural  
**Intent:** Clone nodes (and optionally internal edges) without identity collision or semantic drift.

---

## Purpose

The Duplicate skill creates new nodes that are structurally and semantically equivalent to existing nodes, while ensuring **identity uniqueness** and **graph continuity**.

Duplication is not copying text — it is controlled identity minting.

---

## Inputs

```json
{
  "nodeIds": ["uuid"],
  "includeEdges": false,
  "offset": { "x": 40, "y": 40 },
  "groupId": "optional-uuid"
}
```

---

## Preconditions

- All `nodeIds` must exist
- Nodes must be readable (not locked or protected)
- Caller must have mutation authority
- Graph must be in a mutable state
- If `includeEdges` is true, only **internal edges** are eligible
- Target group must exist if provided

---

## Postconditions

- New nodes are created with **new UUIDs**
- Original nodes remain unchanged
- New nodes preserve:
  - type
  - data
  - handles
  - size
- Positions are offset to avoid overlap
- If edges are duplicated:
  - only edges between duplicated nodes are included
  - external edges are excluded
- Group membership is explicit and intentional

---

## Forbidden Actions

- Reusing original IDs
- Duplicating external edges by default
- Mutating original nodes
- Inferring group membership implicitly
- Auto-layout or spatial normalization
- Copying transient UI state

---

## Failure Modes

| Condition | Error |
|----------|------|
| Missing node | `NODE_NOT_FOUND` |
| ID collision | `ID_COLLISION` |
| Invalid group | `INVALID_GROUP` |
| Protected node | `NODE_LOCKED` |
| Edge leak | `INVALID_EDGE_SCOPE` |

---

## Dry Run Behavior

- Validates all inputs
- Computes closure if edges included
- Reports resulting node/edge count
- No mutation occurs

---

## Idempotency

**Not idempotent.**  
Each execution produces new identities.

---

## Notes for Implementers

- Prefer deterministic offsets for repeatability
- Emit mapping `{ oldId → newId }` in result
- Duplicate is identity minting, not cloning
- This skill must be safe to call by agents

---

*File location:* `contracts/skills/duplicate.md`
