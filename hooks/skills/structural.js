import { assertMutationAllowed } from './manifestPolicy.js';

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 80;
const DEFAULT_GROUP_PADDING = 32;

const ensureArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  return value;
};

const cloneEntity = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const collectHandles = (node, direction) => {
  const unified = Array.isArray(node?.handles)
    ? node.handles
        .filter((handle) => {
          if (!handle) return false;
          const dir = (handle.direction || '').toLowerCase();
          if (direction === 'output') {
            return dir === 'output' || dir === 'bidirectional' || dir === '';
          }
          return dir === 'input' || dir === 'bidirectional' || dir === '';
        })
        .map((handle) => handle.id || handle.key)
        .filter(Boolean)
    : [];

  const legacy = Array.isArray(direction === 'output' ? node?.outputs : node?.inputs)
    ? (direction === 'output' ? node.outputs : node.inputs)
        .map((handle) => handle?.key || handle?.id || handle?.name)
        .filter(Boolean)
    : [];

  return Array.from(new Set([...unified, ...legacy]));
};

const resolveHandle = (node, direction, explicitHandle) => {
  if (explicitHandle) return explicitHandle;
  const handles = collectHandles(node, direction);
  if (handles.length === 1) {
    return handles[0];
  }
  return null;
};

const computeBounds = (nodes, padding = DEFAULT_GROUP_PADDING) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    if (!node || !node.position) return;
    const width = Number.isFinite(Number(node.width)) ? Number(node.width) : DEFAULT_NODE_WIDTH;
    const height = Number.isFinite(Number(node.height)) ? Number(node.height) : DEFAULT_NODE_HEIGHT;
    const x = Number(node.position.x) || 0;
    const y = Number(node.position.y) || 0;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const pad = Number.isFinite(Number(padding)) ? Number(padding) : DEFAULT_GROUP_PADDING;

  return {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(0, maxX - minX + pad * 2),
    height: Math.max(0, maxY - minY + pad * 2)
  };
};

const sanitizeNodeForCreation = (node, { allowPositions, defaultWidth, defaultHeight, autoLabelPrefix }, index) => {
  if (!node || typeof node !== 'object') {
    throw new Error(`nodes[${index}] must be an object`);
  }
  if (!node.id) {
    throw new Error(`nodes[${index}] is missing required id`);
  }

  const sanitized = { ...node };
  sanitized.width = sanitized.width ?? defaultWidth ?? DEFAULT_NODE_WIDTH;
  sanitized.height = sanitized.height ?? defaultHeight ?? DEFAULT_NODE_HEIGHT;
  if (!allowPositions) {
    delete sanitized.position;
  }
  if (!sanitized.label && autoLabelPrefix) {
    sanitized.label = `${autoLabelPrefix} ${index + 1}`;
  }
  return sanitized;
};

const sanitizeEdgeForCreation = (edge, resolution, index) => {
  if (!edge || typeof edge !== 'object') {
    throw new Error(`edges[${index}] must be an object`);
  }

  const sourceId = edge.source || edge.from;
  const targetId = edge.target || edge.to;
  if (!sourceId || !targetId) {
    throw new Error(`edges[${index}] must include source and target`);
  }

  const sourceNode = resolution.nodeMap.get(sourceId);
  const targetNode = resolution.nodeMap.get(targetId);
  if (!sourceNode) {
    throw new Error(`edges[${index}] references missing source node "${sourceId}"`);
  }
  if (!targetNode) {
    throw new Error(`edges[${index}] references missing target node "${targetId}"`);
  }

  let sourceHandle = edge.sourceHandle || edge.fromHandle || edge.handle;
  let targetHandle = edge.targetHandle || edge.toHandle;
  const resolvedSourceHandle = resolveHandle(sourceNode, 'output', sourceHandle);
  const resolvedTargetHandle = resolveHandle(targetNode, 'input', targetHandle);

  if (!sourceHandle && collectHandles(sourceNode, 'output').length > 1 && !resolvedSourceHandle) {
    if (!resolution.allowHandleInference) {
      throw new Error(`edges[${index}] must specify sourceHandle because source node exposes multiple outputs`);
    }
  }
  if (!targetHandle && collectHandles(targetNode, 'input').length > 1 && !resolvedTargetHandle) {
    if (!resolution.allowHandleInference) {
      throw new Error(`edges[${index}] must specify targetHandle because target node exposes multiple inputs`);
    }
  }

  sourceHandle = sourceHandle || resolvedSourceHandle || null;
  targetHandle = targetHandle || resolvedTargetHandle || null;

  const sanitized = {
    id: edge.id,
    label: edge.label,
    source: sourceId,
    target: targetId,
    sourceHandle: sourceHandle || undefined,
    targetHandle: targetHandle || undefined,
    type: edge.type || resolution.defaultEdgeType || 'straight',
    data: edge.data ? cloneEntity(edge.data) : undefined,
    style: edge.style ? cloneEntity(edge.style) : undefined,
    state: edge.state ? cloneEntity(edge.state) : undefined
  };

  return sanitized;
};

