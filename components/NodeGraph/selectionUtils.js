// Utility functions for multi-selection support in NodeGraph layers

export const isNodeSelected = (nodeId, selectedNodeIds) => {
  return selectedNodeIds.includes(nodeId);
};

export const isEdgeSelected = (edgeId, selectedEdgeIds) => {
  return selectedEdgeIds.includes(edgeId);
};

export const getSelectionProps = (nodeId, selectedNodeIds, selectedNodeId) => {
  const isSelected = selectedNodeIds.includes(nodeId);
  const isMultiSelect = selectedNodeIds.length > 1;
  
  return {
    isSelected,
    isMultiSelect,
    // Backward compatibility - if this is the primary selection, pass true for old single-select logic
    selected: nodeId === selectedNodeId
  };
};

export const getEdgeSelectionProps = (edgeId, selectedEdgeIds, selectedEdgeId) => {
  const isSelected = selectedEdgeIds.includes(edgeId);
  const isMultiSelect = selectedEdgeIds.length > 1;
  
  return {
    isSelected,
    isMultiSelect,
    // Backward compatibility
    selected: edgeId === selectedEdgeId
  };
};