// GraphCRUD.js
// LLM-friendly CRUD API for graph manipulation
import { v4 as uuidv4 } from 'uuid';
import { generateUUID, ensureUniqueNodeIds, deduplicateNodes } from './utils/idUtils.js';

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const hasContent = (value) => typeof value === 'string' && value.trim().length > 0;

const toLower = (value) => (value ?? '').toString().toLowerCase();

const DEFAULT_INPUT_HANDLE = Object.freeze({ key: 'in', label: 'In', type: 'trigger', direction: 'input' });
const DEFAULT_OUTPUT_HANDLE = Object.freeze({ key: 'out', label: 'Out', type: 'trigger', direction: 'output' });

const legacyHandleFromNormalized = (handle) => ({
  key: handle.id,
  label: handle.label || handle.id,
  type: handle.dataType || handle.type || 'value'
});

const toHandleDescriptor = (handle, fallbackDirection, index = 0) => {
  if (!handle) return null;
  if (typeof handle === 'string') {
    return { key: handle, label: handle, type: 'value', direction: fallbackDirection };
  }
  if (typeof handle !== 'object') return null;
  const key = handle.key || handle.id || handle.name || `handle-${index}`;
  if (!key) return null;
  return {
    key,
    label: handle.label || handle.name || key,
    type: handle.type || handle.dataType || 'value',
    direction: handle.direction || fallbackDirection || 'output',
    allowedEdgeTypes: Array.isArray(handle.allowedEdgeTypes) ? [...handle.allowedEdgeTypes] : undefined
  };
};

const extractHandlesFromUnified = (node, targetDirection) => {
  if (!node || !Array.isArray(node.handles) || node.handles.length === 0) return [];
  const allowed = targetDirection === 'outputs'
    ? ['output', 'bidirectional', undefined]
    : ['input', 'bidirectional', undefined];
  return node.handles
    .map((handle, index) => {
      const descriptor = toHandleDescriptor(handle, targetDirection === 'outputs' ? 'output' : 'input', index);
      if (!descriptor) return null;
      if (!allowed.includes(descriptor.direction)) return null;
      return descriptor;
    })
    .filter(Boolean);
};

const cloneHandleDescriptor = (handle, directionOverride) => ({
  key: handle.key,
  label: handle.label || handle.key,
  type: handle.type || handle.dataType || 'value',
  direction: directionOverride || handle.direction || 'output',
  allowedEdgeTypes: handle.allowedEdgeTypes ? [...handle.allowedEdgeTypes] : undefined
});

const getHandleList = (node, field, fallback) => {
  if (!node) return [cloneHandleDescriptor(fallback)];
  const unified = extractHandlesFromUnified(node, field);
  if (unified.length > 0) {
    return unified.map(handle => cloneHandleDescriptor(handle));
  }
  const handles = Array.isArray(node[field]) ? node[field].filter(Boolean) : [];
  if (handles.length === 0) {
    return [cloneHandleDescriptor(fallback)];
  }
  return handles
    .map((handle, index) => toHandleDescriptor(handle, field === 'outputs' ? 'output' : 'input', index))
    .filter(Boolean);
};

