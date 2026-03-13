// GraphCRUD.js
// LLM-friendly CRUD API for graph manipulation
import { v4 as uuidv4 } from 'uuid';
import { generateUUID, ensureUniqueNodeIds, deduplicateNodes } from './utils/idUtils.js';
import eventBus from '../NodeGraph/eventBus.js';
import { parsePortEndpoint, endpointToUrl } from './utils/portEndpoint.js';

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
  if (!node || !Array.isArray(node.ports) || node.ports.length === 0) return [];
  const allowed = targetDirection === 'outputs'
    ? ['output', 'bidirectional', undefined]
    : ['input', 'bidirectional', undefined];
  return node.ports
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
  const rootHandle = {
    key: 'root',
    label: 'root',
    type: 'value',
    direction: field === 'outputs' ? 'output' : 'input',
    position: { side: 'left', offset: 0.5 }
  };
  if (unified.length > 0) {
    const list = unified.map(handle => cloneHandleDescriptor(handle));
    if (!list.some(handle => handle.key === 'root')) {
      list.push(rootHandle);
    }
    return list;
  }
  const handles = Array.isArray(node[field]) ? node[field].filter(Boolean) : [];
  if (handles.length === 0) {
    return [rootHandle];
  }
  const list = handles
    .map((handle, index) => toHandleDescriptor(handle, field === 'outputs' ? 'output' : 'input', index))
    .filter(Boolean);
  if (!list.some(handle => handle.key === 'root')) {
    list.push(rootHandle);
  }
  return list;
};

