import { v4 as uuidv4 } from 'uuid';

const deepClone = (value) => {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const defaultNodes = (graphAPI, fallback = []) =>
  typeof graphAPI?.getNodes === 'function' ? graphAPI.getNodes() : fallback;

const defaultEdges = (graphAPI, fallback = []) =>
  typeof graphAPI?.getEdges === 'function' ? graphAPI.getEdges() : fallback;

const defaultGroups = (graphAPI, fallback = []) =>
  typeof graphAPI?.getGroups === 'function' ? graphAPI.getGroups() : fallback;

const ensureArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const substituteTokens = (input, params = {}) => {
  if (typeof input === 'string') {
    return input.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmed = key.trim();
      return Object.prototype.hasOwnProperty.call(params, trimmed) ? String(params[trimmed]) : _;
    });
  }
  if (Array.isArray(input)) {
    return input.map((item) => substituteTokens(item, params));
  }
  if (input && typeof input === 'object') {
    const clone = {};
    Object.keys(input).forEach((key) => {
      clone[key] = substituteTokens(input[key], params);
    });
    return clone;
  }
  return input;
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

const applyCreates = (graphAPI, nodes, edges, groups, dryRun, summary) => {
  if (nodes.length) {
    if (dryRun) {
      summary.createdNodes = nodes.map((node) => node.id);
    } else {
      const result = graphAPI.createNodes(nodes);
      if (!result?.success) {
        throw new Error(result?.error || 'createNodes failed');
      }
      summary.createdNodes =
        Array.isArray(result?.data?.created) && result.data.created.length
          ? result.data.created.map((node) => node?.id).filter(Boolean)
          : nodes.map((node) => node.id);
    }
  }

  if (edges.length) {
    if (dryRun) {
      summary.createdEdges = edges.map((edge) => edge.id);
    } else {
      const result = graphAPI.createEdges(edges);
      if (!result?.success) {
        throw new Error(result?.error || 'createEdges failed');
      }
      summary.createdEdges =
        Array.isArray(result?.data?.created) && result.data.created.length
          ? result.data.created.map((edge) => edge?.id).filter(Boolean)
          : edges.map((edge) => edge.id);
    }
  }

  if (groups.length && typeof graphAPI?.createGroups === 'function') {
    if (dryRun) {
      summary.createdGroups = groups.map((group) => group.id);
    } else {
      const result = graphAPI.createGroups(groups);
      if (!result?.success) {
        throw new Error(result?.error || 'createGroups failed');
      }
      summary.createdGroups =
        Array.isArray(result?.data?.created) && result.data.created.length
          ? result.data.created.map((group) => group?.id).filter(Boolean)
          : groups.map((group) => group.id);
    }
  }
};

const applyNodeUpdates = (graphAPI, updates, dryRun, summary) => {
  if (!updates.size) return;
  if (!summary.updatedNodes) summary.updatedNodes = [];

  for (const [id, patch] of updates.entries()) {
    if (dryRun) {
      summary.updatedNodes.push(id);
      continue;
    }
    const result = graphAPI.updateNode(id, patch);
    if (!result?.success) {
      throw new Error(result?.error || `Failed to update node ${id}`);
    }
    summary.updatedNodes.push(id);
  }
};

const applyEdgeUpdates = (graphAPI, updates, dryRun, summary) => {
  if (!updates.size) return;
  if (!summary.updatedEdges) summary.updatedEdges = [];

  for (const [id, patch] of updates.entries()) {
    if (dryRun) {
      summary.updatedEdges.push(id);
      continue;
    }
    const result = graphAPI.updateEdge(id, patch);
    if (!result?.success) {
      throw new Error(result?.error || `Failed to update edge ${id}`);
    }
    summary.updatedEdges.push(id);
  }
};

const applyDeletes = (graphAPI, nodeIds, dryRun, summary) => {
  if (!nodeIds.size) return;
  if (!summary.deletedNodes) summary.deletedNodes = [];
  nodeIds.forEach((id) => summary.deletedNodes.push(id));
  if (dryRun) return;
  nodeIds.forEach((id) => {
    const result = graphAPI.deleteNode(id);
    if (!result?.success) {
      throw new Error(result?.error || `Failed to delete node ${id}`);
    }
  });
};