const extractGroupsForNodes = (groups, nodeSet) => {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  return groups
    .map((group) => {
      if (!group || !Array.isArray(group.nodeIds)) return null;
      const intersection = group.nodeIds.filter((id) => nodeSet.has(id));
      if (intersection.length < 2) return null;
      return {
        ...cloneEntity(group),
        nodeIds: intersection
      };
    })
    .filter(Boolean);
};

const buildAddRemoveSummary = (results) => {
  const summary = [];
  results.forEach((item) => {
    if (!item) return;
    if (item?.data?.deletedGroupId) {
      summary.push({ type: 'deletedGroup', id: item.data.deletedGroupId });
    } else if (item?.success && item?.data?.id) {
      summary.push({ type: 'updatedGroup', id: item.data.id });
    }
  });
  return summary;
};

const runCreateNodes = async ({ graphAPI }, params = {}) => {
  const mutationCheck = assertMutationAllowed(graphAPI, 'create');
  if (mutationCheck.error) {
    return { success: false, error: mutationCheck.error };
  }
  const nodesInput = ensureArray(params.nodes, 'nodes');
  const allowPositions = params.preservePositions === true;
  const existingNodes = graphAPI.getNodes ? graphAPI.getNodes() : [];
  const existingIds = new Set(existingNodes.map((node) => node.id));

  const sanitized = nodesInput.map((node, index) =>
    sanitizeNodeForCreation(node, {
      allowPositions,
      defaultWidth: params.defaultWidth,
      defaultHeight: params.defaultHeight,
      autoLabelPrefix: params.autoLabelPrefix
    }, index)
  );

  const duplicateIds = sanitized
    .map((node) => node.id)
    .filter((id) => existingIds.has(id));
  if (duplicateIds.length > 0) {
    return {
      success: false,
      error: 'One or more node ids already exist',
      data: { duplicateIds }
    };
  }

  const warnings = [];
  if (!allowPositions) {
    warnings.push('Node positions omitted so auto-layout can place them safely');
  }

  if (params.dryRun) {
    return {
      success: true,
      data: {
        nodes: sanitized,
        warnings: warnings.length ? warnings : undefined
      }
    };
  }

  const result = graphAPI.createNodes(sanitized);
  if (!result?.success) {
    return {
      success: false,
      error: result?.error || 'createNodes failed',
      data: result?.data
    };
  }

  const mergedWarnings = [...warnings];
  if (Array.isArray(result?.data?.warnings)) {
    mergedWarnings.push(...result.data.warnings);
  }

  return {
    success: true,
    data: {
      ...result.data,
      warnings: mergedWarnings.length ? mergedWarnings : undefined,
      manifestWarning: mutationCheck.warning
    }
  };
};

