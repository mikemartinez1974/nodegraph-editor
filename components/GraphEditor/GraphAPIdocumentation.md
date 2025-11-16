# Graph CRUD API Documentation

This API is available globally at `window.graphAPI` and provides full CRUD operations for the node graph editor.

## Response Format

All functions return an object with this structure:
```javascript
{
  success: boolean,
  data?: any,      // Present on success
  error?: string   // Present on failure
}
```

---

## Node Operations

### Create Node
```javascript
window.graphAPI.createNode({
  id: "optional-custom-id",  // Auto-generated if omitted
  type: "default",            // "default" | "display" | "list"
  label: "My Node",
  position: { x: 100, y: 100 },
  data: {
    memo: "Some notes",
    link: "https://example.com"
  }
})
// Returns: { success: true, data: <node object> }
```

### Read Node(s)
```javascript
// Get all nodes
window.graphAPI.readNode()
// Returns: { success: true, data: [<array of nodes>] }

// Get specific node
window.graphAPI.readNode("node-id")
// Returns: { success: true, data: <node object> }
```

### Update Node
```javascript
window.graphAPI.updateNode("node-id", {
  label: "Updated Label",
  position: { x: 200, y: 300 },
  data: { memo: "Updated memo" }
})
// Returns: { success: true, data: <updated node> }
```

### Delete Node
```javascript
window.graphAPI.deleteNode("node-id")
// Returns: { success: true, data: { deletedNodeId: "...", affectedEdges: 2 } }
// Note: Also deletes all connected edges
```

---

## Edge Operations

### Create Edge
```javascript
window.graphAPI.createEdge({
  id: "optional-custom-id",
  source: "source-node-id",
  target: "target-node-id",
  sourceHandle: "output-handle-key",
  targetHandle: "input-handle-key",
  type: "child",              // "child" | "peer" | custom
  label: "Edge Label",
  style: {
    width: 2,
    dash: [],                 // [5, 5] for dashed
    curved: true,
    color: "#1976d2"
  }
})
// Returns: { success: true, data: <edge object> }
```
> **Note:** Handles are required. Use the node's `outputs`/`inputs` arrays (or the default `out`/`in` handles) to determine the proper `sourceHandle` and `targetHandle` keys. Handle types must match (or be `trigger`).

### Read Edge(s)
```javascript
// Get all edges
window.graphAPI.readEdge()
// Returns: { success: true, data: [<array of edges>] }

// Get specific edge
window.graphAPI.readEdge("edge-id")
// Returns: { success: true, data: <edge object> }
```

### Update Edge
```javascript
window.graphAPI.updateEdge("edge-id", {
  type: "peer",
  label: "Updated Label",
  showLabel: true,
  style: {
    width: 4,
    curved: false
  }
})
// Returns: { success: true, data: <updated edge> }
```

### Delete Edge
```javascript
window.graphAPI.deleteEdge("edge-id")
// Returns: { success: true, data: { deletedEdgeId: "..." } }
```

---

## Bulk Operations

### Create Multiple Nodes
```javascript
window.graphAPI.createNodes([
  { label: "Node 1", position: { x: 100, y: 100 } },
  { label: "Node 2", position: { x: 200, y: 100 } },
  { label: "Node 3", position: { x: 300, y: 100 } }
])
// Returns: { success: true, data: { created: [...], failed: [] } }
```

### Create Multiple Edges
```javascript
window.graphAPI.createEdges([
  { source: "node1", target: "node2", sourceHandle: "tick", targetHandle: "trigger" },
  { source: "node2", target: "node3", sourceHandle: "out", targetHandle: "in" }
])
// Returns: { success: true, data: { created: [...], failed: [] } }
```

### Clear Entire Graph
```javascript
window.graphAPI.clearGraph()
// Returns: { success: true, data: { message: "Graph cleared" } }
```

---

## Query Operations

