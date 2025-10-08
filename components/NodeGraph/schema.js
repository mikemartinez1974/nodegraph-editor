/**
 * NodeGraph Editor Data Schema
 * 
 * This module defines the canonical data structure for graphs in the NodeGraph Editor.
 * Use this for validation, export/import, and API contracts.
 */

// Core schema version for compatibility tracking
export const SCHEMA_VERSION = "1.0.0";

// Node schema
export const NodeSchema = {
  id: "string", // Required: Unique identifier
  type: "string", // Optional: Node type for rendering (default: 'default')
  label: "string", // Optional: Display label
  position: { // Required: Position on canvas
    x: "number",
    y: "number"
  },
  width: "number", // Optional: Node width (auto-calculated if not provided)
  height: "number", // Optional: Node height (auto-calculated if not provided)
  data: { // Optional: Custom node data
    memo: "string", // Optional: Markdown memo content
    link: "string", // Optional: Associated URL
    // Additional custom properties allowed
  },
  visible: "boolean", // Optional: Visibility state (default: true)
  style: { // Optional: Custom styling
    backgroundColor: "string",
    borderColor: "string",
    textColor: "string",
    // Additional style properties allowed
  }
};

// Edge schema
export const EdgeSchema = {
  id: "string", // Required: Unique identifier
  type: "string", // Optional: Edge type for rendering (default: 'default')
  source: "string", // Required: Source node ID
  target: "string", // Required: Target node ID
  sourceHandle: "string", // Optional: Source handle ID
  targetHandle: "string", // Optional: Target handle ID
  label: "string", // Optional: Edge label
  showLabel: "boolean", // Optional: Whether to show label (default: false)
  style: { // Optional: Edge styling
    width: "number", // Line width (default: 2)
    color: "string", // Line color
    curved: "boolean", // Whether edge is curved (default: false)
    dashed: "boolean", // Whether line is dashed (default: false)
    // Additional style properties allowed
  }
};

// Full graph schema
export const GraphSchema = {
  version: "string", // Schema version for compatibility
  nodes: [NodeSchema], // Array of nodes
  edges: [EdgeSchema], // Array of edges
  metadata: { // Optional: Graph metadata
    title: "string",
    description: "string",
    created: "string", // ISO date string
    modified: "string", // ISO date string
    author: "string",
    // Additional metadata allowed
  }
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
  
  return errors;
}

// Helper to create a clean export object
export function createGraphExport(nodes, edges, metadata = {}) {
  return {
    version: SCHEMA_VERSION,
    nodes: nodes.map(cleanNode),
    edges: edges.map(cleanEdge),
    metadata: {
      created: new Date().toISOString(),
      ...metadata
    }
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
  
  return cleaned;
}