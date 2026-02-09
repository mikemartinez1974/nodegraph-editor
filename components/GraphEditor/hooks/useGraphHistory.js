import { useState, useRef, useCallback, useEffect } from 'react';

export default function useGraphHistory(nodes, edges, groups, setNodes, setEdges, setGroups) {
  const [history, setHistory] = useState([
    { nodes, edges, groups }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(historyIndex);
  const historyRef = useRef(history);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Save to history
  const saveToHistory = useCallback((newNodes, newEdges, newGroups) => {
    setHistory(prevHistory => {
      const truncated = prevHistory.slice(0, historyIndexRef.current + 1);
      const next = [...truncated, { nodes: newNodes, edges: newEdges, clusters: newGroups }];
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
        if (setGroups) setGroups(snapshot.clusters || []);
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
        if (setGroups) setGroups(snapshot.clusters || []);
      }
    }
  }, [history, setNodes, setEdges, setGroups]);

  const restoreToIndex = useCallback((index) => {
    const list = historyRef.current || [];
    if (!Array.isArray(list) || list.length === 0) return false;
    if (index < 0 || index >= list.length) return false;
    setHistoryIndex(index);
    historyIndexRef.current = index;
    const snapshot = list[index];
    if (snapshot) {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      if (setGroups) setGroups(snapshot.clusters || []);
    }
    return true;
  }, [setNodes, setEdges, setGroups]);

  return {
    history,
    historyIndex,
    saveToHistory,
    handleUndo,
    handleRedo,
    restoreToIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
}
