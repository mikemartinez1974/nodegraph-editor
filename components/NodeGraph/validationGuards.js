// Data validation guards for nodes and edges
import { useRef } from 'react';
import { validateNode, validateEdge, validateGraph } from './schema.js';

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

const BREADBOARD_ROWS = ['A','B','C','D','E','F','G','H','I','J'];

const sanitizeBreadboardPinsArray = (pins, { allowAutoFix, result, fieldBase, gridColumns }) => {
  if (pins === undefined) return undefined;
  if (!Array.isArray(pins)) {
    if (allowAutoFix) {
      result.warnings.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message: `Reset breadboard pins (expected array)`,
        field: fieldBase,
        autoFixed: true
      });
      return [];
    }
    result.errors.push({
      type: VALIDATION_ERRORS.INVALID_DATA,
      message: `Breadboard pins must be an array`,
      field: fieldBase
    });
    return undefined;
  }

  const occupied = new Set();
  return pins.map((pin, index) => {
    if (!pin || typeof pin !== 'object') return pin;
    const sanitizedPin = { ...pin };
    if (!sanitizedPin.id || typeof sanitizedPin.id !== 'string') {
      if (allowAutoFix) {
        sanitizedPin.id = `pin-${index}`;
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_ID,
          message: `Generated breadboard pin id at index ${index}`,
          field: fieldBase,
          autoFixed: true
        });
      } else {
        result.errors.push({
          type: VALIDATION_ERRORS.INVALID_ID,
          message: 'Breadboard pins require string ids',
          field: fieldBase
        });
      }
    }

    if (sanitizedPin.row) {
      const normRow = String(sanitizedPin.row).trim().toUpperCase();
      if (BREADBOARD_ROWS.includes(normRow)) {
        sanitizedPin.row = normRow;
      } else {
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: `Pin '${sanitizedPin.id}' references invalid row '${sanitizedPin.row}'`,
          field: fieldBase
        });
      }
    }

    if (sanitizedPin.column !== undefined) {
      const numericCol = Number(sanitizedPin.column);
      if (Number.isFinite(numericCol) && numericCol >= 1) {
        sanitizedPin.column = Math.floor(numericCol);
        if (gridColumns && numericCol > gridColumns) {
          result.warnings.push({
            type: VALIDATION_ERRORS.INVALID_DATA,
            message: `Pin '${sanitizedPin.id}' column ${numericCol} exceeds board columns (${gridColumns})`,
            field: fieldBase
          });
        }
      } else {
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: `Pin '${sanitizedPin.id}' has invalid column '${sanitizedPin.column}'`,
          field: fieldBase
        });
      }
    }

    if (sanitizedPin.row && sanitizedPin.column !== undefined) {
      const key = `${sanitizedPin.row}:${sanitizedPin.column}`;
      if (occupied.has(key)) {
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: `Multiple pins assigned to socket ${key}`,
          field: fieldBase
        });
      } else {
        occupied.add(key);
      }
    }

    return sanitizedPin;
  });
};

