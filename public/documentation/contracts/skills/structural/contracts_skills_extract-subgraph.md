# Extract Subgraph Skill Contract

**Skill name:** extract-subgraph  
**Category:** Structural  
**Intent:** Lift a subset of a graph into a new portable graph without losing meaning, identity, or closure.

---

## Purpose

The Extract Subgraph skill creates a **new graph artifact** from an existing graph by selecting a subset of nodes and their internal relationships.

This is the primary mechanism by which graphs:
- travel
- fork
- become reusable
- become shareable
- become artifacts instead of sessions

Extraction is not copying. It is **controlled graph birth**.

---

## Inputs

```json
{
  "nodeIds": ["uuid"],
  "includeInternalEdges": true,
  "fork": false,
  "newManifest": true,
  "target": {
    "type": "file | cluster | export",
    "location": "optional-path-or-id"
  }
}
```

---

## Preconditions

- All `nodeIds` must exist
- Caller must have read access to all nodes
- Selection must be non-empty
- If `includeInternalEdges` is true, edge closure must be computable
- If `fork` is false, IDs must remain stable
- If `newManifest` is true, manifest schema must be available

---

## Postconditions

### Original Graph
- Remains unchanged
- No nodes or edges are removed
- No IDs are mutated
- History is preserved

### New Graph Artifact
- Contains all selected nodes
- Contains all internal edges (if enabled)
- Contains **no external edges**
- Includes a Manifest node (if requested)
- Is self-contained and interpretable
- Passes Minimum Valid Graph requirements (if manifest included)

---

## Identity Rules

| Mode | Behavior |
|------|---------|
| fork = false | IDs preserved |
| fork = true | New IDs minted |
| newManifest = true | New graph identity created |
| newManifest = false | Caller must supply identity |

---

## Forbidden Actions

- Partial edge extraction
- Silent ID remapping
- Including edges to non-extracted nodes
- Mutating source graph
- Implicit manifest generation without declaration
- Inferring dependencies without inspection

---

## Failure Modes

| Condition | Error |
|----------|------|
| Missing node | `NODE_NOT_FOUND` |
| Empty selection | `EMPTY_SUBGRAPH` |
| External edge leak | `EDGE_CLOSURE_VIOLATION` |
| Invalid manifest | `MANIFEST_INVALID` |
| Permission denied | `ACCESS_DENIED` |

---

## Dry Run Behavior

- Computes closure (nodes + internal edges)
- Reports resulting node/edge counts
- Reports manifest requirements
- No artifact is written

---

## Idempotency

- **fork = false:** idempotent
- **fork = true:** not idempotent

---

## Notes for Implementers

- Treat extraction as serialization, not mutation
- Always compute closure explicitly
- Prefer emitting `create` payloads, not snapshots
- Allow extraction to file, cluster, or export buffer
- Emit dependency list in manifest if created

---

*File location:* `contracts/skills/extract-subgraph.md`