const normalizeHandleDefinitions = ({ handles, inputs, outputs }) => {
  const normalizedInputs = Array.isArray(inputs) ? inputs.map(handle => ({ ...handle })) : [];
  const normalizedOutputs = Array.isArray(outputs) ? outputs.map(handle => ({ ...handle })) : [];

  if (Array.isArray(handles) && handles.length > 0) {
    const normalizedHandles = handles
      .map((handle, index) => {
        if (!handle) return null;
        const id = handle.id || handle.key || handle.name || `handle-${index}`;
        if (!id) return null;
        const direction = handle.direction
          ? handle.direction
          : handle.handleDirection
          ? handle.handleDirection
          : handle.type === 'input'
          ? 'input'
          : handle.type === 'output'
          ? 'output'
          : 'output';
        return {
          id,
          label: handle.label || handle.name || id,
          direction,
          dataType: handle.dataType || handle.handleType || handle.type || 'value',
          allowedEdgeTypes: Array.isArray(handle.allowedEdgeTypes) ? [...handle.allowedEdgeTypes] : undefined,
          position: handle.position ? { ...handle.position } : undefined,
          metadata: handle.metadata ? { ...handle.metadata } : undefined
        };
      })
      .filter(Boolean);
    const derivedInputs =
      normalizedInputs.length > 0
        ? normalizedInputs
        : normalizedHandles
            .filter(h => h.direction === 'input' || h.direction === 'bidirectional')
            .map(legacyHandleFromNormalized);
    const derivedOutputs =
      normalizedOutputs.length > 0
        ? normalizedOutputs
        : normalizedHandles
            .filter(h => h.direction === 'output' || h.direction === 'bidirectional' || !h.direction)
            .map(legacyHandleFromNormalized);
    return {
      handles: normalizedHandles,
      inputs: derivedInputs,
      outputs: derivedOutputs
    };
  }

  const derivedHandles = [];
  normalizedInputs.forEach((handle, index) => {
    const descriptor = toHandleDescriptor(handle, 'input', index);
    if (descriptor) {
      derivedHandles.push({
        id: descriptor.key,
        label: descriptor.label,
        direction: 'input',
        dataType: descriptor.type
      });
    }
  });
  normalizedOutputs.forEach((handle, index) => {
    const descriptor = toHandleDescriptor(handle, 'output', index);
    if (descriptor) {
      derivedHandles.push({
        id: descriptor.key,
        label: descriptor.label,
        direction: 'output',
        dataType: descriptor.type
      });
    }
  });

  return {
    handles: derivedHandles,
    inputs: normalizedInputs,
    outputs: normalizedOutputs
  };
};

const normalizeEndpoint = (endpoint, explicitHandleKey) => {
  if (typeof endpoint === 'string') {
    return { nodeId: endpoint, handleKey: explicitHandleKey || null };
  }
  if (endpoint && typeof endpoint === 'object') {
    const nodeId = endpoint.nodeId ?? endpoint.id ?? endpoint.node ?? null;
    const derivedHandle = endpoint.handleKey ?? endpoint.key ?? endpoint.handle ?? null;
    return {
      nodeId,
      handleKey: explicitHandleKey || derivedHandle || null
    };
  }
  return { nodeId: endpoint ?? null, handleKey: explicitHandleKey || null };
};

const validateHandlePair = (sourceNode, targetNode, sourceHandleKey, targetHandleKey) => {
  if (!sourceNode || !sourceNode.id) {
    return { error: 'Source node not found' };
  }
  if (!targetNode || !targetNode.id) {
    return { error: 'Target node not found' };
  }
  if (!sourceHandleKey) {
    return { error: `sourceHandle is required for node ${sourceNode.id}` };
  }
  if (!targetHandleKey) {
    return { error: `targetHandle is required for node ${targetNode.id}` };
  }

  const sourceHandles = getHandleList(sourceNode, 'outputs', DEFAULT_OUTPUT_HANDLE);
  const targetHandles = getHandleList(targetNode, 'inputs', DEFAULT_INPUT_HANDLE);

  const sourceHandle = sourceHandles.find(h => h.key === sourceHandleKey);
  if (!sourceHandle) {
    return { error: `Output handle "${sourceHandleKey}" not found on node ${sourceNode.id}` };
  }
  const targetHandle = targetHandles.find(h => h.key === targetHandleKey);
  if (!targetHandle) {
    return { error: `Input handle "${targetHandleKey}" not found on node ${targetNode.id}` };
  }

  if (
    sourceHandle.type &&
    targetHandle.type &&
    sourceHandle.type !== targetHandle.type &&
    sourceHandle.type !== 'trigger' &&
    targetHandle.type !== 'trigger'
  ) {
    return { error: `Handle types do not match: ${sourceHandle.type} → ${targetHandle.type}` };
  }

  return {
    meta: {
      source: { key: sourceHandle.key, label: sourceHandle.label, type: sourceHandle.type },
      target: { key: targetHandle.key, label: targetHandle.label, type: targetHandle.type }
    }
  };
};

