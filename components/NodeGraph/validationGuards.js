// Data validation guards for nodes and edges
import { validateNode, validateEdge, validateGraph } from './schema';

// Validation error types
export const VALIDATION_ERRORS = {
  INVALID_ID: 'INVALID_ID',
  DUPLICATE_ID: 'DUPLICATE_ID',
  MISSING_POSITION: 'MISSING_POSITION',
  INVALID_POSITION: 'INVALID_POSITION',
  MISSING_SOURCE: 'MISSING_SOURCE',
  MISSING_TARGET: 'MISSING_TARGET',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_DATA: 'INVALID_DATA'
};

export class ValidationGuard {
  constructor(options = {}) {
    this.options = {
      strictMode: false,
      allowAutoFix: true,
      maxNodes: 10000,
      maxEdges: 50000,
      ...options
    };
    
    this.nodeIds = new Set();
    this.edgeIds = new Set();
  }

  // Validate and sanitize a node before adding/updating
  validateNode(node, existingNodes = []) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: null
    };

    try {
      // Basic schema validation
      const schemaErrors = validateNode(node);
      if (schemaErrors.length > 0) {
        result.errors.push(...schemaErrors.map(error => ({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: error,
          field: 'schema'
        })));
      }

      // Create working copy
      let sanitized = { ...node };

      // ID validation and generation
      if (!sanitized.id || typeof sanitized.id !== 'string' || sanitized.id.trim() === '') {
        if (this.options.allowAutoFix) {
          sanitized.id = this.generateNodeId();
          result.warnings.push({
            type: VALIDATION_ERRORS.INVALID_ID,
            message: 'Generated new ID for node',
            field: 'id',
            autoFixed: true
          });
        } else {
          result.errors.push({
            type: VALIDATION_ERRORS.INVALID_ID,
            message: 'Node must have a valid ID',
            field: 'id'
          });
        }
      }

      // Check for duplicate IDs
      const existingIds = new Set(existingNodes.map(n => n.id));
      if (existingIds.has(sanitized.id)) {
        if (this.options.allowAutoFix) {
          sanitized.id = this.generateUniqueNodeId(existingIds);
          result.warnings.push({
            type: VALIDATION_ERRORS.DUPLICATE_ID,
            message: 'Generated unique ID to avoid duplicate',
            field: 'id',
            autoFixed: true
          });
        } else {
          result.errors.push({
            type: VALIDATION_ERRORS.DUPLICATE_ID,
            message: `Node ID '${sanitized.id}' already exists`,
            field: 'id'
          });
        }
      }

      // Position validation
      if (!sanitized.position) {
        if (this.options.allowAutoFix) {
          sanitized.position = { x: 0, y: 0 };
          result.warnings.push({
            type: VALIDATION_ERRORS.MISSING_POSITION,
            message: 'Set default position (0, 0)',
            field: 'position',
            autoFixed: true
          });
        } else {
          result.errors.push({
            type: VALIDATION_ERRORS.MISSING_POSITION,
            message: 'Node must have a position',
            field: 'position'
          });
        }
      } else {
        // Validate position values
        if (typeof sanitized.position.x !== 'number' || typeof sanitized.position.y !== 'number') {
          if (this.options.allowAutoFix) {
            sanitized.position = {
              x: Number(sanitized.position.x) || 0,
              y: Number(sanitized.position.y) || 0
            };
            result.warnings.push({
              type: VALIDATION_ERRORS.INVALID_POSITION,
              message: 'Converted position values to numbers',
              field: 'position',
              autoFixed: true
            });
          } else {
            result.errors.push({
              type: VALIDATION_ERRORS.INVALID_POSITION,
              message: 'Position x and y must be numbers',
              field: 'position'
            });
          }
        }

        // Check for invalid position values
        if (!isFinite(sanitized.position.x) || !isFinite(sanitized.position.y)) {
          if (this.options.allowAutoFix) {
            sanitized.position = { x: 0, y: 0 };
            result.warnings.push({
              type: VALIDATION_ERRORS.INVALID_POSITION,
              message: 'Reset invalid position values',
              field: 'position',
              autoFixed: true
            });
          } else {
            result.errors.push({
              type: VALIDATION_ERRORS.INVALID_POSITION,
              message: 'Position values must be finite numbers',
              field: 'position'
            });
          }
        }
      }

      // Validate dimensions
      if (sanitized.width !== undefined) {
        if (typeof sanitized.width !== 'number' || sanitized.width < 0) {
          if (this.options.allowAutoFix) {
            delete sanitized.width;
            result.warnings.push({
              type: VALIDATION_ERRORS.INVALID_DATA,
              message: 'Removed invalid width',
              field: 'width',
              autoFixed: true
            });
          } else {
            result.errors.push({
              type: VALIDATION_ERRORS.INVALID_DATA,
              message: 'Width must be a positive number',
              field: 'width'
            });
          }
        }
      }

      if (sanitized.height !== undefined) {
        if (typeof sanitized.height !== 'number' || sanitized.height < 0) {
          if (this.options.allowAutoFix) {
            delete sanitized.height;
            result.warnings.push({
              type: VALIDATION_ERRORS.INVALID_DATA,
              message: 'Removed invalid height',
              field: 'height',
              autoFixed: true
            });
          } else {
            result.errors.push({
              type: VALIDATION_ERRORS.INVALID_DATA,
              message: 'Height must be a positive number',
              field: 'height'
            });
          }
        }
      }

      // Sanitize data object
      if (sanitized.data && typeof sanitized.data !== 'object') {
        if (this.options.allowAutoFix) {
          sanitized.data = {};
          result.warnings.push({
            type: VALIDATION_ERRORS.INVALID_DATA,
            message: 'Reset invalid data object',
            field: 'data',
            autoFixed: true
          });
        } else {
          result.errors.push({
            type: VALIDATION_ERRORS.INVALID_DATA,
            message: 'Data must be an object',
            field: 'data'
          });
        }
      }

      result.sanitized = sanitized;
      result.isValid = result.errors.length === 0;

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message: `Validation error: ${error.message}`,
        field: 'general'
      });
    }

    return result;
  }

  // Validate and sanitize an edge before adding/updating
  validateEdge(edge, existingNodes = [], existingEdges = []) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: null
    };

    try {
      // Basic schema validation
      const schemaErrors = validateEdge(edge);
      if (schemaErrors.length > 0) {
        result.errors.push(...schemaErrors.map(error => ({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: error,
          field: 'schema'
        })));
      }

      // Create working copy
      let sanitized = { ...edge };

      // ID validation and generation
      if (!sanitized.id || typeof sanitized.id !== 'string' || sanitized.id.trim() === '') {
        if (this.options.allowAutoFix) {
          sanitized.id = this.generateEdgeId();
          result.warnings.push({
            type: VALIDATION_ERRORS.INVALID_ID,
            message: 'Generated new ID for edge',
            field: 'id',
            autoFixed: true
          });
        } else {
          result.errors.push({
            type: VALIDATION_ERRORS.INVALID_ID,
            message: 'Edge must have a valid ID',
            field: 'id'
          });
        }
      }

      // Check for duplicate IDs
      const existingIds = new Set(existingEdges.map(e => e.id));
      if (existingIds.has(sanitized.id)) {
        if (this.options.allowAutoFix) {
          sanitized.id = this.generateUniqueEdgeId(existingIds);
          result.warnings.push({
            type: VALIDATION_ERRORS.DUPLICATE_ID,
            message: 'Generated unique ID to avoid duplicate',
            field: 'id',
            autoFixed: true
          });
        } else {
          result.errors.push({
            type: VALIDATION_ERRORS.DUPLICATE_ID,
            message: `Edge ID '${sanitized.id}' already exists`,
            field: 'id'
          });
        }
      }

      // Validate node references
      const nodeIds = new Set(existingNodes.map(n => n.id));
      
      if (!nodeIds.has(sanitized.source)) {
        result.errors.push({
          type: VALIDATION_ERRORS.INVALID_REFERENCE,
          message: `Source node '${sanitized.source}' does not exist`,
          field: 'source'
        });
      }

      if (!nodeIds.has(sanitized.target)) {
        result.errors.push({
          type: VALIDATION_ERRORS.INVALID_REFERENCE,
          message: `Target node '${sanitized.target}' does not exist`,
          field: 'target'
        });
      }

      // Check for self-reference
      if (sanitized.source === sanitized.target) {
        if (this.options.strictMode) {
          result.errors.push({
            type: VALIDATION_ERRORS.CIRCULAR_REFERENCE,
            message: 'Edge cannot connect a node to itself',
            field: 'target'
          });
        } else {
          result.warnings.push({
            type: VALIDATION_ERRORS.CIRCULAR_REFERENCE,
            message: 'Edge connects node to itself',
            field: 'target'
          });
        }
      }

      result.sanitized = sanitized;
      result.isValid = result.errors.length === 0;

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message: `Validation error: ${error.message}`,
        field: 'general'
      });
    }

    return result;
  }

  // Validate entire graph structure
  validateGraphStructure(nodes, edges) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        duplicateNodes: 0,
        duplicateEdges: 0,
        orphanedEdges: 0
      }
    };

    // Check limits
    if (nodes.length > this.options.maxNodes) {
      result.errors.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message: `Too many nodes: ${nodes.length} (max: ${this.options.maxNodes})`,
        field: 'nodes'
      });
    }

    if (edges.length > this.options.maxEdges) {
      result.errors.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message: `Too many edges: ${edges.length} (max: ${this.options.maxEdges})`,
        field: 'edges'
      });
    }

    // Check for duplicate node IDs
    const nodeIds = new Set();
    const duplicateNodes = [];
    nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        duplicateNodes.push({ id: node.id, index });
      } else {
        nodeIds.add(node.id);
      }
    });

    if (duplicateNodes.length > 0) {
      result.stats.duplicateNodes = duplicateNodes.length;
      result.errors.push({
        type: VALIDATION_ERRORS.DUPLICATE_ID,
        message: `Duplicate node IDs found: ${duplicateNodes.map(d => d.id).join(', ')}`,
        field: 'nodes'
      });
    }

    // Check for duplicate edge IDs
    const edgeIds = new Set();
    const duplicateEdges = [];
    edges.forEach((edge, index) => {
      if (edgeIds.has(edge.id)) {
        duplicateEdges.push({ id: edge.id, index });
      } else {
        edgeIds.add(edge.id);
      }
    });

    if (duplicateEdges.length > 0) {
      result.stats.duplicateEdges = duplicateEdges.length;
      result.errors.push({
        type: VALIDATION_ERRORS.DUPLICATE_ID,
        message: `Duplicate edge IDs found: ${duplicateEdges.map(d => d.id).join(', ')}`,
        field: 'edges'
      });
    }

    // Check for orphaned edges
    const orphanedEdges = edges.filter(edge => 
      !nodeIds.has(edge.source) || !nodeIds.has(edge.target)
    );

    if (orphanedEdges.length > 0) {
      result.stats.orphanedEdges = orphanedEdges.length;
      result.warnings.push({
        type: VALIDATION_ERRORS.INVALID_REFERENCE,
        message: `Found ${orphanedEdges.length} edges with missing nodes`,
        field: 'edges'
      });
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  // Generate unique node ID
  generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  generateUniqueNodeId(existingIds) {
    let id;
    let attempts = 0;
    do {
      id = this.generateNodeId();
      attempts++;
    } while (existingIds.has(id) && attempts < 100);
    
    if (attempts >= 100) {
      // Fallback to UUID-like format
      id = `node_${crypto.randomUUID?.() || Math.random().toString(36)}`;
    }
    
    return id;
  }

  // Generate unique edge ID
  generateEdgeId() {
    return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  generateUniqueEdgeId(existingIds) {
    let id;
    let attempts = 0;
    do {
      id = this.generateEdgeId();
      attempts++;
    } while (existingIds.has(id) && attempts < 100);
    
    if (attempts >= 100) {
      // Fallback to UUID-like format
      id = `edge_${crypto.randomUUID?.() || Math.random().toString(36)}`;
    }
    
    return id;
  }
}

// Hook for using validation guard
export function useValidationGuard(options = {}) {
  const guardRef = useRef();
  
  if (!guardRef.current) {
    guardRef.current = new ValidationGuard(options);
  }
  
  return guardRef.current;
}

// Helper functions for common validation scenarios
export function safeAddNode(nodes, newNode, options = {}) {
  const guard = new ValidationGuard(options);
  const validation = guard.validateNode(newNode, nodes);
  
  if (validation.isValid || options.allowWarnings) {
    return {
      success: true,
      node: validation.sanitized,
      validation
    };
  }
  
  return {
    success: false,
    validation
  };
}

export function safeAddEdge(nodes, edges, newEdge, options = {}) {
  const guard = new ValidationGuard(options);
  const validation = guard.validateEdge(newEdge, nodes, edges);
  
  if (validation.isValid || options.allowWarnings) {
    return {
      success: true,
      edge: validation.sanitized,
      validation
    };
  }
  
  return {
    success: false,
    validation
  };
}