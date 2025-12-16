import eventBus from '../../NodeGraph/eventBus';

const HANDLE_IMPORT_HINT = 'Edges must include sourceHandle/targetHandle keys that match each node\'s handle schema.';
const maybeAugmentHandleError = (message) => {
  if (message && typeof message === 'string' && /handle/i.test(message)) {
    return `${message} (${HANDLE_IMPORT_HINT})`;
  }
  return message;
};

/**
 * Execute CRUD commands from pasted JSON
 * Supported actions: create, update, delete, read, createNodes, createEdges, clearGraph, findNodes, findEdges, getStats
 */
async function executeCRUDCommand(command, graphCRUD, onShowMessage) {
  try {
    const { action } = command;

    // Handle combined create (nodes + edges + groups) in one command
    if (action === 'create') {
      const nodes = Array.isArray(command.nodes) ? command.nodes : (command.node ? [command.node] : []);
      const edges = Array.isArray(command.edges) ? command.edges : (command.edge ? [command.edge] : []);
      const groups = Array.isArray(command.groups) ? command.groups : (command.group ? [command.group] : []);

      let createdNodes = 0;
      let createdEdges = 0;
      let createdGroups = 0;

      // Create nodes first (if any)
      if (nodes.length > 0) {
        const nodeResult = await graphCRUD.createNodes(nodes);
        if (!nodeResult || !nodeResult.success) {
          const err = nodeResult?.error || 'Failed to create nodes';
          if (onShowMessage) onShowMessage(err, 'error');
          return { nodes: 0, edges: 0, groups: 0 };
        }
        createdNodes = Array.isArray(nodeResult.data?.created) ? nodeResult.data.created.length : nodes.length;
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
          const err = groupResult?.error || 'Failed to create groups';
          if (onShowMessage) onShowMessage(err, 'error');
          // Return counts so far
          return { nodes: createdNodes, edges: createdEdges, groups: 0 };
        }
        createdGroups = Array.isArray(groupResult.data?.created) ? groupResult.data.created.length : groups.length;
      }

      if (onShowMessage) onShowMessage(`Created ${createdNodes} nodes, ${createdEdges} edges, ${createdGroups} groups`, 'success');
      return { nodes: createdNodes, edges: createdEdges, groups: createdGroups };
    }

    // Fallback to switch-based handling for other actions
    const { nodes, edges, id, updates, criteria, ids } = command;
    let result;

    switch (action) {
      case 'createNodes':
        if (nodes && Array.isArray(nodes)) {
          result = await graphCRUD.createNodes(nodes);
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

      case 'update':
        if (command.type === 'node' && Array.isArray(ids) && ids.length && updates) {
          if (typeof graphCRUD.updateNodes === 'function') {
            result = await graphCRUD.updateNodes(ids, updates);
          } else {
            result = { success: false, error: 'Bulk node update is not supported' };
          }
        } else if (command.type === 'node' && id && updates) {
          result = await graphCRUD.updateNode(id, updates);
        } else if (command.type === 'edge' && id && updates) {
          result = await graphCRUD.updateEdge(id, updates);
        }
        break;

      case 'delete':
        if (command.type === 'node' && id) {
          result = await graphCRUD.deleteNode(id);
        } else if (command.type === 'edge' && id) {
          result = await graphCRUD.deleteEdge(id);
        }
        break;

      case 'read':
        if (command.type === 'node') {
          result = await graphCRUD.readNode(id);
        } else if (command.type === 'edge') {
          result = await graphCRUD.readEdge(id);
        }
        break;

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
      }

      return { nodes: 0, edges: 0, groups: 0 };
    } else {
      if (onShowMessage) {
        onShowMessage(result?.error || 'CRUD command failed', 'error');
      }
      return { nodes: 0, edges: 0, groups: 0 };
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
      // Check if this is a CRUD command (has action property)
      if (parsed.action && graphCRUD) {
        const result = await executeCRUDCommand(parsed, graphCRUD, onShowMessage);
        return result;
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
        if (onShowMessage) onShowMessage(`Pasted ${nodeCount} nodes, ${edgeCount} edges, ${groupCount} groups`, 'success');
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
          if (onShowMessage) onShowMessage(`Pasted ${validGroups.length} groups`, 'success');
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