const buildEdgePayload = (edgeInput, { nodeMap, existingEdgeIds, generateId, defaultType }) => {
  if (!edgeInput || typeof edgeInput !== 'object') {
    return { error: 'Edge definition must be an object' };
  }

  const { nodeId: normalizedSource, handleKey: normalizedSourceHandle } = normalizeEndpoint(
    edgeInput.source,
    edgeInput.sourceHandle
  );
  const { nodeId: normalizedTarget, handleKey: normalizedTargetHandle } = normalizeEndpoint(
    edgeInput.target,
    edgeInput.targetHandle
  );

  if (!normalizedSource || !normalizedTarget) {
    return { error: 'Edges require both source and target node ids' };
  }

  const sourceNode = nodeMap.get(normalizedSource);
  const targetNode = nodeMap.get(normalizedTarget);

  if (!sourceNode) {
    return { error: `Source node ${normalizedSource} not found` };
  }
  if (!targetNode) {
    return { error: `Target node ${normalizedTarget} not found` };
  }

  const handleValidation = validateHandlePair(
    sourceNode,
    targetNode,
    normalizedSourceHandle,
    normalizedTargetHandle
  );
  if (handleValidation.error) {
    return { error: handleValidation.error };
  }

  let edgeId = edgeInput.id || generateId();
  while (existingEdgeIds.has(edgeId)) {
    edgeId = generateId();
  }
  existingEdgeIds.add(edgeId);

  const style = edgeInput.style || {};

  const sanitizedEdge = {
    id: edgeId,
    source: normalizedSource,
    target: normalizedTarget,
    sourceHandle: normalizedSourceHandle,
    targetHandle: normalizedTargetHandle,
    type: edgeInput.type || defaultType || 'child',
    label: edgeInput.label || '',
    color: edgeInput.color,
    visible: edgeInput.visible !== false,
    showLabel: edgeInput.showLabel === true,
    data: edgeInput.data || {},
    style: {
      width: style.width || 2,
      dash: style.dash || [],
      curved: style.curved !== undefined ? style.curved : true,
      color: style.color
    },
    handleMeta: handleValidation.meta,
    state: edgeInput.state ? { ...edgeInput.state } : undefined,
    logic: edgeInput.logic ? { ...edgeInput.logic } : undefined,
    routing: edgeInput.routing ? { ...edgeInput.routing } : undefined,
    extensions: edgeInput.extensions ? { ...edgeInput.extensions } : undefined
  };

  return { edge: sanitizedEdge };
};

/**
 * CRUD API for Node Graph Editor
 * All functions return { success: boolean, data?: any, error?: string }
 */

export default class GraphCRUD {
  constructor(getNodes, setNodes, getEdges, setEdges, saveToHistory, nodesRef, edgesRef, getGroups, setGroups, groupsRef) {
    this.getNodes = getNodes;
    this.setNodes = setNodes;
    this.getEdges = getEdges;
    this.setEdges = setEdges;
    this.saveToHistory = saveToHistory;
    this.nodesRef = nodesRef;
    this.edgesRef = edgesRef;

    // Optional group handlers (may be undefined in older callers)
    this.getGroups = typeof getGroups === 'function' ? getGroups : (() => (groupsRef && groupsRef.current) || []);
    this.setGroups = typeof setGroups === 'function' ? setGroups : (() => {});
    this.groupsRef = groupsRef;
  }

  // ==================== NODE CRUD ====================

