import { validateNodes, validateEdges, validateGroups } from '../../components/GraphEditor/handlers/validation.js';

const WILDCARD_TYPES = new Set(['value', 'any', 'trigger', 'input', 'output', 'bidirectional']);

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const defaultNodes = (graphAPI, fallback = []) =>
  typeof graphAPI?.getNodes === 'function' ? graphAPI.getNodes() : fallback;

const defaultEdges = (graphAPI, fallback = []) =>
  typeof graphAPI?.getEdges === 'function' ? graphAPI.getEdges() : fallback;

const defaultGroups = (graphAPI, fallback = []) =>
  typeof graphAPI?.getGroups === 'function' ? graphAPI.getGroups() : fallback;

const buildHandleIndex = (node) => {
  const map = new Map();
  const add = (id, meta) => {
    if (!id) return;
    map.set(id, {
      id,
      direction: meta.direction || 'output',
      dataType: meta.dataType || meta.type || 'value'
    });
  };

  if (Array.isArray(node?.handles)) {
    node.handles.forEach((handle) => {
      if (!handle) return;
      add(handle.id || handle.key, handle);
    });
  }

  if (Array.isArray(node?.inputs)) {
    node.inputs.forEach((handle) => {
      if (!handle) return;
      add(handle.key || handle.id, { ...handle, direction: 'input' });
    });
  }

  if (Array.isArray(node?.outputs)) {
    node.outputs.forEach((handle) => {
      if (!handle) return;
      add(handle.key || handle.id, { ...handle, direction: 'output' });
    });
  }

  return map;
};

const isStrictType = (type) => {
  if (!type) return false;
  const normalized = String(type).toLowerCase();
  return !WILDCARD_TYPES.has(normalized);
};

const findHandleMeta = (node, handleId) => {
  if (!handleId || !node) return null;
  const index = buildHandleIndex(node);
  return index.get(handleId) || null;
};

const collectEdgesByNode = (edges = []) => {
  const map = new Map();
  edges.forEach((edge) => {
    if (!edge) return;
    if (edge.source) {
      if (!map.has(edge.source)) map.set(edge.source, { out: 0, in: 0 });
      map.get(edge.source).out += 1;
    }
    if (edge.target) {
      if (!map.has(edge.target)) map.set(edge.target, { out: 0, in: 0 });
      map.get(edge.target).in += 1;
    }
  });
  return map;
};

const runSchemaValidation = ({ graphAPI }, params = {}) => {
  const nodes = params.nodes || defaultNodes(graphAPI);
  const edges = params.edges || defaultEdges(graphAPI);
  const groups = params.groups || defaultGroups(graphAPI);

  const nodeResult = validateNodes(nodes);
  const edgeResult = validateEdges(edges, nodeResult.valid);
  const groupResult = validateGroups(groups);

  const errors = [
    ...nodeResult.errors,
    ...edgeResult.errors,
    ...groupResult.errors
  ];

  const warnings = [
    ...(nodeResult.warnings || []),
    ...(edgeResult.warnings || []),
    ...(groupResult.warnings || [])
  ];

  return {
    success: errors.length === 0,
    data: {
      nodeErrors: nodeResult.errors,
      edgeErrors: edgeResult.errors,
      groupErrors: groupResult.errors,
      warnings
    }
  };
};

