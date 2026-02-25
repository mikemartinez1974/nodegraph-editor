# Twilite LLM Onboarding Guide (Current Capability)

Twilite is a persistent graph workspace. The graph is state. Mutate it with small, explicit deltas.

---

## 1) Non-Negotiable Rules

- Never replace an existing graph with full `nodegraph-data` unless user explicitly asks to reset.
- Use action commands only: `createNodes`, `createEdges`, `update`, `delete`, `move`, `translate`, `transaction`.
- In transactions: create nodes first, then edges.
- Use unique RFC4122 UUID v4 IDs (hex only).
- Prefer `update` over delete+recreate to preserve IDs/history.

---

## 2) New Graph Minimum (Avoid Validation Noise)

When creating a new graph, include all three system nodes:

1. `manifest`
2. `legend`
3. `dictionary`

If `manifest.data.dependencies.nodeTypes` includes custom types, dictionary must include matching `nodeDefs` entries for those custom types.

Notes:
- Built-in node types (`manifest`, `legend`, `dictionary`, `markdown`, `script`, `port`, `view`, `api`) do not need dictionary entries.
- Missing dictionary can trigger warnings when manifest dependencies are declared.

---

## 3) Canonical Data Shapes

### Manifest (recommended shape)

Use this structure to stay compatible with current editor/validator behavior:

- `data.identity`: `graphId`, `name`, `version`, `description`, `createdAt`, `updatedAt`
- `data.intent`: `kind`, `scope`
- `data.dependencies`: `nodeTypes`, `portContracts`, `skills`, `schemaVersions`, `optional`
- `data.authority`: `mutation`, `actors`, `styleAuthority`, `history`
- `data.document`: `url`
- `data.settings`: defaults (theme/background/layout/github/autoSave)

### Legend

Use:

- `data.entries`: array of `{ key, intent, implementation, dictionaryKey }`
- optional `data.markdown`

### Dictionary

Use:

- `data.nodeDefs`: array of `{ key, ref, source, version }`
- `data.skills`: array
- `data.views`: array (optional but recommended for custom types)

---

## 4) Edges and Ports

Required for edge mutations:

- `id`, `source`, `target`, `sourcePort`, `targetPort`, `type`

Rules:

- `source`/`target` must exist.
- `sourcePort`/`targetPort` must exist on nodes.
- `root` is treated as a valid virtual port.
- Prefer explicit ports (`in`/`out`) for functional flow.
- Use a known edge type; safe default is `relates`.

---

## 5) Common Failure Modes

- Duplicate edge IDs in one payload.
- Invalid UUIDs (non-hex chars).
- Custom node type declared in manifest dependencies but missing in dictionary `nodeDefs`.
- Using non-canonical manifest/legend/dictionary data shapes.
- Missing `sourcePort`/`targetPort`.

---

## 6) Command Template (Safe Starter)

```json
{
  "action": "transaction",
  "commands": [
    {
      "action": "createNodes",
      "nodes": [
        {
          "id": "11111111-1111-4111-8111-111111111111",
          "type": "manifest",
          "label": "Manifest",
          "position": { "x": -520, "y": -220 },
          "width": 420,
          "height": 280,
          "data": {
            "identity": {
              "graphId": "starter-graph",
              "name": "Starter Graph",
              "version": "0.1.0",
              "description": "Starter graph",
              "createdAt": "2026-02-22T00:00:00.000Z",
              "updatedAt": "2026-02-22T00:00:00.000Z"
            },
            "intent": { "kind": "graph", "scope": "foundation" },
            "dependencies": {
              "nodeTypes": ["manifest", "legend", "dictionary", "markdown"],
              "portContracts": ["core"],
              "skills": [],
              "schemaVersions": { "nodes": ">=1.0.0", "ports": ">=1.0.0" },
              "optional": []
            },
            "authority": {
              "mutation": {
                "allowCreate": true,
                "allowUpdate": true,
                "allowDelete": true,
                "appendOnly": false
              },
              "actors": { "humans": true, "agents": true, "tools": true },
              "styleAuthority": "descriptive",
              "history": { "rewriteAllowed": false, "squashAllowed": false }
            },
            "document": { "url": "" },
            "settings": {
              "theme": null,
              "backgroundImage": null,
              "defaultNodeColor": "#1976d2",
              "defaultEdgeColor": "#666666",
              "snapToGrid": false,
              "gridSize": 20,
              "edgeRouting": "auto",
              "github": { "repo": "", "path": "", "branch": "main" },
              "autoSave": false
            }
          }
        },
        {
          "id": "22222222-2222-4222-8222-222222222222",
          "type": "legend",
          "label": "Legend",
          "position": { "x": -520, "y": 90 },
          "width": 360,
          "height": 220,
          "data": {
            "entries": [
              {
                "key": "markdown",
                "intent": "documentation",
                "implementation": "markdown node",
                "dictionaryKey": "markdown"
              }
            ]
          }
        },
        {
          "id": "33333333-3333-4333-8333-333333333333",
          "type": "dictionary",
          "label": "Dictionary",
          "position": { "x": -520, "y": 360 },
          "width": 360,
          "height": 220,
          "data": { "nodeDefs": [], "skills": [], "views": [] }
        },
        {
          "id": "44444444-4444-4444-8444-444444444444",
          "type": "markdown",
          "label": "Start Here",
          "position": { "x": 60, "y": -40 },
          "width": 420,
          "height": 240,
          "ports": [
            { "id": "in", "label": "In", "direction": "input", "dataType": "any", "position": { "side": "left", "offset": 0.5 } },
            { "id": "out", "label": "Out", "direction": "output", "dataType": "any", "position": { "side": "right", "offset": 0.5 } }
          ],
          "data": {
            "markdown": "# Twilite Starter\n\nThis graph is valid and ready for extension."
          }
        }
      ]
    },
    {
      "action": "createEdges",
      "edges": [
        {
          "id": "55555555-5555-4555-8555-555555555555",
          "source": "11111111-1111-4111-8111-111111111111",
          "sourcePort": "root",
          "target": "22222222-2222-4222-8222-222222222222",
          "targetPort": "root",
          "type": "relates"
        },
        {
          "id": "66666666-6666-4666-8666-666666666666",
          "source": "11111111-1111-4111-8111-111111111111",
          "sourcePort": "root",
          "target": "44444444-4444-4444-8444-444444444444",
          "targetPort": "in",
          "type": "relates"
        }
      ]
    }
  ]
}
```

---

## 7) Behavior When Unsure

- Do not guess schema.
- Ask for missing constraints.
- Prefer warnings over destructive auto-fixes.
- Keep diffs small and reversible.