const runCreateEdges = async ({ graphAPI }, params = {}) => {
  const mutationCheck = assertMutationAllowed(graphAPI, 'create');
  if (mutationCheck.error) {
    return { success: false, error: mutationCheck.error };
  }
  const edgesInput = ensureArray(params.edges || params.connections, 'edges');
  const nodes = graphAPI.getNodes ? graphAPI.getNodes() : [];
  const edges = graphAPI.getEdges ? graphAPI.getEdges() : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edgeIdSet = new Set(edges.map((edge) => edge?.id).filter(Boolean));
  const allowHandleInference =
    params.allowHandleInference === true ||
    ['import', 'automation', 'transformation', 'auto', 'inferred'].includes(String(params.mode || '').toLowerCase());

  const seen = new Set(edges.map((edge) => `${edge.source}|${edge.sourceHandle || ''}|${edge.target}|${edge.targetHandle || ''}`));
  const duplicates = [];
  const duplicateIds = [];

  const resolution = {
    nodeMap,
    defaultEdgeType: params.defaultType || 'straight',
    allowHandleInference
  };

  const sanitizedEdges = edgesInput.map((edge, index) => {
    const normalized = sanitizeEdgeForCreation(edge, resolution, index);
    if (normalized.id && edgeIdSet.has(normalized.id)) {
      duplicateIds.push({ index, id: normalized.id });
    }
    const key = `${normalized.source}|${normalized.sourceHandle || ''}|${normalized.target}|${normalized.targetHandle || ''}`;
    if (seen.has(key)) {
      duplicates.push({
        index,
        source: normalized.source,
        target: normalized.target,
        sourceHandle: normalized.sourceHandle,
        targetHandle: normalized.targetHandle
      });
    } else {
      seen.add(key);
    }
    return normalized;
  });

  if (duplicateIds.length > 0) {
    return {
      success: false,
      error: 'One or more edge ids already exist',
      data: { duplicateIds }
    };
  }

  if (duplicates.length > 0 && params.failOnDuplicate !== false) {
    return {
      success: false,
      error: 'One or more edges already exist',
      data: { duplicates }
    };
  }

  const warnings = [];
  if (duplicates.length > 0) {
    warnings.push(`${duplicates.length} edge(s) already exist and were ignored`);
  }

  sanitizedEdges.forEach((edge, index) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return;
    if (!edge.sourceHandle && collectHandles(sourceNode, 'output').length > 1) {
      if (allowHandleInference) {
        warnings.push(`edges[${index}] omitted sourceHandle on multi-handle node "${edge.source}"`);
      }
    }
    if (!edge.targetHandle && collectHandles(targetNode, 'input').length > 1) {
      if (allowHandleInference) {
        warnings.push(`edges[${index}] omitted targetHandle on multi-handle node "${edge.target}"`);
      }
    }
  });

  if (params.dryRun) {
    return {
      success: true,
      data: {
        edges: sanitizedEdges,
        warnings: warnings.length ? warnings : undefined
      }
    };
  }

  const edgesToCreate = duplicates.length > 0
    ? sanitizedEdges.filter((edge) => {
        const key = `${edge.source}|${edge.sourceHandle || ''}|${edge.target}|${edge.targetHandle || ''}`;
        return !duplicates.some((dup) => (
          dup.source === edge.source &&
          dup.target === edge.target &&
          dup.sourceHandle === (edge.sourceHandle || null) &&
          dup.targetHandle === (edge.targetHandle || null)
        ));
      })
    : sanitizedEdges;

  if (edgesToCreate.length === 0) {
    return {
      success: true,
      data: {
        created: [],
        warnings: warnings.length ? warnings : undefined
      }
    };
  }

  const result = graphAPI.createEdges(edgesToCreate);
  if (!result?.success) {
    return {
      success: false,
      error: result?.error || 'createEdges failed',
      data: result?.data
    };
  }

  const mergedWarnings = [...warnings];
  if (Array.isArray(result?.data?.warnings)) {
    mergedWarnings.push(...result.data.warnings);
  }

  return {
    success: true,
    data: {
      ...result.data,
      warnings: mergedWarnings.length ? mergedWarnings : undefined,
      manifestWarning: mutationCheck.warning
    }
  };
};