const runHandleValidation = ({ graphAPI }, params = {}) => {
  const nodes = params.nodes || defaultNodes(graphAPI);
  const edges = params.edges || defaultEdges(graphAPI);

  const nodeMap = new Map(nodes.map((node) => [node?.id, node]));

  const errors = [];
  const warnings = [];

  edges.forEach((edge) => {
    if (!edge || !edge.id) return;
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      errors.push({
        edgeId: edge.id,
        code: 'MISSING_NODE',
        message: `Edge references missing node (source ${edge.source} or target ${edge.target}).`
      });
      return;
    }

    const sourceHandle = edge.sourceHandle
      ? findHandleMeta(sourceNode, edge.sourceHandle)
      : null;
    const targetHandle = edge.targetHandle
      ? findHandleMeta(targetNode, edge.targetHandle)
      : null;

    if (edge.sourceHandle && !sourceHandle) {
      errors.push({
        edgeId: edge.id,
        nodeId: sourceNode.id,
        code: 'MISSING_HANDLE',
        message: `Source handle "${edge.sourceHandle}" not found on node "${sourceNode.id}".`
      });
    }

    if (edge.targetHandle && !targetHandle) {
      errors.push({
        edgeId: edge.id,
        nodeId: targetNode.id,
        code: 'MISSING_HANDLE',
        message: `Target handle "${edge.targetHandle}" not found on node "${targetNode.id}".`
      });
    }

    if (sourceHandle && targetHandle) {
      const sourceType = sourceHandle.dataType;
      const targetType = targetHandle.dataType;
      if (isStrictType(sourceType) && isStrictType(targetType) && sourceType !== targetType) {
        errors.push({
          edgeId: edge.id,
          code: 'TYPE_MISMATCH',
        message: `Handle type mismatch (${sourceType} -> ${targetType}).`
        });
      }
    }

    if (!edge.sourceHandle) {
      const outputs = buildHandleIndex(sourceNode);
      if (outputs.size > 1) {
        warnings.push({
          edgeId: edge.id,
          code: 'AMBIGUOUS_SOURCE_HANDLE',
          message: `Edge omits source handle but node "${sourceNode.id}" exposes multiple outputs.`
        });
      }
    }

    if (!edge.targetHandle) {
      const inputs = buildHandleIndex(targetNode);
      if (inputs.size > 1) {
        warnings.push({
          edgeId: edge.id,
          code: 'AMBIGUOUS_TARGET_HANDLE',
          message: `Edge omits target handle but node "${targetNode.id}" exposes multiple inputs.`
        });
      }
    }
  });

  return {
    success: errors.length === 0,
    data: { errors, warnings }
  };
};

const runDependencyValidation = ({ graphAPI }, params = {}) => {
  const nodes = params.nodes || defaultNodes(graphAPI);
  const availableSkillIds =
    params.availableSkills ||
    (typeof graphAPI?.listSkills === 'function'
      ? graphAPI.listSkills().map((skill) => skill.id)
      : []);

  const requiredNodeTypes = toArray(
    params.requiredNodeTypes ||
      params.dependencies?.nodeTypes ||
      params.manifest?.requiredNodeTypes
  );
  const requiredSkills = toArray(
    params.requiredSkills ||
      params.dependencies?.skills ||
      params.manifest?.requiredSkills
  );
  const requiredDefinitions = toArray(
    params.requiredDefinitions ||
      params.dependencies?.definitions ||
      params.manifest?.requiredDefinitions
  );

  const missingNodeTypes = requiredNodeTypes.filter(
    (type) => !nodes.some((node) => node?.type === type)
  );

  const missingSkills = requiredSkills.filter(
    (skill) => !availableSkillIds.includes(skill)
  );

  const missingDefinitions = requiredDefinitions.filter((defId) =>
    params.availableDefinitions
      ? !params.availableDefinitions.includes(defId)
      : false
  );

  const warnings = [];

  if (requiredDefinitions.length && !params.availableDefinitions) {
    warnings.push({
      code: 'DEFINITION_CHECK_SKIPPED',
      message: 'Definitions list not provided; cannot confirm definition dependencies.'
    });
  }

  const success =
    missingNodeTypes.length === 0 &&
    missingSkills.length === 0 &&
    missingDefinitions.length === 0;

  return {
    success,
    data: {
      missingNodeTypes,
      missingSkills,
      missingDefinitions,
      warnings
    }
  };
};

const runOrphanDetection = ({ graphAPI }, params = {}) => {
  const nodes = params.nodes || defaultNodes(graphAPI);
  const edges = params.edges || defaultEdges(graphAPI);
  const groups = params.groups || defaultGroups(graphAPI);

  const allowances = new Set(toArray(params.allowedNodeIds));
  const edgeCounts = collectEdgesByNode(edges);
  const groupMembership = new Set();
  groups.forEach((group) => {
    if (!group || !Array.isArray(group.nodeIds)) return;
    group.nodeIds.forEach((id) => groupMembership.add(id));
  });

  const orphans = nodes.filter((node) => {
    if (!node || allowances.has(node.id)) return false;
    const counts = edgeCounts.get(node.id) || { in: 0, out: 0 };
    const hasEdges = (counts.in || 0) + (counts.out || 0) > 0;
    if (hasEdges) return false;
    if (groupMembership.has(node.id)) return false;
    if (params.includeScratchpads === false && node?.extensions?.scratchpad) {
      return false;
    }
    return true;
  });

  return {
    success: orphans.length === 0,
    data: { orphans }
  };
};

