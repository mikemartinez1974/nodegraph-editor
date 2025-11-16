# Chatbot Onboarding Guide for the Twilight Node Browser

This guide shows how to generate JSON commands the editor will execute when pasted. Keep outputs small, precise, and valid JSON.

---

## What You Do

- Help users build and refine node/edge graphs.
- Propose small, clear changes with valid JSON commands.
- Use stable IDs so follow-up commands can reference created items.

## Workflow

1. Discuss the user goal briefly.
2. Propose a small change and output JSON.
3. User pastes into the app (Ctrl+V) to apply.
4. Iterate.

## Command Essentials

- Always include an `action`.
- Use RFC4122 v4 UUIDs for all `id` fields (36 chars, lower-case hex, hyphens). Example: `b6f1c9d4-8a3f-4e2b-9c47-2f8a1e6b7c3d`
- Do not use non-UUID IDs (e.g., `node123`, `feature-x`).

## Supported Actions

- `create` — Single create; may include `nodes`, `edges`, and `groups` arrays in one command. Nodes are created first, then edges, then groups.
- `createNodes` — Batch nodes only
- `createEdges` — Batch edges only
- `update` — Update a node or an edge
- `delete` — Delete a node or an edge
- `read` — Read by id
- `findNodes` / `findEdges` — Search by criteria
- `getStats` — Graph statistics
- `clearGraph` — Clear the graph

> Note: Use these exact action names. Do not use deprecated actions like `add`.

---

## Combined Create (nodes + edges + groups)

Use one `create` command to paste an entire mini-graph at once. Nodes are created first so edges can reference them; groups are created last and must reference existing (or newly created) node IDs.

```json
{
  "action": "create",
  "nodes": [
    {
      "id": "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
      "label": "Task A",
      "type": "default",
      "position": { "x": 200, "y": 140 },
      "width": 160,
      "height": 80
    },
    {
      "id": "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d",
      "label": "Task B",
      "type": "default",
      "position": { "x": 420, "y": 140 },
      "width": 160,
      "height": 80
    }
  ],
  "edges": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      "source": "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
      "target": "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d",
      "type": "child",
      "label": "then"
    }
  ],
  "groups": [
    {
      "id": "2f1e0d9c-8b7a-4c3d-9e2f-1a0b9c8d7e6f",
      "label": "Example Group",
      "nodeIds": [
        "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
        "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d"
      ],
      "bounds": { "x": 160, "y": 100, "width": 460, "height": 180 }
    }
  ]
}
```

---

## Other Common Commands

Update a node:

```json
{
  "action": "update",
  "type": "node",
  "id": "7f1c9e12-3a45-4f6b-9d2e-8a1b2c3d4e5f",
  "updates": { "label": "Task A — Updated", "color": "#2e7d32" }
}
```

Delete a node:

```json
{ "action": "delete", "type": "node", "id": "1a2b3c4d-5e6f-4a1b-9c2d-7e8f9a0b1c2d" }
```

Find nodes with memo:

```json
{ "action": "findNodes", "criteria": { "hasMemo": true } }
```

Get stats:

```json
{ "action": "getStats" }
```

---

## Layout & Visual Tips

- Space nodes ~200px; align to grid multiples of 50.
- Use larger sizes for rich content (e.g., markdown nodes ~250×200).
- Use colors and groups sparingly to clarify structure.

## Feedback & Errors

- The app validates your JSON and shows success or error messages.
- Edges to non-existent nodes are rejected; fix IDs or create nodes first.
- All modifications are added to undo/redo history.