const normalizeHandleDefinitions = ({ handles, ports, inputs, outputs }) => {
  const normalizedInputs = Array.isArray(inputs) ? inputs.map(handle => ({ ...handle })) : [];
  const normalizedOutputs = Array.isArray(outputs) ? outputs.map(handle => ({ ...handle })) : [];
  const unifiedHandles = Array.isArray(handles) && handles.length > 0
    ? handles
    : Array.isArray(ports) && ports.length > 0
    ? ports
    : [];

  if (unifiedHandles.length > 0) {
    const normalizedHandles = unifiedHandles
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
      ports: normalizedHandles,
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
    ports: derivedHandles,
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

  const sourceHandles = getHandleList(sourceNode, 'outputs');
  const targetHandles = getHandleList(targetNode, 'inputs');

  const sourcePort = sourceHandleKey === 'root'
    ? { key: 'root', label: 'root', type: 'value' }
    : sourceHandleKey
    ? sourceHandles.find(h => h.key === sourceHandleKey)
    : null;
  if (sourceHandleKey && !sourcePort) {
    return { error: `Output port "${sourceHandleKey}" not found on node ${sourceNode.id}` };
  }
  const targetPort = targetHandleKey === 'root'
    ? { key: 'root', label: 'root', type: 'value' }
    : targetHandleKey
    ? targetHandles.find(h => h.key === targetHandleKey)
    : null;
  if (targetHandleKey && !targetPort) {
    return { error: `Input port "${targetHandleKey}" not found on node ${targetNode.id}` };
  }
  if (!sourcePort || !targetPort) {
    return {
      meta: {
        source: sourcePort ? toHandleMeta(sourcePort) : undefined,
        target: targetPort ? toHandleMeta(targetPort) : undefined
      }
    };
  }
  if (edgeType) {
    const sourceAllowed = Array.isArray(sourcePort.allowedEdgeTypes)
      ? sourcePort.allowedEdgeTypes
      : null;
    const targetAllowed = Array.isArray(targetPort.allowedEdgeTypes)
      ? targetPort.allowedEdgeTypes
      : null;
    if (sourceAllowed && !sourceAllowed.includes(edgeType)) {
      return { error: `Edge type "${edgeType}" is not allowed by source port "${sourceHandleKey}"` };
    }
    if (targetAllowed && !targetAllowed.includes(edgeType)) {
      return { error: `Edge type "${edgeType}" is not allowed by target port "${targetHandleKey}"` };
    }
  }

  if (
    !isWildcardHandleType(sourcePort.type) &&
    !isWildcardHandleType(targetPort.type) &&
    sourcePort.type !== targetPort.type
  ) {
    return { error: `Port types do not match: ${sourcePort.type} → ${targetPort.type}` };
  }

  return {
    meta: {
      source: toHandleMeta(sourcePort),
      target: toHandleMeta(targetPort)
    }
  };
};

const buildEdgePayload = (edgeInput, { nodeMap, existingEdgeIds, generateId, defaultType }) => {
  if (!edgeInput || typeof edgeInput !== 'object') {
    return { error: 'Edge definition must be an object' };
  }

  const { nodeId: normalizedSource, handleKey: normalizedSourceHandle } = normalizeEndpoint(
    edgeInput.source,
    edgeInput.sourcePort
  );
  const { nodeId: normalizedTarget, handleKey: normalizedTargetHandle } = normalizeEndpoint(
    edgeInput.target,
    edgeInput.targetPort
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

  const edgeType = edgeInput.type || defaultType || 'relates';
  const sourcePortKey = normalizedSourceHandle || 'root';
  const targetPortKey = normalizedTargetHandle || 'root';

  const handleValidation = validateHandlePair(
    sourceNode,
    targetNode,
    sourcePortKey,
    targetPortKey,
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
    sourcePort: sourcePortKey,
    targetPort: targetPortKey,
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
    portMeta: handleValidation.meta,
    state: edgeInput.state ? cloneValue(edgeInput.state) : undefined,
    logic: edgeInput.logic ? cloneValue(edgeInput.logic) : undefined,
    routing: edgeInput.routing ? cloneValue(edgeInput.routing) : undefined,
    extensions: cloneExtensions(edgeInput.extensions)
  };

  return { edge: sanitizedEdge };
};

const applyNodeUpdates = (node, updates = {}) => {
  const dataMode = updates.__twiliteDataMode || 'merge-shallow';
  const replaceData = updates.replaceData === true;
  const { __twiliteDataMode, replaceData: _replaceData, ...cleanUpdates } = updates;
  const nextInputs = updates.inputs
    ? updates.inputs.map(handle => ({ ...handle }))
    : node.inputs;
  const nextOutputs = updates.outputs
    ? updates.outputs.map(handle => ({ ...handle }))
    : node.outputs;

  let nextHandles = node.ports;
  if (updates.ports) {
    nextHandles = normalizeHandleDefinitions({
      ports: updates.ports,
      inputs: nextInputs,
      outputs: nextOutputs
    }).ports;
  } else if (updates.inputs || updates.outputs) {
    nextHandles = normalizeHandleDefinitions({
      ports: node.ports,
      inputs: nextInputs,
      outputs: nextOutputs
    }).ports;
  }

  return {
    ...node,
    ...cleanUpdates,
    inputs: nextInputs,
    outputs: nextOutputs,
    ports: nextHandles,
    data: updates.data
      ? (
        replaceData || dataMode === 'replace'
          ? cloneValue(updates.data)
          : dataMode === 'merge-deep'
            ? mergeExtensionValues(node.data || {}, updates.data || {})
            : { ...(node.data || {}), ...(updates.data || {}) }
      )
      : node.data,
    position: updates.position ? { ...node.position, ...updates.position } : node.position,
    state: updates.state ? { ...node.state, ...updates.state } : node.state,
    style: updates.style ? { ...node.style, ...updates.style } : node.style,
    extensions:
      updates.extensions === undefined
        ? node.extensions
        : mergeExtensions(node.extensions, updates.extensions)
  };
};

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizeTypeTransitionForNavigationNodes = (currentNode, updates = {}) => {
  const nextType = String(updates?.type || '').trim();
  if (!nextType || (nextType !== 'port' && nextType !== 'graph-reference')) {
    return updates;
  }
  if (!currentNode || typeof currentNode !== 'object') return updates;

  const currentData = currentNode.data && typeof currentNode.data === 'object' ? currentNode.data : {};
  const incomingData = updates.data && typeof updates.data === 'object' ? updates.data : {};
  const baseData = updates.replaceData === true
    ? cloneValue(incomingData)
    : { ...cloneValue(currentData), ...cloneValue(incomingData) };
  const baseTarget = baseData.target && typeof baseData.target === 'object' ? baseData.target : {};

  const canonicalRef = firstNonEmptyString(
    baseData.ref,
    baseData.src,
    baseData.graphUrl,
    baseTarget.ref
  );
  const canonicalEndpoint = firstNonEmptyString(
    baseData.endpoint,
    baseTarget.endpoint
  );
  const canonicalUrl = firstNonEmptyString(
    baseData.url,
    baseTarget.url
  );

  const defaultTarget = {
    endpoint: canonicalEndpoint || 'root.node:root',
    ref: canonicalRef || '',
    mode: typeof baseTarget.mode === 'string' && baseTarget.mode.trim() ? baseTarget.mode.trim() : 'navigate',
    url: canonicalUrl || '',
    graphId: typeof baseTarget.graphId === 'string' ? baseTarget.graphId : '',
    nodeId: typeof baseTarget.nodeId === 'string' ? baseTarget.nodeId : '',
    portId: typeof baseTarget.portId === 'string' && baseTarget.portId.trim()
      ? baseTarget.portId
      : (typeof baseTarget.handleId === 'string' && baseTarget.handleId.trim() ? baseTarget.handleId : 'root'),
    label: typeof baseTarget.label === 'string' ? baseTarget.label : ''
  };

  const normalizedData = {
    ...baseData,
    target: {
      ...defaultTarget,
      ...baseTarget,
      endpoint: firstNonEmptyString(baseTarget.endpoint, defaultTarget.endpoint),
      ref: firstNonEmptyString(baseTarget.ref, defaultTarget.ref),
      mode: firstNonEmptyString(baseTarget.mode, defaultTarget.mode) || 'navigate',
      url: firstNonEmptyString(baseTarget.url, defaultTarget.url),
      portId: firstNonEmptyString(baseTarget.portId, baseTarget.handleId, defaultTarget.portId),
      handleId: firstNonEmptyString(baseTarget.handleId, baseTarget.portId, defaultTarget.portId),
      label: firstNonEmptyString(baseTarget.label, defaultTarget.label),
      graphId: firstNonEmptyString(baseTarget.graphId, defaultTarget.graphId),
      nodeId: firstNonEmptyString(baseTarget.nodeId, defaultTarget.nodeId)
    },
    intent: firstNonEmptyString(baseData.intent, 'external'),
    src: firstNonEmptyString(baseData.src, canonicalRef),
    ref: firstNonEmptyString(baseData.ref, canonicalRef),
    endpoint: firstNonEmptyString(baseData.endpoint, canonicalEndpoint),
    url: firstNonEmptyString(baseData.url, canonicalUrl)
  };

  return {
    ...updates,
    data: normalizedData
  };
};

const BUILTIN_NODE_TYPES = new Set([
  'manifest',
  'legend',
  'dictionary',
  'markdown',
  'script',
  'port',
  'view',
  'api',
  'graph-reference',
  'default'
]);

const toNodeClassKey = (entry) => String(entry?.key || entry?.nodeType || entry?.type || '').trim();

const resolveNodeClassEntry = (nodes = [], nodeType = '') => {
  const type = String(nodeType || '').trim();
  if (!type || BUILTIN_NODE_TYPES.has(type)) return null;
  const dictionaries = Array.isArray(nodes) ? nodes.filter((node) => node?.type === 'dictionary') : [];
  for (const dict of dictionaries) {
    const nodeDefs = Array.isArray(dict?.data?.nodeDefs) ? dict.data.nodeDefs : [];
    const match = nodeDefs.find((entry) => toNodeClassKey(entry) === type);
    if (match) return match;
  }
  return null;
};

const resolveNodeClassPolicy = (entry) => {
  const overrides = entry?.overrides && typeof entry.overrides === 'object' ? entry.overrides : {};
  return {
    allowLabel: overrides.allowLabel !== false,
    allowSize: overrides.allowSize !== false,
    allowColor: overrides.allowColor !== false,
    allowPorts: overrides.allowPorts !== false,
    allowData: overrides.allowData !== false,
    dataMode: ['replace', 'merge-shallow', 'merge-deep'].includes(String(overrides.dataMode || ''))
      ? overrides.dataMode
      : 'merge-deep'
  };
};

const resolveNodeClassDefaults = (entry) => {
  const defaults = entry?.defaults && typeof entry.defaults === 'object' ? entry.defaults : {};
  const dataDefaults = defaults?.data && typeof defaults.data === 'object' ? defaults.data : {};
  return {
    label: typeof defaults.label === 'string' ? defaults.label : '',
    size: defaults?.size && typeof defaults.size === 'object' ? defaults.size : {},
    color: defaults?.color,
    visible: typeof defaults?.visible === 'boolean' ? defaults.visible : undefined,
    showLabel: typeof defaults?.showLabel === 'boolean' ? defaults.showLabel : undefined,
    ports: Array.isArray(defaults?.ports) ? defaults.ports : [],
    data: dataDefaults
  };
};

const mergeNodeClassDataForCreate = (inputData, defaultsData, policy, hadDataInput) => {
  if (!policy.allowData) return cloneValue(defaultsData || {});
  const incoming = inputData && typeof inputData === 'object' ? inputData : {};
  const base = defaultsData && typeof defaultsData === 'object' ? defaultsData : {};
  if (policy.dataMode === 'replace') {
    return cloneValue(hadDataInput ? incoming : base);
  }
  if (policy.dataMode === 'merge-shallow') {
    return { ...cloneValue(base), ...cloneValue(incoming) };
  }
  return mergeExtensionValues(base, incoming);
};

const updatesSetNodeAsRoot = (updates = {}) => {
  if (!updates || typeof updates !== 'object') return false;
  if (updates.isRoot === true) return true;
  const data = updates.data;
  if (!data || typeof data !== 'object') return false;
  return data.isRoot === true || data.root === true;
};

const clearRootFlags = (node) => {
  if (!node || typeof node !== 'object') return node;
  const currentData = node.data && typeof node.data === 'object' ? node.data : {};
  const nextData = {
    ...currentData,
    isRoot: false,
    root: false
  };
  return {
    ...node,
    isRoot: false,
    data: nextData
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

const EXPANSION_ERROR = Object.freeze({
  INVALID_TARGET: 'INVALID_TARGET',
  UNSUPPORTED_MODE: 'UNSUPPORTED_MODE',
  EXPANSION_LIMIT_EXCEEDED: 'EXPANSION_LIMIT_EXCEEDED',
  REF_FETCH_FAILED: 'REF_FETCH_FAILED',
  TRUST_POLICY_BLOCKED: 'TRUST_POLICY_BLOCKED',
  ID_COLLISION_UNRESOLVED: 'ID_COLLISION_UNRESOLVED',
  TRANSACTION_ROLLBACK: 'TRANSACTION_ROLLBACK'
});

const normalizeExpansionTarget = (target = {}) => {
  if (!target || typeof target !== 'object') return null;
  const kind = typeof target.kind === 'string' ? target.kind.trim().toLowerCase() : '';
  const mode = typeof target.mode === 'string' ? target.mode.trim().toLowerCase() : 'expand';
  const endpointRaw = typeof target.endpoint === 'string' ? target.endpoint.trim() : '';
  const targetRef = typeof target.ref === 'string' ? target.ref.trim() : '';
  let ref = targetRef;
  let entryPort =
    typeof target.entryPort === 'string' && target.entryPort.trim() ? target.entryPort.trim() : 'root';
  if (!ref && endpointRaw) {
    const parsed = parsePortEndpoint(endpointRaw);
    if (parsed.ok && parsed.value?.filePath) {
      ref = endpointToUrl(parsed.value.filePath);
      if (parsed.value.portId) entryPort = parsed.value.portId;
    } else {
      ref = endpointToUrl(endpointRaw);
    }
  }
  const trustMode =
    typeof target.trustMode === 'string' && target.trustMode.trim()
      ? target.trustMode.trim().toLowerCase()
      : 'untrusted';
  const expectedHash = typeof target.expectedHash === 'string' ? target.expectedHash.trim() : '';
  return {
    kind: kind || 'fragment',
    mode,
    ref,
    entryPort,
    trustMode,
    expectedHash
  };
};

const hashExpansionKey = (value = '') => {
  let hash = 0;
  const input = String(value);
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const createExpansionId = (expansionKey) => `exp_${hashExpansionKey(expansionKey)}`;

const resolveSourceTargetFromNode = (sourceNode) => {
  const data = sourceNode?.data && typeof sourceNode.data === 'object' ? sourceNode.data : {};
  const nestedTarget = data?.target && typeof data.target === 'object' ? data.target : {};
  const ref = firstNonEmptyString(
    nestedTarget.ref,
    nestedTarget.url,
    data.ref,
    data.src,
    data.graphUrl,
    data.url
  );
  const endpoint = firstNonEmptyString(nestedTarget.endpoint, data.endpoint);
  const mode = firstNonEmptyString(nestedTarget.mode, data.mode, 'expand');
  const kind = firstNonEmptyString(nestedTarget.kind, data.kind, 'fragment');
  const trustMode = firstNonEmptyString(nestedTarget.trustMode, data.trustMode, 'untrusted');
  const expectedHash = firstNonEmptyString(nestedTarget.expectedHash, data.expectedHash);
  return {
    ref,
    endpoint,
    mode,
    kind,
    entryPort: firstNonEmptyString(nestedTarget.portId, nestedTarget.handleId, nestedTarget.entryPort, 'root'),
    trustMode,
    expectedHash
  };
};

const DEFAULT_EXPANSION_TRUST_POLICY = Object.freeze({
  strict: false,
  allowProtocols: ['github', 'https', 'local', 'tlz', 'relative'],
  allowHosts: [],
  allowGithubRepos: [],
  blockHttp: true,
  maxFetchBytes: 2_000_000
});

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
    color,
    inputs,
    outputs,
    handles,
    ports,
    state,
    style,
    visible = true,
    extensions
  } = {}) {
    try {
      if (typeof window !== 'undefined') {
        try {
          console.log('[GraphCrud] createNode draft=', window.__Twilite_DRAFT__, 'draftParam=', new URLSearchParams(window.location.search).get('draft'));
        } catch {}
      }
      const currentNodes = this.getNodes();
      let nodeId = id || this._generateId();
      while (currentNodes.some(n => n.id === nodeId)) {
        nodeId = this._generateId();
      }

      const normalizedHandles = normalizeHandleDefinitions({ handles, ports, inputs, outputs });
      const sanitizedState = state ? cloneValue(state) : undefined;
      const sanitizedStyle = style ? cloneValue(style) : undefined;
      const sanitizedExtensions = cloneExtensions(extensions);
      const sanitizedData = sanitizeNodeData(data);
      const nodeClassEntry = resolveNodeClassEntry(currentNodes, type);
      const policy = resolveNodeClassPolicy(nodeClassEntry);
      const defaults = resolveNodeClassDefaults(nodeClassEntry);
      const defaultHandles = defaults.ports.length
        ? normalizeHandleDefinitions({ ports: defaults.ports })
        : null;
      const usingDefaultPorts = defaults.ports.length > 0 && (!policy.allowPorts || !(Array.isArray(ports) || Array.isArray(handles) || Array.isArray(inputs) || Array.isArray(outputs)));
      const resolvedHandles = usingDefaultPorts && defaultHandles
        ? defaultHandles
        : normalizedHandles;
      const hadDataInput = data && typeof data === 'object';
      const resolvedData = mergeNodeClassDataForCreate(sanitizedData, defaults.data, policy, hadDataInput);
      const fallbackWidth = defaults.size?.width !== undefined ? defaults.size.width : 80;
      const fallbackHeight = defaults.size?.height !== undefined ? defaults.size.height : 48;
      const resolvedWidth = !policy.allowSize && defaults.size?.width !== undefined
        ? defaults.size.width
        : (width !== undefined ? width : fallbackWidth);
      const resolvedHeight = !policy.allowSize && defaults.size?.height !== undefined
        ? defaults.size.height
        : (height !== undefined ? height : fallbackHeight);
      const resolvedLabel = !policy.allowLabel && defaults.label
        ? defaults.label
        : (hasContent(label) ? label : (defaults.label || label));
      const resolvedColor = !policy.allowColor
        ? defaults.color
        : (color !== undefined ? color : defaults.color);
      const resolvedVisible = defaults.visible !== undefined ? defaults.visible : visible;
      const resolvedShowLabel = defaults.showLabel !== undefined ? defaults.showLabel : true;
      const newNode = {
        id: nodeId,
        type,
        label: resolvedLabel,
        position,
        width: resolvedWidth,
        height: resolvedHeight,
        color: resolvedColor,
        data: resolvedData,
        inputs: resolvedHandles.inputs,
        outputs: resolvedHandles.outputs,
        ports: resolvedHandles.ports,
        visible: resolvedVisible,
        state: sanitizedState,
        style: sanitizedStyle,
        extensions: sanitizedExtensions,
        resizable: true,
        portPosition: 'center',
        showLabel: resolvedShowLabel
      };
      const newNodeSetsRoot = newNode?.isRoot === true || newNode?.data?.isRoot === true || newNode?.data?.root === true;
      const baseNodes = newNodeSetsRoot ? currentNodes.map(clearRootFlags) : currentNodes;
      const updatedNodes = deduplicateNodes([...baseNodes, newNode]);
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
      const currentNode = currentNodes[nodeIndex];
      const normalizedTypeUpdates = normalizeTypeTransitionForNavigationNodes(currentNode, updates || {});
      try {
        eventBus.emit('nodeBeforeUpdate', {
          id,
          node: cloneValue(currentNode),
          patch: cloneValue(normalizedTypeUpdates || {})
        });
      } catch (err) {
        // ignore lifecycle emit failures
      }
      const nodeClassEntry = resolveNodeClassEntry(currentNodes, currentNode?.type);
      const policy = resolveNodeClassPolicy(nodeClassEntry);
      const filteredUpdates = { ...normalizedTypeUpdates };
      if (!policy.allowLabel) {
        delete filteredUpdates.label;
      }
      if (!policy.allowSize) {
        delete filteredUpdates.width;
        delete filteredUpdates.height;
      }
      if (!policy.allowColor) {
        delete filteredUpdates.color;
      }
      if (!policy.allowPorts) {
        delete filteredUpdates.ports;
        delete filteredUpdates.inputs;
        delete filteredUpdates.outputs;
        delete filteredUpdates.handles;
      }
      if (!policy.allowData) {
        delete filteredUpdates.data;
      } else if (filteredUpdates.data && typeof filteredUpdates.data === 'object') {
        filteredUpdates.__twiliteDataMode = policy.dataMode;
      }

      const enforceSingleRoot = updatesSetNodeAsRoot(filteredUpdates);
      const updatedNodes = currentNodes.map(node => {
        if (node.id === id) {
          return applyNodeUpdates(node, filteredUpdates);
        }
        if (enforceSingleRoot) {
          return clearRootFlags(node);
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
      const updatesById = new Map();
      ids.forEach((targetId) => {
        const node = currentNodes.find((candidate) => candidate.id === targetId);
        if (!node) return;
        const normalizedTypeUpdates = normalizeTypeTransitionForNavigationNodes(node, updates || {});
        try {
          eventBus.emit('nodeBeforeUpdate', {
            id: targetId,
            node: cloneValue(node),
            patch: cloneValue(normalizedTypeUpdates || {})
          });
        } catch (err) {
          // ignore lifecycle emit failures
        }
        const nodeClassEntry = resolveNodeClassEntry(currentNodes, node?.type);
        const policy = resolveNodeClassPolicy(nodeClassEntry);
        const filtered = { ...normalizedTypeUpdates };
        if (!policy.allowLabel) {
          delete filtered.label;
        }
        if (!policy.allowSize) {
          delete filtered.width;
          delete filtered.height;
        }
        if (!policy.allowColor) {
          delete filtered.color;
        }
        if (!policy.allowPorts) {
          delete filtered.ports;
          delete filtered.inputs;
          delete filtered.outputs;
          delete filtered.handles;
        }
        if (!policy.allowData) {
          delete filtered.data;
        } else if (filtered.data && typeof filtered.data === 'object') {
          filtered.__twiliteDataMode = policy.dataMode;
        }
        updatesById.set(targetId, filtered);
      });
      const enforceSingleRoot = ids.some((targetId) => updatesSetNodeAsRoot(updatesById.get(targetId)));
      const targetRootId = enforceSingleRoot ? ids[0] : null;
      const updatedNodes = currentNodes.map(node => {
        if (!idSet.has(node.id)) {
          if (enforceSingleRoot && node.id !== targetRootId) {
            return clearRootFlags(node);
          }
          return node;
        }
        const nextNode = applyNodeUpdates(node, updatesById.get(node.id) || updates);
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
      const nodeBeforeDelete = currentNodes.find((n) => n.id === id) || null;
      try {
        eventBus.emit('nodeBeforeDelete', {
          id,
          node: cloneValue(nodeBeforeDelete)
        });
      } catch (err) {
        // ignore lifecycle emit failures
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
   * @param {string} options.type - Edge type (relates, contains, dependsOn, etc)
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
        defaultType: edgeInput.type || 'relates'
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
        mergedEdge.sourcePort,
        mergedEdge.targetPort,
        mergedEdge.type
      );
      if (handleValidation.error) {
        return { success: false, error: handleValidation.error };
      }
      mergedEdge.portMeta = handleValidation.meta;

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
          mergedEdge.sourcePort,
          mergedEdge.targetPort,
          mergedEdge.type
        );
        if (handleValidation.error) {
          throw new Error(`Edge ${edge.id}: ${handleValidation.error}`);
        }
        mergedEdge.portMeta = handleValidation.meta;
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
      let autoPlacedIndex = 0;

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
            ports: opts.ports,
            inputs: opts.inputs,
            outputs: opts.outputs
          });
          const sanitizedData = sanitizeNodeData(opts.data);
          const nodeType = opts.type || 'default';
          const nodeClassEntry = resolveNodeClassEntry(currentNodes, nodeType);
          const policy = resolveNodeClassPolicy(nodeClassEntry);
          const defaults = resolveNodeClassDefaults(nodeClassEntry);
          const defaultHandles = defaults.ports.length
            ? normalizeHandleDefinitions({ ports: defaults.ports })
            : null;
          const usingDefaultPorts = defaults.ports.length > 0 && (!policy.allowPorts || !(Array.isArray(opts.ports) || Array.isArray(opts.inputs) || Array.isArray(opts.outputs)));
          const resolvedHandles = usingDefaultPorts && defaultHandles
            ? defaultHandles
            : normalizedHandles;
          const hadDataInput = opts.data && typeof opts.data === 'object';
          const resolvedData = mergeNodeClassDataForCreate(sanitizedData, defaults.data, policy, hadDataInput);
          const hasExplicitPosition = opts && Object.prototype.hasOwnProperty.call(opts, 'position');
          const fallbackPosition = hasExplicitPosition
            ? opts.position
            : {
                x: 100 + (autoPlacedIndex % 4) * 260,
                y: 100 + Math.floor(autoPlacedIndex / 4) * 160
              };
          if (!hasExplicitPosition) autoPlacedIndex += 1;
          const defaultWidth = defaults.size?.width !== undefined ? defaults.size.width : 160;
          const defaultHeight = defaults.size?.height !== undefined ? defaults.size.height : 80;
          const resolvedWidth = !policy.allowSize && defaults.size?.width !== undefined
            ? defaults.size.width
            : (opts.width !== undefined ? opts.width : defaultWidth);
          const resolvedHeight = !policy.allowSize && defaults.size?.height !== undefined
            ? defaults.size.height
            : (opts.height !== undefined ? opts.height : defaultHeight);
          const resolvedLabel = !policy.allowLabel && defaults.label
            ? defaults.label
            : (hasContent(opts.label) ? opts.label : (defaults.label || opts.label || ''));
          const resolvedColor = !policy.allowColor
            ? defaults.color
            : (opts.color !== undefined ? opts.color : defaults.color);
          const resolvedVisible = defaults.visible !== undefined
            ? defaults.visible
            : (opts.visible !== undefined ? opts.visible : true);
          const resolvedShowLabel = defaults.showLabel !== undefined
            ? defaults.showLabel
            : (opts.showLabel !== undefined ? opts.showLabel : true);

          const newNode = {
            id: nodeId,
            type: nodeType,
            label: resolvedLabel,
            position: fallbackPosition || { x: 100, y: 100 },
            width: resolvedWidth,
            height: resolvedHeight,
            color: resolvedColor,
            visible: resolvedVisible,
            data: resolvedData,
            inputs: resolvedHandles.inputs,
            outputs: resolvedHandles.outputs,
            ports: resolvedHandles.ports,
            state: opts.state ? cloneValue(opts.state) : undefined,
            style: opts.style ? cloneValue(opts.style) : undefined,
            extensions: cloneExtensions(opts.extensions),
            resizable: opts.resizable !== undefined ? opts.resizable : true,
            portPosition: opts.portPosition || 'center',
            showLabel: resolvedShowLabel
          };

          createdNodes.push(newNode);
        } catch (error) {
          failed.push(error.message);
        }
      }

      const createdRootNode = createdNodes.find(
        (node) => node?.isRoot === true || node?.data?.isRoot === true || node?.data?.root === true
      );
      const baseNodes = createdRootNode ? currentNodes.map(clearRootFlags) : currentNodes;
      const normalizedCreatedNodes = createdRootNode
        ? createdNodes.map((node) => {
            if (node.id === createdRootNode.id) return node;
            return clearRootFlags(node);
          })
        : createdNodes;
      // Update state once with all nodes
      const updatedNodes = deduplicateNodes([...baseNodes, ...normalizedCreatedNodes]);
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
    const groupStore = manager.clusters;
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
          failed.push(`Cluster ${i}: must be an object`);
          continue;
        }

        const gid = opts.id || this._generateId();
        if (existingGroupIds.has(gid)) {
          failed.push(`Cluster ${gid}: already exists`);
          continue;
        }

        const nodeIds = Array.isArray(opts.nodeIds) ? opts.nodeIds.filter(id => nodeIdSet.has(id)) : [];
        if (nodeIds.length < 2) {
          failed.push(`Cluster ${gid}: must reference at least two existing nodes`);
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
        return { success: false, error: failed.join('; ') || 'No valid clusters to create' };
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
        if (!group) return { success: false, error: `Cluster ${id} not found` };
        return { success: true, data: group };
      }
      return { success: true, data: groups };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a group
   * @param {string} id - Cluster ID
   * @param {Object} updates - Properties to update
   * @returns {Object} Result with updated group
   */
  updateGroup(id, updates) {
    try {
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === id);
      if (groupIndex === -1) {
        return { success: false, error: `Cluster ${id} not found` };
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
            throw new Error(`Cluster ${id}: must reference at least two existing nodes`);
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
            throw new Error(`Cluster ${group.id}: must reference at least two existing nodes`);
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
   * @param {string} id - Cluster ID
   * @returns {Object} Result
   */
  deleteGroup(id) {
    try {
      const currentGroups = this.getGroups();
      const groupExists = currentGroups.some(g => g.id === id);
      if (!groupExists) {
        return { success: false, error: `Cluster ${id} not found` };
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
   * @param {string} clusterId - Cluster ID
   * @param {string[]} nodeIds - Node IDs to add
   */
  addNodesToGroup(clusterId, nodeIds) {
    try {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return { success: false, error: 'nodeIds must be a non-empty array' };
      }
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === clusterId);
      if (groupIndex === -1) {
        return { success: false, error: `Cluster ${clusterId} not found` };
      }

      const nodeIdSet = new Set((this.getNodes() || []).map(n => n.id));
      const additions = nodeIds.filter(id => nodeIdSet.has(id));
      if (additions.length === 0) {
        return { success: false, error: 'No valid nodeIds found' };
      }

      const updatedGroups = currentGroups.map(group => {
        if (group.id !== clusterId) return group;
        const nextNodeIds = Array.from(new Set([...(group.nodeIds || []), ...additions]));
        if (nextNodeIds.length < 2) {
          throw new Error(`Cluster ${clusterId}: must reference at least two existing nodes`);
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
   * @param {string} clusterId - Cluster ID
   * @param {string[]} nodeIds - Node IDs to remove
   */
  removeNodesFromGroup(clusterId, nodeIds) {
    try {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return { success: false, error: 'nodeIds must be a non-empty array' };
      }
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === clusterId);
      if (groupIndex === -1) {
        return { success: false, error: `Cluster ${clusterId} not found` };
      }

      let removedGroup = false;
      const updatedGroups = currentGroups
        .map(group => {
          if (group.id !== clusterId) return group;
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
        data: removedGroup ? { deletedGroupId: clusterId } : updatedGroups[groupIndex]
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Replace a group's nodeIds
   * @param {string} clusterId - Cluster ID
   * @param {string[]} nodeIds - New node IDs
   */
  setGroupNodes(clusterId, nodeIds) {
    try {
      if (!Array.isArray(nodeIds)) {
        return { success: false, error: 'nodeIds must be an array' };
      }
      const currentGroups = this.getGroups();
      const groupIndex = currentGroups.findIndex(g => g.id === clusterId);
      if (groupIndex === -1) {
        return { success: false, error: `Cluster ${clusterId} not found` };
      }

      const nodeIdSet = new Set((this.getNodes() || []).map(n => n.id));
      const filtered = nodeIds.filter(id => nodeIdSet.has(id));
      if (filtered.length < 2) {
        return { success: false, error: `Cluster ${clusterId}: must reference at least two existing nodes` };
      }

      const updatedGroups = currentGroups.map(group =>
        group.id === clusterId ? { ...group, nodeIds: filtered } : group
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
   * Apply a batch of deltas in sequence.
   * Supports node/edge/group ops; can batch history into a single entry.
   * @param {Array} deltas
   * @param {Object} options
   * @param {boolean} options.batchHistory
   */
  applyDeltas(deltas = [], options = {}) {
    const shouldBatchHistory = options.batchHistory !== false;
    const originalSave = this.saveToHistory;
    try {
      if (!Array.isArray(deltas)) {
        return { success: false, error: 'deltas must be an array' };
      }

      if (shouldBatchHistory) {
        this.saveToHistory = () => {};
      }

      const results = [];
      for (const delta of deltas) {
        if (!delta || !delta.op) {
          results.push({ success: false, error: 'delta missing op', delta });
          continue;
        }
        let result = { success: false, error: `Unknown op ${delta.op}` };
        try {
          switch (delta.op) {
            case 'createNode':
              result = this.createNode(delta.data || {});
              break;
            case 'createNodes':
              result = this.createNodes(delta.data || delta.nodes || []);
              break;
            case 'updateNode':
              result = this.updateNode(delta.id, delta.patch || {});
              break;
            case 'updateNodes':
              result = this.updateNodes(delta.ids || [], delta.patch || {});
              break;
            case 'deleteNode':
              result = this.deleteNode(delta.id);
              break;
            case 'deleteNodes': {
              const ids = Array.isArray(delta.ids) ? delta.ids : [];
              const deleted = [];
              const failed = [];
              ids.forEach((id) => {
                const res = this.deleteNode(id);
                if (res?.success) deleted.push(id);
                else failed.push({ id, error: res?.error });
              });
              result = { success: failed.length === 0, data: { deleted, failed } };
              break;
            }
            case 'createEdge':
              result = this.createEdge(delta.data || {});
              break;
            case 'createEdges':
              result = this.createEdges(delta.data || delta.edges || []);
              break;
            case 'updateEdge':
              result = this.updateEdge(delta.id, delta.patch || {});
              break;
            case 'updateEdges':
              result = this.updateEdges(delta.ids || [], delta.patch || {});
              break;
            case 'deleteEdge':
              result = this.deleteEdge(delta.id);
              break;
            case 'translateNodes':
              result = this.translateNodes(delta.ids || [], delta.delta || delta);
              break;
            case 'translateGroups':
              result = this.translateGroups(delta.ids || [], delta.delta || delta);
              break;
            case 'createGroups':
              result = this.createGroups(delta.data || delta.clusters || []);
              break;
            case 'updateGroup':
              result = this.updateGroup(delta.id, delta.patch || {});
              break;
            case 'updateGroups':
              result = this.updateGroups(delta.ids || [], delta.patch || {});
              break;
            case 'deleteGroup':
              result = this.deleteGroup(delta.id);
              break;
            case 'addNodesToGroup':
              result = this.addNodesToGroup(delta.id, delta.nodeIds || []);
              break;
            case 'removeNodesFromGroup':
              result = this.removeNodesFromGroup(delta.id, delta.nodeIds || []);
              break;
            case 'setGroupNodes':
              result = this.setGroupNodes(delta.id, delta.nodeIds || []);
              break;
            case 'batch':
              if (Array.isArray(delta.deltas)) {
                result = this.applyDeltas(delta.deltas, { batchHistory: false });
              }
              break;
            default:
              break;
          }
        } catch (err) {
          result = { success: false, error: err.message };
        }
        results.push({ op: delta.op, ...result });
      }

      if (shouldBatchHistory) {
        if (originalSave) {
          originalSave(this.getNodes(), this.getEdges());
        }
        this.saveToHistory = originalSave;
      }

      const failed = results.filter(r => !r.success);
      return {
        success: failed.length === 0,
        data: { results, failed: failed.length ? failed : undefined }
      };
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
            defaultType: newEdge.type || edge.type || 'relates'
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

  async expandReference(payload = {}) {
    try {
      const sourceNodeId =
        typeof payload?.sourceNodeId === 'string' && payload.sourceNodeId.trim()
          ? payload.sourceNodeId.trim()
          : '';
      const options = isPlainObject(payload?.options) ? payload.options : {};
      const maxNodes = options.maxNodes === undefined ? 200 : toNumber(options.maxNodes);
      const maxEdges = options.maxEdges === undefined ? 400 : toNumber(options.maxEdges);
      const sourceNode = this.getNodes().find((node) => node.id === sourceNodeId);
      if (!sourceNode) {
        return this._expansionFailure(
          EXPANSION_ERROR.INVALID_TARGET,
          `Source node "${sourceNodeId}" was not found`,
          { sourceNodeId }
        );
      }

      const sourceTarget = resolveSourceTargetFromNode(sourceNode);
      const directTarget = isPlainObject(payload?.target) ? payload.target : {};
      const target = normalizeExpansionTarget({ ...sourceTarget, ...directTarget });
      if (!sourceNodeId || !target || !target.ref) {
        return this._expansionFailure(
          EXPANSION_ERROR.INVALID_TARGET,
          'expandReference requires sourceNodeId and target.ref',
          { sourceNodeId, target }
        );
      }

      if (target.mode !== 'expand') {
        return this._expansionFailure(
          EXPANSION_ERROR.UNSUPPORTED_MODE,
          `expandReference does not support target.mode="${target.mode}"`,
          { target }
        );
      }

      if (target.kind !== 'fragment') {
        return this._expansionFailure(
          EXPANSION_ERROR.UNSUPPORTED_MODE,
          `expandReference only supports target.kind="fragment" in v1 (received "${target.kind || 'unknown'}")`,
          { target }
        );
      }

      if (!this._isExpansionRefAllowed(target.ref)) {
        return this._expansionFailure(
          EXPANSION_ERROR.TRUST_POLICY_BLOCKED,
          `Reference "${target.ref}" is blocked by trust policy`,
          { target }
        );
      }

      if (maxNodes === null || maxNodes <= 0 || maxEdges === null || maxEdges <= 0) {
        return this._expansionFailure(
          EXPANSION_ERROR.EXPANSION_LIMIT_EXCEEDED,
          'options.maxNodes and options.maxEdges must be positive numbers',
          { maxNodes: options.maxNodes, maxEdges: options.maxEdges }
        );
      }

      const expansionKey = [sourceNodeId, target.ref, target.entryPort, target.mode].join('::');
      const existingExpansionNode = this.getNodes().find((node) => node?.data?._expansion?.expandKey === expansionKey);
      if (existingExpansionNode) {
        return this._expansionSuccess({
          expansionId: existingExpansionNode?.data?._expansion?.expansionId || null,
          added: { nodes: 0, edges: 0 },
          skipped: true,
          reason: 'already-expanded',
          expandKey: expansionKey
        });
      }

      const {
        nodes: fragmentNodes,
        edges: fragmentEdges,
        fetchMeta
      } = await this._resolveExpansionGraph(payload, target);
      if (typeof target.expectedHash === 'string' && target.expectedHash.trim()) {
        const expected = target.expectedHash.trim().toLowerCase();
        const actual = String(fetchMeta?.hash || '').toLowerCase();
        if (expected && actual && expected !== actual) {
          return this._expansionFailure(
            EXPANSION_ERROR.TRUST_POLICY_BLOCKED,
            `Integrity hash mismatch for "${target.ref}"`,
            { expectedHash: expected, actualHash: actual }
          );
        }
      }
      if (fragmentNodes.length > maxNodes || fragmentEdges.length > maxEdges) {
        return this._expansionFailure(
          EXPANSION_ERROR.EXPANSION_LIMIT_EXCEEDED,
          `Expansion exceeds limits (nodes=${fragmentNodes.length}/${maxNodes}, edges=${fragmentEdges.length}/${maxEdges})`,
          {
            maxNodes,
            maxEdges,
            received: { nodes: fragmentNodes.length, edges: fragmentEdges.length }
          }
        );
      }

      const expansionId = createExpansionId(expansionKey);
      const existingNodes = this.getNodes();
      const existingEdges = this.getEdges();
      const existingNodeIds = new Set(existingNodes.map((node) => node.id));
      const existingEdgeIds = new Set(existingEdges.map((edge) => edge.id));
      const runtimeNodeIdMap = new Map();
      const materializedNodes = [];
      const nowIso = new Date().toISOString();
      const expansionMeta = {
        expansionId,
        expandKey: expansionKey,
        sourceNodeId,
        sourceRef: target.ref,
        entryPort: target.entryPort || 'root',
        trustMode: target.trustMode || 'untrusted',
        injectedBy: 'expandReference',
        createdAt: nowIso,
        sourceOrigin: fetchMeta?.origin || '',
        sourceHash: fetchMeta?.hash || '',
        sourceBytes: fetchMeta?.bytes || 0
      };

      for (let index = 0; index < fragmentNodes.length; index += 1) {
        const node = fragmentNodes[index];
        const canonicalId = String(node?.id || `node-${index}`);
        const runtimeId = `${expansionId}:${canonicalId}`;
        if (existingNodeIds.has(runtimeId) || runtimeNodeIdMap.has(canonicalId)) {
          return this._expansionFailure(
            EXPANSION_ERROR.ID_COLLISION_UNRESOLVED,
            `Runtime node id collision for canonicalId "${canonicalId}"`,
            { canonicalId, runtimeId }
          );
        }
        runtimeNodeIdMap.set(canonicalId, runtimeId);
        existingNodeIds.add(runtimeId);
        const nodeData = isPlainObject(node?.data) ? cloneValue(node.data) : {};
        const position = node?.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)
          ? { x: node.position.x, y: node.position.y }
          : { x: index * 40, y: index * 40 };
        materializedNodes.push({
          ...cloneValue(node),
          id: runtimeId,
          position,
          data: {
            ...nodeData,
            _origin: {
              canonicalId,
              ref: target.ref,
              instanceId: expansionId
            },
            _expansion: cloneValue(expansionMeta)
          }
        });
      }

      const layoutMode = typeof options.layout === 'string' && options.layout.trim()
        ? options.layout.trim().toLowerCase()
        : 'attach-right';
      const offset = this._computeExpansionOffset(sourceNode, materializedNodes, layoutMode);
      const shiftedNodes = materializedNodes.map((node) => ({
        ...node,
        position: {
          x: (node.position?.x || 0) + offset.x,
          y: (node.position?.y || 0) + offset.y
        }
      }));

      const materializedEdges = [];
      for (let index = 0; index < fragmentEdges.length; index += 1) {
        const edge = fragmentEdges[index];
        const canonicalSource = String(edge?.source || '');
        const canonicalTarget = String(edge?.target || '');
        const source = runtimeNodeIdMap.get(canonicalSource);
        const targetNodeId = runtimeNodeIdMap.get(canonicalTarget);
        if (!source || !targetNodeId) continue;

        const canonicalEdgeId = String(edge?.id || `edge-${index}`);
        let runtimeEdgeId = `${expansionId}:edge:${canonicalEdgeId}`;
        let suffix = 1;
        while (existingEdgeIds.has(runtimeEdgeId)) {
          runtimeEdgeId = `${expansionId}:edge:${canonicalEdgeId}:${suffix}`;
          suffix += 1;
        }
        existingEdgeIds.add(runtimeEdgeId);

        const edgeData = isPlainObject(edge?.data) ? cloneValue(edge.data) : {};
        materializedEdges.push({
          ...cloneValue(edge),
          id: runtimeEdgeId,
          source,
          target: targetNodeId,
          sourcePort: edge?.sourcePort || 'root',
          targetPort: edge?.targetPort || 'root',
          data: {
            ...edgeData,
            _origin: {
              canonicalId: canonicalEdgeId,
              ref: target.ref,
              instanceId: expansionId
            },
            _expansion: cloneValue(expansionMeta)
          }
        });
      }

      const entryNode = this._resolveExpansionEntryNode(shiftedNodes);
      if (!entryNode?.id) {
        return this._expansionFailure(
          EXPANSION_ERROR.INVALID_TARGET,
          'Expanded fragment did not include a valid entry node',
          { expansionId }
        );
      }
      const attachEdgeId = this._generateUniqueEdgeId(existingEdgeIds);
      materializedEdges.push({
        id: attachEdgeId,
        source: sourceNodeId,
        target: entryNode.id,
        sourcePort: 'root',
        targetPort: target.entryPort || 'root',
        type: 'expands-to',
        label: '',
        data: {
          _expansion: cloneValue(expansionMeta)
        },
        style: {
          width: 2,
          dash: [6, 4],
          curved: true
        }
      });

      const nextNodes = deduplicateNodes([...existingNodes, ...shiftedNodes]);
      const nextEdges = [...existingEdges, ...materializedEdges];
      this.setNodes(() => {
        if (this.nodesRef) this.nodesRef.current = nextNodes;
        return nextNodes;
      });
      this.setEdges(() => {
        if (this.edgesRef) this.edgesRef.current = nextEdges;
        return nextEdges;
      });
      this.saveToHistory(nextNodes, nextEdges);
      try {
        eventBus.emit('expansionStateChanged', {
          action: 'expanded',
          sourceNodeId,
          expansionId,
          expandKey: expansionKey
        });
      } catch {}

      return this._expansionSuccess({
        expansionId,
        added: { nodes: shiftedNodes.length, edges: materializedEdges.length },
        skipped: false,
        reason: null,
        expandKey: expansionKey,
        entryNodeId: entryNode.id,
        trust: {
          origin: fetchMeta?.origin || '',
          hash: fetchMeta?.hash || '',
          bytes: fetchMeta?.bytes || 0
        }
      });
    } catch (error) {
      if (error?.code === EXPANSION_ERROR.REF_FETCH_FAILED) {
        return this._expansionFailure(EXPANSION_ERROR.REF_FETCH_FAILED, error.message);
      }
      return this._expansionFailure(EXPANSION_ERROR.TRANSACTION_ROLLBACK, error.message);
    }
  }

  async _resolveExpansionGraph(payload = {}, target = {}) {
    const inlineGraph = isPlainObject(payload?.fragment)
      ? payload.fragment
      : isPlainObject(payload?.graph)
      ? payload.graph
      : null;
    if (inlineGraph) {
      return this._parseExpansionGraphPayload(inlineGraph);
    }
    if (typeof payload?.fragmentText === 'string' && payload.fragmentText.trim()) {
      return this._parseExpansionGraphPayload(payload.fragmentText);
    }
    const fetched = await this._fetchExpansionRefText(target.ref, payload?.branch);
    return {
      ...this._parseExpansionGraphPayload(fetched.text),
      fetchMeta: fetched
    };
  }

  async _fetchExpansionRefText(ref, preferredBranch) {
    const raw = String(ref || '').trim();
    if (!raw) {
      const error = new Error('Expansion ref is empty');
      error.code = EXPANSION_ERROR.REF_FETCH_FAILED;
      throw error;
    }

    const trustPolicy = this._getExpansionTrustPolicy();
    const maxFetchBytes = toNumber(trustPolicy.maxFetchBytes) || DEFAULT_EXPANSION_TRUST_POLICY.maxFetchBytes;

    if (raw.startsWith('github://')) {
      const parsed = this._parseGithubRef(raw);
      if (!parsed) {
        const error = new Error(`Invalid github ref "${raw}"`);
        error.code = EXPANSION_ERROR.REF_FETCH_FAILED;
        throw error;
      }
      const branchCandidates = [];
      if (typeof preferredBranch === 'string' && preferredBranch.trim()) {
        branchCandidates.push(preferredBranch.trim());
      }
      branchCandidates.push('main', 'master');
      const tried = new Set();
      for (const branch of branchCandidates) {
        if (!branch || tried.has(branch)) continue;
        tried.add(branch);
        const safePath = parsed.path
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/');
        const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/${encodeURIComponent(branch)}/${safePath}`;
        const response = await fetch(rawUrl);
        if (response.ok) {
          const text = await response.text();
          const bytes = new TextEncoder().encode(text).length;
          if (bytes > maxFetchBytes) {
            const error = new Error(`Fetched content exceeds maxFetchBytes (${bytes}/${maxFetchBytes})`);
            error.code = EXPANSION_ERROR.TRUST_POLICY_BLOCKED;
            throw error;
          }
          return {
            text,
            origin: `github://${parsed.owner}/${parsed.repo}`,
            resolvedRef: `github://${parsed.owner}/${parsed.repo}/${parsed.path}`,
            bytes,
            hash: await this._computeExpansionHash(text)
          };
        }
      }
      const error = new Error(`Unable to fetch github ref "${raw}"`);
      error.code = EXPANSION_ERROR.REF_FETCH_FAILED;
      throw error;
    }

    const fetchUrl = this._toFetchableRef(raw);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      const error = new Error(`Failed to fetch "${raw}" (HTTP ${response.status})`);
      error.code = EXPANSION_ERROR.REF_FETCH_FAILED;
      throw error;
    }
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > maxFetchBytes) {
      const error = new Error(`Fetched content exceeds maxFetchBytes (${bytes}/${maxFetchBytes})`);
      error.code = EXPANSION_ERROR.TRUST_POLICY_BLOCKED;
      throw error;
    }
    const origin = this._resolveExpansionOrigin(fetchUrl);
    return {
      text,
      origin,
      resolvedRef: fetchUrl,
      bytes,
      hash: await this._computeExpansionHash(text)
    };
  }

  _parseExpansionGraphPayload(payload) {
    let graph = payload;
    if (typeof payload === 'string') {
      try {
        graph = JSON.parse(payload);
      } catch (error) {
        const err = new Error(`Expansion payload is not valid JSON: ${error.message}`);
        err.code = EXPANSION_ERROR.REF_FETCH_FAILED;
        throw err;
      }
    }
    if (!isPlainObject(graph)) {
      const err = new Error('Expansion payload must be an object');
      err.code = EXPANSION_ERROR.REF_FETCH_FAILED;
      throw err;
    }
    const nodes = Array.isArray(graph.nodes) ? graph.nodes.map((node) => cloneValue(node)) : [];
    const edges = Array.isArray(graph.edges) ? graph.edges.map((edge) => cloneValue(edge)) : [];
    if (nodes.length === 0) {
      const err = new Error('Expansion graph has no nodes');
      err.code = EXPANSION_ERROR.REF_FETCH_FAILED;
      throw err;
    }
    return { nodes, edges };
  }

  _isExpansionRefAllowed(ref) {
    const raw = String(ref || '').trim();
    if (!raw) return false;
    const policy = this._getExpansionTrustPolicy();
    const kind = this._classifyExpansionRef(raw);
    if (kind === 'http' && policy.blockHttp) return false;

    const allowedProtocols = new Set((Array.isArray(policy.allowProtocols) ? policy.allowProtocols : []).map((item) => String(item || '').toLowerCase()));
    if (allowedProtocols.size > 0 && !allowedProtocols.has(kind)) {
      return false;
    }

    if (kind === 'github') {
      const parsed = this._parseGithubRef(raw);
      if (!parsed) return false;
      const repoKey = `${parsed.owner}/${parsed.repo}`.toLowerCase();
      const allowRepos = Array.isArray(policy.allowGithubRepos) ? policy.allowGithubRepos : [];
      if (policy.strict && allowRepos.length > 0 && !allowRepos.some((entry) => String(entry || '').toLowerCase() === repoKey)) {
        return false;
      }
      return true;
    }

    if ((kind === 'https' || kind === 'http') && policy.strict) {
      const host = this._extractRefHost(raw);
      const allowHosts = Array.isArray(policy.allowHosts) ? policy.allowHosts : [];
      if (allowHosts.length > 0 && !allowHosts.some((entry) => String(entry || '').toLowerCase() === host)) {
        return false;
      }
    }
    return true;
  }

  _toFetchableRef(ref) {
    const raw = String(ref || '').trim();
    if (raw.startsWith('local://')) {
      const localPath = raw.slice('local://'.length).replace(/^\/+/, '');
      return `/${localPath}`;
    }
    if (raw.startsWith('tlz://')) {
      const rest = raw.slice('tlz://'.length);
      if (rest.startsWith('/')) return rest;
      if (rest.includes('/')) return `https://${rest}`;
      return `/${rest}`;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('/')) return raw;
    return `/${raw.replace(/^\/+/, '')}`;
  }

  _parseGithubRef(ref) {
    if (typeof ref !== 'string' || !ref.startsWith('github://')) return null;
    const raw = ref.slice('github://'.length);
    const [owner = '', repo = '', ...pathParts] = raw.split('/');
    if (!owner || !repo) return null;
    let path = pathParts.join('/').replace(/^\/+/, '');
    if (!path || path.endsWith('/')) path = `${path}root.node`;
    return { owner, repo, path };
  }

  _classifyExpansionRef(ref) {
    const raw = String(ref || '').trim();
    if (raw.startsWith('github://')) return 'github';
    if (raw.startsWith('local://')) return 'local';
    if (raw.startsWith('tlz://')) return 'tlz';
    if (raw.startsWith('https://')) return 'https';
    if (raw.startsWith('http://')) return 'http';
    if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return 'relative';
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return 'relative';
    return 'unknown';
  }

  _extractRefHost(ref) {
    try {
      return new URL(ref).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  _resolveExpansionOrigin(fetchRef) {
    const raw = String(fetchRef || '').trim();
    if (!raw) return '';
    if (raw.startsWith('/')) return 'local://';
    try {
      const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : undefined);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return raw;
    }
  }

  _getExpansionTrustPolicy() {
    const nodes = this.getNodes();
    const manifest = Array.isArray(nodes) ? nodes.find((node) => node?.type === 'manifest') : null;
    const rawPolicy = manifest?.data?.settings?.expansionTrust;
    if (!rawPolicy || typeof rawPolicy !== 'object') {
      return { ...DEFAULT_EXPANSION_TRUST_POLICY };
    }
    return {
      ...DEFAULT_EXPANSION_TRUST_POLICY,
      ...rawPolicy
    };
  }

  async _computeExpansionHash(text = '') {
    const value = String(text ?? '');
    if (typeof crypto !== 'undefined' && crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const encoded = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      const bytes = Array.from(new Uint8Array(digest));
      return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    return hashExpansionKey(value);
  }

  _resolveExpansionEntryNode(nodes = []) {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;
    const explicit = nodes.find((node) => node?.isRoot || node?.data?.isRoot || node?.data?.root);
    if (explicit) return explicit;
    const manifest = nodes.find((node) => node?.type === 'manifest');
    if (manifest) return manifest;
    return nodes[0];
  }

  _computeExpansionOffset(sourceNode, nodes = [], layoutMode = 'attach-right') {
    if (!Array.isArray(nodes) || nodes.length === 0) return { x: 0, y: 0 };
    if (layoutMode === 'none' || layoutMode === 'preserve') return { x: 0, y: 0 };
    const points = nodes
      .map((node) => node?.position)
      .filter((position) => position && Number.isFinite(position.x) && Number.isFinite(position.y));
    if (points.length === 0) return { x: 0, y: 0 };
    const minX = Math.min(...points.map((position) => position.x));
    const minY = Math.min(...points.map((position) => position.y));
    const maxY = Math.max(...points.map((position) => position.y));

    const sourceX = Number.isFinite(sourceNode?.position?.x) ? sourceNode.position.x : 0;
    const sourceY = Number.isFinite(sourceNode?.position?.y) ? sourceNode.position.y : 0;
    const sourceWidth = Number.isFinite(sourceNode?.width) ? sourceNode.width : 220;
    const sourceHeight = Number.isFinite(sourceNode?.height) ? sourceNode.height : 140;
    const gap = 100;
    const targetX = sourceX + sourceWidth + gap;
    const sourceCenterY = sourceY + sourceHeight / 2;
    const fragmentCenterY = (minY + maxY) / 2;
    return {
      x: targetX - minX,
      y: sourceCenterY - fragmentCenterY
    };
  }

  _generateUniqueEdgeId(existingIds) {
    let id = this._generateId();
    while (existingIds.has(id)) {
      id = this._generateId();
    }
    existingIds.add(id);
    return id;
  }

  collapseExpansion(payload = {}) {
    try {
      const expansionId =
        typeof payload?.expansionId === 'string' && payload.expansionId.trim()
          ? payload.expansionId.trim()
          : '';
      if (!expansionId) {
        return this._expansionFailure(
          EXPANSION_ERROR.INVALID_TARGET,
          'collapseExpansion requires expansionId'
        );
      }

      const currentNodes = this.getNodes();
      const currentEdges = this.getEdges();
      const nodeIdsToRemove = new Set(
        currentNodes
          .filter((node) => node?.data?._expansion?.expansionId === expansionId)
          .map((node) => node.id)
      );
      const edgeIdsToRemove = new Set(
        currentEdges
          .filter((edge) => edge?.data?._expansion?.expansionId === expansionId)
          .map((edge) => edge.id)
      );

      if (nodeIdsToRemove.size === 0 && edgeIdsToRemove.size === 0) {
        return this._expansionSuccess({
          expansionId,
          removed: { nodes: 0, edges: 0 },
          skipped: true,
          reason: 'not-found'
        });
      }

      const nextNodes = currentNodes.filter((node) => !nodeIdsToRemove.has(node.id));
      const nextEdges = currentEdges.filter((edge) => {
        if (edgeIdsToRemove.has(edge.id)) return false;
        if (nodeIdsToRemove.has(edge.source)) return false;
        if (nodeIdsToRemove.has(edge.target)) return false;
        return true;
      });

      this.setNodes(() => {
        if (this.nodesRef) this.nodesRef.current = nextNodes;
        return nextNodes;
      });
      this.setEdges(() => {
        if (this.edgesRef) this.edgesRef.current = nextEdges;
        return nextEdges;
      });
      this.saveToHistory(nextNodes, nextEdges);
      try {
        eventBus.emit('expansionStateChanged', {
          action: 'collapsed',
          sourceNodeId: payload?.sourceNodeId || null,
          expansionId
        });
      } catch {}

      return this._expansionSuccess({
        expansionId,
        removed: {
          nodes: currentNodes.length - nextNodes.length,
          edges: currentEdges.length - nextEdges.length
        },
        skipped: false,
        reason: null
      });
    } catch (error) {
      return this._expansionFailure(EXPANSION_ERROR.TRANSACTION_ROLLBACK, error.message);
    }
  }

  _expansionFailure(code, message, details) {
    return {
      success: false,
      error: message,
      code,
      data: {
        ok: false,
        code,
        message,
        details: details || null
      }
    };
  }

  _expansionSuccess(data = {}) {
    return {
      success: true,
      data: {
        ok: true,
        ...data
      }
    };
  }

  executeNode(nodeId, meta = {}) {
    try {
      if (!nodeId) return { success: false, error: 'nodeId required' };
      eventBus.emit('nodeInput', {
        targetNodeId: nodeId,
        handleId: 'root',
        inputName: 'root',
        value: meta || {},
        source: 'user',
        meta: { requestedBy: 'executeNode' }
      });
      eventBus.emit('executeNode', { nodeId, meta });
      return { success: true, data: { nodeId } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  executeNodes(nodeIds = [], meta = {}) {
    try {
      if (!Array.isArray(nodeIds)) {
        return { success: false, error: 'nodeIds must be an array' };
      }
      nodeIds.forEach(nodeId => {
        if (nodeId) {
          eventBus.emit('nodeInput', {
            targetNodeId: nodeId,
            handleId: 'root',
            inputName: 'root',
            value: meta || {},
            source: 'user',
            meta: { requestedBy: 'executeNodes' }
          });
          eventBus.emit('executeNode', { nodeId, meta });
        }
      });
      return { success: true, data: { count: nodeIds.length } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  sendInput(nodeId, handleId = 'root', value = {}, meta = {}) {
    try {
      if (!nodeId) return { success: false, error: 'nodeId required' };
      eventBus.emit('nodeInput', {
        targetNodeId: nodeId,
        handleId: handleId || 'root',
        inputName: handleId || 'root',
        value,
        source: meta?.source || 'api',
        meta
      });
      return { success: true, data: { nodeId, handleId } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

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
  sourcePort: "out",
  targetPort: "in",
  type: "relates"
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
