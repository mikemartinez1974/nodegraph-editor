import { useEffect } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import { pasteFromClipboardUnified } from '../handlers/pasteHandler';

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
  nodesRef,
  setShowAllEdgeLabels, // <-- Add this prop
  graphCRUD, // <-- Add graphCRUD
  setGroups,
  pan,
  zoom,
  onShowMessage
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
        const result = await pasteFromClipboardUnified({ 
          handlers: null, 
          state: { setNodes, nodesRef, setEdges, edgesRef, setGroups, pan, zoom }, 
          historyHook: { saveToHistory }, 
          onShowMessage: onShowMessage || ((msg) => console.log(msg)),
          graphCRUD
        });
        if (result) {
          console.log(`Pasted ${result.nodes || 0} nodes and ${result.edges || 0} edges`);
        }
        return;
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
      const mod = e.ctrlKey || e.metaKey;

      // Save (Ctrl/Cmd+S)
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        eventBus.emit('saveGraph');
        return;
      }

      // Undo (Ctrl/Cmd+Z)
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        eventBus.emit('undo');
        return;
      }

      // Redo (Ctrl/Cmd+Y)
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        eventBus.emit('redo');
        return;
      }

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
      // Show all edge labels on Alt+L
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        if (setShowAllEdgeLabels) setShowAllEdgeLabels(true);
      }
    }
    
    // Separate keyup handler ONLY for Alt+L edge label toggle
    const handleKeyUp = (e) => {
      if (!e.altKey && setShowAllEdgeLabels) {
        setShowAllEdgeLabels(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyboardShortcuts);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeIds, selectedEdgeIds, setNodes, setEdges, setSelectedNodeIds, setSelectedEdgeIds, handleDeleteSelected, clearSelection, handleCreateGroup, handleUngroupSelected, saveToHistory, edgesRef, nodesRef, setShowAllEdgeLabels, onShowMessage, graphCRUD]);
}