### Find Nodes
```javascript
// Find by type
window.graphAPI.findNodes({ type: "default" })

// Find by label (partial match)
window.graphAPI.findNodes({ label: "Test" })

// Find nodes with memo
window.graphAPI.findNodes({ hasMemo: true })

// Find nodes with link
window.graphAPI.findNodes({ hasLink: true })

// Combine criteria
window.graphAPI.findNodes({ 
  type: "default", 
  hasMemo: true 
})
// Returns: { success: true, data: [<matching nodes>] }
```

### Find Edges
```javascript
// Find by type
window.graphAPI.findEdges({ type: "child" })

// Find edges from a node
window.graphAPI.findEdges({ source: "node-id" })

// Find edges to a node
window.graphAPI.findEdges({ target: "node-id" })

// Combine criteria
window.graphAPI.findEdges({ 
  type: "peer", 
  source: "node1" 
})
// Returns: { success: true, data: [<matching edges>] }
```

### Get Statistics
```javascript
window.graphAPI.getStats()
// Returns: {
//   success: true,
//   data: {
//     nodeCount: 10,
//     edgeCount: 15,
//     nodeTypes: ["default", "display"],
//     edgeTypes: ["child", "peer"],
//     nodesWithMemo: 5,
//     nodesWithLink: 3
//   }
// }
```

---

## Common Use Cases

### Create a Simple Graph
```javascript
// Create nodes
const n1 = window.graphAPI.createNode({ 
  label: "Start", 
  position: { x: 100, y: 100 } 
});
const n2 = window.graphAPI.createNode({ 
  label: "Middle", 
  position: { x: 300, y: 100 } 
});
const n3 = window.graphAPI.createNode({ 
  label: "End", 
  position: { x: 500, y: 100 } 
});

// Connect them (default nodes expose handles named "out" and "in")
window.graphAPI.createEdge({ 
  source: n1.data.id, 
  target: n2.data.id, 
  sourceHandle: "out",
  targetHandle: "in",
  type: "child"
});
window.graphAPI.createEdge({ 
  source: n2.data.id, 
  target: n3.data.id, 
  sourceHandle: "out",
  targetHandle: "in",
  type: "child"
});
```

### Update All Nodes of a Type
```javascript
const result = window.graphAPI.findNodes({ type: "default" });
if (result.success) {
  result.data.forEach(node => {
    window.graphAPI.updateNode(node.id, {
      data: { memo: "Updated by script" }
    });
  });
}
```

### Delete All Edges of a Type
```javascript
const result = window.graphAPI.findEdges({ type: "peer" });
if (result.success) {
  result.data.forEach(edge => {
    window.graphAPI.deleteEdge(edge.id);
  });
}
```

### Create a Tree Structure
```javascript
const root = window.graphAPI.createNode({
  label: "Root",
  position: { x: 300, y: 50 }
});

const children = window.graphAPI.createNodes([
  { label: "Child 1", position: { x: 150, y: 200 } },
  { label: "Child 2", position: { x: 300, y: 200 } },
  { label: "Child 3", position: { x: 450, y: 200 } }
]);

children.data.created.forEach(child => {
  window.graphAPI.createEdge({
    source: root.data.id,
    target: child.id,
    sourceHandle: "out",
    targetHandle: "in",
    type: "child"
  });
});
```

---

## Error Handling

Always check the `success` property:

```javascript
const result = window.graphAPI.createNode({ 
  label: "Test" 
});

if (result.success) {
  console.log("Created:", result.data);
} else {
  console.error("Error:", result.error);
}
```

---

## Tips for LLMs

1. Always check `result.success` before using `result.data`
2. Node and edge IDs are auto-generated UUIDs unless specified
3. Deleting a node automatically deletes its connected edges
4. All operations are saved to undo/redo history
5. Use `getStats()` to understand the current graph state
6. Use `findNodes()` and `findEdges()` for queries before bulk operations
7. Position coordinates are in pixels relative to the graph canvas
