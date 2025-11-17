/**
 * NodeGraph Editor Data Schema
 * 
 * This module defines the canonical data structure for graphs in the NodeGraph Editor.
 * Use this for validation, export/import, and API contracts.
 */

// Core schema version for compatibility tracking
export const SCHEMA_VERSION = "1.0.0";

// Handle schema for explicit per-node connector definitions
export const NodeHandleSchema = {
  id: "string", // Required: Unique handle identifier
  direction: "'input'|'output'|'bidirectional'", // Optional: Defaults to 'output'
  label: "string", // Optional label shown in UI
  dataType: "string", // Optional semantic type (boolean, number, etc.)
  allowedEdgeTypes: ["string"], // Optional list of edge types this handle accepts
  position: { // Optional hint for renderer/layout
    side: "'top'|'right'|'bottom'|'left'",
    offset: "number" // 0-1 relative position along the side
  },
  metadata: "object" // Optional plugin-specific payload (namespaced)
};

export const NodeStateSchema = {
  locked: "boolean",
  collapsed: "boolean",
  hidden: "boolean"
};

// Node schema
export const NodeSchema = {
  id: "string",
  type: "string",
  label: "string",
  position: {
    x: "number",
    y: "number"
  },
  width: "number",
  height: "number",
  data: "object",
  visible: "boolean",
  style: "object",
  handles: [NodeHandleSchema], // Optional explicit handle definitions
  state: NodeStateSchema, // Optional persisted UI/interaction state
  extensions: "object" // Reserved for plugin namespaces
};

export const EdgeStateSchema = {
  enabled: "boolean",
  locked: "boolean",
  lastStatus: "string" // Optional status indicator (ok/warning/error)
};

export const EdgeLogicSchema = {
  condition: "string", // Optional expression evaluated before firing
  transform: "string", // Optional expression applied to payload
  delayMs: "number",
  throttleMs: "number"
};

export const EdgeRoutingSchema = {
  points: [
    {
      x: "number",
      y: "number"
    }
  ],
  labelPosition: {
    x: "number",
    y: "number"
  }
};

// Edge schema
export const EdgeSchema = {
  id: "string",
  type: "string",
  source: "string",
  target: "string",
  sourceHandle: "string",
  targetHandle: "string",
  label: "string",
  showLabel: "boolean",
  style: "object",
  state: EdgeStateSchema,
  logic: EdgeLogicSchema,
  routing: EdgeRoutingSchema,
  extensions: "object"
};

export const GroupSchema = {
  id: "string",
  label: "string",
  nodeIds: ["string"],
  bounds: {
    x: "number",
    y: "number",
    width: "number",
    height: "number"
  },
  style: "object",
  collapsed: "boolean",
  visible: "boolean",
  extensions: "object"
};

export const GraphOptionsSchema = {
  gridSize: "number",
  snapToGrid: "boolean",
  theme: "string",
  validationMode: "'strict'|'permissive'"
};

// Full graph schema
export const GraphSchema = {
  version: "string",
  nodes: [NodeSchema],
  edges: [EdgeSchema],
  groups: [GroupSchema],
  options: GraphOptionsSchema,
  metadata: {
    title: "string",
    description: "string",
    created: "string",
    modified: "string",
    author: "string"
  },
  extensions: "object"
};

// Validation functions
export function validateNode(node) {
  const errors = [];
  
  if (!node.id || typeof node.id !== 'string') {
    errors.push('Node must have a string id');
  }
  
  if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('Node must have position with numeric x and y');
  }

  if (node.handles !== undefined) {
    if (!Array.isArray(node.handles)) {
      errors.push('Node handles must be an array');
    } else {
      const handleIds = new Set();
      node.handles.forEach((handle, idx) => {
        if (!handle || typeof handle.id !== 'string' || handle.id.trim() === '') {
          errors.push(`Node handle ${idx} must have a string id`);
        } else if (handleIds.has(handle.id)) {
          errors.push(`Duplicate handle id '${handle.id}' on node '${node.id}'`);
        } else {
          handleIds.add(handle.id);
        }
        if (handle.direction && !['input', 'output', 'bidirectional'].includes(handle.direction)) {
          errors.push(`Handle '${handle.id}' has invalid direction '${handle.direction}'`);
        }
        if (handle.allowedEdgeTypes && !Array.isArray(handle.allowedEdgeTypes)) {
          errors.push(`Handle '${handle.id}' allowedEdgeTypes must be an array`);
        }
      });
    }
  }
  
  return errors;
}

export function validateEdge(edge) {
  const errors = [];
  
  if (!edge.id || typeof edge.id !== 'string') {
    errors.push('Edge must have a string id');
  }
  
  if (!edge.source || typeof edge.source !== 'string') {
    errors.push('Edge must have a string source node id');
  }
  
  if (!edge.target || typeof edge.target !== 'string') {
    errors.push('Edge must have a string target node id');
  }

  if (edge.state && typeof edge.state !== 'object') {
    errors.push('Edge state must be an object');
  }

  if (edge.logic && typeof edge.logic !== 'object') {
    errors.push('Edge logic must be an object');
  }

  if (edge.routing && typeof edge.routing !== 'object') {
    errors.push('Edge routing must be an object');
  }
  
  return errors;
}