const applyCommandsSequentially = async (graphAPI, commands, dryRun, summary) => {
  for (const command of commands) {
    const action = command?.action;
    switch (action) {
      case 'createNodes': {
        const nodes = Array.isArray(command.nodes) ? command.nodes : [];
        if (!nodes.length) break;
        if (dryRun) {
          if (!summary.createdNodes) summary.createdNodes = [];
          summary.createdNodes.push(...nodes.map((node) => node.id));
        } else {
          const result = graphAPI.createNodes(nodes);
          if (!result?.success) {
            throw new Error(result?.error || 'createNodes failed');
          }
          if (!summary.createdNodes) summary.createdNodes = [];
          summary.createdNodes.push(
            ...(Array.isArray(result?.data?.created) && result.data.created.length
              ? result.data.created.map((node) => node?.id).filter(Boolean)
              : nodes.map((node) => node.id))
          );
        }
        break;
      }
      case 'createEdges': {
        const edges = Array.isArray(command.edges) ? command.edges : [];
        if (!edges.length) break;
        if (dryRun) {
          if (!summary.createdEdges) summary.createdEdges = [];
          summary.createdEdges.push(...edges.map((edge) => edge.id));
        } else {
          const result = graphAPI.createEdges(edges);
          if (!result?.success) {
            throw new Error(result?.error || 'createEdges failed');
          }
          if (!summary.createdEdges) summary.createdEdges = [];
          summary.createdEdges.push(
            ...(Array.isArray(result?.data?.created) && result.data.created.length
              ? result.data.created.map((edge) => edge?.id).filter(Boolean)
              : edges.map((edge) => edge.id))
          );
        }
        break;
      }
      case 'updateNode': {
        if (!command.id || !command.updates) break;
        if (dryRun) {
          if (!summary.updatedNodes) summary.updatedNodes = [];
          summary.updatedNodes.push(command.id);
        } else {
          const result = graphAPI.updateNode(command.id, command.updates);
          if (!result?.success) {
            throw new Error(result?.error || `Failed to update node ${command.id}`);
          }
          if (!summary.updatedNodes) summary.updatedNodes = [];
          summary.updatedNodes.push(command.id);
        }
        break;
      }
      case 'updateNodes': {
        const ids = Array.isArray(command.ids) ? command.ids : [];
        if (!ids.length || !command.updates) break;
        if (dryRun) {
          if (!summary.updatedNodes) summary.updatedNodes = [];
          summary.updatedNodes.push(...ids);
        } else {
          const result = graphAPI.updateNodes(ids, command.updates);
          if (!result?.success) {
            throw new Error(result?.error || 'updateNodes failed');
          }
          if (!summary.updatedNodes) summary.updatedNodes = [];
          summary.updatedNodes.push(...ids);
        }
        break;
      }
      case 'updateEdge': {
        if (!command.id || !command.updates) break;
        if (dryRun) {
          if (!summary.updatedEdges) summary.updatedEdges = [];
          summary.updatedEdges.push(command.id);
        } else {
          const result = graphAPI.updateEdge(command.id, command.updates);
          if (!result?.success) {
            throw new Error(result?.error || `Failed to update edge ${command.id}`);
          }
          if (!summary.updatedEdges) summary.updatedEdges = [];
          summary.updatedEdges.push(command.id);
        }
        break;
      }
      case 'updateEdges': {
        const ids = Array.isArray(command.ids) ? command.ids : [];
        if (!ids.length || !command.updates) break;
        if (dryRun) {
          if (!summary.updatedEdges) summary.updatedEdges = [];
          summary.updatedEdges.push(...ids);
        } else {
          const result = graphAPI.updateEdges(ids, command.updates);
          if (!result?.success) {
            throw new Error(result?.error || 'updateEdges failed');
          }
          if (!summary.updatedEdges) summary.updatedEdges = [];
          summary.updatedEdges.push(...ids);
        }
        break;
      }
      case 'delete': {
        if (command.type !== 'node') {
          throw new Error('Automation batch only supports node deletion (edge/group deletion should use dedicated commands).');
        }
        const targets = Array.isArray(command.ids) ? command.ids : command.id ? [command.id] : [];
        if (!targets.length) break;
        targets.forEach((id) => {
          if (dryRun) {
            if (!summary.deletedNodes) summary.deletedNodes = [];
            summary.deletedNodes.push(id);
          } else {
            const result = graphAPI.deleteNode(id);
            if (!result?.success) {
              throw new Error(result?.error || `Failed to delete node ${id}`);
            }
            if (!summary.deletedNodes) summary.deletedNodes = [];
            summary.deletedNodes.push(id);
          }
        });
        break;
      }
      case 'translate':
      case 'move': {
        const ids = Array.isArray(command.ids) ? command.ids : command.id ? [command.id] : [];
        if (!ids.length) break;
        const delta = command.delta || command.offset || { x: command.dx, y: command.dy };
        if (dryRun) {
          if (!summary.translatedNodes) summary.translatedNodes = [];
          summary.translatedNodes.push({ ids, delta });
        } else {
          const result = graphAPI.translateNodes(ids, delta || {});
          if (!result?.success) {
            throw new Error(result?.error || 'translateNodes failed');
          }
          if (!summary.translatedNodes) summary.translatedNodes = [];
          summary.translatedNodes.push({ ids, delta });
        }
        break;
      }
      case 'addNodesToGroup':
      case 'removeNodesFromGroup':
      case 'setGroupNodes': {
        if (typeof graphAPI?.[action] !== 'function') {
          throw new Error(`Graph API does not support ${action}.`);
        }
        const groupId = command.groupId || command.id;
        const nodeIds = ensureArray(command.nodeIds);
        if (!groupId || !nodeIds.length) break;
        if (dryRun) {
          if (!summary.groupMutations) summary.groupMutations = [];
          summary.groupMutations.push({ action, groupId, nodeIds });
        } else {
          const result = graphAPI[action](groupId, nodeIds);
          if (!result?.success) {
            throw new Error(result?.error || `${action} failed`);
          }
          if (!summary.groupMutations) summary.groupMutations = [];
          summary.groupMutations.push({ action, groupId, nodeIds });
        }
        break;
      }
      default:
        throw new Error(`Unsupported automation command: ${action}`);
    }
  }
};