const runGrouping = async ({ graphAPI }, params = {}) => {
  const action = (params.action || 'create').toLowerCase();
  const mutationIntent =
    action === 'dissolve' || action === 'delete'
      ? 'delete'
      : 'update';
  const mutationCheck = assertMutationAllowed(graphAPI, mutationIntent);
  if (mutationCheck.error) {
    return { success: false, error: mutationCheck.error };
  }
  const padding = params.padding ?? DEFAULT_GROUP_PADDING;
  const nodes = graphAPI.getNodes ? graphAPI.getNodes() : [];
  const groups = graphAPI.getGroups ? graphAPI.getGroups() : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const groupMap = new Map(groups.map((group) => [group.id, group]));

  if (action === 'create') {
    const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
    const missing = nodeIds.filter((id) => !nodeMap.has(id));
    if (missing.length > 0) {
      return {
        success: false,
        error: 'One or more nodeIds do not exist',
        data: { missing }
      };
    }
    if (nodeIds.length < 2) {
      return { success: false, error: 'Groups must reference at least two nodes' };
    }
    if (params.allowRegroup !== true) {
      const grouped = groups
        .filter((group) => Array.isArray(group.nodeIds))
        .flatMap((group) => group.nodeIds)
        .filter((id) => nodeIds.includes(id));
      const uniqueGrouped = Array.from(new Set(grouped));
      if (uniqueGrouped.length > 0) {
        return {
          success: false,
          error: 'One or more nodes already belong to a group',
          data: { groupedNodeIds: uniqueGrouped }
        };
      }
    }
    const targetNodes = nodeIds.map((id) => nodeMap.get(id));
    const bounds = computeBounds(targetNodes, padding);
    const payload = {
      id: params.groupId,
      label: params.label || '',
      nodeIds,
      bounds,
      style: params.style ? cloneEntity(params.style) : undefined,
      visible: params.visible !== false,
      collapsed: Boolean(params.collapsed)
    };

    if (params.dryRun) {
      return { success: true, data: { action: 'create', group: payload } };
    }

    const result = graphAPI.createGroups([payload]);
    if (!result?.success) {
      return { success: false, error: result?.error || 'createGroups failed', data: result?.data };
    }
    return {
      success: true,
      data: {
        action: 'create',
        group: Array.isArray(result?.data?.created) ? result.data.created[0] : undefined,
        warnings: result?.data?.failed,
        manifestWarning: mutationCheck.warning
      }
    };
  }

  if (action === 'dissolve' || action === 'delete') {
    const groupId = params.groupId;
    if (!groupId) {
      return { success: false, error: 'groupId is required for dissolve' };
    }
    if (!groupMap.has(groupId)) {
      return { success: false, error: `Group ${groupId} not found` };
    }
    if (params.dryRun) {
      return { success: true, data: { action: 'dissolve', groupId } };
    }
    const result = graphAPI.deleteGroup(groupId);
    if (!result?.success) {
      return { success: false, error: result?.error || 'deleteGroup failed', data: result?.data };
    }
    return {
      success: true,
      data: { action: 'dissolve', result: result.data, manifestWarning: mutationCheck.warning }
    };
  }

  if (action === 'add') {
    const groupId = params.groupId;
    const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
    if (!groupMap.has(groupId)) {
      return { success: false, error: `Group ${groupId} not found` };
    }
    if (params.allowRegroup !== true) {
      const alreadyGrouped = groups
        .filter((group) => group.id !== groupId && Array.isArray(group.nodeIds))
        .flatMap((group) => group.nodeIds)
        .filter((id) => nodeIds.includes(id));
      const uniqueGrouped = Array.from(new Set(alreadyGrouped));
      if (uniqueGrouped.length > 0) {
        return {
          success: false,
          error: 'One or more nodes already belong to another group',
          data: { groupedNodeIds: uniqueGrouped }
        };
      }
    }
    const missing = nodeIds.filter((id) => !nodeMap.has(id));
    if (missing.length > 0) {
      return { success: false, error: 'One or more nodeIds do not exist', data: { missing } };
    }
    if (params.dryRun) {
      return { success: true, data: { action: 'add', groupId, nodeIds } };
    }
    const addResult = graphAPI.addNodesToGroup(groupId, nodeIds);
    if (!addResult?.success) {
      return { success: false, error: addResult?.error || 'addNodesToGroup failed', data: addResult?.data };
    }
    if (params.recalculateBounds !== false) {
      const refreshedGroup = graphAPI.readGroup(groupId)?.data;
      if (refreshedGroup) {
        const refreshedNodes = (refreshedGroup.nodeIds || []).map((id) => nodeMap.get(id)).filter(Boolean);
        const bounds = computeBounds(refreshedNodes, padding);
        graphAPI.updateGroup(groupId, { bounds });
      }
    }
    return {
      success: true,
      data: { action: 'add', group: addResult.data, manifestWarning: mutationCheck.warning }
    };
  }

  if (action === 'remove') {
    const groupId = params.groupId;
    const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
    if (!groupMap.has(groupId)) {
      return { success: false, error: `Group ${groupId} not found` };
    }
    if (params.dryRun) {
      return { success: true, data: { action: 'remove', groupId, nodeIds } };
    }
    const removeResult = graphAPI.removeNodesFromGroup(groupId, nodeIds);
    if (!removeResult?.success) {
      return { success: false, error: removeResult?.error || 'removeNodesFromGroup failed', data: removeResult?.data };
    }
    return {
      success: true,
      data: { action: 'remove', result: removeResult.data, manifestWarning: mutationCheck.warning }
    };
  }

  if (action === 'set') {
    const groupId = params.groupId;
    const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
    if (!groupMap.has(groupId)) {
      return { success: false, error: `Group ${groupId} not found` };
    }
    const missing = nodeIds.filter((id) => !nodeMap.has(id));
    if (missing.length > 0) {
      return { success: false, error: 'One or more nodeIds do not exist', data: { missing } };
    }
    if (params.dryRun) {
      return { success: true, data: { action: 'set', groupId, nodeIds } };
    }
    const result = graphAPI.setGroupNodes(groupId, nodeIds);
    if (!result?.success) {
      return { success: false, error: result?.error || 'setGroupNodes failed', data: result?.data };
    }
    if (params.recalculateBounds !== false) {
      const refreshedNodes = nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
      const bounds = computeBounds(refreshedNodes, padding);
      graphAPI.updateGroup(groupId, { bounds });
    }
    return { success: true, data: { action: 'set', group: result.data, manifestWarning: mutationCheck.warning } };
  }

  return { success: false, error: `Unsupported grouping action "${action}"` };
};

