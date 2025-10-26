import eventBus from '../NodeGraph/eventBus';

export async function pasteFromClipboardUnified({ handlers, state, historyHook, onShowMessage }) {
  const { setNodes, nodesRef, setEdges, edgesRef, setGroups, pan, zoom } = state;
  const saveToHistory = historyHook?.saveToHistory;

  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) return { nodes: 0, edges: 0, groups: 0 };

    // Try JSON
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (err) { parsed = null; }

    if (parsed) {
      // If a global handler is available, prefer it but still return counts based on parsed data
      if (typeof window !== 'undefined' && typeof window.handlePasteGraphData === 'function') {
        try {
          await window.handlePasteGraphData(parsed);
        } catch (err) {
          console.warn('window.handlePasteGraphData failed:', err);
        }
        const nodeCount = Array.isArray(parsed.nodes) ? parsed.nodes.length : 0;
        const edgeCount = Array.isArray(parsed.edges) ? parsed.edges.length : 0;
        const groupCount = Array.isArray(parsed.groups) ? parsed.groups.length : 0;
        if (onShowMessage) onShowMessage(`Pasted ${nodeCount} nodes and ${edgeCount} edges`, 'success');
        return { nodes: nodeCount, edges: edgeCount, groups: groupCount };
      }

      // If handlers.provide paste, call it and return counts
      if (handlers && typeof handlers.handlePasteGraphData === 'function') {
        try {
          await handlers.handlePasteGraphData(parsed);
        } catch (err) {
          console.warn('handlers.handlePasteGraphData failed:', err);
        }
        const nodeCount = Array.isArray(parsed.nodes) ? parsed.nodes.length : 0;
        const edgeCount = Array.isArray(parsed.edges) ? parsed.edges.length : 0;
        const groupCount = Array.isArray(parsed.groups) ? parsed.groups.length : 0;
        if (onShowMessage) onShowMessage(`Pasted ${nodeCount} nodes and ${edgeCount} edges`, 'success');
        return { nodes: nodeCount, edges: edgeCount, groups: groupCount };
      }

      // Otherwise, perform an internal merge (similar to previous paste logic)
      if (Array.isArray(parsed.nodes)) {
        const currentNodes = nodesRef?.current || [];
        const currentEdges = edgesRef?.current || [];
        const idMapping = {};
        const timestamp = Date.now();
        parsed.nodes.forEach((node, index) => {
          const newId = `node_${timestamp}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          idMapping[node.id] = newId;
        });
        const pastedNodes = parsed.nodes.map((node, index) => ({
          ...node,
          id: idMapping[node.id] || `node_${Date.now()}_${index}`,
          label: node.label || node.id || `Node ${index + 1}`,
          position: node.position || { x: 100 + index * 120, y: 100 },
          width: node.width || 160,
          height: node.height || 80,
          data: {
            ...node.data,
            memo: typeof node.data?.memo === 'string' ? node.data.memo.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : node.data?.memo,
            link: typeof node.data?.link === 'string' ? node.data.link.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : node.data?.link
          }
        }));
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

        if (setNodes) setNodes(newNodes);
        if (setEdges) setEdges(newEdges);
        if (nodesRef) nodesRef.current = newNodes;
        if (edgesRef) edgesRef.current = newEdges;

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
