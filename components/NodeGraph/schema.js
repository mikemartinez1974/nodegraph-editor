/**
 * NodeGraph Editor Data Schema
 * 
 * This module defines the canonical data structure for graphs in the NodeGraph Editor.
 * Use this for validation, export/import, and API contracts.
 */

// Core schema version for compatibility tracking
export const SCHEMA_VERSION = "1.0.0";

// Port schema for explicit per-node connector definitions
export const NodePortSchema = {
  id: "string", // Required: Unique port identifier
  direction: "'input'|'output'|'bidirectional'", // Optional: Defaults to 'output'
  label: "string", // Optional label shown in UI
  dataType: "string", // Optional semantic type (boolean, number, etc.)
  allowedEdgeTypes: ["string"], // Optional list of edge types this port accepts
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

export const BreadboardPinSchema = {
  id: "string",
  row: "string", // A-J
  column: "number", // 1-63 etc.
  polarity: "string", // e.g., anode/cathode/positive/negative
  rail: "string", // Optional rail id this pin prefers
  metadata: "object"
};

export const BreadboardFootprintSchema = {
  width: "number", // physical width in px or board units
  height: "number", // physical height
  rows: "number",
  columns: "number",
  rowPitch: "number", // spacing between rows (A/B, etc.)
  columnPitch: "number", // spacing between columns
  metadata: "object"
};

export const BreadboardNodeExtensionSchema = {
  footprint: "string",
  orientation: "'horizontal'|'vertical'",
  pins: [BreadboardPinSchema],
  allowStacking: "boolean",
  metadata: "object"
};

export const BreadboardNodeDataSchema = {
  pins: [BreadboardPinSchema],
  footprint: BreadboardFootprintSchema,
  metadata: "object"
};

export const NodeDataSchema = {
  memo: "string",
  link: "string",
  html: "string",
  svg: "string",
  width: "number",
  height: "number",
  pins: [BreadboardPinSchema],
  footprint: BreadboardFootprintSchema,
  breadboard: BreadboardNodeDataSchema,
  metadata: "object"
};

export const BreadboardRailSchema = {
  id: "string",
  label: "string",
  voltage: "number",
  polarity: "'positive'|'negative'|'neutral'",
  segments: [
    {
      startColumn: "number",
      endColumn: "number"
    }
  ],
  metadata: "object"
};

export const BreadboardPresetSchema = {
  id: "string",
  label: "string",
  grid: {
    rows: "number",
    columns: "number",
    rowSpacing: "number",
    columnSpacing: "number"
  },
  rails: [BreadboardRailSchema],
  metadata: "object"
};

export const BreadboardGraphExtensionSchema = {
  grid: {
    rows: "number",
    columns: "number",
    rowSpacing: "number",
    columnSpacing: "number"
  },
  rails: [BreadboardRailSchema],
  presets: [BreadboardPresetSchema],
  activePresetId: "string",
  metadata: "object"
};

export const GraphMetadataSchema = {
  title: "string",
  description: "string",
  created: "string",
  modified: "string",
  author: "string",
  breadboard: {
    presetId: "string",
    lastSimulated: "string",
    metadata: "object"
  }
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
  data: NodeDataSchema,
  visible: "boolean",
  style: "object",
  ports: [NodePortSchema], // Optional explicit port definitions
  state: NodeStateSchema, // Optional persisted UI/interaction state
  extensions: {
    breadboard: BreadboardNodeExtensionSchema
  } // Additional plugin namespaces may be added
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
  sourcePort: "string",
  targetPort: "string",
  label: "string",
  showLabel: "boolean",
  style: "object",
  state: EdgeStateSchema,
  logic: EdgeLogicSchema,
  routing: EdgeRoutingSchema,
  extensions: "object"
};

export const ClusterSchema = {
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
  clusters: [ClusterSchema],
  options: GraphOptionsSchema,
  metadata: GraphMetadataSchema,
  extensions: {
    breadboard: BreadboardGraphExtensionSchema
  }
};

// Validation functions
export function validateNode(node) {
  const errors = [];
  
  if (!node.id || typeof node.id !== 'string') {
    errors.push('Node must have a string id');
  }
  
  if (node.position !== undefined) {
    if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      errors.push('Node position must include numeric x and y');
    }
  }

  if (node.width !== undefined && (typeof node.width !== 'number' || node.width < 0)) {
    errors.push('Node width must be a positive number when provided');
  }

  if (node.height !== undefined && (typeof node.height !== 'number' || node.height < 0)) {
    errors.push('Node height must be a positive number when provided');
  }

  const allowedNodeKeys = new Set([
    'id',
    'type',
    'label',
    'position',
    'width',
    'height',
    'data',
    'visible',
    'showLabel',
    'color',
    'style',
    'ports',
    'inputs',
    'outputs',
    'clusterId',
    'extensions',
    'state',
    'resizable',
    'portPosition'
  ]);

  Object.keys(node).forEach((key) => {
    if (!allowedNodeKeys.has(key)) {
      errors.push(`Node has unknown field '${key}'`);
    }
  });

  if (node.data !== undefined) {
    if (!node.data || typeof node.data !== 'object' || Array.isArray(node.data)) {
      errors.push('Node data must be an object');
    } else {
      const allowedDataKeys = new Set([
        'memo',
        'link',
        'html',
        'svg',
        'width',
        'height',
        'pins',
        'footprint',
        'breadboard',
        'metadata',
        'markdown',
        'ext'
      ]);
      Object.keys(node.data).forEach((key) => {
        if (!allowedDataKeys.has(key)) {
          errors.push(`Node data has unknown field '${key}'`);
        }
      });
    }
  }

  if (node.ports !== undefined) {
    if (!Array.isArray(node.ports)) {
      errors.push('Node ports must be an array');
    } else {
      const portIds = new Set();
      node.ports.forEach((port, idx) => {
        if (!port || typeof port.id !== 'string' || port.id.trim() === '') {
          errors.push(`Node port ${idx} must have a string id`);
        } else if (portIds.has(port.id)) {
          errors.push(`Duplicate port id '${port.id}' on node '${node.id}'`);
        } else {
          portIds.add(port.id);
        }
        if (port.direction && !['input', 'output', 'bidirectional'].includes(port.direction)) {
          errors.push(`Port '${port.id}' has invalid direction '${port.direction}'`);
        }
        if (port.allowedEdgeTypes && !Array.isArray(port.allowedEdgeTypes)) {
          errors.push(`Port '${port.id}' allowedEdgeTypes must be an array`);
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
  if (!edge.sourcePort || typeof edge.sourcePort !== 'string') {
    errors.push('Edge must have a string sourcePort');
  }
  if (!edge.targetPort || typeof edge.targetPort !== 'string') {
    errors.push('Edge must have a string targetPort');
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

function validateCluster(cluster) {
  const errors = [];
  if (!cluster || typeof cluster !== 'object') {
    errors.push('Cluster must be an object');
    return errors;
  }
  if (!cluster.id || typeof cluster.id !== 'string') {
    errors.push('Cluster must have a string id');
  }
  if (!Array.isArray(cluster.nodeIds)) {
    errors.push(`Cluster '${cluster.id || 'unknown'}' must have a nodeIds array`);
  }
  if (cluster.bounds) {
    const { x, y, width, height } = cluster.bounds;
    if (![x, y, width, height].every(value => typeof value === 'number')) {
      errors.push(`Cluster '${cluster.id}' bounds must include numeric x, y, width, height`);
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

  if (graph.clusters) {
    const clusterIds = new Set();
    graph.clusters.forEach((cluster, index) => {
      const clusterErrors = validateCluster(cluster);
      clusterErrors.forEach(err => errors.push(`Cluster ${index}: ${err}`));
      if (cluster && cluster.id) {
        if (clusterIds.has(cluster.id)) {
          errors.push(`Duplicate cluster id '${cluster.id}'`);
        } else {
          clusterIds.add(cluster.id);
        }
      }
      if (Array.isArray(cluster?.nodeIds)) {
        cluster.nodeIds.forEach(nodeId => {
          if (!nodeIds.has(nodeId)) {
            errors.push(`Cluster '${cluster.id}': node '${nodeId}' not found in graph`);
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
    clusters: Array.isArray(groups) ? groups.map(cleanGroup) : [],
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
  if (Array.isArray(node.ports) && node.ports.length > 0) cleaned.ports = node.ports;
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
  cleaned.sourcePort = edge.sourcePort || 'root';
  cleaned.targetPort = edge.targetPort || 'root';
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