const runReparent = async ({ graphAPI }, params = {}) => {
  const mutationCheck = assertMutationAllowed(graphAPI, 'update');
  if (mutationCheck.error) {
    return { success: false, error: mutationCheck.error };
  }
  const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
  const nodes = graphAPI.getNodes ? graphAPI.getNodes() : [];
  const groups = graphAPI.getGroups ? graphAPI.getGroups() : [];

  const nodeSet = new Set(nodes.map((node) => node.id));
  const missing = nodeIds.filter((id) => !nodeSet.has(id));
  if (missing.length > 0) {
    return { success: false, error: 'One or more nodeIds do not exist', data: { missing } };
  }

  const targetGroupId = params.targetGroupId || params.toGroupId || params.to;
  const sourceGroupIds = params.sourceGroupIds || params.fromGroupIds || params.from;
  const groupMap = new Map(groups.map((group) => [group.id, group]));

  if (targetGroupId && !groupMap.has(targetGroupId)) {
    return { success: false, error: `Target group ${targetGroupId} not found` };
  }

  let resolvedSources;
  if (Array.isArray(sourceGroupIds) && sourceGroupIds.length > 0) {
    resolvedSources = sourceGroupIds;
  } else {
    const containingGroups = groups
      .filter((group) => Array.isArray(group.nodeIds) && group.nodeIds.some((id) => nodeIds.includes(id)))
      .map((group) => group.id);
    resolvedSources = containingGroups;
  }

  if ((!resolvedSources || resolvedSources.length === 0) && !targetGroupId) {
    return { success: false, error: 'Nothing to reparent: no source or target groups resolved' };
  }

  const operations = [];
  resolvedSources.forEach((groupId) => {
    const group = groupMap.get(groupId);
    if (!group) return;
    const candidates = (group.nodeIds || []).filter((id) => nodeIds.includes(id));
    if (candidates.length === 0) return;
    operations.push({ type: 'remove', groupId, nodeIds: candidates });
  });
  if (targetGroupId) {
    operations.push({ type: 'add', groupId: targetGroupId, nodeIds });
  }

  if (operations.length === 0) {
    return { success: false, error: 'No reparent operations resolved' };
  }

  if (params.dryRun) {
    return { success: true, data: { operations } };
  }

  const results = [];
  for (const op of operations) {
    if (op.type === 'remove') {
      const outcome = graphAPI.removeNodesFromGroup(op.groupId, op.nodeIds);
      if (!outcome?.success) {
        return { success: false, error: outcome?.error || `Failed to remove nodes from ${op.groupId}`, data: outcome?.data };
      }
      results.push(outcome);
    } else if (op.type === 'add') {
      const outcome = graphAPI.addNodesToGroup(op.groupId, op.nodeIds);
      if (!outcome?.success) {
        return { success: false, error: outcome?.error || `Failed to add nodes to ${op.groupId}`, data: outcome?.data };
      }
      results.push(outcome);
      if (params.recalculateBounds !== false) {
        const refreshedGroup = graphAPI.readGroup(op.groupId)?.data;
        const nodesForBounds = (refreshedGroup?.nodeIds || []).map((id) =>
          nodes.find((node) => node.id === id)
        ).filter(Boolean);
        const bounds = computeBounds(nodesForBounds, params.padding ?? DEFAULT_GROUP_PADDING);
        graphAPI.updateGroup(op.groupId, { bounds });
      }
    }
  }

  return {
    success: true,
    data: {
      operations,
      summary: buildAddRemoveSummary(results),
      manifestWarning: mutationCheck.warning
    }
  };
};