  /**
   * Create a new node
   * @param {Object} options - Node creation options
   * @param {string} options.id - Optional custom ID (auto-generated if not provided)
   * @param {string} options.type - Node type (default, display, list)
   * @param {string} options.label - Node label
   * @param {Object} options.position - {x, y} coordinates
   * @param {Object} options.data - {memo, link} data object
   * @param {number} options.width - Node width
   * @param {number} options.height - Node height
   * @returns {Object} Result with created node
   */
  createNode({
    id,
    type = 'default',
    label = '',
    position = { x: 100, y: 100 },
    data = {},
    width,
    height,
    inputs,
    outputs,
    handles,
    state,
    style,
    visible = true,
    extensions
  } = {}) {
    try {
      const currentNodes = this.getNodes();
      let nodeId;
      do {
        nodeId = id || this._generateId();
      } while (currentNodes.some(n => n.id === nodeId));

      const normalizedHandles = normalizeHandleDefinitions({ handles, inputs, outputs });
      const sanitizedState = state ? { ...state } : undefined;
      const sanitizedStyle = style ? { ...style } : undefined;
      const sanitizedExtensions = extensions ? { ...extensions } : undefined;
      const newNode = {
        id: nodeId,
        type,
        label,
        position,
        width: width !== undefined ? width : 80,
        height: height !== undefined ? height : 48,
        data: {
          memo: data.memo || '',
          link: data.link || ''
        },
        inputs: normalizedHandles.inputs,
        outputs: normalizedHandles.outputs,
        handles: normalizedHandles.handles,
        visible,
        state: sanitizedState,
        style: sanitizedStyle,
        extensions: sanitizedExtensions,
        resizable: true,
        handlePosition: 'center',
        showLabel: true
      };
      const updatedNodes = deduplicateNodes([...currentNodes, newNode]);
      this.setNodes(prev => {
        if (this.nodesRef) this.nodesRef.current = updatedNodes;
        return updatedNodes;
      });
      this.saveToHistory(updatedNodes, this.getEdges());
      return { success: true, data: newNode };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Read/Get node(s)
   * @param {string} id - Optional node ID. If omitted, returns all nodes
   * @returns {Object} Result with node(s)
   */
  readNode(id) {
    try {
      const nodes = this.getNodes();
      if (id) {
        const node = nodes.find(n => n.id === id);
        if (!node) return { success: false, error: `Node ${id} not found` };
        return { success: true, data: node };
      }
      return { success: true, data: nodes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a node
   * @param {string} id - Node ID
   * @param {Object} updates - Properties to update
   * @returns {Object} Result with updated node
   */
  updateNode(id, updates) {
    try {
      const currentNodes = this.getNodes();
      const nodeIndex = currentNodes.findIndex(n => n.id === id);
      
      if (nodeIndex === -1) {
        return { success: false, error: `Node ${id} not found` };
      }

      const updatedNodes = currentNodes.map(node => {
        if (node.id === id) {
          const nextInputs = updates.inputs
            ? updates.inputs.map(handle => ({ ...handle }))
            : node.inputs;
          const nextOutputs = updates.outputs
            ? updates.outputs.map(handle => ({ ...handle }))
            : node.outputs;
          let nextHandles = node.handles;
          if (updates.handles) {
            nextHandles = normalizeHandleDefinitions({
              handles: updates.handles,
              inputs: nextInputs,
              outputs: nextOutputs
            }).handles;
          } else if (updates.inputs || updates.outputs) {
            nextHandles = normalizeHandleDefinitions({
              handles: node.handles,
              inputs: nextInputs,
              outputs: nextOutputs
            }).handles;
          }
          return {
            ...node,
            ...updates,
            inputs: nextInputs,
            outputs: nextOutputs,
            handles: nextHandles,
            data: updates.data ? { ...node.data, ...updates.data } : node.data,
            position: updates.position ? { ...node.position, ...updates.position } : node.position,
            state: updates.state ? { ...node.state, ...updates.state } : node.state,
            style: updates.style ? { ...node.style, ...updates.style } : node.style,
            extensions: updates.extensions ? { ...node.extensions, ...updates.extensions } : node.extensions
          };
        }
        return node;
      });

      this.setNodes(prev => {
        const next = updatedNodes;
        if (this.nodesRef) this.nodesRef.current = next;
        return next;
      });
      this.saveToHistory(updatedNodes, this.getEdges());

      return { success: true, data: updatedNodes[nodeIndex] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a node (and connected edges)
   * @param {string} id - Node ID
   * @returns {Object} Result
   */
  deleteNode(id) {
    try {
      const currentNodes = this.getNodes();
      const currentEdges = this.getEdges();
      
      const nodeExists = currentNodes.some(n => n.id === id);
      if (!nodeExists) {
        return { success: false, error: `Node ${id} not found` };
      }

      const updatedNodes = currentNodes.filter(n => n.id !== id);
      const updatedEdges = currentEdges.filter(e => e.source !== id && e.target !== id);
      
      this.setNodes(prev => {
        const next = updatedNodes;
        if (this.nodesRef) this.nodesRef.current = next;
        return next;
      });
      this.setEdges(prev => {
        const next = updatedEdges;
        if (this.edgesRef) this.edgesRef.current = next;
        return next;
      });
      this.saveToHistory(updatedNodes, updatedEdges);

      return { success: true, data: { deletedNodeId: id, affectedEdges: currentEdges.length - updatedEdges.length } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== EDGE CRUD ====================

  /**
   * Create a new edge
   * @param {Object} options - Edge creation options
   * @param {string} options.id - Optional custom ID
   * @param {string} options.source - Source node ID
   * @param {string} options.target - Target node ID
   * @param {string} options.type - Edge type (child, peer, etc)
   * @param {string} options.label - Edge label
   * @param {Object} options.style - {width, dash, curved, color}
   * @returns {Object} Result with created edge
   */
  createEdge(edgeInput = {}) {
    try {
      const nodes = this.getNodes();
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const currentEdges = this.getEdges();
      const existingEdgeIds = new Set(currentEdges.map(e => e.id));
      const { edge, error } = buildEdgePayload(edgeInput, {
        nodeMap,
        existingEdgeIds,
        generateId: () => this._generateId(),
        defaultType: edgeInput.type || 'child'
      });

      if (error) {
        return { success: false, error };
      }

      const updatedEdges = [...currentEdges, edge];
      this.setEdges(prev => {
        const next = updatedEdges;
        if (this.edgesRef) this.edgesRef.current = next;
        return next;
      });
      this.saveToHistory(nodes, updatedEdges);

      return { success: true, data: edge };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Read/Get edge(s)
   * @param {string} id - Optional edge ID. If omitted, returns all edges
   * @returns {Object} Result with edge(s)
   */
  readEdge(id) {
    try {
      const edges = this.getEdges();
      if (id) {
        const edge = edges.find(e => e.id === id);
        if (!edge) return { success: false, error: `Edge ${id} not found` };
        return { success: true, data: edge };
      }
      return { success: true, data: edges };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an edge
   * @param {string} id - Edge ID
   * @param {Object} updates - Properties to update
   * @returns {Object} Result with updated edge
   */
  updateEdge(id, updates) {
    try {
      const currentEdges = this.getEdges();
      const edgeIndex = currentEdges.findIndex(e => e.id === id);
      
      if (edgeIndex === -1) {
        return { success: false, error: `Edge ${id} not found` };
      }

      const existingEdge = currentEdges[edgeIndex];
      const mergedEdge = {
        ...existingEdge,
        ...updates,
        style: updates.style ? { ...existingEdge.style, ...updates.style } : existingEdge.style,
        state: updates.state ? { ...existingEdge.state, ...updates.state } : existingEdge.state,
        logic: updates.logic ? { ...existingEdge.logic, ...updates.logic } : existingEdge.logic,
        routing: updates.routing ? { ...existingEdge.routing, ...updates.routing } : existingEdge.routing,
        extensions: updates.extensions ? { ...existingEdge.extensions, ...updates.extensions } : existingEdge.extensions
      };
      if (updates.data) {
        mergedEdge.data = { ...existingEdge.data, ...updates.data };
      }

      const nodes = this.getNodes();
      const sourceNode = nodes.find(n => n.id === mergedEdge.source);
      const targetNode = nodes.find(n => n.id === mergedEdge.target);
      const handleValidation = validateHandlePair(
        sourceNode,
        targetNode,
        mergedEdge.sourceHandle,
        mergedEdge.targetHandle
      );
      if (handleValidation.error) {
        return { success: false, error: handleValidation.error };
      }
      mergedEdge.handleMeta = handleValidation.meta;

      const updatedEdges = currentEdges.map(edge => (edge.id === id ? mergedEdge : edge));

      this.setEdges(prev => {
        const next = updatedEdges;
        if (this.edgesRef) this.edgesRef.current = next;
        return next;
      });
      this.saveToHistory(nodes, updatedEdges);

      return { success: true, data: mergedEdge };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an edge
   * @param {string} id - Edge ID
   * @returns {Object} Result
   */
  deleteEdge(id) {
    try {
      const currentEdges = this.getEdges();
      const edgeExists = currentEdges.some(e => e.id === id);
      
      if (!edgeExists) {
        return { success: false, error: `Edge ${id} not found` };
      }

      const updatedEdges = currentEdges.filter(e => e.id !== id);
      this.setEdges(prev => {
        const next = updatedEdges;
        if (this.edgesRef) this.edgesRef.current = next;
        return next;
      });
      this.saveToHistory(this.getNodes(), updatedEdges);

      return { success: true, data: { deletedEdgeId: id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Create multiple nodes at once
   * @param {Array} nodesArray - Array of node options
   * @returns {Object} Result with created nodes
   */
  createNodes(nodesArray) {
    try {
      const currentNodes = this.getNodes();
      const createdNodes = [];
      const failed = [];

      // Create all nodes without calling setNodes/saveToHistory for each
      for (const opts of nodesArray) {
        try {
          let nodeId;
          do {
            nodeId = opts.id || this._generateId();
          } while (currentNodes.some(n => n.id === nodeId) || createdNodes.some(n => n.id === nodeId));

          const normalizedHandles = normalizeHandleDefinitions({
            handles: opts.handles,
            inputs: opts.inputs,
            outputs: opts.outputs
          });

          const newNode = {
            id: nodeId,
            type: opts.type || 'default',
            label: opts.label || '',
            position: opts.position || { x: 100, y: 100 },
            width: opts.width !== undefined ? opts.width : 160,
            height: opts.height !== undefined ? opts.height : 80,
            color: opts.color,
            visible: opts.visible !== undefined ? opts.visible : true,
            data: {
              memo: opts.data?.memo || '',
              link: opts.data?.link || '',
              html: opts.data?.html || '',
              svg: opts.data?.svg || '',
              ...opts.data
            },
            inputs: normalizedHandles.inputs,
            outputs: normalizedHandles.outputs,
            handles: normalizedHandles.handles,
            state: opts.state ? { ...opts.state } : undefined,
            style: opts.style ? { ...opts.style } : undefined,
            extensions: opts.extensions ? { ...opts.extensions } : undefined,
            resizable: opts.resizable !== undefined ? opts.resizable : true,
            handlePosition: opts.handlePosition || 'center',
            showLabel: opts.showLabel !== undefined ? opts.showLabel : true
          };

          createdNodes.push(newNode);
        } catch (error) {
          failed.push(error.message);
        }
      }

      // Update state once with all nodes
      const updatedNodes = deduplicateNodes([...currentNodes, ...createdNodes]);
      this.setNodes(prev => {
        const next = updatedNodes;
        if (this.nodesRef) this.nodesRef.current = next;
        return next;
      });
      this.saveToHistory(updatedNodes, this.getEdges());

      return {
        success: failed.length === 0,
        data: {
          created: createdNodes,
          failed: failed
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create multiple edges at once
   * @param {Array} edgesArray - Array of edge options
   * @returns {Object} Result with created edges
   */
  createEdges(edges) {
    try {
      if (!Array.isArray(edges)) {
        return { success: false, error: 'edges must be an array' };
      }

      const currentNodes = this.getNodes();
      const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
      const currentEdges = this.getEdges();
      const existingEdgeIds = new Set(currentEdges.map(e => e.id));

      const validEdges = [];
      const errors = [];

      for (let i = 0; i < edges.length; i++) {
        const rawEdge = edges[i];
        const { edge, error } = buildEdgePayload(rawEdge, {
          nodeMap,
          existingEdgeIds,
          generateId: () => this._generateId(),
          defaultType: (rawEdge && rawEdge.type) || 'straight'
        });
        if (error) {
          errors.push(`Edge ${i}: ${error}`);
          continue;
        }
        validEdges.push(edge);
      }

      if (validEdges.length === 0) {
        return {
          success: false,
          error: errors.length > 0 ? errors.join('; ') : 'No valid edges to create'
        };
      }

      const updatedEdges = [...currentEdges, ...validEdges];
      this.setEdges(prev => {
        if (this.edgesRef) this.edgesRef.current = updatedEdges;
        return updatedEdges;
      });

      this.saveToHistory(currentNodes, updatedEdges);

      const message = `Created ${validEdges.length} edge${validEdges.length > 1 ? 's' : ''}`;
      if (errors.length > 0) {
        console.warn('Edge creation warnings:', errors);
      }

      return {
        success: true,
        data: {
          created: validEdges,
          message,
          warnings: errors.length > 0 ? errors : undefined
        }
      };
    } catch (error) {
      console.error('createEdges error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create multiple groups at once
   * @param {Array} groupsArray - Array of group options
   * @returns {Object} Result with created groups
   */
  createGroups(groupsArray) {
    try {
      if (!Array.isArray(groupsArray)) {
        return { success: false, error: 'groups must be an array' };
      }

      const currentNodes = this.getNodes();
      const currentGroups = this.getGroups ? this.getGroups() : (this.groupsRef ? this.groupsRef.current || [] : []);
      const nodeIdSet = new Set((currentNodes || []).map(n => n.id));
      const existingGroupIds = new Set((currentGroups || []).map(g => g.id));

      const createdGroups = [];
      const failed = [];

      for (let i = 0; i < groupsArray.length; i++) {
        const opts = groupsArray[i];
        if (!opts || typeof opts !== 'object') {
          failed.push(`Group ${i}: must be an object`);
          continue;
        }

        const gid = opts.id || this._generateId();
        if (existingGroupIds.has(gid)) {
          failed.push(`Group ${gid}: already exists`);
          continue;
        }

        const nodeIds = Array.isArray(opts.nodeIds) ? opts.nodeIds.filter(id => nodeIdSet.has(id)) : [];
        if (nodeIds.length === 0) {
          failed.push(`Group ${gid}: no valid nodeIds found (must reference existing nodes)`);
          continue;
        }

        const newGroup = {
          id: gid,
          label: opts.label || '',
          nodeIds: nodeIds,
          bounds: opts.bounds || { x: 0, y: 0, width: 0, height: 0 },
          visible: opts.visible !== false,
          style: opts.style || {}
        };

        createdGroups.push(newGroup);
        existingGroupIds.add(gid);
      }

      if (createdGroups.length === 0) {
        return { success: false, error: failed.join('; ') || 'No valid groups to create' };
      }

      const updatedGroups = [...(currentGroups || []), ...createdGroups];
      this.setGroups(prev => {
        const next = updatedGroups;
        if (this.groupsRef) this.groupsRef.current = next;
        return next;
      });

      // Save history using current nodes/edges (groups are part of UI state but history handler can be used)
      if (this.saveToHistory) this.saveToHistory(this.getNodes(), this.getEdges());

      return {
        success: true,
        data: {
          created: createdGroups,
          failed: failed.length ? failed : undefined
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== QUERY OPERATIONS ====================

  /**
   * Find nodes by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Object} Result with matching nodes
   */
  findNodes(criteria = {}) {
    try {
      const nodes = [...this.getNodes()];
      if (!criteria || Object.keys(criteria).length === 0) {
        return { success: true, data: nodes };
      }

      const {
        type,
        types,
        label,
        text,
        id,
        ids,
        memoContains,
        hasMemo,
        hasLink,
        includeHidden = true,
        includeVisible = true,
        visible,
        minWidth,
        maxWidth,
        minHeight,
        maxHeight,
        custom
      } = criteria;

      const normalizedTypes = Array.isArray(types) ? types.filter(Boolean) : null;
      const idSet = Array.isArray(ids) ? new Set(ids) : null;
      const textQuery = hasContent(text) ? toLower(text.trim()) : null;
      const memoQuery = hasContent(memoContains) ? toLower(memoContains.trim()) : null;
      const labelQuery = hasContent(label) ? toLower(label.trim()) : null;
      const minWidthNum = toNumber(minWidth);
      const maxWidthNum = toNumber(maxWidth);
      const minHeightNum = toNumber(minHeight);
      const maxHeightNum = toNumber(maxHeight);

      const filtered = nodes.filter(node => {
        const nodeType = node.type || 'default';

        if (type && nodeType !== type) return false;
        if (normalizedTypes && normalizedTypes.length && !normalizedTypes.includes(nodeType)) return false;
        if (id && node.id !== id) return false;
        if (idSet && !idSet.has(node.id)) return false;
        if (labelQuery && !toLower(node.label).includes(labelQuery)) return false;

        const labelLower = toLower(node.label);
        const idLower = toLower(node.id);
        const memoLower = toLower(node.data?.memo);
        const linkLower = toLower(node.data?.link);

        if (textQuery) {
          const matchesText =
            labelLower.includes(textQuery) ||
            idLower.includes(textQuery) ||
            memoLower.includes(textQuery) ||
            linkLower.includes(textQuery);
          if (!matchesText) return false;
        }

        if (memoQuery && !memoLower.includes(memoQuery)) return false;

        if (hasMemo === true && !hasContent(node.data?.memo)) return false;
        if (hasMemo === false && hasContent(node.data?.memo)) return false;

        if (hasLink === true && !hasContent(node.data?.link)) return false;
        if (hasLink === false && hasContent(node.data?.link)) return false;

        const isVisible = node.visible !== false;
        if (visible === true && !isVisible) return false;
        if (visible === false && isVisible) return false;
        if (!includeVisible && isVisible) return false;
        if (!includeHidden && !isVisible) return false;

        const widthValue = toNumber(node.width ?? node.data?.width);
        if (minWidthNum !== null && (widthValue === null || widthValue < minWidthNum)) return false;
        if (maxWidthNum !== null && (widthValue === null || widthValue > maxWidthNum)) return false;

        const heightValue = toNumber(node.height ?? node.data?.height);
        if (minHeightNum !== null && (heightValue === null || heightValue < minHeightNum)) return false;
        if (maxHeightNum !== null && (heightValue === null || heightValue > maxHeightNum)) return false;

        if (typeof custom === 'function') {
          try {
            return !!custom(node);
          } catch (err) {
            console.warn('[GraphCRUD] custom node filter failed:', err);
            return false;
          }
        }

        return true;
      });

      return { success: true, data: filtered };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find edges by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Object} Result with matching edges
   */
  findEdges(criteria) {
    try {
      let edges = this.getEdges();

      if (criteria.type) {
        edges = edges.filter(e => e.type === criteria.type);
      }
      if (criteria.source) {
        edges = edges.filter(e => e.source === criteria.source);
      }
      if (criteria.target) {
        edges = edges.filter(e => e.target === criteria.target);
      }

      return { success: true, data: edges };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get graph statistics
   * @returns {Object} Result with statistics
   */
  getStats() {
    try {
      const nodes = this.getNodes();
      const edges = this.getEdges();

      return {
        success: true,
        data: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          nodeTypes: [...new Set(nodes.map(n => n.type))],
          edgeTypes: [...new Set(edges.map(e => e.type))],
          nodesWithMemo: nodes.filter(n => n.data?.memo).length,
          nodesWithLink: nodes.filter(n => n.data?.link).length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== HELPER METHODS ====================

  _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return uuidv4();
  }
}

// Export createNode as a standalone function for convenience
export function createNode(nodeData) {
  // Always assign a unique id if not provided
  const id = nodeData.id || uuidv4();
  return {
    ...nodeData,
    id,
  };
}

// Example usage for LLM:
/*
const crud = new GraphCRUD(getNodes, setNodes, getEdges, setEdges, saveToHistory);

// Create a node
crud.createNode({
  label: "My Node",
  position: { x: 200, y: 150 },
  data: { memo: "Important note" }
});

// Create an edge
crud.createEdge({
  source: "node1",
  target: "node2",
  sourceHandle: "out",
  targetHandle: "in",
  type: "child"
});

// Update node
crud.updateNode("node1", {
  label: "Updated Label",
  data: { memo: "New memo" }
});

// Query
crud.findNodes({ type: "default", hasMemo: true });

// Get stats
crud.getStats();
*/