function validateGroup(group) {
  const errors = [];
  if (!group || typeof group !== 'object') {
    errors.push('Group must be an object');
    return errors;
  }
  if (!group.id || typeof group.id !== 'string') {
    errors.push('Group must have a string id');
  }
  if (!Array.isArray(group.nodeIds)) {
    errors.push(`Group '${group.id || 'unknown'}' must have a nodeIds array`);
  }
  if (group.bounds) {
    const { x, y, width, height } = group.bounds;
    if (![x, y, width, height].every(value => typeof value === 'number')) {
      errors.push(`Group '${group.id}' bounds must include numeric x, y, width, height`);
    }
  }
  return errors;
}

export function validateGraph(graph) {
  const errors = [];
  
  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    errors.push('Graph must have a nodes array');
    return errors;
  }
  
  if (!graph.edges || !Array.isArray(graph.edges)) {
    errors.push('Graph must have an edges array');
    return errors;
  }
  
  // Validate all nodes
  graph.nodes.forEach((node, index) => {
    const nodeErrors = validateNode(node);
    nodeErrors.forEach(error => errors.push(`Node ${index}: ${error}`));
  });
  
  // Validate all edges
  graph.edges.forEach((edge, index) => {
    const edgeErrors = validateEdge(edge);
    edgeErrors.forEach(error => errors.push(`Edge ${index}: ${error}`));
  });
  
  // Check edge references
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  graph.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${index}: source node '${edge.source}' not found`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${index}: target node '${edge.target}' not found`);
    }
  });

  if (graph.groups) {
    const groupIds = new Set();
    graph.groups.forEach((group, index) => {
      const groupErrors = validateGroup(group);
      groupErrors.forEach(err => errors.push(`Group ${index}: ${err}`));
      if (group && group.id) {
        if (groupIds.has(group.id)) {
          errors.push(`Duplicate group id '${group.id}'`);
        } else {
          groupIds.add(group.id);
        }
      }
      if (Array.isArray(group?.nodeIds)) {
        group.nodeIds.forEach(nodeId => {
          if (!nodeIds.has(nodeId)) {
            errors.push(`Group '${group.id}': node '${nodeId}' not found in graph`);
          }
        });
      }
    });
  }
  
  return errors;
}

// Helper to create a clean export object
export function createGraphExport(
  nodes,
  edges,
  metadata = {},
  groups = [],
  options = {},
  extensions = {}
) {
  return {
    version: SCHEMA_VERSION,
    nodes: nodes.map(cleanNode),
    edges: edges.map(cleanEdge),
    groups: Array.isArray(groups) ? groups.map(cleanGroup) : [],
    options,
    metadata: {
      created: new Date().toISOString(),
      ...metadata
    },
    extensions
  };
}

function cleanNode(node) {
  const cleaned = {
    id: node.id,
    position: { x: node.position.x, y: node.position.y }
  };
  
  if (node.type && node.type !== 'default') cleaned.type = node.type;
  if (node.label) cleaned.label = node.label;
  if (node.width) cleaned.width = node.width;
  if (node.height) cleaned.height = node.height;
  if (node.data && Object.keys(node.data).length > 0) cleaned.data = node.data;
  if (node.visible === false) cleaned.visible = node.visible;
  if (node.style && Object.keys(node.style).length > 0) cleaned.style = node.style;
  if (Array.isArray(node.handles) && node.handles.length > 0) cleaned.handles = node.handles;
  if (node.state) cleaned.state = node.state;
  if (node.extensions && Object.keys(node.extensions).length > 0) cleaned.extensions = node.extensions;
  
  return cleaned;
}

function cleanEdge(edge) {
  const cleaned = {
    id: edge.id,
    source: edge.source,
    target: edge.target
  };
  
  if (edge.type && edge.type !== 'default') cleaned.type = edge.type;
  if (edge.sourceHandle) cleaned.sourceHandle = edge.sourceHandle;
  if (edge.targetHandle) cleaned.targetHandle = edge.targetHandle;
  if (edge.label) cleaned.label = edge.label;
  if (edge.showLabel) cleaned.showLabel = edge.showLabel;
  if (edge.style && Object.keys(edge.style).length > 0) cleaned.style = edge.style;
  if (edge.state) cleaned.state = edge.state;
  if (edge.logic) cleaned.logic = edge.logic;
  if (edge.routing) cleaned.routing = edge.routing;
  if (edge.extensions && Object.keys(edge.extensions).length > 0) cleaned.extensions = edge.extensions;
  
  return cleaned;
}

function cleanGroup(group) {
  if (!group) return group;
  const cleaned = {
    id: group.id,
    nodeIds: Array.isArray(group.nodeIds) ? group.nodeIds : []
  };
  if (group.label) cleaned.label = group.label;
  if (group.bounds) cleaned.bounds = group.bounds;
  if (group.style) cleaned.style = group.style;
  if (group.collapsed !== undefined) cleaned.collapsed = group.collapsed;
  if (group.visible !== undefined) cleaned.visible = group.visible;
  if (group.extensions && Object.keys(group.extensions).length > 0) cleaned.extensions = group.extensions;
  return cleaned;
}
