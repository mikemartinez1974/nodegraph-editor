import eventBus from '../../NodeGraph/eventBus';

const HANDLE_IMPORT_HINT = 'Handles are optional; when provided they must match each node\'s handle schema.';
const maybeAugmentHandleError = (message) => {
  if (message && typeof message === 'string' && /handle/i.test(message)) {
    return `${message} (${HANDLE_IMPORT_HINT})`;
  }
  return message;
};

/**
 * Execute CRUD commands from pasted JSON
 * Supported actions: create, update, delete, read, createNodes, createEdges, createGroups,
 * addNodesToGroup, removeNodesFromGroup, setGroupNodes, clearGraph, findNodes, findEdges,
 * getStats, translate, duplicate, batch, skill
 */
const estimateCrudImpact = (command = {}) => {
  const { action } = command;
  if (!action) return { nodes: 0, edges: 0, groups: 0 };
  switch (action) {
    case 'create': {
      const nodes = Array.isArray(command.nodes) ? command.nodes : (command.node ? [command.node] : []);
      const edges = Array.isArray(command.edges) ? command.edges : (command.edge ? [command.edge] : []);
      const groups = Array.isArray(command.groups) ? command.groups : (command.group ? [command.group] : []);
      return { nodes: nodes.length, edges: edges.length, groups: groups.length };
    }
    case 'createNodes':
      return { nodes: Array.isArray(command.nodes) ? command.nodes.length : 0, edges: 0, groups: 0 };
    case 'createEdges':
      return { nodes: 0, edges: Array.isArray(command.edges) ? command.edges.length : 0, groups: 0 };
    case 'createGroups':
      return { nodes: 0, edges: 0, groups: Array.isArray(command.groups) ? command.groups.length : 0 };
    case 'update':
    case 'delete':
    case 'translate':
    case 'duplicate': {
      const count = Array.isArray(command.ids) ? command.ids.length : command.id ? 1 : 0;
      if (command.type === 'edge') return { nodes: 0, edges: count, groups: 0 };
      if (command.type === 'group') return { nodes: 0, edges: 0, groups: count };
      return { nodes: count, edges: 0, groups: 0 };
    }
    case 'skill':
      return { nodes: 0, edges: 0, groups: 0 };
    case 'batch':
    case 'transaction': {
      const commands = Array.isArray(command.commands) ? command.commands : [];
      return commands.reduce(
        (acc, entry) => {
          const result = estimateCrudImpact(entry || {});
          return {
            nodes: acc.nodes + (result.nodes || 0),
            edges: acc.edges + (result.edges || 0),
            groups: acc.groups + (result.groups || 0)
          };
        },
        { nodes: 0, edges: 0, groups: 0 }
      );
    }
    default:
      return { nodes: 0, edges: 0, groups: 0 };
  }
};

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isColorString = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (typeof CSS !== 'undefined' && CSS.supports) {
    return CSS.supports('color', trimmed);
  }
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed);
};

const validateThemeSection = (section, keys, path, errors) => {
  if (section === undefined || section === null) return;
  if (!isPlainObject(section)) {
    errors.push(`${path} must be an object`);
    return;
  }
  keys.forEach((key) => {
    if (section[key] === undefined) return;
    if (!isColorString(section[key])) {
      errors.push(`${path}.${key} must be a valid color`);
    }
  });
};