const runScriptExecution = async (_ctx, params = {}) => {
  const script = params.script || params.source || '';
  if (!script || typeof script !== 'string') {
    return { success: false, data: { errors: ['Script text is required'] } };
  }
  if (params.dryRun) {
    const available = typeof window !== 'undefined' && window.__scriptRunner;
    return {
      success: available ? true : false,
      data: {
        available,
        message: available ? 'Script runner available' : 'Script runner not initialized'
      }
    };
  }
  if (typeof window === 'undefined' || !window.__scriptRunner) {
    return {
      success: false,
      data: { errors: ['Script runner unavailable in this environment'] }
    };
  }
  try {
    const meta = params.meta && typeof params.meta === 'object' ? params.meta : {};
    const runner = window.__scriptRunner;
    const result = await runner.run(script, meta);
    return {
      success: result?.success !== false,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      data: { errors: [error?.message || 'Script execution failed'] }
    };
  }
};

const runBatchMutation = async ({ graphAPI }, params = {}) => {
  const commands = Array.isArray(params.commands) ? params.commands : [];
  if (!commands.length) {
    return { success: false, data: { errors: ['commands array is required'] } };
  }
  const dryRun = params.dryRun === true;
  const summary = {};
  try {
    await applyCommandsSequentially(graphAPI, commands, dryRun, summary);
    return { success: true, data: summary };
  } catch (error) {
    return {
      success: false,
      data: { errors: [error?.message || 'Batch mutation failed'], summary }
    };
  }
};

