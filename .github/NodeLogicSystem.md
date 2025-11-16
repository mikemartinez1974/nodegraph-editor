# TODO: Unified Handle & Logic System Migration Checklist

- [x] Audit all node types to ensure they use the new `inputs`/`outputs` schema
- [x] Refactor logic nodes to use only the new handle schema (remove legacy handle logic)
- [ ] Ensure HandleLayer renders and manages all handles from the schema for every node
- [x] Validate edge creation (output→input, type match, no self-connection)
- [x] Add tooltips and highlighting for handle labels/types
- [x] Migrate all node types to the new system, one by one
- [ ] Remove any old/duplicate handle code
- [ ] Test edge creation, drag, and undo/redo for all node types
- [ ] Document the unified handle/logic system for future contributors

# NodeGraph Logic System Design

## 1. Core Concepts

### A. Node Types
- **Action/Trigger Nodes**: Emit events (Timer, Button, Script, API).
- **Processing Nodes**: Transform or filter data (Script, Gate, Delay, Math).
- **Data Nodes**: Hold or fetch values (Fixed, Counter, API, Toggle).
- **Display Nodes**: Show results (Markdown, Div, Svg, ThreeD).

### B. Handles/Ports
- **Input Handles**: Accept data or triggers (left side).
- **Output Handles**: Emit data or triggers (right side).
- **Multiple Handles**: Nodes can have multiple inputs/outputs, each with a label and type (e.g., “Trigger”, “Value”, “Result”).

### C. Edges
- **Connect output to input** (never output→output or input→input).
- **Edges carry data or trigger signals**.

---

## 2. Execution Model

- **Trigger Flow**: When an output fires (e.g., Timer ticks), all connected inputs are notified.
- **Data Flow**: Data can be passed along edges (e.g., API response, script result).
- **Node Execution**: Each node defines what happens when its input(s) are triggered.

---

## 3. Node Definition Example

```js
{
  id: 'node-1',
  type: 'TimerNode',
  label: 'Timer',
  position: { x: 100, y: 100 },
  data: { interval: 1000 },
  inputs: [
    { key: 'reset', label: 'Reset', type: 'trigger' }
  ],
  outputs: [
    { key: 'tick', label: 'Tick', type: 'trigger' }
  ]
}
```

- **inputs/outputs**: Array of handles, each with a key, label, and type.

---

## 4. Edge Definition Example

```js
{
  id: 'edge-1',
  source: { nodeId: 'node-1', handleKey: 'tick' },
  target: { nodeId: 'node-2', handleKey: 'trigger' }
}
```

---

## 5. UI/UX Principles

- **Visible, labeled handles** on each node.
- **Drag from output to input** to create edges.
- **Highlight valid targets** during drag.
- **Show tooltips** for handle labels/types.
- **Prevent invalid connections** (type mismatch, output→output, etc.).
- **Show node/edge activity** (e.g., flash on trigger).
- **Panel for node properties** (edit interval, script, etc.).
- **Undo/redo** for all actions.

---

## 6. Extensibility

- **Node types** are just config + React components.
- **Handles** are defined per node type (can be dynamic).
- **Execution logic** is modular (each node type implements a `process` function).

---

## 7. Implementation Plan

1. **Schema**: Define a node/edge schema with labeled handles.
2. **Rendering**: Render handles based on node schema; show labels.
3. **Edge Logic**: Only allow output→input connections; validate types.
4. **Event Bus**: On output fire, propagate to all connected inputs.
5. **Node Execution**: Each node type implements a handler for its inputs.
6. **UI**: Panels for node properties, edge creation, and help.

---

## 8. Example Flow

- **TimerNode** (tick) → **ScriptNode** (trigger) → **MarkdownNode** (set content)
- **APINode** (response) → **ScriptNode** (process) → **DivNode** (display)

---

## 9. What to Refactor/Keep

- **Keep**: Your node components, eventBus, pan/zoom, selection, undo/redo, and layered rendering.
- **Refactor**: Node data model to include explicit `inputs` and `outputs` arrays with keys/labels/types.
- **Update**: HandleLayer to use the new schema for rendering and connecting handles.

---

## 10. Next Steps

- [x] Define the new node/edge schema (with handles).
- [x] Refactor one node (e.g., TimerNode) to use this schema.
- [x] Update HandleLayer to render handles from schema.
- [x] Implement edge validation and connection logic.
- [x] Gradually migrate other nodes.

---

**Summary:**  
This approach gives you a scalable, maintainable, and user-friendly logic system. You’ll have clear, labeled handles, robust data/trigger flow, and a foundation for advanced features (type checking, custom handles, etc.).

---
