import eventBus from '../../NodeGraph/eventBus';

/**
 * Execute CRUD commands from pasted JSON
 * Supported actions: create, update, delete, read, createNodes, createEdges, clearGraph, findNodes, findEdges, getStats
 */
async function executeCRUDCommand(command, graphCRUD, onShowMessage) {
  try {
    const { action, nodes, edges, id, updates, criteria } = command;
    let result;

    switch (action) {
      case 'create':
        if (nodes && Array.isArray(nodes)) {
          result = graphCRUD.createNodes(nodes);
        } else if (edges && Array.isArray(edges)) {
          result = graphCRUD.createEdges(edges);
        } else if (command.node) {
          result = graphCRUD.createNode(command.node);
        } else if (command.edge) {
          result = graphCRUD.createEdge(command.edge);
        }
        break;

      case 'update':
        if (command.type === 'node' && id && updates) {
          result = graphCRUD.updateNode(id, updates);
        } else if (command.type === 'edge' && id && updates) {
          result = graphCRUD.updateEdge(id, updates);
        }
        break;

      case 'delete':
        if (command.type === 'node' && id) {
          result = graphCRUD.deleteNode(id);
        } else if (command.type === 'edge' && id) {
          result = graphCRUD.deleteEdge(id);
        }
        break;

      case 'read':
        if (command.type === 'node') {
          result = graphCRUD.readNode(id);
        } else if (command.type === 'edge') {
          result = graphCRUD.readEdge(id);
        }
        break;

      case 'createNodes':
        if (nodes && Array.isArray(nodes)) {
          result = graphCRUD.createNodes(nodes);
        }
        break;

      case 'createEdges':
        if (edges && Array.isArray(edges)) {
          result = graphCRUD.createEdges(edges);
        }
        break;

      case 'clearGraph':
        result = graphCRUD.clearGraph();
        break;

      case 'findNodes':
        result = graphCRUD.findNodes(criteria || {});
        break;

      case 'findEdges':
        result = graphCRUD.findEdges(criteria || {});
        break;

      case 'getStats':
        result = graphCRUD.getStats();
        break;

      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    if (result.success) {
      if (onShowMessage) {
        const message = result.data?.message || `${action} completed successfully`;
        onShowMessage(message, 'success');
      }
      
      // Return appropriate counts for actions that modify the graph
      if (action === 'create' || action === 'createNodes') {
        const created = result.data?.created || (result.data ? [result.data] : []);
        return { nodes: created.length, edges: 0, groups: 0 };
      } else if (action === 'createEdges') {
        const created = result.data?.created || (result.data ? [result.data] : []);
        return { nodes: 0, edges: created.length, groups: 0 };
      } else if (action === 'delete') {
        return { nodes: 0, edges: 0, groups: 0 };
      }
      
      return { nodes: 0, edges: 0, groups: 0 };
    } else {
      if (onShowMessage) {
        onShowMessage(result.error || 'CRUD command failed', 'error');
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

        if (saveToHistory) saveToHistory(newNodes, newEdges);
        const nodeCount = pastedNodes.length;
        const edgeCount = pastedEdges.length;
        if (onShowMessage) onShowMessage(`Pasted ${nodeCount} nodes and ${edgeCount} edges`, 'success');
        return { nodes: nodeCount, edges: edgeCount, groups: Array.isArray(parsed.groups) ? parsed.groups.length : 0 };
      }

      // If parsed JSON contains only groups
      if (Array.isArray(parsed.groups) && setGroups) {
        setGroups(prev => [...prev, ...parsed.groups]);
        if (onShowMessage) onShowMessage(`Pasted ${parsed.groups.length} groups`, 'success');
        return { nodes: 0, edges: 0, groups: parsed.groups.length };
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