const runProceduralGeneration = ({ graphAPI }, params = {}) => {
  const blueprint = params.blueprint || {};
  const nodesTemplate = Array.isArray(blueprint.nodes) ? blueprint.nodes : [];
  const edgesTemplate = Array.isArray(blueprint.edges) ? blueprint.edges : [];
  const groupsTemplate = Array.isArray(blueprint.groups) ? blueprint.groups : [];
  if (!nodesTemplate.length && !edgesTemplate.length && !groupsTemplate.length) {
    return { success: false, data: { errors: ['Blueprint must include nodes, edges, or groups'] } };
  }

  const iterations = Math.max(1, Number(params.count || blueprint.count || 1));
  const baseParams = { ...(params.parameters || blueprint.parameters || {}) };
  const dryRun = params.dryRun === true;
  const existingNodes = defaultNodes(graphAPI);
  const existingEdges = defaultEdges(graphAPI);
  const existingNodeIds = new Set(existingNodes.map((node) => node.id));
  const existingEdgeIds = new Set(existingEdges.map((edge) => edge.id));
  const existingGroupIds = new Set(
    defaultGroups(graphAPI)
      .map((group) => group.id)
      .filter(Boolean)
  );

  const createdNodes = [];
  const createdEdges = [];
  const createdGroups = [];

  for (let index = 0; index < iterations; index += 1) {
    const iterationParams = {
      ...baseParams,
      index,
      iteration: index,
      count: iterations
    };
    const idMapping = new Map();

    nodesTemplate.forEach((template, nodeIndex) => {
      const rawId = template?.id || `node_${nodeIndex}`;
      const substituted = substituteTokens(template, iterationParams);
      const nodeId = ensureUniqueId(existingNodeIds, substituted.id || rawId);
      existingNodeIds.add(nodeId);
      idMapping.set(rawId, nodeId);
      createdNodes.push({
        ...deepClone(substituted),
        id: nodeId
      });
    });

    edgesTemplate.forEach((template, edgeIndex) => {
      const rawId = template?.id || `edge_${edgeIndex}`;
      const substituted = substituteTokens(template, iterationParams);
      const sourceRaw = substituted.source || template.source;
      const targetRaw = substituted.target || template.target;
      const source = idMapping.get(sourceRaw) || sourceRaw;
      const target = idMapping.get(targetRaw) || targetRaw;
      const edgeId = ensureUniqueId(existingEdgeIds, substituted.id || rawId);
      existingEdgeIds.add(edgeId);
      createdEdges.push({
        ...deepClone(substituted),
        id: edgeId,
        source,
        target
      });
    });

    groupsTemplate.forEach((template, groupIndex) => {
      const rawId = template?.id || `group_${groupIndex}`;
      const substituted = substituteTokens(template, iterationParams);
      const groupId = ensureUniqueId(existingGroupIds, substituted.id || rawId);
      existingGroupIds.add(groupId);
      const nodeIds = Array.isArray(substituted.nodeIds)
        ? substituted.nodeIds.map((id) => idMapping.get(id) || id)
        : [];
      createdGroups.push({
        ...deepClone(substituted),
        id: groupId,
        nodeIds
      });
    });
  }

  const summary = {};
  try {
    applyCreates(graphAPI, createdNodes, createdEdges, createdGroups, dryRun, summary);
    return { success: true, data: summary };
  } catch (error) {
    return {
      success: false,
      data: { errors: [error?.message || 'Procedural generation failed'], summary }
    };
  }
};

const runSimulationStep = async ({ graphAPI }, params = {}) => {
  const mutations = Array.isArray(params.mutations) ? params.mutations : [];
  if (!mutations.length) {
    return { success: false, data: { errors: ['mutations array is required'] } };
  }
  const dryRun = params.dryRun === true;
  const recordPrevious = params.recordPrevious !== false;
  const nodes = defaultNodes(graphAPI);
  const nodeMap = new Map(nodes.map((node) => [node.id, deepClone(node)]));
  const beforeState = {};
  const touchedNodes = new Set();
  mutations.forEach((command) => {
    const action = command?.action;
    if (action === 'updateNode' && command.id) {
      touchedNodes.add(command.id);
    }
    if (action === 'updateNodes' && Array.isArray(command.ids)) {
      command.ids.forEach((id) => touchedNodes.add(id));
    }
    if (action === 'delete' && Array.isArray(command.ids)) {
      command.ids.forEach((id) => touchedNodes.add(id));
    }
  });
  if (recordPrevious) {
    touchedNodes.forEach((id) => {
      if (nodeMap.has(id)) {
        beforeState[id] = deepClone(nodeMap.get(id));
      }
    });
  }
  const summary = recordPrevious ? { before: beforeState } : {};
  try {
    await applyCommandsSequentially(graphAPI, mutations, dryRun, summary);
    if (!dryRun) {
      const afterNodes = defaultNodes(graphAPI);
      const afterMap = {};
      touchedNodes.forEach((id) => {
        const next = afterNodes.find((node) => node.id === id);
        if (next) afterMap[id] = deepClone(next);
      });
      summary.after = afterMap;
    }
    summary.stepId = params.stepId || null;
    return { success: true, data: summary };
  } catch (error) {
    return {
      success: false,
      data: { errors: [error?.message || 'Simulation step failed'], summary }
    };
  }
};

