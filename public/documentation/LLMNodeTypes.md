## Twilight LLM Node Types Guide

Use this reference when choosing `type` values or wiring handles. Plugin nodes are namespaced as `pluginId:nodeType` (example: `io.breadboard.sockets:socket`).

---

## Core Node Types

| Type | Label | Purpose |
| --- | --- | --- |
| `default` | Default Node | Basic resizable node for general use. |
| `fixed` | Fixed Node | Fixed position node (no resize/drag intent). |
| `markdown` | Markdown Node | Rich text/notes rendered from `data.markdown` or `data.memo`. |
| `svg` | SVG Node | Inline SVG rendering. |
| `div` | Div Node | Custom HTML container node. |
| `timer` | Timer Node | Countdown/stopwatch style timer. |
| `toggle` | Toggle Node | On/off state toggle. |
| `counter` | Counter Node | Increment/decrement counter. |
| `gate` | Gate | Logic gate (AND/OR/NOT/XOR/NAND/NOR). |
| `delay` | Delay Node | Delayed trigger with queue/cancel support. |
| `valueTrigger` | Value Adapter | Convert value changes to trigger pulses. |
| `api` | API Node | HTTP request on trigger (method/headers/body). |
| `script` | Script Node | Run a saved script on trigger. |
| `backgroundRpc` | Background RPC | Call methods exposed by the background frame. |
| `canvas` | Canvas Node | Canvas-rendered native node (custom styles). |
| `3d` | 3D View | Interactive Three.js scene. |

Notes:
- Documentation-style nodes (`markdown`, `canvas`, `svg`, `div`) do not expose handles unless explicitly declared.
- Use explicit `handles` arrays with `direction` + `position` when wiring edges.

---

## Built-in Breadboard Plugin Nodes

These load from the built-in plugin manifests:

### Socket Toolkit (`io.breadboard.sockets`)

| Type | Label | Handles |
| --- | --- | --- |
| `io.breadboard.sockets:socket` | Breadboard Socket | `socket` |
| `io.breadboard.sockets:railSocket` | Rail Socket | `positive`, `negative` |
| `io.breadboard.sockets:skin` | Breadboard Skin | none |
| `io.breadboard.sockets:bus` | Breadboard Bus | `positive`, `negative` |

### Component Pack (`io.breadboard.components`)

| Type | Label | Handles |
| --- | --- | --- |
| `io.breadboard.components:resistor` | Resistor | `pinA`, `pinB` |
| `io.breadboard.components:led` | LED | `anode`, `cathode` |
| `io.breadboard.components:jumper` | Jumper Wire | `wireA`, `wireB` |

---

## Plugin Nodes (General Rule)

Additional plugin node types can be installed. Always read the plugin manifest or `definition` to confirm:
- handle ids
- default data fields
- size/extension constraints

---

## Edge Types

Edges use the `type` field. These are defined in `components/GraphEditor/edgeTypes.js`:

| Type | Label | Purpose |
| --- | --- | --- |
| `child` | Child | Parent-child hierarchy (default). |
| `parent` | Parent | Reverse parent relationship. |
| `peer` | Peer | Peer-to-peer relationship. |
| `dataFlow` | Data Flow | Data moving from source to target. |
| `dependency` | Dependency | Dependency linkage. |
| `reference` | Reference | Lightweight reference or link. |
| `bidirectional` | Bidirectional | Two-way relationship. |
| `weak` | Weak Link | Optional/low-strength relationship. |
| `strong` | Strong Link | Required/high-strength relationship. |
| `temporal` | Temporal | Time-based relationship. |
| `energyFlow` | Energy Flow | Gradient-styled flow. |

Notes:
- `sourceHandle` and `targetHandle` are optional; when omitted the edge attaches to the node boundary.
- Edge styling comes from the edge type; you can override per-edge with `style`.

### Example: simple child edge
```json
{
  "id": "edge-1",
  "type": "child",
  "source": "node-a",
  "target": "node-b"
}
```

### Example: data flow edge with handles
```json
{
  "id": "edge-2",
  "type": "dataFlow",
  "source": "api-node",
  "target": "display-node",
  "sourceHandle": "out",
  "targetHandle": "in"
}
```

### Example: custom style override
```json
{
  "id": "edge-3",
  "type": "dependency",
  "source": "task-a",
  "target": "task-b",
  "style": {
    "width": 3,
    "curved": true,
    "dash": [4, 4]
  }
}
```
