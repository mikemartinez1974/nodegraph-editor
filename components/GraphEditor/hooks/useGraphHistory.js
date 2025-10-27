import { useState, useRef, useCallback } from 'react';

export default function useGraphHistory(nodes, edges, groups, setNodes, setEdges, setGroups) {
  const [history, setHistory] = useState([
    { nodes, edges, groups }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(historyIndex);

  // Save to history
  const saveToHistory = useCallback((newNodes, newEdges, newGroups) => {
    setHistory(prevHistory => {
      const truncated = prevHistory.slice(0, historyIndexRef.current + 1);
      const next = [...truncated, { nodes: newNodes, edges: newEdges, groups: newGroups }];
      setHistoryIndex(next.length - 1);
      historyIndexRef.current = next.length - 1;
      return next;
    });
  }, []);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      const snapshot = history[newIndex];
      if (snapshot) {
        setNodes(snapshot.nodes);
        setEdges(snapshot.edges);
        if (setGroups) setGroups(snapshot.groups || []);
      }
    }
  }, [history, setNodes, setEdges, setGroups]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < history.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      const snapshot = history[newIndex];
      if (snapshot) {
        setNodes(snapshot.nodes);
        setEdges(snapshot.edges);
        if (setGroups) setGroups(snapshot.groups || []);
      }
    }
  }, [history, setNodes, setEdges, setGroups]);

  return {
    history,
    historyIndex,
    saveToHistory,
    handleUndo,
    handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
}