const runCompileArtifact = ({ graphAPI }, params = {}) => {
  const format = (params.format || 'json').toLowerCase();
  const nodes = defaultNodes(graphAPI);
  const edges = defaultEdges(graphAPI);
  const groups = defaultGroups(graphAPI);
  const manifest = params.manifest || {};
  let artifact;
  switch (format) {
    case 'markdown': {
      const lines = [];
      lines.push(`# Graph Artifact: ${manifest.title || 'Untitled'}`);
      lines.push('');
      lines.push(`- Nodes: ${nodes.length}`);
      lines.push(`- Edges: ${edges.length}`);
      lines.push(`- Groups: ${groups.length}`);
      lines.push('');
      lines.push('## Nodes');
      nodes.forEach((node) => {
      lines.push(`- **${node.label || node.id}** (${node.id}) - type: ${node.type || 'default'}`);
      });
      lines.push('');
      lines.push('## Edges');
      edges.forEach((edge) => {
        lines.push(`- ${edge.id}: ${edge.source} -> ${edge.target} (${edge.type || 'child'})`);
      });
      artifact = lines.join('\n');
      break;
    }
    case 'csv': {
      const header = 'id,label,type,x,y,width,height';
      const rows = nodes.map((node) => {
        const pos = node.position || {};
        return [
          node.id,
          JSON.stringify(node.label || ''),
          node.type || 'default',
          pos.x ?? '',
          pos.y ?? '',
          node.width ?? '',
          node.height ?? ''
        ].join(',');
      });
      artifact = [header, ...rows].join('\n');
      break;
    }
    case 'json':
    default: {
      artifact = JSON.stringify(
        {
          manifest,
          nodes,
          edges,
          groups,
          generatedAt: new Date().toISOString()
        },
        null,
        params.pretty === false ? 0 : 2
      );
      break;
    }
  }
  return {
    success: true,
    data: {
      artifact,
      format,
      manifest
    }
  };
};

