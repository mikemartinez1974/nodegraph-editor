import { v4 as uuidv4 } from 'uuid';
import { assertMutationAllowed } from './manifestPolicy.js';

const deepClone = (value) => {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return value;
  }
};

const defaultNodes = (graphAPI, fallback = []) =>
  typeof graphAPI?.getNodes === 'function' ? graphAPI.getNodes() : fallback;

const defaultEdges = (graphAPI, fallback = []) =>
  typeof graphAPI?.getEdges === 'function' ? graphAPI.getEdges() : fallback;

const defaultGroups = (graphAPI, fallback = []) =>
  typeof graphAPI?.getGroups === 'function' ? graphAPI.getGroups() : fallback;

const toArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const readPath = (obj, path) => {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    if (key === '*') return Array.isArray(acc) ? acc : undefined;
    return acc[key];
  }, obj);
};

const setPath = (obj, path, value) => {
  if (!path) return;
  const segments = path.split('.');
  let current = obj;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[segments[segments.length - 1]] = value;
};

const deletePath = (obj, path) => {
  if (!obj || typeof obj !== 'object' || !path) return;
  const segments = path.split('.');
  let current = obj;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      return;
    }
    current = current[key];
  }
  delete current[segments[segments.length - 1]];
};

const mergePatch = (target, patch) => {
  const result = deepClone(target || {});
  Object.keys(patch || {}).forEach((key) => {
    const value = patch[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergePatch(result[key], value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

const accumPatch = (map, id, patch) => {
  if (!id || !patch) return;
  const existing = map.get(id) || {};
  map.set(id, mergePatch(existing, patch));
};

const ensureUniqueId = (existingIds, proposed) => {
  if (!proposed || existingIds.has(proposed)) {
    let candidate;
    do {
      candidate = uuidv4();
    } while (existingIds.has(candidate));
    return candidate;
  }
  return proposed;
};

const assertMutationPlan = (graphAPI, plan) => {
  const warnings = [];
  if (plan.create) {
    const result = assertMutationAllowed(graphAPI, 'create');
    if (result.error) return result;
    if (result.warning) warnings.push(result.warning);
  }
  if (plan.update) {
    const result = assertMutationAllowed(graphAPI, 'update');
    if (result.error) return result;
    if (result.warning) warnings.push(result.warning);
  }
  if (plan.delete) {
    const result = assertMutationAllowed(graphAPI, 'delete');
    if (result.error) return result;
    if (result.warning) warnings.push(result.warning);
  }
  return warnings.length ? { warning: warnings.join(' ') } : {};
};

const applyCreates = (graphAPI, nodes, dryRun, summary) => {
  if (!nodes.length) return;
  if (dryRun) {
    summary.createdNodes = nodes.map((node) => node.id);
    return;
  }
  const result = graphAPI.createNodes(nodes);
  if (!result?.success) {
    const message = result?.error || 'createNodes failed';
    throw new Error(message);
  }
  summary.createdNodes = Array.isArray(result.data?.created)
    ? result.data.created.map((node) => node.id)
    : nodes.map((node) => node.id);
};

const applyNodeUpdates = (graphAPI, updates, dryRun, summary) => {
  if (!updates.size) return;
  summary.updatedNodes = [];
  for (const [id, patch] of updates.entries()) {
    if (dryRun) {
      summary.updatedNodes.push(id);
      continue;
    }
    const result = graphAPI.updateNode(id, patch);
    if (!result?.success) {
      const message = result?.error || `Failed to update node ${id}`;
      throw new Error(message);
    }
    summary.updatedNodes.push(id);
  }
};

const applyEdgeUpdates = (graphAPI, updates, dryRun, summary) => {
  if (!updates.size) return;
  summary.updatedEdges = [];
  for (const [id, patch] of updates.entries()) {
    if (dryRun) {
      summary.updatedEdges.push(id);
      continue;
    }
    const result = graphAPI.updateEdge(id, patch);
    if (!result?.success) {
      const message = result?.error || `Failed to update edge ${id}`;
      throw new Error(message);
    }
    summary.updatedEdges.push(id);
  }
};

const applyDeletes = (graphAPI, ids, dryRun, summary) => {
  if (!ids.size) return;
  summary.deletedNodes = Array.from(ids);
  if (dryRun) return;
  for (const id of ids) {
    const result = graphAPI.deleteNode(id);
    if (!result?.success) {
      const message = result?.error || `Failed to delete node ${id}`;
      throw new Error(message);
    }
  }
};

const applyGroupAdds = (graphAPI, pairs, dryRun, summary) => {
  if (!pairs.length || typeof graphAPI?.addNodesToGroup !== 'function') return;
  if (!summary.clusters) summary.clusters = { added: [] };
  pairs.forEach(({ clusterId, nodeIds }) => {
    if (dryRun) {
      summary.clusters.added.push({ clusterId, nodeIds });
      return;
    }
    const result = graphAPI.addNodesToGroup(clusterId, nodeIds);
    if (!result?.success) {
      const message = result?.error || `Failed to add nodes to group ${clusterId}`;
      throw new Error(message);
    }
    summary.clusters.added.push({ clusterId, nodeIds });
  });
};

const runRefactor = ({ graphAPI }, params = {}) => {
  const plan = {
    create: Boolean(params.split) || (Array.isArray(params.splits) && params.splits.length > 0),
    update: Boolean(params.merge) || (Array.isArray(params.merges) && params.merges.length > 0),
    delete: false
  };
  const splitList = []
    .concat(params.split || [])
    .concat(Array.isArray(params.splits) ? params.splits : []);
  plan.delete = splitList.some((split) => split?.removeOriginal);
  const mergeList = []
    .concat(params.merge || [])
    .concat(Array.isArray(params.merges) ? params.merges : []);
  if (mergeList.length) {
    plan.update = true;
    if (mergeList.some((merge) => merge?.deleteSources !== false)) {
      plan.delete = true;
    }
  }
  const policy = assertMutationPlan(graphAPI, plan);
  if (policy.error) {
    return { success: false, error: policy.error };
  }

  const dryRun = params.dryRun === true;
  const nodes = defaultNodes(graphAPI);
  const edges = defaultEdges(graphAPI);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edgeMap = new Map(edges.map((edge) => [edge.id, edge]));
  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const existingEdgeIds = new Set(edges.map((edge) => edge.id));

  const createQueue = [];
  const nodeUpdates = new Map();
  const edgeUpdates = new Map();
  const deleteQueue = new Set();
  const groupAdds = [];
  const warnings = [];
  const summary = {};

  const errors = [];

  const handleSplit = (split) => {
    if (!split || typeof split !== 'object') return;
    const sourceId = split.sourceId;
    if (!sourceId || !nodeMap.has(sourceId)) {
      errors.push(`Split source node "${sourceId}" not found.`);
      return;
    }
    const sourceNode = nodeMap.get(sourceId);
    const parts = Array.isArray(split.parts) ? split.parts : [];
    if (!parts.length) {
      errors.push(`Split for "${sourceId}" requires at least one part.`);
      return;
    }
    parts.forEach((part, index) => {
      const proposedId = part?.id || `${sourceId}-${index + 1}`;
      const newId = ensureUniqueId(existingNodeIds, proposedId);
      existingNodeIds.add(newId);
      const base = deepClone(sourceNode);
      base.id = newId;
      base.label = part?.label || base.label;
      if (part?.replaceData) {
        base.data = deepClone(part.data || {});
      } else if (part?.data && typeof part.data === 'object') {
        base.data = mergePatch(base.data || {}, part.data);
      }
      if (part?.type) {
        base.type = part.type;
      }
      if (part?.position) {
        base.position = mergePatch(base.position || {}, part.position);
      }
      if (part?.extensions) {
        base.extensions = mergePatch(base.extensions || {}, part.extensions);
      }
      if (part?.state) {
        base.state = mergePatch(base.state || {}, part.state);
      }
      createQueue.push(base);
      nodeMap.set(base.id, base);

      if (Array.isArray(part?.edgeRedirects)) {
        part.edgeRedirects.forEach((redirect) => {
          const edgeId = redirect?.edgeId;
          if (!edgeId || !edgeMap.has(edgeId)) {
            warnings.push(`Edge redirect references missing edge "${edgeId}".`);
            return;
          }
          const endpoint = redirect?.endpoint === 'target' ? 'target' : 'source';
          const patch = endpoint === 'source'
            ? { source: base.id, sourcePort: redirect?.handle ?? redirect?.handleId }
            : { target: base.id, targetPort: redirect?.handle ?? redirect?.handleId };
          accumPatch(edgeUpdates, edgeId, patch);
        });
      }

      if (Array.isArray(part?.createEdges) && part.createEdges.length) {
        part.createEdges.forEach((edgeBlueprint) => {
          const payload = {
            id: ensureUniqueId(existingEdgeIds, edgeBlueprint?.id),
            source: edgeBlueprint?.source || base.id,
            target: edgeBlueprint?.target,
            sourcePort: edgeBlueprint?.sourcePort,
            targetPort: edgeBlueprint?.targetPort,
            type: edgeBlueprint?.type || 'child',
            label: edgeBlueprint?.label,
            data: edgeBlueprint?.data,
            style: edgeBlueprint?.style
          };
          if (!payload.target) {
            warnings.push(`Skipped creating edge for split part "${base.id}" because target is missing.`);
            return;
          }
          if (dryRun) {
            if (!summary.createdEdges) summary.createdEdges = [];
            summary.createdEdges.push(payload);
          } else {
            const result = graphAPI.createEdge(payload);
            if (!result?.success) {
              throw new Error(result?.error || 'Failed to create edge during split');
            }
            if (!summary.createdEdges) summary.createdEdges = [];
            summary.createdEdges.push(result.data?.id || payload.id);
            existingEdgeIds.add(result.data?.id || payload.id);
          }
        });
      }

      if (part?.clusterId) {
        groupAdds.push({ clusterId: part.clusterId, nodeIds: [base.id] });
      }
    });

    if (split.removeOriginal) {
      deleteQueue.add(sourceId);
    } else if (split.note) {
      const sanitized = mergePatch(sourceNode, {});
      sanitized.data = mergePatch(sanitized.data || {}, { memo: [sanitized.data?.memo, split.note].filter(Boolean).join('\n\n') });
      accumPatch(nodeUpdates, sourceId, { data: sanitized.data });
    }
  };

  const handleMerge = (merge) => {
    if (!merge || typeof merge !== 'object') return;
    const targetId = merge.targetId;
    if (!targetId || !nodeMap.has(targetId)) {
      errors.push(`Merge target node "${targetId}" not found.`);
      return;
    }
    const targetNode = deepClone(nodeMap.get(targetId));
    const fieldMap = Array.isArray(merge.sources) ? merge.sources : [];
    fieldMap.forEach((entry) => {
      const sourceId = entry?.id;
      if (!sourceId || !nodeMap.has(sourceId)) {
        warnings.push(`Merge source node "${sourceId}" not found.`);
        return;
      }
      const sourceNode = nodeMap.get(sourceId);
      const mappings = Array.isArray(entry?.fields) ? entry.fields : [];
      mappings.forEach((mapping) => {
        const fromPath = mapping?.from || mapping?.source;
        const toPath = mapping?.to || mapping?.target;
        if (!fromPath || !toPath) return;
        const value = readPath(sourceNode.data || {}, fromPath);
        if (value === undefined) {
          warnings.push(`Field "${fromPath}" missing on node "${sourceId}" during merge.`);
          return;
        }
        setPath(targetNode.data || (targetNode.data = {}), toPath, deepClone(value));
        if (mapping?.removeOriginal) {
          const clone = deepClone(nodeMap.get(sourceId));
          deletePath(clone.data || {}, fromPath);
          nodeMap.set(sourceId, clone);
          accumPatch(nodeUpdates, sourceId, { data: clone.data });
        }
      });
      if (entry?.annotations) {
        const targetMemo = targetNode.data?.memo || '';
        targetNode.data = mergePatch(targetNode.data || {}, {
          memo: `${targetMemo}${targetMemo ? '\n\n' : ''}${entry.annotations}`
        });
      }
      if (merge.retargetEdges !== false) {
        edges.forEach((edge) => {
          if (!edge || !edge.id) return;
          if (edge.source === sourceId) {
            const patch = { source: targetId };
            if (entry?.handleMap?.source) {
              patch.sourcePort = entry.handleMap.source;
            }
            accumPatch(edgeUpdates, edge.id, patch);
          }
          if (edge.target === sourceId) {
            const patch = { target: targetId };
            if (entry?.handleMap?.target) {
              patch.targetPort = entry.handleMap.target;
            }
            accumPatch(edgeUpdates, edge.id, patch);
          }
        });
      }
      if (merge.deleteSources !== false && sourceId !== targetId) {
        deleteQueue.add(sourceId);
      }
    });
    if (merge.data && typeof merge.data === 'object') {
      targetNode.data = mergePatch(targetNode.data || {}, merge.data);
    }
    if (merge.label) {
      targetNode.label = merge.label;
    }
    if (merge.type) {
      targetNode.type = merge.type;
    }
    nodeMap.set(targetId, targetNode);
    accumPatch(
      nodeUpdates,
      targetId,
      {
        data: targetNode.data,
        label: targetNode.label,
        type: targetNode.type
      }
    );
  };

  if (params.split) {
    handleSplit(params.split);
  }
  if (Array.isArray(params.splits)) {
    params.splits.forEach(handleSplit);
  }
  if (params.merge) {
    handleMerge(params.merge);
  }
  if (Array.isArray(params.merges)) {
    params.merges.forEach(handleMerge);
  }

  if (errors.length) {
    return {
      success: false,
      data: { errors, warnings, summary }
    };
  }

  try {
    applyCreates(graphAPI, createQueue, dryRun, summary);
    applyNodeUpdates(graphAPI, nodeUpdates, dryRun, summary);
    applyEdgeUpdates(graphAPI, edgeUpdates, dryRun, summary);
    applyDeletes(graphAPI, deleteQueue, dryRun, summary);
    applyGroupAdds(graphAPI, groupAdds, dryRun, summary);
  } catch (error) {
    return { success: false, data: { errors: [error.message], warnings, summary } };
  }

  summary.warnings = warnings;
  if (policy.warning) {
    summary.manifestWarning = policy.warning;
  }
  return { success: true, data: summary };
};

const runNormalize = ({ graphAPI }, params = {}) => {
  const plan = { update: true };
  const policy = assertMutationPlan(graphAPI, plan);
  if (policy.error) {
    return { success: false, error: policy.error };
  }
  const dryRun = params.dryRun === true;
  const operations = Array.isArray(params.operations) ? params.operations : [];
  const nodeUpdates = new Map();
  const warnings = [];
  const nodes = defaultNodes(graphAPI);
  const nodeMap = new Map(nodes.map((node) => [node.id, deepClone(node)]));
  const summary = {};

  const ensureNode = (nodeId) => {
    if (!nodeMap.has(nodeId)) {
      warnings.push(`Node "${nodeId}" not found for normalization operation.`);
      return null;
    }
    return nodeMap.get(nodeId);
  };

  operations.forEach((op) => {
    if (!op || typeof op !== 'object') return;
    switch (op.type) {
      case 'removeDuplicates': {
        const nodeId = op.nodeId;
        const fieldPath = op.fieldPath;
        const node = ensureNode(nodeId);
        if (!node || !fieldPath) break;
        const arr = readPath(node.data || {}, fieldPath);
        if (!Array.isArray(arr)) {
          warnings.push(`Field "${fieldPath}" on node "${nodeId}" is not an array.`);
          break;
        }
        const seen = new Set();
        const deduped = [];
        arr.forEach((item) => {
          const key = JSON.stringify(item);
          if (seen.has(key)) return;
          seen.add(key);
          deduped.push(item);
        });
        if (deduped.length !== arr.length) {
          setPath(node.data || (node.data = {}), fieldPath, deduped);
          accumPatch(nodeUpdates, nodeId, { data: node.data });
        }
        break;
      }
      case 'moveField':
      case 'copyField': {
        const from = op.from || {};
        const to = op.to || {};
        const sourceNode = ensureNode(from.nodeId);
        const targetNode = ensureNode(to.nodeId);
        if (!sourceNode || !targetNode || !from.path || !to.path) break;
        const value = readPath(sourceNode.data || {}, from.path);
        if (value === undefined) {
          warnings.push(`Path "${from.path}" not found on node "${from.nodeId}".`);
          break;
        }
        setPath(targetNode.data || (targetNode.data = {}), to.path, deepClone(value));
        accumPatch(nodeUpdates, to.nodeId, { data: targetNode.data });
        if (op.type === 'moveField' && op.removeOriginal !== false) {
          deletePath(sourceNode.data || {}, from.path);
          accumPatch(nodeUpdates, from.nodeId, { data: sourceNode.data });
        }
        break;
      }
      case 'setField': {
        const node = ensureNode(op.nodeId);
        if (!node || !op.path) break;
        setPath(node.data || (node.data = {}), op.path, deepClone(op.value));
        accumPatch(nodeUpdates, op.nodeId, { data: node.data });
        break;
      }
      default:
        warnings.push(`Unsupported normalization operation "${op.type}".`);
        break;
    }
  });

  try {
    applyNodeUpdates(graphAPI, nodeUpdates, dryRun, summary);
  } catch (error) {
    return { success: false, data: { errors: [error.message], warnings } };
  }

  summary.warnings = warnings;
  if (policy.warning) {
    summary.manifestWarning = policy.warning;
  }
  return { success: true, data: summary };
};

const runTypeMigration = ({ graphAPI }, params = {}) => {
  const policy = assertMutationPlan(graphAPI, { update: true });
  if (policy.error) {
    return { success: false, error: policy.error };
  }
  const dryRun = params.dryRun === true;
  const migrations = Array.isArray(params.migrations) ? params.migrations : [];
  const nodes = defaultNodes(graphAPI);
  const nodeMap = new Map(nodes.map((node) => [node.id, deepClone(node)]));
  const nodeUpdates = new Map();
  const warnings = [];
  const summary = {};

  migrations.forEach((migration) => {
    if (!migration || typeof migration !== 'object') return;
    const nodeId = migration.nodeId;
    if (!nodeMap.has(nodeId)) {
      warnings.push(`Cannot migrate node "${nodeId}" - node not found.`);
      return;
    }
    const node = nodeMap.get(nodeId);
    const originalData = deepClone(node.data || {});
    const newData = deepClone(originalData);
    const fieldMap = migration.fieldMap || migration.fields || {};
    Object.keys(fieldMap).forEach((targetPath) => {
      const mapping = fieldMap[targetPath];
      const fromPath = typeof mapping === 'string' ? mapping : mapping?.from;
      if (!fromPath) return;
      const value = readPath(originalData, fromPath);
      if (value === undefined) {
        warnings.push(`Migration field "${fromPath}" missing on node "${nodeId}".`);
        return;
      }
      setPath(newData, targetPath, deepClone(value));
      if (mapping?.removeOriginal) {
        deletePath(newData, fromPath);
      }
    });
    if (Array.isArray(migration.removeFields)) {
      migration.removeFields.forEach((path) => deletePath(newData, path));
    }
    if (migration.defaults && typeof migration.defaults === 'object') {
      Object.keys(migration.defaults).forEach((path) => {
        if (readPath(newData, path) === undefined) {
          setPath(newData, path, deepClone(migration.defaults[path]));
        }
      });
    }
    if (migration.data && typeof migration.data === 'object') {
      Object.keys(migration.data).forEach((path) => {
        setPath(newData, path, deepClone(migration.data[path]));
      });
    }
    node.data = newData;
    if (migration.targetType) {
      node.type = migration.targetType;
    }
    if (migration.label) {
      node.label = migration.label;
    }
    accumPatch(nodeUpdates, nodeId, {
      data: node.data,
      type: node.type,
      label: node.label
    });
  });

  try {
    applyNodeUpdates(graphAPI, nodeUpdates, dryRun, summary);
  } catch (error) {
    return { success: false, data: { errors: [error.message], warnings } };
  }

  summary.warnings = warnings;
  if (policy.warning) {
    summary.manifestWarning = policy.warning;
  }
  return { success: true, data: summary };
};

const runSchemaUpgrade = ({ graphAPI }, params = {}) => {
  const policy = assertMutationPlan(graphAPI, { update: true });
  if (policy.error) {
    return { success: false, error: policy.error };
  }
  const dryRun = params.dryRun === true;
  const patches = Array.isArray(params.patches) ? params.patches : [];
  const nodeUpdates = new Map();
  const warnings = [];
  const nodes = defaultNodes(graphAPI);
  const nodeMap = new Map(nodes.map((node) => [node.id, deepClone(node)]));
  const summary = {};

  patches.forEach((patch) => {
    if (!patch || typeof patch !== 'object') return;
    const nodeId = patch.nodeId;
    if (!nodeMap.has(nodeId)) {
      warnings.push(`Schema upgrade skipped missing node "${nodeId}".`);
      return;
    }
    const node = nodeMap.get(nodeId);
    if (patch.data && typeof patch.data === 'object') {
      node.data = mergePatch(node.data || {}, patch.data);
    }
    if (patch.extensions && typeof patch.extensions === 'object') {
      node.extensions = mergePatch(node.extensions || {}, patch.extensions);
    }
    if (patch.type) {
      node.type = patch.type;
    }
    if (patch.label) {
      node.label = patch.label;
    }
    accumPatch(nodeUpdates, nodeId, {
      data: node.data,
      extensions: node.extensions,
      type: node.type,
      label: node.label
    });
  });

  try {
    applyNodeUpdates(graphAPI, nodeUpdates, dryRun, summary);
  } catch (error) {
    return { success: false, data: { errors: [error.message], warnings } };
  }

  summary.warnings = warnings;
  if (policy.warning) {
    summary.manifestWarning = policy.warning;
  }
  if (params.targetVersion) {
    summary.contractVersion = params.targetVersion;
  }
  return { success: true, data: summary };
};

const runInlineExtract = ({ graphAPI }, params = {}) => {
  const operations = Array.isArray(params.operations) ? params.operations : [];
  const plan = {
    create: operations.some((op) => op?.type === 'extract'),
    update: operations.some((op) => op?.type === 'inline' || op?.type === 'extract'),
    delete: operations.some((op) => op?.type === 'inline' && op?.deleteSource)
  };
  const policy = assertMutationPlan(graphAPI, plan);
  if (policy.error) {
    return { success: false, error: policy.error };
  }
  const dryRun = params.dryRun === true;
  const nodes = defaultNodes(graphAPI);
  const nodeMap = new Map(nodes.map((node) => [node.id, deepClone(node)]));
  const nodeUpdates = new Map();
  const createQueue = [];
  const deleteQueue = new Set();
  const warnings = [];
  const summary = {};

  const ensureNode = (nodeId) => {
    if (!nodeMap.has(nodeId)) {
      warnings.push(`Inline/extract operation skipped missing node "${nodeId}".`);
      return null;
    }
    return nodeMap.get(nodeId);
  };

  operations.forEach((op) => {
    if (!op || typeof op !== 'object') return;
    if (op.type === 'inline') {
      const fromNode = ensureNode(op.fromNodeId);
      const intoNode = ensureNode(op.intoNodeId);
      if (!fromNode || !intoNode) return;
      const fieldMap = op.fieldMap || {};
      Object.keys(fieldMap).forEach((fromPath) => {
        const toPath = fieldMap[fromPath] || fromPath;
        const value = readPath(fromNode.data || {}, fromPath);
        if (value === undefined) {
          warnings.push(`Inline field "${fromPath}" missing on node "${op.fromNodeId}".`);
          return;
        }
        setPath(intoNode.data || (intoNode.data = {}), toPath, deepClone(value));
        if (op.removeOriginal !== false) {
          deletePath(fromNode.data || {}, fromPath);
          accumPatch(nodeUpdates, op.fromNodeId, { data: fromNode.data });
        }
        accumPatch(nodeUpdates, op.intoNodeId, { data: intoNode.data });
      });
      if (op.deleteSource) {
        deleteQueue.add(op.fromNodeId);
      }
    } else if (op.type === 'extract') {
      const sourceNode = ensureNode(op.sourceNodeId);
      if (!sourceNode) return;
      const newNodeBlueprint = op.newNode || {};
      const newId = ensureUniqueId(new Set(), newNodeBlueprint.id);
      const extracted = {
        id: newId,
        type: newNodeBlueprint.type || sourceNode.type || 'default',
        label: newNodeBlueprint.label || `${sourceNode.label || sourceNode.id} Extract`,
        position: newNodeBlueprint.position || mergePatch({}, sourceNode.position || {}),
        width: newNodeBlueprint.width || sourceNode.width,
        height: newNodeBlueprint.height || sourceNode.height,
        data: mergePatch({}, newNodeBlueprint.data || {}),
        ports: deepClone(newNodeBlueprint.ports || sourceNode.ports),
        inputs: deepClone(newNodeBlueprint.inputs || sourceNode.inputs),
        outputs: deepClone(newNodeBlueprint.outputs || sourceNode.outputs),
        extensions: mergePatch({}, newNodeBlueprint.extensions || {}),
        state: mergePatch({}, newNodeBlueprint.state || {})
      };
      const fields = Array.isArray(op.fields) ? op.fields : [];
      fields.forEach((path) => {
        const value = readPath(sourceNode.data || {}, path);
        if (value === undefined) {
          warnings.push(`Extract field "${path}" missing on node "${op.sourceNodeId}".`);
          return;
        }
        setPath(extracted.data, path, deepClone(value));
        if (op.removeFields !== false) {
          deletePath(sourceNode.data || {}, path);
          accumPatch(nodeUpdates, op.sourceNodeId, { data: sourceNode.data });
        }
      });
      createQueue.push(extracted);
    } else {
      warnings.push(`Unsupported inline/extract operation "${op.type}".`);
    }
  });

  try {
    applyCreates(graphAPI, createQueue, dryRun, summary);
    applyNodeUpdates(graphAPI, nodeUpdates, dryRun, summary);
    applyDeletes(graphAPI, deleteQueue, dryRun, summary);
  } catch (error) {
    return { success: false, data: { errors: [error.message], warnings } };
  }

  summary.warnings = warnings;
  if (policy.warning) {
    summary.manifestWarning = policy.warning;
  }
  return { success: true, data: summary };
};

export const transformationSkills = [
  {
    id: 'transform.refactor',
    title: 'Refactor',
    description: 'Split or merge nodes while preserving semantics.',
    category: 'transform',
    supportsDryRun: true,
    run: runRefactor,
    contracts: {
      inputs: ['split?', 'merge?'],
      forbidden: ['Identity loss without opt-in removal']
    }
  },
  {
    id: 'transform.normalize',
    title: 'Normalize / Denormalize',
    description: 'Shift between compact and expanded representations.',
    category: 'transform',
    supportsDryRun: true,
    run: runNormalize,
    contracts: {
      inputs: ['operations[]'],
      forbidden: ['Dropping data without explicit instruction']
    }
  },
  {
    id: 'transform.typeMigration',
    title: 'Type Migration',
    description: 'Upgrade node types safely.',
    category: 'transform',
    supportsDryRun: true,
    run: runTypeMigration,
    contracts: {
      inputs: ['migrations[]'],
      forbidden: ['Replacing nodes without preserving IDs']
    }
  },
  {
    id: 'transform.schemaUpgrade',
    title: 'Schema Upgrade',
    description: 'Apply schema patches incrementally.',
    category: 'transform',
    supportsDryRun: true,
    run: runSchemaUpgrade,
    contracts: {
      inputs: ['patches[]', 'targetVersion?'],
      forbidden: ['Skipping intermediate versions']
    }
  },
  {
    id: 'transform.inlineExtract',
    title: 'Inline / Extract',
    description: 'Move structure between abstraction layers.',
    category: 'transform',
    supportsDryRun: true,
    run: runInlineExtract,
    contracts: {
      inputs: ['operations[]'],
      forbidden: ['Removing references without replacing them']
    }
  }
];
