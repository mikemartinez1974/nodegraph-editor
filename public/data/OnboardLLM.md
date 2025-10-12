# OnboardLLM

This guide explains how a language model (LLM) can create and update graph data for this nodegraph editor by generating JSON that the user can copy/paste into the application (or into the browser console). Keep payloads simple, valid, and self-contained.

## Quick summary

- Produce JSON that follows the node/edge schema in data/nodegraph-schema.md.
- Provide stable string IDs (e.g. `node_1672345678900_abcd`).
- Use graph-space coordinates (not screen pixels).
- Offer examples: single-node, multi-node import, and edge creation.

## Node JSON format (minimal)

A single node object (the editor expects `position.x` and `position.y`):

```json
{
  "id": "node_1700000000000_ab12",
  "label": "New Node",
  "position": { "x": 200, "y": 150 },
  "width": 120,
  "height": 60,
  "type": "default",
  "data": { "notes": "created by LLM" },
  "visible": true
}
```

- `id` should be unique. Use a timestamp + short suffix if possible.
- `position` is in graph coordinates (not screen coordinates). The pan/zoom transform is applied at render time.

## Multi-node import format

If you want to create multiple nodes (and optional edges) in one paste, wrap them in `nodes` / `edges` arrays.

```json
{
  "nodes": [
    { "id": "node_1700000000000_a1", "label": "A", "position": {"x": 100, "y": 100} },
    { "id": "node_1700000000000_b2", "label": "B", "position": {"x": 300, "y": 100} }
  ],
  "edges": [
    { "id": "edge_1700000000000_e1", "source": "node_1700000000000_a1", "target": "node_1700000000000_b2", "type": "straight" }
  ]
}
```

- The editor will read `nodes` and `edges` and add them to the graph. If your UI exposes an "Import JSON" box, paste this entire object.

## Edge creation (single)

To create an edge programmatically, supply source/target node ids and an optional `type`:

```json
{
  "id": "edge_1700000000000_e2",
  "source": "node_1700000000000_a1",
  "target": "node_1700000000000_b2",
  "type": "curved",
  "label": "relationship"
}
```

## How to paste into the app

Options the user can perform (LLM should instruct the user which to use):

1. Import pane (if available): paste the whole JSON object (nodes/edges) into the app import UI and confirm.
2. Browser console: run the supplied helper API calls. Example using a global helper the app exposes (if available):

```js
// Create a single node
window.graphAPI.createNode({ id: 'node_1700000000000_ab12', label: 'New Node', position: { x: 200, y: 150 } });

// Create multiple nodes/edges
window.graphAPI.importGraph({ nodes: [...], edges: [...] });
```

If `window.graphAPI` is not present, the app may have a specific import dialog—paste the JSON there.

## ID recommendations

- Use readable, unique IDs such as: `node_<timestamp>_<short>` or `edge_<timestamp>_<short>`.
- Avoid duplicating existing node IDs. If an ID collides, the editor may overwrite or ignore the import depending on implementation.

Example id pattern (recommended):

```
node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}
```

## Coordinate system

- Positions are logical (graph-space). If you place a node at {x:200,y:150}, it will appear where the renderer places graph-space (subject to pan/zoom).
- When doing drag-to-create from a handle, the app calculates handle positions; LLM just needs to provide node coordinates for pasted nodes.

## Node map features: groups, markdown, emoji

This editor supports several richer node-map features beyond plain nodes/edges. When the LLM produces JSON, include these fields to take advantage of the features:

- Groups
  - Field: `groups` (array). Each group may include `id`, `label`, `nodeIds`, and `bounds` ({x,y,width,height}).
  - Use cases: logical clusters, background boxes, collapsible regions.
  - Example:

```json
{
  "groups": [
    {
      "id": "group_1700000000000_g1",
      "label": "Act I",
      "nodeIds": ["node_1","node_2","node_3"],
      "bounds": { "x": 50, "y": 40, "width": 500, "height": 260 },
      "collapsed": false
    }
  ]
}
```

- Markdown content
  - Field: `data.memo` (string) or `data.description`. The app will render markdown (basic formatting) in node detail panels or, if configured, inline on the node.
  - Use cases: multi-line descriptions, lists, links, and simple formatting (bold, italics, code spans).
  - Example node with markdown:

```json
{
  "id": "node_md_1",
  "label": "Research",
  "position": { "x": 120, "y": 220 },
  "data": {
    "memo": "**Summary:**\n- Collect data\n- Analyze results\n\n[Notes](https://example.com)"
  }
}
```

- Emoji and rich labels
  - Emoji can be included directly in `label` or in `data` fields. They are UTF-8 characters (e.g. "📚", "🔥").
  - Example: `"label": "Idea 💡"`.

- Tags and metadata
  - Field: `data.tags` (array of strings) or `metadata` for arbitrary developer keys.
  - Useful for filters, search, or automatic styling.

- Best practices for LLM output
  - When creating groups, include `nodeIds` that match the nodes you also create in the same JSON payload.
  - Prefer `data.memo` for longer descriptions; keep `label` concise and emoji-friendly.
  - Provide `bounds` for groups when you want the UI to place a background box. If omitted, the UI may auto-compute bounds from node positions.

- Combined example (nodes + groups + markdown + emoji):

```json
{
  "nodes": [
    { "id": "node_1700000000000_a1", "label": "Alpha 📚", "position": {"x": 100, "y": 100}, "data": { "memo": "**Alpha section**\nDetails here." } },
    { "id": "node_1700000000000_b2", "label": "Beta 🔥", "position": {"x": 300, "y": 100}, "data": { "memo": "Notes for Beta." } }
  ],
  "groups": [
    { "id": "group_1700000000000_act1", "label": "Chapter 1", "nodeIds": ["node_1700000000000_a1","node_1700000000000_b2"], "bounds": { "x": 40, "y": 60, "width": 360, "height": 140 } }
  ],
  "edges": [
    { "id": "edge_1700000000000_e1", "source": "node_1700000000000_a1", "target": "node_1700000000000_b2", "type": "straight" }
  ]
}
```


---
