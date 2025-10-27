import { useCallback } from 'react';

export default function useSelection({
  setSelectedNodeIds,
  setSelectedEdgeIds,
  setSelectedGroupIds,
  setShowNodeProperties,
  setShowEdgeProperties
}) {
  // Node selection
  const handleNodeSelection = useCallback((nodeId, isMultiSelect = false) => {
    setSelectedNodeIds(prev => {
      if (isMultiSelect) {
        const newSelection = prev.includes(nodeId)
          ? prev.filter(id => id !== nodeId)
          : [...prev, nodeId];
        return newSelection;
      } else {
        return [nodeId];
      }
    });
    setSelectedEdgeIds([]);
    if (setShowEdgeProperties) setShowEdgeProperties(false);
  }, [setSelectedNodeIds, setSelectedEdgeIds, setShowEdgeProperties]);

  // Edge selection
  const handleEdgeSelection = useCallback((edgeId, isMultiSelect = false) => {
    setSelectedEdgeIds(prev => {
      if (isMultiSelect) {
        return prev.includes(edgeId)
          ? prev.filter(id => id !== edgeId)
          : [...prev, edgeId];
      } else {
        return [edgeId];
      }
    });
    setSelectedNodeIds([]);
    if (setShowNodeProperties) setShowNodeProperties(false);
  }, [setSelectedEdgeIds, setSelectedNodeIds, setShowNodeProperties]);

  // Group selection
  const handleGroupSelection = useCallback((groupId, isMultiSelect = false) => {
    setSelectedGroupIds(prev => {
      if (isMultiSelect) {
        return prev.includes(groupId)
          ? prev.filter(id => id !== groupId)
          : [...prev, groupId];
      } else {
        return [groupId];
      }
    });
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, [setSelectedGroupIds, setSelectedNodeIds, setSelectedEdgeIds]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    if (setShowNodeProperties) setShowNodeProperties(false);
    if (setShowEdgeProperties) setShowEdgeProperties(false);
  }, [setSelectedNodeIds, setSelectedEdgeIds, setSelectedGroupIds, setShowNodeProperties, setShowEdgeProperties]);

  return {
    handleNodeSelection,
    handleEdgeSelection,
    handleGroupSelection,
    clearSelection
  };
}
