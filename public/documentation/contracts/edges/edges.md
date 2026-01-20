# Edge Contracts

This document defines the **minimal, portable contract** for edges in Twilite graphs.

Edges express relationships. Handles are optional so graphs remain portable.

---

## Required Fields

Every edge must include:

```json
{
  "id": "uuid-v4",
  "source": "node-id",
  "target": "node-id",
  "type": "string"
}
```

- `id` must be unique within the graph.
- `source` and `target` must reference existing nodes.
- `type` identifies semantic intent (e.g., `dataFlow`, `reference`, `straight`).

---

## Optional Fields

```json
{
  "label": "string",
  "data": { "any": "json" },
  "style": { "any": "json" },
  "state": { "any": "json" },
  "sourceHandle": "handle-id",
  "targetHandle": "handle-id"
}
```

- `label` is human-readable, not semantic logic.
- `data`, `style`, and `state` are optional metadata.
- `sourceHandle` / `targetHandle` are optional **and may be omitted**.

---

## Handle Rules (Lightweight)

- Handles are **optional** for portability.
- If handles are provided, they must match declared handles on the node.
- If handles are omitted, the edge is still valid and must attach to the node boundary.

---

## Edge Types

Edge `type` must be a string. Recommended core types:

- `dataFlow`
- `reference`
- `straight`
- `child`

Projects may add their own types, but they must remain strings.

---

## Forbidden

Edges must never:

- Reference missing nodes
- Reuse an existing edge `id`
- Implicitly create handles

---

## Validation Summary

An edge is valid if:

1. `id`, `source`, `target`, and `type` exist
2. `source` and `target` exist as node IDs
3. If handles are provided, they exist on their nodes

This is intentionally minimal to preserve portability.
