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

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  Object.prototype.toString.call(value) === '[object Object]';

const cloneValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item));
  }
  if (isPlainObject(value)) {
    const cloned = {};
    Object.keys(value).forEach(key => {
      cloned[key] = cloneValue(value[key]);
    });
    return cloned;
  }
  return value;
};

const cloneExtensions = (extensions) => {
  if (!extensions) return extensions;
  if (!isPlainObject(extensions)) {
    return cloneValue(extensions);
  }
  const cloned = {};
  Object.keys(extensions).forEach(key => {
    cloned[key] = cloneValue(extensions[key]);
  });
  return cloned;
};

const mergeExtensionValues = (existing, incoming) => {
  if (incoming === undefined) {
    return existing;
  }
  if (Array.isArray(incoming)) {
    return incoming.map(item => cloneValue(item));
  }
  if (isPlainObject(incoming)) {
    const base = isPlainObject(existing) ? { ...existing } : {};
    Object.keys(incoming).forEach(key => {
      base[key] = mergeExtensionValues(existing ? existing[key] : undefined, incoming[key]);
    });
    return base;
  }
  return cloneValue(incoming);
};

const mergeExtensions = (existing, updates) => {
  if (updates === null) return null;
  if (!updates) return existing;
  if (!isPlainObject(updates)) {
    return cloneValue(updates);
  }
  const base = existing && isPlainObject(existing) ? cloneExtensions(existing) : {};
  Object.keys(updates).forEach(key => {
    base[key] = mergeExtensionValues(existing ? existing[key] : undefined, updates[key]);
  });
  return base;
};

const DEFAULT_INPUT_HANDLE = Object.freeze({ key: 'in', label: 'In', type: 'trigger', direction: 'input' });
const DEFAULT_OUTPUT_HANDLE = Object.freeze({ key: 'out', label: 'Out', type: 'trigger', direction: 'output' });
const isWildcardHandleType = (value) => {
  if (!value) return true;
  const normalized = String(value).toLowerCase();
  return (
    normalized === 'value' ||
    normalized === 'trigger' ||
    normalized === 'any' ||
    normalized === 'input' ||
    normalized === 'output' ||
    normalized === 'bidirectional'
  );
};

const legacyHandleFromNormalized = (handle) => ({
  key: handle.id,
  label: handle.label || handle.id,
  type: handle.dataType || handle.type || 'value',
  metadata: handle.metadata ? cloneValue(handle.metadata) : undefined
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
    allowedEdgeTypes: Array.isArray(handle.allowedEdgeTypes) ? [...handle.allowedEdgeTypes] : undefined,
    metadata: handle.metadata ? cloneValue(handle.metadata) : undefined,
    position: handle.position ? { ...handle.position } : undefined
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
  allowedEdgeTypes: handle.allowedEdgeTypes ? [...handle.allowedEdgeTypes] : undefined,
  metadata: handle.metadata ? cloneValue(handle.metadata) : undefined,
  position: handle.position ? { ...handle.position } : undefined
});

const toHandleMeta = (handle) => ({
  key: handle.key,
  label: handle.label || handle.key,
  type: handle.type || handle.dataType || 'value',
  direction: handle.direction || 'output',
  allowedEdgeTypes: handle.allowedEdgeTypes ? [...handle.allowedEdgeTypes] : undefined,
  metadata: handle.metadata ? cloneValue(handle.metadata) : undefined,
  position: handle.position ? { ...handle.position } : undefined
});