const validateThemePasteCommand = (command = {}) => {
  const errors = [];
  if (!command || command.action !== 'setTheme') {
    return { valid: false, errors: ['Action must be setTheme'] };
  }

  const theme = command.theme;
  const defaultNodeColor = command.defaultNodeColor;
  const defaultEdgeColor = command.defaultEdgeColor;

  if (theme === undefined && defaultNodeColor === undefined && defaultEdgeColor === undefined) {
    errors.push('Theme payload must include theme and/or defaultNodeColor/defaultEdgeColor');
  }

  if (theme !== undefined) {
    if (!isPlainObject(theme)) {
      errors.push('theme must be an object');
    } else {
      if (theme.mode !== undefined && theme.mode !== 'light' && theme.mode !== 'dark') {
        errors.push('theme.mode must be light or dark');
      }
      validateThemeSection(theme.primary, ['main', 'light', 'dark', 'contrastText'], 'theme.primary', errors);
      validateThemeSection(theme.secondary, ['main', 'light', 'dark', 'contrastText'], 'theme.secondary', errors);
      validateThemeSection(theme.background, ['default', 'paper'], 'theme.background', errors);
      validateThemeSection(theme.text, ['primary', 'secondary'], 'theme.text', errors);
      if (theme.divider !== undefined && !isColorString(theme.divider)) {
        errors.push('theme.divider must be a valid color');
      }
    }
  }

  if (defaultNodeColor !== undefined && !isColorString(defaultNodeColor)) {
    errors.push('defaultNodeColor must be a valid color');
  }
  if (defaultEdgeColor !== undefined && !isColorString(defaultEdgeColor)) {
    errors.push('defaultEdgeColor must be a valid color');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    normalized: {
      action: 'setTheme',
      theme: theme || null,
      defaultNodeColor: defaultNodeColor || null,
      defaultEdgeColor: defaultEdgeColor || null
    }
  };
};
async function executeCRUDCommand(command, graphCRUD, onShowMessage) {
  try {
    const { action } = command;
    const positionsOmitted = (nodes = []) => {
      if (!Array.isArray(nodes) || nodes.length === 0) return false;
      return nodes.every((node) => node && !Object.prototype.hasOwnProperty.call(node, 'position'));
    };

    if (command.dryRun === true) {
      const estimate = estimateCrudImpact(command);
      if (onShowMessage) {
        onShowMessage(`Dry run: ${action} would affect ${estimate.nodes} nodes, ${estimate.edges} edges, ${estimate.groups} clusters`, 'info');
      }
      return { ...estimate, dryRun: true };
    }

    // Handle combined create (nodes + edges + groups) in one command
    if (action === 'create') {
      const nodes = Array.isArray(command.nodes) ? command.nodes : (command.node ? [command.node] : []);
      const edges = Array.isArray(command.edges) ? command.edges : (command.edge ? [command.edge] : []);
      const groups = Array.isArray(command.groups) ? command.groups : (command.group ? [command.group] : []);
      const shouldAutoLayout = positionsOmitted(nodes);

      let createdNodes = 0;
      let createdEdges = 0;
      let createdGroups = 0;
      let createdNodeIds = [];

      // Create nodes first (if any)
      if (nodes.length > 0) {
        const nodeResult = await graphCRUD.createNodes(nodes);
        if (!nodeResult || !nodeResult.success) {
          const err = nodeResult?.error || 'Failed to create nodes';
          if (onShowMessage) onShowMessage(err, 'error');
          return { nodes: 0, edges: 0, groups: 0 };
        }
        createdNodes = Array.isArray(nodeResult.data?.created) ? nodeResult.data.created.length : nodes.length;
        createdNodeIds = Array.isArray(nodeResult.data?.created)
          ? nodeResult.data.created.map((node) => node?.id).filter(Boolean)
          : [];
      }

      // Then create edges (if any). graphCRUD.createEdges validates that source/target nodes exist.
      if (edges.length > 0) {
        const edgeResult = await graphCRUD.createEdges(edges);
        if (!edgeResult || !edgeResult.success) {
          const err = maybeAugmentHandleError(edgeResult?.error || 'Failed to create edges');
          if (onShowMessage) onShowMessage(err, 'error');
          // Return nodes created so far and zero edges/groups
          return { nodes: createdNodes, edges: 0, groups: 0 };
        }
        createdEdges = Array.isArray(edgeResult.data?.created) ? edgeResult.data.created.length : edges.length;
      }

      // Finally create groups (if any). Groups typically reference node IDs, so create them last.
      if (groups.length > 0 && typeof graphCRUD.createGroups === 'function') {
        const groupResult = await graphCRUD.createGroups(groups);
        if (!groupResult || !groupResult.success) {
          const err = groupResult?.error || 'Failed to create clusters';
          if (onShowMessage) onShowMessage(err, 'error');
          // Return counts so far
          return { nodes: createdNodes, edges: createdEdges, groups: 0 };
        }
        createdGroups = Array.isArray(groupResult.data?.created) ? groupResult.data.created.length : groups.length;
      }

      if (onShowMessage) onShowMessage(`Created ${createdNodes} nodes, ${createdEdges} edges, ${createdGroups} clusters`, 'success');
      if (shouldAutoLayout && createdNodes > 0) {
        try {
          eventBus.emit('layout:autoOnMissingPositions', {
            reason: 'paste',
            action: 'create',
            nodeIds: createdNodeIds
          });
        } catch (err) {
          // ignore event bus errors
        }
      }
      return { nodes: createdNodes, edges: createdEdges, groups: createdGroups };
    }

    // Fallback to switch-based handling for other actions
    const { nodes, edges, id, updates, criteria, ids, groups } = command;
    let result;

    switch (action) {
      case 'skill': {
        if (typeof graphCRUD.executeSkill !== 'function') {
          result = { success: false, error: 'Skill execution is not supported in this context' };
          break;
        }
        const skillName = command.name || command.skill || command.id;
        if (!skillName || typeof skillName !== 'string') {
          result = { success: false, error: 'Skill commands require a name field (name/skill/id)' };
          break;
        }
        const params = {
          ...(command.params || {}),
          dryRun: command.dryRun === true ? true : (command.params && command.params.dryRun) === true
        };
        result = await graphCRUD.executeSkill(skillName, params);
        if (onShowMessage && command.silent !== true) {
          if (result?.success) {
            const label = command.toastLabel || `Skill "${skillName}" executed`;
            onShowMessage(label, 'success');
          } else {
            onShowMessage(result?.error || `Skill "${skillName}" failed`, 'error');
          }
        }
        break;
      }

      case 'createNodes':
        if (nodes && Array.isArray(nodes)) {
          const shouldAutoLayout = positionsOmitted(nodes);
          result = await graphCRUD.createNodes(nodes);
          if (result?.success && shouldAutoLayout) {
            const createdNodeIds = Array.isArray(result.data?.created)
              ? result.data.created.map((node) => node?.id).filter(Boolean)
              : [];
            try {
              eventBus.emit('layout:autoOnMissingPositions', {
                reason: 'paste',
                action: 'createNodes',
                nodeIds: createdNodeIds
              });
            } catch (err) {
              // ignore event bus errors
            }
          }
        }
        break;

      case 'createEdges':
        if (edges && Array.isArray(edges)) {
          result = await graphCRUD.createEdges(edges);
          if (result && !result.success) {
            result.error = maybeAugmentHandleError(result.error);
          }
        }
        break;

      case 'createGroups':
        if (groups && Array.isArray(groups)) {
          if (typeof graphCRUD.createGroups === 'function') {
            result = await graphCRUD.createGroups(groups);
          } else {
            result = { success: false, error: 'Group creation is not supported' };
          }
        }
        break;

      case 'update':
        if (command.type === 'node' && Array.isArray(ids) && ids.length && updates) {
          if (typeof graphCRUD.updateNodes === 'function') {
            result = await graphCRUD.updateNodes(ids, updates);
          } else {
            result = { success: false, error: 'Bulk node update is not supported' };
          }
        } else if (command.type === 'edge' && Array.isArray(ids) && ids.length && updates) {
          if (typeof graphCRUD.updateEdges === 'function') {
            result = await graphCRUD.updateEdges(ids, updates);
          } else {
            result = { success: false, error: 'Bulk edge update is not supported' };
          }
        } else if (command.type === 'group' && Array.isArray(ids) && ids.length && updates) {
          if (typeof graphCRUD.updateGroups === 'function') {
            result = await graphCRUD.updateGroups(ids, updates);
          } else {
            result = { success: false, error: 'Bulk group update is not supported' };
          }
        } else if (command.type === 'node' && id && updates) {
          result = await graphCRUD.updateNode(id, updates);
        } else if (command.type === 'edge' && id && updates) {
          result = await graphCRUD.updateEdge(id, updates);
        } else if (command.type === 'group' && id && updates) {
          if (typeof graphCRUD.updateGroup === 'function') {
            result = await graphCRUD.updateGroup(id, updates);
          } else {
            result = { success: false, error: 'Group updates are not supported' };
          }
        }
        break;

      case 'delete':
        if (command.type === 'node' && id) {
          result = await graphCRUD.deleteNode(id);
        } else if (command.type === 'edge' && id) {
          result = await graphCRUD.deleteEdge(id);
        } else if (command.type === 'group' && id) {
          if (typeof graphCRUD.deleteGroup === 'function') {
            result = await graphCRUD.deleteGroup(id);
          } else {
            result = { success: false, error: 'Group deletion is not supported' };
          }
        }
        break;

      case 'read':
        if (command.type === 'node') {
          result = await graphCRUD.readNode(id);
        } else if (command.type === 'edge') {
          result = await graphCRUD.readEdge(id);
        } else if (command.type === 'group') {
          if (typeof graphCRUD.readGroup === 'function') {
            result = await graphCRUD.readGroup(id);
          } else {
            result = { success: false, error: 'Group reads are not supported' };
          }
        }
        break;

      case 'addNodesToGroup': {
        const groupId = command.groupId || id;
        if (typeof graphCRUD.addNodesToGroup === 'function') {
          result = await graphCRUD.addNodesToGroup(groupId, command.nodeIds || []);
        } else {
          result = { success: false, error: 'Group membership updates are not supported' };
        }
        break;
      }

      case 'removeNodesFromGroup': {
        const groupId = command.groupId || id;
        if (typeof graphCRUD.removeNodesFromGroup === 'function') {
          result = await graphCRUD.removeNodesFromGroup(groupId, command.nodeIds || []);
        } else {
          result = { success: false, error: 'Group membership updates are not supported' };
        }
        break;
      }

      case 'setGroupNodes': {
        const groupId = command.groupId || id;
        if (typeof graphCRUD.setGroupNodes === 'function') {
          result = await graphCRUD.setGroupNodes(groupId, command.nodeIds || []);
        } else {
          result = { success: false, error: 'Group membership updates are not supported' };
        }
        break;
      }

      case 'translate':
      case 'move': {
        const targetIds = Array.isArray(ids) && ids.length ? ids : id ? [id] : [];
        const delta = command.delta || command.offset || { x: 0, y: 0 };
        const targetType = command.type || 'node';
        if (targetIds.length === 0) {
          result = { success: false, error: 'translate requires id or ids' };
        } else if (targetType === 'group' && typeof graphCRUD.translateGroups === 'function') {
          result = await graphCRUD.translateGroups(targetIds, delta);
        } else if (targetType === 'node' && typeof graphCRUD.translateNodes === 'function') {
          result = await graphCRUD.translateNodes(targetIds, delta);
        } else {
          result = { success: false, error: `translate not supported for type: ${targetType}` };
        }
        break;
      }

      case 'duplicate': {
        const targetIds = Array.isArray(ids) && ids.length ? ids : id ? [id] : [];
        const targetType = command.type || 'node';
        if (targetIds.length === 0) {
          result = { success: false, error: 'duplicate requires id or ids' };
        } else if (targetType === 'node' && typeof graphCRUD.duplicateNodes === 'function') {
          result = await graphCRUD.duplicateNodes(
            targetIds,
            command.options || { offset: command.offset, includeEdges: command.includeEdges }
          );
        } else {
          result = { success: false, error: `duplicate not supported for type: ${targetType}` };
        }
        break;
      }

      case 'batch':
      case 'transaction': {
        const commands = Array.isArray(command.commands) ? command.commands : [];
        const continueOnError = command.continueOnError === true;
        let totals = { nodes: 0, edges: 0, groups: 0 };
        for (let i = 0; i < commands.length; i++) {
          const entry = commands[i];
          if (!entry || typeof entry !== 'object') {
            if (!continueOnError) {
              result = { success: false, error: `Command ${i} is not an object` };
              break;
            }
            continue;
          }
          const child = command.dryRun ? { ...entry, dryRun: true } : entry;
          const childResult = await executeCRUDCommand(child, graphCRUD, onShowMessage);
          if (childResult && childResult.nodes !== undefined) {
            totals.nodes += childResult.nodes || 0;
            totals.edges += childResult.edges || 0;
            totals.groups += childResult.groups || 0;
          }
          if (childResult?.error && !continueOnError) {
            result = { success: false, error: childResult.error };
            break;
          }
        }
        if (!result) {
          result = { success: true, data: { message: 'Batch completed', totals } };
        }
        break;
      }

      case 'clearGraph':
        result = await graphCRUD.clearGraph();
        break;

      case 'findNodes':
        result = await graphCRUD.findNodes(criteria || {});
        break;

      case 'findEdges':
        result = await graphCRUD.findEdges(criteria || {});
        break;

      case 'getStats':
        result = await graphCRUD.getStats();
        break;

      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    if (result && result.success) {
      if (onShowMessage) {
        const message = result.data?.message || `${action} completed successfully`;
        onShowMessage(message, 'success');
      }

      // Return counts for create operations
      if (action === 'createNodes') {
        const created = result.data?.created || [];
        return { nodes: created.length, edges: 0, groups: 0 };
      } else if (action === 'createEdges') {
        const created = result.data?.created || [];
        return { nodes: 0, edges: created.length, groups: 0 };
      } else if (action === 'createGroups') {
        const created = result.data?.created || [];
        return { nodes: 0, edges: 0, groups: created.length };
      } else if (action === 'translate' || action === 'move') {
        if (command.type === 'group') {
          return { nodes: 0, edges: 0, groups: result.data?.updated || 0 };
        }
        return { nodes: result.data?.updated || 0, edges: 0, groups: 0 };
      } else if (action === 'duplicate') {
        const createdNodes = result.data?.createdNodes || [];
        const createdEdges = result.data?.createdEdges || [];
        return { nodes: createdNodes.length, edges: createdEdges.length, groups: 0 };
      }

      return { nodes: 0, edges: 0, groups: 0 };
    } else {
      if (onShowMessage) {
        onShowMessage(result?.error || 'CRUD command failed', 'error');
      }
      return { nodes: 0, edges: 0, groups: 0, error: result?.error || 'CRUD command failed' };
    }
  } catch (error) {
    console.error('executeCRUDCommand error:', error);
    if (onShowMessage) {
      onShowMessage(`Command execution failed: ${error.message}`, 'error');
    }
    return { nodes: 0, edges: 0, groups: 0 };
  }
}

export async function pasteFromClipboardUnified({ handlers, state, historyHook, onShowMessage, graphCRUD }) {
  const { setNodes, nodesRef, setEdges, edgesRef, setGroups, pan, zoom } = state;
  const saveToHistory = historyHook?.saveToHistory;

  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) return { nodes: 0, edges: 0, groups: 0 };

    // Try JSON
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (err) { parsed = null; }

    if (parsed) {
      if (parsed.action === 'setTheme') {
        const validation = validateThemePasteCommand(parsed);
        if (!validation.valid) {
          if (onShowMessage) onShowMessage(`Theme command invalid: ${validation.errors.join('; ')}`, 'error');
          return { nodes: 0, edges: 0, groups: 0, error: validation.errors.join('; ') };
        }
        eventBus.emit('themePasteValidated', validation.normalized);
        if (onShowMessage) onShowMessage('Theme command validated', 'success');
        return { nodes: 0, edges: 0, groups: 0 };
      }
      // Check if this is a CRUD command (has action property)
      if (parsed.action) {
        const intentAPI =
          (handlers && handlers.graphAPI && handlers.graphAPI.current)
            ? handlers.graphAPI.current
            : (typeof window !== 'undefined' && window.graphAPI ? window.graphAPI : null);
        const apiToUse = intentAPI || graphCRUD;
        if (apiToUse) {
          const result = await executeCRUDCommand(parsed, apiToUse, onShowMessage);
          return result;
        }
      }
      // Prefer an external handler if provided (handlers prop, global window handler, or graphEditorHandlers)
      const externalHandler = (handlers && typeof handlers.handlePasteGraphData === 'function' && handlers.handlePasteGraphData)
        || (typeof window !== 'undefined' && typeof window.handlePasteGraphData === 'function' && window.handlePasteGraphData)
        || (typeof window !== 'undefined' && window.graphEditorHandlers && typeof window.graphEditorHandlers.handlePasteGraphData === 'function' && window.graphEditorHandlers.handlePasteGraphData);

      if (externalHandler && typeof externalHandler === 'function') {
        try {
          const result = await externalHandler(parsed);
          // If the external handler returned counts, respect them
          if (result && typeof result === 'object' && ('nodes' in result || 'edges' in result || 'groups' in result)) {
            if (onShowMessage) onShowMessage('Imported successfully', 'success');
            return { nodes: result.nodes || 0, edges: result.edges || 0, groups: result.groups || 0 };
          }

          // Otherwise assume the handler performed the import; infer counts from parsed where possible
          const nodeCount = Array.isArray(parsed.nodes) ? parsed.nodes.length : (Array.isArray(parsed) ? parsed.length : 0);
          const edgeCount = Array.isArray(parsed.edges) ? parsed.edges.length : 0;
          const groupCount = Array.isArray(parsed.groups) ? parsed.groups.length : 0;
          if (onShowMessage) onShowMessage(`Pasted ${nodeCount} nodes and ${edgeCount} edges`, 'success');
          return { nodes: nodeCount, edges: edgeCount, groups: groupCount };
        } catch (err) {
          console.warn('External paste handler failed, falling back to internal import:', err);
          if (onShowMessage) onShowMessage('External paste handler failed — attempting local import', 'warning');
          // fall through to local import
        }
      }

      // Otherwise, perform an internal merge (similar to previous paste logic)
      if (Array.isArray(parsed.nodes)) {
        const currentNodes = nodesRef?.current || [];
        const currentEdges = edgesRef?.current || [];
        const idMapping = {};
        const timestamp = Date.now();
        const placeholderForIndex = (node, index) => {
          if (node && typeof node.id === 'string' && node.id.trim().length) {
            return node.id;
          }
          return `__placeholder_${timestamp}_${index}`;
        };

        parsed.nodes.forEach((node, index) => {
          const originalId = placeholderForIndex(node, index);
          const newId = `node_${timestamp}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          idMapping[originalId] = newId;
        });

        const pastedNodes = parsed.nodes.map((node, index) => {
          const originalId = placeholderForIndex(node, index);
          return {
            ...node,
            id: idMapping[originalId] || `node_${Date.now()}_${index}`,
            label: node.label || originalId || `Node ${index + 1}`,
            position: node.position || { x: 100 + index * 120, y: 100 },
            width: node.width || 160,
            height: node.height || 80,
            data: {
              ...node.data,
              memo: typeof node.data?.memo === 'string' ? node.data.memo.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : node.data?.memo,
              link: typeof node.data?.link === 'string' ? node.data.link.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : node.data?.link
            }
          };
        });
        const pastedEdges = (parsed.edges || []).map((edge, index) => {
          const newSource = idMapping[edge.source] || edge.source;
          const newTarget = idMapping[edge.target] || edge.target;
          return {
            ...edge,
            id: `edge_${timestamp}_${index}_${Math.random().toString(36).substr(2, 6)}`,
            source: newSource,
            target: newTarget
          };
        }).filter(edge => pastedNodes.some(n => n.id === edge.source || n.id === edge.target));

        const newNodes = [...currentNodes, ...pastedNodes];
        const newEdges = [...currentEdges, ...pastedEdges];

        if (setNodes) {
          setNodes(prev => {
            const next = newNodes;
            if (nodesRef) nodesRef.current = next;
            return next;
          });
        }
        if (setEdges) {
          setEdges(prev => {
            const next = newEdges;
            if (edgesRef) edgesRef.current = next;
            return next;
          });
        }

        // If parsed contains groups, map node ids and add groups
        let pastedGroups = [];
        if (Array.isArray(parsed.groups) && parsed.groups.length) {
          pastedGroups = parsed.groups.map((g) => {
            const nodeIds = Array.isArray(g.nodeIds) ? g.nodeIds.map(id => idMapping[id] || id).filter(id => newNodes.some(n => n.id === id)) : [];
            return {
              ...g,
              id: g.id || `group_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
              nodeIds
            };
          }).filter(g => Array.isArray(g.nodeIds) && g.nodeIds.length > 0);

          if (pastedGroups.length > 0 && setGroups) {
            setGroups(prev => {
              const next = [...(prev || []), ...pastedGroups];
              if (typeof prev === 'undefined' && typeof window !== 'undefined' && window.__INITIAL_GROUPS__) {
                // no-op
              }
              return next;
            });
          }
        }

        if (saveToHistory) saveToHistory(newNodes, newEdges);
        const nodeCount = pastedNodes.length;
        const edgeCount = pastedEdges.length;
        const groupCount = pastedGroups.length;
        if (onShowMessage) onShowMessage(`Pasted ${nodeCount} nodes, ${edgeCount} edges, ${groupCount} clusters`, 'success');
        return { nodes: nodeCount, edges: edgeCount, groups: groupCount };
      }

      // If parsed JSON contains only groups
      if (Array.isArray(parsed.groups) && setGroups) {
        // Map nodeIds to existing ids where possible
        const currentNodes = nodesRef?.current || [];
        const nodeIdSet = new Set(currentNodes.map(n => n.id));
        const validGroups = parsed.groups.map(g => ({
          ...g,
          nodeIds: Array.isArray(g.nodeIds) ? g.nodeIds.filter(id => nodeIdSet.has(id)) : []
        })).filter(g => g.nodeIds && g.nodeIds.length > 0);

        if (validGroups.length > 0) {
          setGroups(prev => [...prev, ...validGroups]);
          if (onShowMessage) onShowMessage(`Pasted ${validGroups.length} clusters`, 'success');
          return { nodes: 0, edges: 0, groups: validGroups.length };
        }

        return { nodes: 0, edges: 0, groups: 0 };
      }

      // Fallback: emit event
      eventBus.emit('pasteGraphData', parsed);
      return { nodes: 0, edges: 0, groups: 0 };
    }

    // Plain text -> create a resizable node (same behavior as before)
    const lines = text.trim().split('\n');
    const label = lines[0].substring(0, 50);
    const memo = text.trim();

    const width = Math.max(200, Math.min(600, label.length * 8 + 100));
    const height = Math.max(100, Math.min(400, lines.length * 20 + 50));

    const centerX = (window.innerWidth / 2 - (pan?.x || 0)) / (zoom || 1);
    const centerY = (window.innerHeight / 2 - (pan?.y || 0)) / (zoom || 1);

    const newNode = {
      id: `node_${Date.now()}`,
      label: label,
      type: 'default',
      position: { x: centerX, y: centerY },
      width: width,
      height: height,
      resizable: true,
      data: { memo: memo }
    };

    if (setNodes) {
      setNodes(prev => {
        const next = [...prev, newNode];
        if (nodesRef) nodesRef.current = next;
        return next;
      });
    }

    if (saveToHistory) saveToHistory(nodesRef?.current || [], edgesRef?.current || []);
    if (onShowMessage) onShowMessage('Created resizable node from pasted text', 'success');
    return { nodes: 1, edges: 0, groups: 0 };
  } catch (err) {
    console.error('pasteFromClipboardUnified failed:', err);
    if (onShowMessage) onShowMessage('Failed to paste from clipboard', 'error');
    return { nodes: 0, edges: 0, groups: 0 };
  }
}
