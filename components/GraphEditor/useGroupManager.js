import { useCallback } from 'react';

export default function useGroupManager({
  groups,
  setGroups,
  nodes,
  setSelectedNodeIds,
  setSelectedGroupIds,
  selectedNodeIds,
  selectedGroupIds,
  groupManager,
  saveToHistory,
  edges
}) {
  // Create group
  const handleCreateGroup = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      console.log('At least 2 nodes must be selected to create a group');
      return;
    }
    const result = groupManager.current.createGroup(selectedNodeIds, {
      nodes,
      label: `Group ${groups.length + 1}`
    });
    if (result.success) {
      const newGroups = [...groups, result.data];
      setGroups(newGroups);
      setSelectedNodeIds([]);
      setSelectedGroupIds([result.data.id]);
      saveToHistory(nodes, edges);
      console.log('Created group:', result.data.id);
    } else {
      console.error('Failed to create group:', result.error);
    }
  }, [selectedNodeIds, groups, nodes, setGroups, setSelectedNodeIds, setSelectedGroupIds, groupManager, saveToHistory, edges]);

  // Ungroup selected
  const handleUngroupSelected = useCallback(() => {
    if (selectedGroupIds.length === 0) {
      console.log('No groups selected to ungroup');
      return;
    }
    let updated = false;
    selectedGroupIds.forEach(groupId => {
      const result = groupManager.current.removeGroup(groupId);
      if (result.success) {
        updated = true;
        console.log('Removed group:', groupId);
      }
    });
    if (updated) {
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds([]);
      saveToHistory(nodes, edges);
    }
  }, [selectedGroupIds, setGroups, groupManager, setSelectedGroupIds, saveToHistory, nodes, edges]);

  // Toggle group collapse/expand
  const handleToggleGroupCollapse = useCallback((groupId) => {
    const result = groupManager.current.toggleGroupCollapse(groupId);
    if (result.success) {
      const group = result.data;
      // Update nodes visibility
      // This should be handled in the parent if needed
      setGroups(groupManager.current.getAllGroups());
      console.log(`Group ${groupId} ${group.collapsed ? 'collapsed' : 'expanded'}`);
    }
  }, [groupManager, setGroups]);

  // Update group bounds when nodes move
  const updateGroupBounds = useCallback(() => {
    let updated = false;
    groups.forEach(group => {
      const result = groupManager.current.updateGroupBounds(group.id, nodes);
      if (result.success) {
        updated = true;
      }
    });
    if (updated) {
      setGroups(groupManager.current.getAllGroups());
    }
  }, [groups, groupManager, nodes, setGroups]);

  return {
    handleCreateGroup,
    handleUngroupSelected,
    handleToggleGroupCollapse,
    updateGroupBounds
  };
}