const runDuplicateNodes = async ({ graphAPI }, params = {}) => {
  const mutationCheck = assertMutationAllowed(graphAPI, 'create');
  if (mutationCheck.error) {
    return { success: false, error: mutationCheck.error };
  }
  const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
  const nodes = graphAPI.getNodes ? graphAPI.getNodes() : [];
  const nodeSet = new Set(nodes.map((node) => node.id));
  const missing = nodeIds.filter((id) => !nodeSet.has(id));
  if (missing.length > 0) {
    return { success: false, error: 'One or more nodeIds do not exist', data: { missing } };
  }

  const options = {
    includeEdges: params.includeEdges !== false,
    offset: params.offset
  };

  if (params.dryRun) {
    return {
      success: true,
      data: {
        planned: {
          count: nodeIds.length,
          includeEdges: options.includeEdges,
          offset: options.offset || { x: 40, y: 40 }
        }
      }
    };
  }

  const result = graphAPI.duplicateNodes(nodeIds, options);
  if (!result?.success) {
    return {
      success: false,
      error: result?.error || 'duplicateNodes failed',
      data: result?.data
    };
  }

  return {
    success: true,
    data: {
      ...result.data,
      manifestWarning: mutationCheck.warning
    }
  };
};

const runExtractSubgraph = async ({ graphAPI }, params = {}) => {
  const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
  const nodes = graphAPI.getNodes ? graphAPI.getNodes() : [];
  const edges = graphAPI.getEdges ? graphAPI.getEdges() : [];
  const groups = graphAPI.getGroups ? graphAPI.getGroups() : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const missing = nodeIds.filter((id) => !nodeMap.has(id));
  if (missing.length > 0) {
    return { success: false, error: 'One or more nodeIds do not exist', data: { missing } };
  }

  const nodeSet = new Set(nodeIds);
  const selectedNodes = nodeIds.map((id) => cloneEntity(nodeMap.get(id)));
  const selectedEdges = edges
    .filter((edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target))
    .map((edge) => cloneEntity(edge));

  const includeGroups = params.includeGroups !== false;
  const intersectedGroups = includeGroups ? extractGroupsForNodes(groups, nodeSet) : [];

  const payload = {
    nodes: selectedNodes,
    edges: selectedEdges,
    groups: intersectedGroups
  };

  if (params.createGroup) {
    const mutationCheck = assertMutationAllowed(graphAPI, 'create');
    if (mutationCheck.error) {
      return { success: false, error: mutationCheck.error };
    }
    const nodesForBounds = nodeIds.map((id) => nodeMap.get(id));
    const bounds = computeBounds(nodesForBounds, params.padding ?? DEFAULT_GROUP_PADDING);
    const groupPayload = {
      id: params.groupId,
      label: params.groupLabel || params.label || 'Extracted Subgraph',
      nodeIds,
      bounds,
      style: params.style ? cloneEntity(params.style) : undefined,
      visible: params.visible !== false
    };

    if (params.dryRun) {
      return {
        success: true,
        data: {
          payload,
          plannedGroup: groupPayload
        }
      };
    }

    const result = graphAPI.createGroups([groupPayload]);
    if (!result?.success) {
      return {
        success: false,
        error: result?.error || 'createGroups failed',
        data: result?.data
      };
    }
    return {
      success: true,
      data: {
        payload,
        group: Array.isArray(result?.data?.created) ? result.data.created[0] : null,
        manifestWarning: mutationCheck.warning
      }
    };
  }

  return {
    success: true,
    data: payload
  };
};