const runUnsafeMutationDetection = (_ctx, params = {}) => {
  const commands = params.commands
    ? Array.isArray(params.commands)
      ? params.commands
      : [params.commands]
    : [];

  if (commands.length === 0) {
    return {
      success: false,
      data: { issues: ['No commands provided for analysis'] }
    };
  }

  const replacePatterns = [];
  const deletedIds = new Set();
  const createdIds = new Set();
  let clearGraphRequested = false;

  const flatCommands = [];
  const flatten = (command) => {
    if (!command) return;
    if (command.action === 'batch' || command.action === 'transaction') {
      const nested = Array.isArray(command.commands) ? command.commands : [];
      nested.forEach(flatten);
      return;
    }
    flatCommands.push(command);
  };
  commands.forEach(flatten);

  flatCommands.forEach((command) => {
    const action = command.action || null;

    if (!action && command.type === 'nodegraph-data') {
      replacePatterns.push('Direct nodegraph-data payload detected');
    }

    if (action === 'replace') {
      replacePatterns.push('Explicit replace action requested');
    }

    if (action === 'clearGraph') {
      clearGraphRequested = true;
    }

    if (action === 'createNodes' || action === 'create') {
      const list = Array.isArray(command.nodes)
        ? command.nodes
        : command.node
        ? [command.node]
        : [];
      list.forEach((node) => {
        if (node?.id) createdIds.add(node.id);
      });
    }

    if (action === 'delete') {
      const list = Array.isArray(command.ids)
        ? command.ids
        : command.id
        ? [command.id]
        : [];
      list.forEach((id) => {
        if (typeof id === 'string') deletedIds.add(id);
      });
    }
  });

  const deleteAndRecreate = Array.from(deletedIds).filter((id) =>
    createdIds.has(id)
  );

  const massDeleteThreshold =
    typeof params.massDeleteThreshold === 'number'
      ? params.massDeleteThreshold
      : 10;

  const massDeletion = deletedIds.size > massDeleteThreshold;

  const issues = [];
  if (replacePatterns.length) {
    issues.push(...replacePatterns);
  }
  if (deleteAndRecreate.length) {
    issues.push(
      `Delete + recreate pattern detected for ids: ${deleteAndRecreate.join(', ')}`
    );
  }
  if (massDeletion) {
    issues.push(
      `High-risk delete command affecting ${deletedIds.size} ids (threshold ${massDeleteThreshold}).`
    );
  }
  if (clearGraphRequested) {
    issues.push('clearGraph action requested');
  }

  return {
    success: issues.length === 0,
    data: { issues, analyzedCommands: flatCommands.length }
  };
};

export const validationSkills = [
  {
    id: 'validation.schema',
    title: 'Schema Validation',
    description: 'Validate nodes, edges, and groups against structural contracts.',
    category: 'validation',
    supportsDryRun: true,
    run: runSchemaValidation,
    contracts: {
      inputs: ['nodes?', 'edges?', 'groups?'],
      outputs: ['nodeErrors[]', 'edgeErrors[]', 'groupErrors[]']
    }
  },
  {
    id: 'validation.handles',
    title: 'Handle Compatibility Checks',
    description: 'Ensure edge handles exist and match declared semantics.',
    category: 'validation',
    supportsDryRun: true,
    run: runHandleValidation,
    contracts: {
      inputs: ['edges[]'],
      forbidden: ['Implicit handle creation']
    }
  },
  {
    id: 'validation.dependencies',
    title: 'Missing Dependency Detection',
    description: 'Verify required node types, skills, and definitions are present.',
    category: 'validation',
    supportsDryRun: true,
    run: runDependencyValidation,
    contracts: {
      inputs: ['requiredNodeTypes[]?', 'requiredSkills[]?'],
      outputs: ['missingNodeTypes[]', 'missingSkills[]']
    }
  },
  {
    id: 'validation.orphans',
    title: 'Orphan Detection',
    description: 'Identify disconnected nodes and unreachable subgraphs.',
    category: 'validation',
    supportsDryRun: true,
    run: runOrphanDetection,
    contracts: {
      inputs: ['nodeIds?'],
      forbidden: ['Automatic deletion of orphaned nodes']
    }
  },
  {
    id: 'validation.unsafeMutation',
    title: 'Unsafe Mutation Detection',
    description: 'Analyse proposed commands for dangerous mutation patterns.',
    category: 'validation',
    supportsDryRun: true,
    run: runUnsafeMutationDetection,
    contracts: {
      inputs: ['commands[]'],
      forbidden: ['Implicit graph replacement']
    }
  }
];
