import { useEffect } from 'react';

export default function useGraphShortcuts({
  setNodes,
  setEdges,
  selectedNodeIds,
  selectedEdgeIds,
  setSelectedNodeIds,
  setSelectedEdgeIds,
  handleDeleteSelected,
  clearSelection,
  handleCreateGroup,
  handleUngroupSelected,
  saveToHistory,
  edgesRef,
  nodesRef
}) {
  useEffect(() => {
    // Helper function to copy selected nodes and edges to clipboard as JSON
    async function copyToClipboard() {
      if (!selectedNodeIds || selectedNodeIds.length === 0) {
        console.log('No nodes selected for copy');
        return;
      }

      const nodes = nodesRef?.current || [];
      const edges = edgesRef?.current || [];
      
      // Get selected nodes
      const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
      
      // Get edges that connect selected nodes (both source and target must be selected)
      const selectedEdges = edges.filter(edge => 
        selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
      );

      // Clean the data to avoid JSON issues
      const cleanNodes = selectedNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          // Ensure strings are properly escaped
          memo: typeof node.data?.memo === 'string' ? node.data.memo.replace(/\n/g, '\\n').replace(/\r/g, '\\r') : node.data?.memo,
          link: typeof node.data?.link === 'string' ? node.data.link.replace(/\n/g, '\\n').replace(/\r/g, '\\r') : node.data?.link
        }
      }));

      const clipboardData = {
        type: 'nodegraph-data',
        nodes: cleanNodes,
        edges: selectedEdges,
        timestamp: new Date().toISOString(),
        nodeCount: cleanNodes.length,
        edgeCount: selectedEdges.length
      };

      try {
        // Use compact JSON to reduce size
        const jsonString = JSON.stringify(clipboardData);
        await navigator.clipboard.writeText(jsonString);
        console.log(`Copied ${selectedNodes.length} nodes and ${selectedEdges.length} edges to clipboard (${jsonString.length} chars)`);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        // Fallback: try without pretty printing
        try {
          await navigator.clipboard.writeText(JSON.stringify(clipboardData));
          console.log('Copied with compact format');
        } catch (fallbackErr) {
          console.error('Fallback copy also failed:', fallbackErr);
        }
      }
    }

    // Helper function to cut selected nodes and edges
    async function cutToClipboard() {
      if (!selectedNodeIds || selectedNodeIds.length === 0) {
        console.log('No nodes selected for cut');
        return;
      }
      await copyToClipboard();
      handleDeleteSelected();
    }

    // Helper function to paste nodes and edges from clipboard
    async function pasteFromClipboard() {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText || typeof clipboardText !== 'string') {
          console.log('Clipboard is empty or invalid');
          return;
        }
        let clipboardData;
        try {
          clipboardData = JSON.parse(clipboardText);
        } catch (parseErr) {
          console.error('Invalid JSON in clipboard:', parseErr.message);
          console.log('First 100 chars of clipboard:', clipboardText.substring(0, 100));
          return;
        }
        // If action: replace or update, call handlePasteGraphData
        if ((clipboardData.action === 'replace' || clipboardData.action === 'update') && typeof window.handlePasteGraphData === 'function') {
          window.handlePasteGraphData(clipboardData);
          return;
        }
        if (!clipboardData.nodes || !Array.isArray(clipboardData.nodes)) {
          console.log('Clipboard does not contain valid node array. Each node should include label, position, width, and height. Defaults will be applied if missing.');
          return;
        }
        const currentNodes = nodesRef?.current || [];
        const currentEdges = edgesRef?.current || [];
        // Generate new IDs for pasted nodes to avoid conflicts
        const idMapping = {};
        const timestamp = Date.now();
        clipboardData.nodes.forEach((node, index) => {
          const newId = `node_${timestamp}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          idMapping[node.id] = newId;
        });
        const pastedNodes = clipboardData.nodes.map((node, index) => ({
          ...node,
          id: idMapping[node.id],
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
        // Update edge source/target IDs using the mapping, but only for edges that reference pasted nodes
        const pastedEdges = (clipboardData.edges || []).map((edge, index) => {
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
        setNodes(newNodes);
        setEdges(newEdges);
        if (nodesRef) nodesRef.current = newNodes;
        if (edgesRef) edgesRef.current = newEdges;
        setSelectedNodeIds(pastedNodes.map(node => node.id));
        setSelectedEdgeIds([]);
        if (saveToHistory) saveToHistory(newNodes, newEdges);
        console.log(`Pasted ${pastedNodes.length} nodes and ${pastedEdges.length} edges`);
      } catch (err) {
        console.error('Failed to paste from clipboard:', err);
      }
    }

    function isTextInputActive() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      const editable = el.getAttribute('contenteditable');
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        editable === 'true' ||
        el.isContentEditable
      );
    }

    function handleKeyboardShortcuts(e) {
      // Only trigger graph shortcuts if not editing text
      if (isTextInputActive()) return;
      // Copy selected nodes on Ctrl+C
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copyToClipboard();
      }
      // Cut selected nodes on Ctrl+X
      else if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        cutToClipboard();
      }
      // Paste nodes on Ctrl+V
      else if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteFromClipboard();
      }
      // Resize all nodes to 80x48 on Ctrl+Q
      else if (e.ctrlKey && (e.key === 'q' || e.key === 'Q')) {
        setNodes(prev => {
          const updated = prev.map(n => ({ ...n, width: 80, height: 48 }));
          if (nodesRef) nodesRef.current = updated;
          if (saveToHistory && edgesRef) saveToHistory(updated, edgesRef.current);
          return updated;
        });
        console.log('All nodes resized to 80x48');
      }
      // Select all nodes on Ctrl+A
      else if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (nodesRef) setSelectedNodeIds(nodesRef.current.map(n => n.id));
        setSelectedEdgeIds([]);
        console.log(`Selected all nodes`);
      }
      // Delete selected on Delete key only (removed Backspace to avoid conflicts with text editing)
      else if (e.key === 'Delete') {
        handleDeleteSelected();
      }
      // Escape to clear selection
      else if (e.key === 'Escape') {
        clearSelection();
      }
      // Create group on Ctrl+G
      else if (e.ctrlKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        handleCreateGroup();
      }
      // Ungroup on Ctrl+Shift+G
      else if (e.ctrlKey && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        handleUngroupSelected();
      }
      // Example shortcut registration (add this near your node add shortcut logic)
      function handleShortcutAddNode() {
        console.log('Shortcut: Add Node triggered');
        // ...existing code to add node...
      }
    }
    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [selectedNodeIds, selectedEdgeIds, setNodes, setEdges, setSelectedNodeIds, setSelectedEdgeIds, handleDeleteSelected, clearSelection, handleCreateGroup, handleUngroupSelected, saveToHistory, edgesRef, nodesRef]);
}