export const structuralSkills = [
  {
    id: 'struct.createNodes',
    title: 'Create Nodes',
    description: 'Create new nodes without disturbing existing state.',
    category: 'structural',
    supportsDryRun: true,
    run: runCreateNodes,
    contracts: {
      inputs: ['nodes[]'],
      outputs: ['created[]', 'warnings[]'],
      forbidden: ['implicit position assignment when preservePositions is false']
    }
  },
  {
    id: 'struct.createEdges',
    title: 'Create Edges',
    description: 'Attach relationships between existing nodes.',
    category: 'structural',
    supportsDryRun: true,
    run: runCreateEdges,
    contracts: {
      inputs: ['edges[]'],
      preconditions: ['nodes referenced must already exist'],
      forbidden: ['rewiring existing edges unless failOnDuplicate is false']
    }
  },
  {
    id: 'struct.grouping',
    title: 'Group / Ungroup',
    description: 'Create or dissolve containment without altering meaning.',
    category: 'structural',
    supportsDryRun: true,
    run: runGrouping,
    contracts: {
      inputs: ['action', 'groupId?', 'nodeIds?'],
      warnings: ['Grouping mutations never move nodes; bounds only']
    }
  },
  {
    id: 'struct.reparent',
    title: 'Reparent',
    description: 'Move nodes between structural containers.',
    category: 'structural',
    supportsDryRun: true,
    run: runReparent,
    contracts: {
      inputs: ['nodeIds[]', 'sourceGroupIds?', 'targetGroupId?'],
      forbidden: ['Implicit layout changes'],
      postconditions: ['Groups updated to reflect new membership']
    }
  },
  {
    id: 'struct.duplicate',
    title: 'Duplicate',
    description: 'Clone nodes (and optionally edges) safely.',
    category: 'structural',
    supportsDryRun: true,
    run: runDuplicateNodes,
    contracts: {
      inputs: ['nodeIds[]', 'includeEdges?', 'offset?'],
      postconditions: ['New node ids minted'],
      forbidden: ['Identity collisions']
    }
  },
  {
    id: 'struct.extractSubgraph',
    title: 'Extract Subgraph',
    description: 'Lift a subset of nodes into a new cluster or payload.',
    category: 'structural',
    supportsDryRun: true,
    run: runExtractSubgraph,
    contracts: {
      inputs: ['nodeIds[]', 'includeGroups?', 'createGroup?'],
      outputs: ['payload { nodes, edges, groups }'],
      forbidden: ['Snapshot overwrite of existing graph']
    }
  }
];