const sanitizeFootprintDimensions = (footprint, { allowAutoFix, result, fieldBase }) => {
  if (footprint === undefined) return undefined;
  if (!footprint || typeof footprint !== 'object' || Array.isArray(footprint)) {
    if (allowAutoFix) {
      result.warnings.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message: `Removed invalid footprint metadata`,
        field: fieldBase,
        autoFixed: true
      });
      return undefined;
    }
    result.errors.push({
      type: VALIDATION_ERRORS.INVALID_DATA,
      message: 'Footprint metadata must be an object',
      field: fieldBase
    });
    return undefined;
  }

  const sanitized = { ...footprint };
  ['rows', 'columns', 'width', 'height', 'rowPitch', 'columnPitch'].forEach(key => {
    if (sanitized[key] === undefined) return;
    const numericValue = Number(sanitized[key]);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      if (allowAutoFix) {
        delete sanitized[key];
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: `Removed invalid ${key} from footprint`,
          field: fieldBase,
          autoFixed: true
        });
      } else {
        result.errors.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: `Footprint ${key} must be a positive number`,
          field: fieldBase
        });
      }
    } else {
      sanitized[key] = numericValue;
    }
  });

  return sanitized;
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

      if (!sanitized.data) {
        sanitized.data = {};
      } else {
        const dataPins = sanitizeBreadboardPinsArray(sanitized.data.pins, {
          allowAutoFix: this.options.allowAutoFix,
          result,
          fieldBase: 'data.pins',
          gridColumns: sanitized.data?.footprint?.columns
        });
        if (dataPins !== undefined) {
          sanitized.data.pins = dataPins;
        }

        const footprint = sanitizeFootprintDimensions(sanitized.data.footprint, {
          allowAutoFix: this.options.allowAutoFix,
          result,
          fieldBase: 'data.footprint'
        });
        if (footprint !== undefined) {
          sanitized.data.footprint = footprint;
        }
      }

      if (sanitized.handles !== undefined) {
        if (!Array.isArray(sanitized.handles)) {
          result.errors.push({
            type: VALIDATION_ERRORS.INVALID_DATA,
            message: 'Handles must be an array',
            field: 'handles'
          });
        } else {
          const handleIds = new Set();
          sanitized.handles = sanitized.handles
            .map((handle, index) => {
              if (!handle) return null;
              if (typeof handle === 'string') {
                return {
                  id: handle,
                  label: handle,
                  direction: 'output',
                  dataType: 'value'
                };
              }
              if (typeof handle !== 'object') return null;
              const id = handle.id || handle.key || `handle-${index}`;
              if (!id) return null;
              if (handleIds.has(id)) {
                result.errors.push({
                  type: VALIDATION_ERRORS.DUPLICATE_ID,
                  message: `Duplicate handle id '${id}'`,
                  field: 'handles'
                });
                return null;
              }
              handleIds.add(id);
              return {
                id,
                label: handle.label || id,
                direction: handle.direction || (handle.type === 'input' ? 'input' : handle.type === 'output' ? 'output' : 'output'),
                dataType: handle.dataType || handle.type || 'value',
                allowedEdgeTypes: Array.isArray(handle.allowedEdgeTypes) ? [...handle.allowedEdgeTypes] : undefined,
                position: handle.position ? { ...handle.position } : undefined,
                metadata: handle.metadata ? { ...handle.metadata } : undefined
              };
            })
            .filter(Boolean);
        }
      }

      const sanitizeIoHandles = (list, fieldName) => {
        if (!Array.isArray(list)) return list;
        const seen = new Set();
        const sanitizedList = [];
        list.forEach((handle, index) => {
          if (!handle) return;
          let candidate = handle;
          if (typeof handle === 'string') {
            candidate = { key: handle, label: handle, type: 'value' };
          }
          if (typeof candidate !== 'object') return;
          const key = candidate.key || candidate.id;
          if (!key) {
            result.errors.push({
              type: VALIDATION_ERRORS.INVALID_DATA,
              message: `${fieldName} handle missing key`,
              field: fieldName
            });
            return;
          }
          if (seen.has(key)) {
            result.errors.push({
              type: VALIDATION_ERRORS.DUPLICATE_ID,
              message: `Duplicate ${fieldName} handle key '${key}'`,
              field: fieldName
            });
            return;
          }
          seen.add(key);
          sanitizedList.push({
            key,
            label: candidate.label || key,
            type: candidate.type || candidate.dataType || 'value',
            position: candidate.position ? { ...candidate.position } : undefined,
            allowedEdgeTypes: Array.isArray(candidate.allowedEdgeTypes) ? [...candidate.allowedEdgeTypes] : undefined,
            metadata: candidate.metadata ? { ...candidate.metadata } : undefined
          });
        });
        return sanitizedList;
      };

      if (sanitized.inputs !== undefined) {
        sanitized.inputs = sanitizeIoHandles(sanitized.inputs, 'inputs') || [];
      }
      if (sanitized.outputs !== undefined) {
        sanitized.outputs = sanitizeIoHandles(sanitized.outputs, 'outputs') || [];
      }

      sanitized = this.applyBreadboardExtensionValidation(sanitized, result);

      const deriveLegacyHandles = (direction) => {
        const source = Array.isArray(sanitized.handles) ? sanitized.handles : [];
        return source
          .filter(handle => {
            const dir = handle.direction || 'output';
            if (direction === 'input') {
              return dir === 'input' || dir === 'bidirectional';
            }
            return dir === 'output' || dir === 'bidirectional' || !dir;
          })
          .map(handle => ({
            key: handle.id,
            label: handle.label || handle.id,
            type: handle.dataType || 'value'
          }));
      };

      if (!Array.isArray(sanitized.inputs) || sanitized.inputs.length === 0) {
        const derivedInputs = deriveLegacyHandles('input');
        if (derivedInputs.length > 0) {
          sanitized.inputs = derivedInputs;
        }
      }
      if (!Array.isArray(sanitized.outputs) || sanitized.outputs.length === 0) {
        const derivedOutputs = deriveLegacyHandles('output');
        if (derivedOutputs.length > 0) {
          sanitized.outputs = derivedOutputs;
        }
      }

      if (sanitized.state && typeof sanitized.state !== 'object') {
        sanitized.state = undefined;
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: 'Removed invalid node state (must be object)',
          field: 'state',
          autoFixed: true
        });
      }

      if (sanitized.extensions && typeof sanitized.extensions !== 'object') {
        sanitized.extensions = undefined;
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: 'Removed invalid node extensions (must be object)',
          field: 'extensions',
          autoFixed: true
        });
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

      if (sanitized.state && typeof sanitized.state !== 'object') {
        sanitized.state = undefined;
      }

      if (sanitized.logic && typeof sanitized.logic !== 'object') {
        sanitized.logic = undefined;
      }

      if (sanitized.routing && typeof sanitized.routing !== 'object') {
        sanitized.routing = undefined;
      } else if (sanitized.routing?.points && !Array.isArray(sanitized.routing.points)) {
        sanitized.routing.points = undefined;
      }

      if (sanitized.extensions && typeof sanitized.extensions !== 'object') {
        sanitized.extensions = undefined;
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
  validateGraphStructure(nodes, edges, graphExtensions = null) {
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

    if (graphExtensions?.breadboard) {
      this.validateBreadboardGraphExtensions(graphExtensions.breadboard, result);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  applyBreadboardExtensionValidation(node, result) {
    if (!node.extensions || !node.extensions.breadboard) {
      return node;
    }
    const ext = { ...node.extensions.breadboard };

    if (ext.orientation && !['horizontal', 'vertical'].includes(ext.orientation)) {
      if (this.options.allowAutoFix) {
        delete ext.orientation;
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: 'Removed invalid breadboard orientation',
          field: 'extensions.breadboard.orientation',
          autoFixed: true
        });
      } else {
        result.errors.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: 'Breadboard orientation must be horizontal or vertical',
          field: 'extensions.breadboard.orientation'
        });
      }
    }

    if (ext.allowStacking !== undefined && typeof ext.allowStacking !== 'boolean') {
      if (this.options.allowAutoFix) {
        ext.allowStacking = Boolean(ext.allowStacking);
        result.warnings.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: 'Coerced allowStacking to boolean',
          field: 'extensions.breadboard.allowStacking',
          autoFixed: true
        });
      } else {
        result.errors.push({
          type: VALIDATION_ERRORS.INVALID_DATA,
          message: 'allowStacking must be boolean',
          field: 'extensions.breadboard.allowStacking'
        });
      }
    }

    if (ext.pins !== undefined) {
      const pins = sanitizeBreadboardPinsArray(ext.pins, {
        allowAutoFix: this.options.allowAutoFix,
        result,
        fieldBase: 'extensions.breadboard.pins'
      });
      if (pins !== undefined) {
        ext.pins = pins;
      }
    }

    const dataPins = node.data?.pins || node.data?.breadboard?.pins;
    if (Array.isArray(ext.pins) && Array.isArray(dataPins) && ext.pins.length !== dataPins.length) {
      result.warnings.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message: `extensions.breadboard.pins (${ext.pins.length}) does not match data pins (${dataPins.length})`,
        field: 'data.pins'
      });
    }

    return {
      ...node,
      extensions: {
        ...node.extensions,
        breadboard: ext
      }
    };
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

  validateBreadboardGraphExtensions(extension, result) {
    const addWarning = (message, field = 'extensions.breadboard') => {
      result.warnings.push({
        type: VALIDATION_ERRORS.INVALID_DATA,
        message,
        field
      });
    };

    const validateGrid = (grid, field = 'extensions.breadboard.grid') => {
      if (!grid || typeof grid !== 'object') {
        addWarning('Breadboard grid must be an object', field);
        return null;
      }
      if (grid.rows !== undefined && (!Number.isFinite(grid.rows) || grid.rows <= 0)) {
        addWarning('Breadboard grid rows must be a positive number', `${field}.rows`);
      }
      if (grid.columns !== undefined && (!Number.isFinite(grid.columns) || grid.columns <= 0)) {
        addWarning('Breadboard grid columns must be a positive number', `${field}.columns`);
      }
      if (grid.rowSpacing !== undefined && (!Number.isFinite(grid.rowSpacing) || grid.rowSpacing <= 0)) {
        addWarning('Breadboard rowSpacing must be > 0', `${field}.rowSpacing`);
      }
      if (grid.columnSpacing !== undefined && (!Number.isFinite(grid.columnSpacing) || grid.columnSpacing <= 0)) {
        addWarning('Breadboard columnSpacing must be > 0', `${field}.columnSpacing`);
      }
      return grid;
    };

    const validateRails = (rails, field = 'extensions.breadboard.rails', columnLimit = null) => {
      if (rails === undefined) return;
      if (!Array.isArray(rails)) {
        addWarning('Breadboard rails must be an array', field);
        return;
      }
      rails.forEach((rail, index) => {
        if (!rail || typeof rail !== 'object') {
          addWarning(`Rail entry ${index} must be an object`, field);
          return;
        }
        if (!rail.id || typeof rail.id !== 'string') {
          addWarning(`Rail entry ${index} missing string id`, field);
        }
        if (rail.voltage !== undefined && !Number.isFinite(rail.voltage)) {
          addWarning(`Rail '${rail.id || index}' has invalid voltage`, field);
        }
        if (rail.polarity && !['positive', 'negative', 'neutral'].includes(rail.polarity)) {
          addWarning(`Rail '${rail.id || index}' polarity should be positive/negative/neutral`, field);
        }
        if (rail.segments !== undefined) {
          if (!Array.isArray(rail.segments)) {
            addWarning(`Rail '${rail.id || index}' segments must be an array`, field);
          } else {
            rail.segments.forEach((segment) => {
              if (!segment || typeof segment !== 'object') {
                addWarning(`Rail '${rail.id || index}' segment must be an object`, field);
                return;
              }
              const { startColumn, endColumn } = segment;
              if (!Number.isFinite(startColumn) || !Number.isFinite(endColumn)) {
                addWarning(`Rail '${rail.id || index}' segment columns must be numbers`, field);
              } else if (startColumn > endColumn) {
                addWarning(`Rail '${rail.id || index}' segment startColumn must be <= endColumn`, field);
              } else if (columnLimit && endColumn > columnLimit) {
                addWarning(`Rail '${rail.id || index}' segment exceeds grid column count (${columnLimit})`, field);
              }
            });
          }
        }
      });
    };

    const grid = validateGrid(extension.grid);
    const gridColumns =
      grid && Number.isFinite(grid.columns) && grid.columns > 0 ? grid.columns : null;

    validateRails(extension.rails, 'extensions.breadboard.rails', gridColumns);

    if (extension.presets !== undefined) {
      if (!Array.isArray(extension.presets)) {
        addWarning('Breadboard presets must be an array', 'extensions.breadboard.presets');
      } else {
        const presetIds = new Set();
        extension.presets.forEach((preset, index) => {
          if (!preset || typeof preset !== 'object') {
            addWarning(`Preset ${index} must be an object`, 'extensions.breadboard.presets');
            return;
          }
          if (!preset.id || typeof preset.id !== 'string') {
            addWarning(`Preset ${index} missing string id`, 'extensions.breadboard.presets');
          } else if (presetIds.has(preset.id)) {
            addWarning(`Duplicate preset id '${preset.id}'`, 'extensions.breadboard.presets');
          } else {
            presetIds.add(preset.id);
          }
          const presetField = `extensions.breadboard.presets[${index}]`;
          const presetGrid = validateGrid(preset.grid, `${presetField}.grid`);
          validateRails(
            preset.rails,
            `${presetField}.rails`,
            presetGrid?.columns || gridColumns
          );
        });
        if (extension.activePresetId && !presetIds.has(extension.activePresetId)) {
          addWarning(
            `activePresetId '${extension.activePresetId}' not found in presets`,
            'extensions.breadboard.activePresetId'
          );
        }
      }
    }
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