const getHandleList = (node, field) => {
  if (!node) return [];
  const unified = extractHandlesFromUnified(node, field);
  if (unified.length > 0) {
    return unified.map(handle => cloneHandleDescriptor(handle));
  }
  const handles = Array.isArray(node[field]) ? node[field].filter(Boolean) : [];
  if (handles.length === 0) {
    return [];
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
          metadata: handle.metadata ? cloneValue(handle.metadata) : undefined
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
        dataType: descriptor.type,
        allowedEdgeTypes: descriptor.allowedEdgeTypes ? [...descriptor.allowedEdgeTypes] : undefined,
        metadata: descriptor.metadata ? cloneValue(descriptor.metadata) : undefined,
        position: descriptor.position ? { ...descriptor.position } : undefined
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
        dataType: descriptor.type,
        allowedEdgeTypes: descriptor.allowedEdgeTypes ? [...descriptor.allowedEdgeTypes] : undefined,
        metadata: descriptor.metadata ? cloneValue(descriptor.metadata) : undefined,
        position: descriptor.position ? { ...descriptor.position } : undefined
      });
    }
  });

  return {
    handles: derivedHandles,
    inputs: normalizedInputs,
    outputs: normalizedOutputs
  };
};

const sanitizeNodeData = (rawData) => {
  const data =
    rawData && typeof rawData === 'object' && !Array.isArray(rawData)
      ? cloneValue(rawData)
      : {};
  if (data.memo === undefined || data.memo === null) {
    data.memo = '';
  }
  if (data.link === undefined || data.link === null) {
    data.link = '';
  }
  if (data.html === undefined || data.html === null) {
    data.html = '';
  }
  if (data.svg === undefined || data.svg === null) {
    data.svg = '';
  }
  return data;
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

const validateHandlePair = (sourceNode, targetNode, sourceHandleKey, targetHandleKey, edgeType) => {
  if (!sourceNode || !sourceNode.id) {
    return { error: 'Source node not found' };
  }
  if (!targetNode || !targetNode.id) {
    return { error: 'Target node not found' };
  }
  if (!sourceHandleKey && !targetHandleKey) {
    return { meta: null };
  }

  const sourceHandles = getHandleList(sourceNode, 'outputs');
  const targetHandles = getHandleList(targetNode, 'inputs');

  const sourceHandle = sourceHandleKey
    ? sourceHandles.find(h => h.key === sourceHandleKey)
    : null;
  if (sourceHandleKey && !sourceHandle) {
    return { error: `Output handle "${sourceHandleKey}" not found on node ${sourceNode.id}` };
  }
  const targetHandle = targetHandleKey
    ? targetHandles.find(h => h.key === targetHandleKey)
    : null;
  if (targetHandleKey && !targetHandle) {
    return { error: `Input handle "${targetHandleKey}" not found on node ${targetNode.id}` };
  }
  if (!sourceHandle || !targetHandle) {
    return {
      meta: {
        source: sourceHandle ? toHandleMeta(sourceHandle) : undefined,
        target: targetHandle ? toHandleMeta(targetHandle) : undefined
      }
    };
  }
  if (edgeType) {
    const sourceAllowed = Array.isArray(sourceHandle.allowedEdgeTypes)
      ? sourceHandle.allowedEdgeTypes
      : null;
    const targetAllowed = Array.isArray(targetHandle.allowedEdgeTypes)
      ? targetHandle.allowedEdgeTypes
      : null;
    if (sourceAllowed && !sourceAllowed.includes(edgeType)) {
      return { error: `Edge type "${edgeType}" is not allowed by source handle "${sourceHandleKey}"` };
    }
    if (targetAllowed && !targetAllowed.includes(edgeType)) {
      return { error: `Edge type "${edgeType}" is not allowed by target handle "${targetHandleKey}"` };
    }
  }

  if (
    !isWildcardHandleType(sourceHandle.type) &&
    !isWildcardHandleType(targetHandle.type) &&
    sourceHandle.type !== targetHandle.type
  ) {
    return { error: `Handle types do not match: ${sourceHandle.type} → ${targetHandle.type}` };
  }

  return {
    meta: {
      source: toHandleMeta(sourceHandle),
      target: toHandleMeta(targetHandle)
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

  const edgeType = edgeInput.type || defaultType || 'child';
  const handleValidation = validateHandlePair(
    sourceNode,
    targetNode,
    normalizedSourceHandle,
    normalizedTargetHandle,
    edgeType
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
    type: edgeType,
    label: edgeInput.label || '',
    color: edgeInput.color,
    visible: edgeInput.visible !== false,
    showLabel: edgeInput.showLabel === true,
    data:
      edgeInput.data && typeof edgeInput.data === 'object'
        ? cloneValue(edgeInput.data)
        : {},
    style: {
      width: style.width || 2,
      dash: style.dash || [],
      curved: style.curved !== undefined ? style.curved : true,
      color: style.color
    },
    handleMeta: handleValidation.meta,
    state: edgeInput.state ? cloneValue(edgeInput.state) : undefined,
    logic: edgeInput.logic ? cloneValue(edgeInput.logic) : undefined,
    routing: edgeInput.routing ? cloneValue(edgeInput.routing) : undefined,
    extensions: cloneExtensions(edgeInput.extensions)
  };

  return { edge: sanitizedEdge };
};

const applyNodeUpdates = (node, updates = {}) => {
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
    extensions:
      updates.extensions === undefined
        ? node.extensions
        : mergeExtensions(node.extensions, updates.extensions)
  };
};

const applyEdgeUpdates = (edge, updates = {}) => {
  const mergedEdge = {
    ...edge,
    ...updates,
    style: updates.style ? { ...edge.style, ...updates.style } : edge.style,
    state: updates.state ? { ...edge.state, ...updates.state } : edge.state,
    logic: updates.logic ? { ...edge.logic, ...updates.logic } : edge.logic,
    routing: updates.routing ? { ...edge.routing, ...updates.routing } : edge.routing,
    extensions:
      updates.extensions === undefined
        ? edge.extensions
        : mergeExtensions(edge.extensions, updates.extensions)
  };
  if (updates.data) {
    mergedEdge.data = { ...edge.data, ...updates.data };
  }
  return mergedEdge;
};

/**
 * CRUD API for Node Graph Editor
 * All functions return { success: boolean, data?: any, error?: string }
 */

export default class GraphCRUD {
  constructor(getNodes, setNodes, getEdges, setEdges, saveToHistory, nodesRef, edgesRef, getGroups, setGroups, groupsRef, groupManagerRef) {
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
    this.groupManagerRef = groupManagerRef;
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
      let nodeId = id || this._generateId();
      while (currentNodes.some(n => n.id === nodeId)) {
        nodeId = this._generateId();
      }

      const normalizedHandles = normalizeHandleDefinitions({ handles, inputs, outputs });
      const sanitizedState = state ? cloneValue(state) : undefined;
      const sanitizedStyle = style ? cloneValue(style) : undefined;
      const sanitizedExtensions = cloneExtensions(extensions);
      const sanitizedData = sanitizeNodeData(data);
      const newNode = {
        id: nodeId,
        type,
        label,
        position,
        width: width !== undefined ? width : 80,
        height: height !== undefined ? height : 48,
        data: sanitizedData,
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
          return applyNodeUpdates(node, updates);
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
   * Update multiple nodes with the same changes
   * @param {string[]} ids - Array of node IDs
   * @param {Object} updates - Properties to update
   */
  updateNodes(ids, updates) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'ids must be a non-empty array' };
      }
      if (!updates || typeof updates !== 'object') {
        return { success: false, error: 'updates must be provided' };
      }

      const idSet = new Set(ids);
      const currentNodes = this.getNodes();
      const missing = ids.filter(id => !currentNodes.some(node => node.id === id));
      if (missing.length === ids.length) {
        return { success: false, error: 'None of the specified node ids were found', data: { missing } };
      }

      const updatedItems = [];
      const updatedNodes = currentNodes.map(node => {
        if (!idSet.has(node.id)) {
          return node;
        }
        const nextNode = applyNodeUpdates(node, updates);
        updatedItems.push(nextNode);
        return nextNode;
      });

      this.setNodes(prev => {
        const next = updatedNodes;
        if (this.nodesRef) this.nodesRef.current = next;
        return next;
      });
      this.saveToHistory(updatedNodes, this.getEdges());

      return {
        success: true,
        data: {
          updated: updatedItems,
          missing: missing.length ? missing : undefined
        }
      };
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
      const mergedEdge = applyEdgeUpdates(existingEdge, updates);

      const nodes = this.getNodes();
      const sourceNode = nodes.find(n => n.id === mergedEdge.source);
      const targetNode = nodes.find(n => n.id === mergedEdge.target);
      const handleValidation = validateHandlePair(
        sourceNode,
        targetNode,
        mergedEdge.sourceHandle,
        mergedEdge.targetHandle,
        mergedEdge.type
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
   * Update multiple edges with the same changes
   * @param {string[]} ids - Array of edge IDs
   * @param {Object} updates - Properties to update
   */
  updateEdges(ids, updates) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'ids must be a non-empty array' };
      }
      if (!updates || typeof updates !== 'object') {
        return { success: false, error: 'updates must be provided' };
      }

      const idSet = new Set(ids);
      const currentEdges = this.getEdges();
      const missing = ids.filter(id => !currentEdges.some(edge => edge.id === id));
      if (missing.length === ids.length) {
        return { success: false, error: 'None of the specified edge ids were found', data: { missing } };
      }

      const nodes = this.getNodes();
      const updatedItems = [];
      const updatedEdges = currentEdges.map(edge => {
        if (!idSet.has(edge.id)) {
          return edge;
        }
        const mergedEdge = applyEdgeUpdates(edge, updates);
        const sourceNode = nodes.find(n => n.id === mergedEdge.source);
        const targetNode = nodes.find(n => n.id === mergedEdge.target);
        const handleValidation = validateHandlePair(
          sourceNode,
          targetNode,
          mergedEdge.sourceHandle,
          mergedEdge.targetHandle,
          mergedEdge.type
        );
        if (handleValidation.error) {
          throw new Error(`Edge ${edge.id}: ${handleValidation.error}`);
        }
        mergedEdge.handleMeta = handleValidation.meta;
        updatedItems.push(mergedEdge);
        return mergedEdge;
      });

      this.setEdges(() => {
        const next = updatedEdges;
        if (this.edgesRef) this.edgesRef.current = next;
        return next;
      });
      this.saveToHistory(nodes, updatedEdges);

      return {
        success: true,
        data: {
          updated: updatedItems,
          missing: missing.length ? missing : undefined
        }
      };
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
          let nodeId = opts.id || this._generateId();
          while (
            currentNodes.some(n => n.id === nodeId) ||
            createdNodes.some(n => n.id === nodeId)
          ) {
            nodeId = this._generateId();
          }

          const normalizedHandles = normalizeHandleDefinitions({
            handles: opts.handles,
            inputs: opts.inputs,
            outputs: opts.outputs
          });
          const sanitizedData = sanitizeNodeData(opts.data);

          const newNode = {
            id: nodeId,
            type: opts.type || 'default',
            label: opts.label || '',
            position: opts.position || { x: 100, y: 100 },
            width: opts.width !== undefined ? opts.width : 160,
            height: opts.height !== undefined ? opts.height : 80,
            color: opts.color,
            visible: opts.visible !== undefined ? opts.visible : true,
            data: sanitizedData,
            inputs: normalizedHandles.inputs,
            outputs: normalizedHandles.outputs,
            handles: normalizedHandles.handles,
            state: opts.state ? cloneValue(opts.state) : undefined,
            style: opts.style ? cloneValue(opts.style) : undefined,
            extensions: cloneExtensions(opts.extensions),
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
      if (this.nodesRef) this.nodesRef.current = updatedNodes;
      this.setNodes(() => updatedNodes);
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

  _syncGroupManager(nextGroups, nodes = null) {
    if (!this.groupManagerRef) return;
    const manager = this.groupManagerRef.current || this.groupManagerRef;
    if (!manager) return;
    const groupStore = manager.groups;
    const nodeToGroup = manager.nodeToGroup;
    if (typeof manager.clear === 'function') {
      manager.clear();
    } else {
      groupStore?.clear?.();
      nodeToGroup?.clear?.();
    }
    if (!Array.isArray(nextGroups)) return;
    nextGroups.forEach(group => {
      if (!group || !group.id) return;
      if (groupStore?.set) {
        groupStore.set(group.id, group);
      }
      if (nodeToGroup?.set && Array.isArray(group.nodeIds)) {
        group.nodeIds.forEach(nodeId => nodeToGroup.set(nodeId, group.id));
      }
    });
  }

  _commitGroups(nextGroups) {
    this.setGroups(() => {
      if (this.groupsRef) this.groupsRef.current = nextGroups;
      return nextGroups;
    });
    this._syncGroupManager(nextGroups);
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
        if (nodeIds.length < 2) {
          failed.push(`Group ${gid}: must reference at least two existing nodes`);
          continue;
        }

        const newGroup = {
          id: gid,
          label: opts.label || '',
          nodeIds: nodeIds,
          bounds: opts.bounds || { x: 0, y: 0, width: 0, height: 0 },
          visible: opts.visible !== false,
          style: opts.style || {},
          collapsed: opts.collapsed === true,
          extensions: cloneExtensions(opts.extensions)
        };

        createdGroups.push(newGroup);
        existingGroupIds.add(gid);
      }

      if (createdGroups.length === 0) {
        return { success: false, error: failed.join('; ') || 'No valid groups to create' };
      }

      const updatedGroups = [...(currentGroups || []), ...createdGroups];
      this._commitGroups(updatedGroups);

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

  /**
   * Read/Get group(s)
   * @param {string} id - Optional group ID. If omitted, returns all groups
   * @returns {Object} Result with group(s)
   */
  readGroup(id) {
    try {
      const groups = this.getGroups();
      if (id) {
        const group = groups.find(g => g.id === id);
        if (!group) return { success: false, error: `Group ${id} not found` };
        return { success: true, data: group };
      }
      return { success: true, data: groups };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a group
   * @param {string} id - Group ID
   * @param {Object} updates - Properties to update
   * @returns {Object} Result with updated group
   */
  updateGroup(id, updates) {
    try {
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === id);
      if (groupIndex === -1) {
        return { success: false, error: `Group ${id} not found` };
      }
      const nodeIdSet = new Set((this.getNodes() || []).map(n => n.id));
      const updatedGroups = currentGroups.map(group => {
        if (group.id !== id) return group;
        const nextGroup = {
          ...group,
          ...updates,
          bounds: updates.bounds ? { ...group.bounds, ...updates.bounds } : group.bounds,
          style: updates.style ? { ...group.style, ...updates.style } : group.style,
          extensions:
            updates.extensions === undefined
              ? group.extensions
              : mergeExtensions(group.extensions, updates.extensions)
        };
        if (updates.nodeIds !== undefined) {
          if (!Array.isArray(updates.nodeIds)) {
            throw new Error('nodeIds must be an array');
          }
          const filtered = updates.nodeIds.filter(nodeId => nodeIdSet.has(nodeId));
          if (filtered.length < 2) {
            throw new Error(`Group ${id}: must reference at least two existing nodes`);
          }
          nextGroup.nodeIds = filtered;
        }
        return nextGroup;
      });

      this._commitGroups(updatedGroups);
      if (this.saveToHistory) this.saveToHistory(this.getNodes(), this.getEdges());

      return { success: true, data: updatedGroups[groupIndex] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update multiple groups with the same changes
   * @param {string[]} ids - Array of group IDs
   * @param {Object} updates - Properties to update
   */
  updateGroups(ids, updates) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'ids must be a non-empty array' };
      }
      if (!updates || typeof updates !== 'object') {
        return { success: false, error: 'updates must be provided' };
      }

      const idSet = new Set(ids);
      const currentGroups = this.getGroups();
      const missing = ids.filter(id => !currentGroups.some(group => group.id === id));
      if (missing.length === ids.length) {
        return { success: false, error: 'None of the specified group ids were found', data: { missing } };
      }

      const nodeIdSet = new Set((this.getNodes() || []).map(n => n.id));
      const updatedItems = [];
      const updatedGroups = currentGroups.map(group => {
        if (!idSet.has(group.id)) {
          return group;
        }
        const nextGroup = {
          ...group,
          ...updates,
          bounds: updates.bounds ? { ...group.bounds, ...updates.bounds } : group.bounds,
          style: updates.style ? { ...group.style, ...updates.style } : group.style,
          extensions:
            updates.extensions === undefined
              ? group.extensions
              : mergeExtensions(group.extensions, updates.extensions)
        };
        if (updates.nodeIds !== undefined) {
          if (!Array.isArray(updates.nodeIds)) {
            throw new Error('nodeIds must be an array');
          }
          const filtered = updates.nodeIds.filter(nodeId => nodeIdSet.has(nodeId));
          if (filtered.length < 2) {
            throw new Error(`Group ${group.id}: must reference at least two existing nodes`);
          }
          nextGroup.nodeIds = filtered;
        }
        updatedItems.push(nextGroup);
        return nextGroup;
      });

      this._commitGroups(updatedGroups);
      if (this.saveToHistory) this.saveToHistory(this.getNodes(), this.getEdges());

      return {
        success: true,
        data: {
          updated: updatedItems,
          missing: missing.length ? missing : undefined
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a group
   * @param {string} id - Group ID
   * @returns {Object} Result
   */
  deleteGroup(id) {
    try {
      const currentGroups = this.getGroups();
      const groupExists = currentGroups.some(g => g.id === id);
      if (!groupExists) {
        return { success: false, error: `Group ${id} not found` };
      }

      const updatedGroups = currentGroups.filter(g => g.id !== id);
      this._commitGroups(updatedGroups);
      if (this.saveToHistory) this.saveToHistory(this.getNodes(), this.getEdges());

      return { success: true, data: { deletedGroupId: id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Add nodes to an existing group
   * @param {string} groupId - Group ID
   * @param {string[]} nodeIds - Node IDs to add
   */
  addNodesToGroup(groupId, nodeIds) {
    try {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return { success: false, error: 'nodeIds must be a non-empty array' };
      }
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) {
        return { success: false, error: `Group ${groupId} not found` };
      }

      const nodeIdSet = new Set((this.getNodes() || []).map(n => n.id));
      const additions = nodeIds.filter(id => nodeIdSet.has(id));
      if (additions.length === 0) {
        return { success: false, error: 'No valid nodeIds found' };
      }

      const updatedGroups = currentGroups.map(group => {
        if (group.id !== groupId) return group;
        const nextNodeIds = Array.from(new Set([...(group.nodeIds || []), ...additions]));
        if (nextNodeIds.length < 2) {
          throw new Error(`Group ${groupId}: must reference at least two existing nodes`);
        }
        return { ...group, nodeIds: nextNodeIds };
      });

      this._commitGroups(updatedGroups);
      if (this.saveToHistory) this.saveToHistory(this.getNodes(), this.getEdges());

      return { success: true, data: updatedGroups[groupIndex] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove nodes from an existing group
   * @param {string} groupId - Group ID
   * @param {string[]} nodeIds - Node IDs to remove
   */
  removeNodesFromGroup(groupId, nodeIds) {
    try {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return { success: false, error: 'nodeIds must be a non-empty array' };
      }
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) {
        return { success: false, error: `Group ${groupId} not found` };
      }

      let removedGroup = false;
      const updatedGroups = currentGroups
        .map(group => {
          if (group.id !== groupId) return group;
          const nextNodeIds = (group.nodeIds || []).filter(id => !nodeIds.includes(id));
          if (nextNodeIds.length < 2) {
            removedGroup = true;
            return null;
          }
          return { ...group, nodeIds: nextNodeIds };
        })
        .filter(Boolean);

      this._commitGroups(updatedGroups);
      if (this.saveToHistory) this.saveToHistory(this.getNodes(), this.getEdges());

      return {
        success: true,
        data: removedGroup ? { deletedGroupId: groupId } : updatedGroups[groupIndex]
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Replace a group's nodeIds
   * @param {string} groupId - Group ID
   * @param {string[]} nodeIds - New node IDs
   */
  setGroupNodes(groupId, nodeIds) {
    try {
      if (!Array.isArray(nodeIds)) {
        return { success: false, error: 'nodeIds must be an array' };
      }
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) {
        return { success: false, error: `Group ${groupId} not found` };
      }

      const nodeIdSet = new Set((this.getNodes() || []).map(n => n.id));
      const filtered = nodeIds.filter(id => nodeIdSet.has(id));
      if (filtered.length < 2) {
        return { success: false, error: `Group ${groupId}: must reference at least two existing nodes` };
      }

      const updatedGroups = currentGroups.map(group =>
        group.id === groupId ? { ...group, nodeIds: filtered } : group
      );

      this._commitGroups(updatedGroups);
      if (this.saveToHistory) this.saveToHistory(this.getNodes(), this.getEdges());

      return { success: true, data: updatedGroups[groupIndex] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Translate nodes by a delta
   * @param {string[]} ids - Array of node IDs
   * @param {Object} delta - {x, y} delta
   */
  translateNodes(ids, delta = {}) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'ids must be a non-empty array' };
      }
      const dx = Number(delta.x ?? delta.dx ?? 0);
      const dy = Number(delta.y ?? delta.dy ?? 0);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return { success: false, error: 'delta must include numeric x and y' };
      }

      const idSet = new Set(ids);
      const currentNodes = this.getNodes();
      const missing = ids.filter(id => !currentNodes.some(node => node.id === id));
      if (missing.length === ids.length) {
        return { success: false, error: 'None of the specified node ids were found', data: { missing } };
      }

      const updatedNodes = currentNodes.map(node => {
        if (!idSet.has(node.id)) return node;
        const position = node.position || { x: 0, y: 0 };
        return {
          ...node,
          position: { x: position.x + dx, y: position.y + dy }
        };
      });

      this.setNodes(() => {
        const next = updatedNodes;
        if (this.nodesRef) this.nodesRef.current = next;
        return next;
      });
      this.saveToHistory(updatedNodes, this.getEdges());

      return { success: true, data: { updated: ids.length, missing: missing.length ? missing : undefined } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Translate groups and their member nodes by a delta
   * @param {string[]} ids - Array of group IDs
   * @param {Object} delta - {x, y} delta
   */
  translateGroups(ids, delta = {}) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'ids must be a non-empty array' };
      }
      const dx = Number(delta.x ?? delta.dx ?? 0);
      const dy = Number(delta.y ?? delta.dy ?? 0);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return { success: false, error: 'delta must include numeric x and y' };
      }

      const idSet = new Set(ids);
      const currentGroups = this.getGroups();
      const missing = ids.filter(id => !currentGroups.some(group => group.id === id));
      if (missing.length === ids.length) {
        return { success: false, error: 'None of the specified group ids were found', data: { missing } };
      }

      const nodeIdsToMove = new Set();
      const updatedGroups = currentGroups.map(group => {
        if (!idSet.has(group.id)) return group;
        (group.nodeIds || []).forEach(nodeId => nodeIdsToMove.add(nodeId));
        const bounds = group.bounds || { x: 0, y: 0, width: 0, height: 0 };
        return {
          ...group,
          bounds: { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
        };
      });

      const currentNodes = this.getNodes();
      const updatedNodes = currentNodes.map(node => {
        if (!nodeIdsToMove.has(node.id)) return node;
        const position = node.position || { x: 0, y: 0 };
        return {
          ...node,
          position: { x: position.x + dx, y: position.y + dy }
        };
      });

      this.setNodes(() => {
        const next = updatedNodes;
        if (this.nodesRef) this.nodesRef.current = next;
        return next;
      });
      this._commitGroups(updatedGroups);
      this.saveToHistory(updatedNodes, this.getEdges());

      return { success: true, data: { updated: ids.length, missing: missing.length ? missing : undefined } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Duplicate nodes (optionally include edges between them)
   * @param {string[]} ids - Array of node IDs
   * @param {Object} options - { offset: {x,y}, includeEdges: boolean }
   */
  duplicateNodes(ids, options = {}) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'ids must be a non-empty array' };
      }

      const currentNodes = this.getNodes();
      const currentEdges = this.getEdges();
      const idSet = new Set(ids);
      const nodesToDuplicate = currentNodes.filter(node => idSet.has(node.id));
      if (nodesToDuplicate.length === 0) {
        return { success: false, error: 'No matching nodes found to duplicate' };
      }

      const dx = Number(options?.offset?.x ?? options?.offset?.dx ?? 40);
      const dy = Number(options?.offset?.y ?? options?.offset?.dy ?? 40);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return { success: false, error: 'offset must include numeric x and y' };
      }
      const includeEdges = options.includeEdges !== false;

      const idMap = new Map();
      const createdNodes = nodesToDuplicate.map(node => {
        let newId = this._generateId();
        while (currentNodes.some(n => n.id === newId) || idMap.has(newId)) {
          newId = this._generateId();
        }
        idMap.set(node.id, newId);
        const position = node.position || { x: 0, y: 0 };
        return {
          ...cloneValue(node),
          id: newId,
          position: { x: position.x + dx, y: position.y + dy }
        };
      });

      const updatedNodes = deduplicateNodes([...currentNodes, ...createdNodes]);
      let createdEdges = [];
      let edgeErrors = [];

      if (includeEdges) {
        const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));
        const existingEdgeIds = new Set(currentEdges.map(e => e.id));
        const edgesToDuplicate = currentEdges.filter(
          edge => idSet.has(edge.source) && idSet.has(edge.target)
        );
        edgesToDuplicate.forEach((edge, index) => {
          const newEdge = {
            ...cloneValue(edge),
            id: this._generateId(),
            source: idMap.get(edge.source),
            target: idMap.get(edge.target)
          };
          const { edge: normalized, error } = buildEdgePayload(newEdge, {
            nodeMap,
            existingEdgeIds,
            generateId: () => this._generateId(),
            defaultType: newEdge.type || edge.type || 'child'
          });
          if (error) {
            edgeErrors.push(`Edge ${index}: ${error}`);
            return;
          }
          createdEdges.push(normalized);
          existingEdgeIds.add(normalized.id);
        });
      }

      const updatedEdges = [...currentEdges, ...createdEdges];
      this.setNodes(() => {
        const next = updatedNodes;
        if (this.nodesRef) this.nodesRef.current = next;
        return next;
      });
      this.setEdges(() => {
        const next = updatedEdges;
        if (this.edgesRef) this.edgesRef.current = next;
        return next;
      });
      this.saveToHistory(updatedNodes, updatedEdges);

      return {
        success: true,
        data: {
          createdNodes,
          createdEdges,
          warnings: edgeErrors.length ? edgeErrors : undefined
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