const runImportExport = ({ graphAPI }, params = {}) => {
  const direction = (params.direction || params.mode || '').toLowerCase();
  const dryRun = params.dryRun === true;
  if (direction === 'export') {
    const nodes = defaultNodes(graphAPI);
    const edges = defaultEdges(graphAPI);
    const groups = defaultGroups(graphAPI);
    const nodeFilterIds = ensureArray(params.nodeIds);
    const filteredNodes = nodeFilterIds.length
      ? nodes.filter((node) => nodeFilterIds.includes(node.id))
      : nodes;
    const nodeSet = new Set(filteredNodes.map((node) => node.id));
    const filteredEdges = edges.filter(
      (edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target)
    );
    const filteredGroups = groups.filter(
      (group) => !group.nodeIds || group.nodeIds.every((id) => nodeSet.has(id))
    );
    const payload = {
      manifest: params.manifest || {},
      nodes: filteredNodes,
      edges: filteredEdges,
      groups: filteredGroups,
      exportedAt: new Date().toISOString()
    };
    if (params.as === 'string' || params.format === 'string') {
      return { success: true, data: JSON.stringify(payload, null, params.pretty === false ? 0 : 2) };
    }
    return { success: true, data: payload };
  }

  if (direction === 'import') {
    let payload = params.payload || params.data || null;
    if (!payload && typeof params.source === 'string') {
      try {
        payload = JSON.parse(params.source);
      } catch (err) {
        return { success: false, data: { errors: ['Failed to parse import source', err?.message] } };
      }
    }
    if (!payload || typeof payload !== 'object') {
      return { success: false, data: { errors: ['Import payload is required'] } };
    }
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];
    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    if (!nodes.length && !edges.length && !groups.length) {
      return { success: false, data: { errors: ['Import payload is empty'] } };
    }
    const existingNodes = defaultNodes(graphAPI);
    const existingEdges = defaultEdges(graphAPI);
    const existingGroups = defaultGroups(graphAPI);
    const existingNodeIds = new Set(existingNodes.map((node) => node.id));
    const existingEdgeIds = new Set(existingEdges.map((edge) => edge.id));
    const existingGroupIds = new Set(existingGroups.map((group) => group.id));
    const nodeIdMap = new Map();
    const finalNodes = nodes.map((node) => {
      const newId = ensureUniqueId(existingNodeIds, node.id);
      nodeIdMap.set(node.id, newId);
      return {
        ...deepClone(node),
        id: newId
      };
    });
    const finalEdges = edges.map((edge) => {
      const newId = ensureUniqueId(existingEdgeIds, edge.id);
      const source = nodeIdMap.get(edge.source) || edge.source;
      const target = nodeIdMap.get(edge.target) || edge.target;
      return {
        ...deepClone(edge),
        id: newId,
        source,
        target
      };
    });
    const finalGroups = groups.map((group) => {
      const newId = ensureUniqueId(existingGroupIds, group.id);
      return {
        ...deepClone(group),
        id: newId,
        nodeIds: Array.isArray(group.nodeIds)
          ? group.nodeIds.map((id) => nodeIdMap.get(id) || id)
          : []
      };
    });
    const summary = {};
    try {
      applyCreates(graphAPI, finalNodes, finalEdges, finalGroups, dryRun, summary);
      summary.nodeIdMap = Object.fromEntries(nodeIdMap.entries());
      return { success: true, data: summary };
    } catch (error) {
      return {
        success: false,
        data: { errors: [error?.message || 'Import failed'], summary }
      };
    }
  }

  return { success: false, data: { errors: ['direction must be "import" or "export"'] } };
};

export const automationSkills = [
  {
    id: 'automation.scriptExecution',
    title: 'Script Execution',
    description: 'Run ScriptNodes or ad-hoc scripts in a sandbox.',
    category: 'automation',
    supportsDryRun: true,
    run: runScriptExecution,
    contracts: {
      inputs: ['script', 'meta?'],
      forbidden: ['Running without sandbox availability']
    }
  },
  {
    id: 'automation.batchMutation',
    title: 'Batch Mutation',
    description: 'Apply a list of graph mutations atomically.',
    category: 'automation',
    supportsDryRun: true,
    run: runBatchMutation,
    contracts: {
      inputs: ['commands[]'],
      forbidden: ['clearGraph', 'replace']
    }
  },
  {
    id: 'automation.proceduralGeneration',
    title: 'Procedural Generation',
    description: 'Generate graph structures from parameterized blueprints.',
    category: 'automation',
    supportsDryRun: true,
    run: runProceduralGeneration,
    contracts: {
      inputs: ['blueprint', 'count?'],
      forbidden: ['Overwriting existing IDs without remapping']
    }
  },
  {
    id: 'automation.simulationStep',
    title: 'Simulation Step',
    description: 'Advance the graph via a reversible mutation bundle.',
    category: 'automation',
    supportsDryRun: true,
    run: runSimulationStep,
    contracts: {
      inputs: ['mutations[]'],
      forbidden: ['Destructive resets without backup']
    }
  },
  {
    id: 'automation.compileArtifact',
    title: 'Compile Graph -> Artifact',
    description: 'Compile the current graph into an external artifact.',
    category: 'automation',
    supportsDryRun: true,
    run: runCompileArtifact,
    contracts: {
      inputs: ['format?', 'manifest?'],
      forbidden: ['Using UI-only state as data']
    }
  },
  {
    id: 'automation.importExport',
    title: 'Import / Export',
    description: 'Move graph data between systems with continuity safeguards.',
    category: 'automation',
    supportsDryRun: true,
    run: runImportExport,
    contracts: {
      inputs: ['direction', 'payload?'],
      forbidden: ['Snapshot replacement of live graphs']
    }
  }
];
