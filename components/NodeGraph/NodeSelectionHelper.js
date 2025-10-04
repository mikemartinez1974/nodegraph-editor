// Helper function for NodeLayer to determine node selection state
export const getNodeSelectionProps = (nodeId, selectedNodeId, selectedNodeIds = []) => {
  const isSelected = selectedNodeIds.includes(nodeId);
  const isMultiSelect = selectedNodeIds.length > 1;
  
  return {
    // New multi-select aware property
    isSelected,
    // For compatibility with existing single-select logic
    selected: nodeId === selectedNodeId,
    // Additional context
    isMultiSelect,
    selectionCount: selectedNodeIds.length
  };
};

// Debug function to help troubleshoot selection issues
export const debugNodeSelection = (nodeId, selectedNodeId, selectedNodeIds) => {
  console.log(`Node ${nodeId}:`, {
    inSelectedArray: selectedNodeIds.includes(nodeId),
    isSelectedNodeId: nodeId === selectedNodeId,
    selectedNodeIds,
    selectedNodeId
  });
};