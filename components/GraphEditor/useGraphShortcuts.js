import { useEffect } from 'react';

export default function useGraphShortcuts({
  setNodes,
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
    function handleKeyboardShortcuts(e) {
      // Resize all nodes to 80x48 on Ctrl+Q
      if (e.ctrlKey && (e.key === 'q' || e.key === 'Q')) {
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
      // Delete selected on Delete key
      else if (e.key === 'Delete' || e.key === 'Backspace') {
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
    }
    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [setNodes, setSelectedNodeIds, setSelectedEdgeIds, handleDeleteSelected, clearSelection, handleCreateGroup, handleUngroupSelected, saveToHistory, edgesRef, nodesRef]);
}
