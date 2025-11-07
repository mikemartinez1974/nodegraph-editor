// ============================================
// 2. GraphEditor/graphEditorHandlers.js
// All handler functions consolidated
// ============================================
import eventBus from '../../NodeGraph/eventBus';
import { generateUUID } from '../utils/idUtils';

// Debounce guard for delete operations (must be outside function to persist)
let deleteInProgress = false;

export function createGraphEditorHandlers({
  graphAPI,
  state,
  historyHook,
  groupManagerHook,
  selectionHook,
  modesHook
}) {
  const {
    nodes, setNodes, nodesRef,
    edges, setEdges, edgesRef,
    groups, setGroups,
    pan, zoom,
    selectedNodeIds, setSelectedNodeIds,
    selectedEdgeIds, setSelectedEdgeIds,
    selectedGroupIds, setSelectedGroupIds,
    groupManager,
    setSnackbar, setLoading
  } = state;
  
  const { saveToHistory } = historyHook;
  
  // ===== NODE HANDLERS =====
  const handleAddNode = (type = 'default', options = {}) => {
    console.log('[handleAddNode] Called with type:', type, 'options:', options);
    const { width = 200, height = 120 } = options;
    console.log('[handleAddNode] Using width:', width, 'height:', height);
    
    const centerX = (window.innerWidth / 2 - pan.x) / zoom;
    const centerY = (window.innerHeight / 2 - pan.y) / zoom;
    let api = graphAPI && graphAPI.current ? graphAPI.current : (typeof window !== 'undefined' && window.graphAPI ? window.graphAPI : null);
    if (!api || typeof api.createNode !== 'function') {
      console.error('graphAPI is not available or createNode is not a function');
      return;
    }
    const result = api.createNode({
      type: type, // Use the passed type
      label: 'New Node',
      data: { memo: '', link: '' },
      position: { x: centerX, y: centerY },
      width: width,
      height: height,
      resizable: true,
      handlePosition: 'center',
      showLabel: true
    });

    if (result.success) {
      // Remove direct setNodes calls from handleAddNode
      // Only use GraphCRUD API for node addition
    } else {
      console.error('Failed to create node:', result.error);
    }
  };
  
  // Simplified update handler: directly call graphAPI when available, otherwise fail fast.
  function handleUpdateNodeData(nodeId, updates) {
    if (!graphAPI || !graphAPI.current) {
      // graphAPI not ready; return failure without noisy logging
      return { success: false, error: 'graphAPI unavailable' };
    }

    try {
      const result = graphAPI.current.updateNode(nodeId, updates);
      return result;
    } catch (err) {
      // Log real errors
      console.error('Failed to update node via graphAPI:', err);
      return { success: false, error: err.message };
    }
  }
  
  const handleNodeListSelect = (nodeId, isMultiSelect = false) => {
    if (isMultiSelect) {
      selectionHook.handleNodeSelection(nodeId, true);
    } else {
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeIds([]);
    }
  };

  const handleNodeFocus = (nodeId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      state.setPan({
        x: window.innerWidth / 2 - node.position.x * zoom,
        y: window.innerHeight / 2 - node.position.y * zoom
      });
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeIds([]);
    }
  };

  const handleNodeDoubleClick = (nodeId) => {
    eventBus.emit('openNodeProperties');
  };
  
  // ===== EDGE HANDLERS =====
  const handleUpdateEdge = (edgeId, updates) => {
    let api = graphAPI && graphAPI.current ? graphAPI.current : (typeof window !== 'undefined' && window.graphAPI ? window.graphAPI : null);
    if (!api || typeof api.updateEdge !== 'function') {
      console.error('graphAPI is not available or updateEdge is not a function');
      return;
    }
    const result = api.updateEdge(edgeId, updates);
    if (!result.success) {
      console.error('Failed to update edge:', result.error);
    }
  };
  
  const handleEdgeDoubleClick = (edgeId) => {
    eventBus.emit('openEdgeProperties');
  };
  
  // ===== DELETE HANDLERS =====
  const handleDeleteSelected = () => {
    // Debounce guard to prevent double-execution
    if (deleteInProgress) {
      // console.log('DELETE: Already in progress, ignoring duplicate call');
      return;
    }
    
    // Early return if nothing is selected
    const hasSelection = 
      (selectedNodeIds && selectedNodeIds.length > 0) ||
      (selectedEdgeIds && selectedEdgeIds.length > 0) ||
      (selectedGroupIds && selectedGroupIds.length > 0);
    
    if (!hasSelection) {
      // console.log('DELETE: No selection, ignoring');
      return;
    }
    
    deleteInProgress = true;
    
    // console.log('DELETE DEBUG:', {
    //   selectedNodeIds,
    //   selectedEdgeIds,
    //   selectedGroupIds,
    //   edgesFromState: edges.map(e => ({ id: e.id, type: e.type, source: e.source, target: e.target })),
    //   edgesFromRef: edgesRef.current.map(e => ({ id: e.id, type: e.type, source: e.source, target: e.target }))
    // });
    
    if (selectedNodeIds && selectedNodeIds.length > 0) {
      // Use refs as source of truth for consistent deletion
      const deletedNodeId = selectedNodeIds[0];
      const affectedEdges = edgesRef.current.filter(e => 
        e.source === deletedNodeId || e.target === deletedNodeId
      );
      
      // console.log('DELETING NODE:', deletedNodeId, 'WILL REMOVE EDGES:', affectedEdges.map(e => ({ id: e.id, type: e.type, label: e.label })));
      
      const newNodes = nodesRef.current.filter(n => !selectedNodeIds.includes(n.id));
      const newEdges = edgesRef.current.filter(e => 
        !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
      );
      
      // console.log('AFTER DELETE - Nodes:', newNodes.length, 'Edges:', newEdges.length);
      
      nodesRef.current = newNodes;
      edgesRef.current = newEdges;
      setNodes(newNodes);
      setEdges(newEdges);
      setSelectedNodeIds([]);
      saveToHistory(newNodes, newEdges);
      
      // Force canvas redraw
      try {
        eventBus.emit('forceRedraw');
      } catch (e) {
        console.warn('Failed to emit forceRedraw:', e);
      }
    } else if (selectedEdgeIds && selectedEdgeIds.length > 0) {
      // Use ref as source of truth, update both ref and state atomically
      // console.log('DELETING EDGES:', selectedEdgeIds, 'FROM:', edgesRef.current.map(e => e.id));
      const newEdges = edgesRef.current.filter(e => !selectedEdgeIds.includes(e.id));
      // console.log('AFTER FILTER - New edges:', newEdges.map(e => e.id));
      edgesRef.current = newEdges;
      setEdges(newEdges);
      setSelectedEdgeIds([]);
      saveToHistory(nodesRef.current, newEdges);
      
      // Force canvas redraw to show edge removal immediately
      try {
        eventBus.emit('forceRedraw');
      } catch (e) {
        console.warn('Failed to emit forceRedraw:', e);
      }
    } else if (selectedGroupIds && selectedGroupIds.length > 0) {
      selectedGroupIds.forEach(groupId => {
        groupManager.current.removeGroup(groupId);
      });
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds([]);
      saveToHistory(nodesRef.current, edgesRef.current);
    }
    
    // Reset debounce guard after a short delay
    setTimeout(() => {
      deleteInProgress = false;
    }, 100);
  };
  
  const handleClearGraph = () => {
    const newNodes = [], newEdges = [], newGroups = [];
    // Update refs first, then state to ensure consistency
    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    setNodes(newNodes);
    setEdges(newEdges);
    setGroups(newGroups);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    groupManager.current?.clear?.();
    saveToHistory(newNodes, newEdges, newGroups);
  };
  
  // ===== LOAD/SAVE HANDLERS =====
  const handleLoadGraph = (loadedNodes, loadedEdges, loadedGroups = []) => {
    setNodes(prev => {
      nodesRef.current = loadedNodes;
      return loadedNodes;
    });
    setEdges(prev => {
      edgesRef.current = loadedEdges;
      return loadedEdges;
    });
    setGroups(loadedGroups);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    saveToHistory(loadedNodes, loadedEdges);

    if (loadedNodes.length > 0) {
      const firstNode = loadedNodes[0];
      state.setPan({
        x: window.innerWidth / 2 - firstNode.position.x * zoom,
        y: window.innerHeight / 2 - firstNode.position.y * zoom
      });
      // Do not auto-select or open the properties panel after loading a file
    }
  };
  
  // ===== GROUP HANDLERS =====
  const handleGroupListSelect = (groupId, isMultiSelect = false) => {
    selectionHook.handleGroupSelection(groupId, isMultiSelect);
  };

  const handleGroupFocus = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (group?.bounds) {
      state.setPan({
        x: window.innerWidth / 2 - (group.bounds.x + group.bounds.width / 2) * zoom,
        y: window.innerHeight / 2 - (group.bounds.y + group.bounds.height / 2) * zoom
      });
      setSelectedGroupIds([groupId]);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
    }
  };

  const handleGroupDoubleClickFromList = (groupId) => {
    state.setShowGroupProperties(true);
  };

  const handleGroupToggleVisibility = (groupId) => {
    const updatedGroups = groups.map(g =>
      g.id === groupId ? { ...g, visible: g.visible !== true } : g
    );
    setGroups(updatedGroups);
    saveToHistory(nodes, edges);
  };

  const handleGroupDelete = (groupId) => {
    const result = groupManager.current.removeGroup(groupId);
    if (result.success) {
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
      saveToHistory(nodes, edges);
    }
  };

  const handleUpdateGroup = (groupId, updates) => {
    const updatedGroups = groups.map(g =>
      g.id === groupId ? { ...g, ...updates } : g
    );
    setGroups(updatedGroups);
    saveToHistory(nodes, edges);
  };

  const handleAddNodesToGroup = (groupId, nodeIds) => {
    const result = groupManager.current.addNodesToGroup(groupId, nodeIds);
    if (result.success) {
      setGroups(groupManager.current.getAllGroups());
      saveToHistory(nodes, edges);
    }
  };

  const handleRemoveNodesFromGroup = (groupId, nodeIds) => {
    const result = groupManager.current.removeNodesFromGroup(groupId, nodeIds);
    if (result.success) {
      setGroups(groupManager.current.getAllGroups());
      saveToHistory(nodes, edges);
    }
  };
  
  const handleCreateGroupWrapper = () => {
    if (selectedNodeIds.length < 2) return;
    const result = groupManager.current.createGroup(selectedNodeIds, {
      nodes: nodes,
      label: `Group ${groups.length + 1}`
    });
    if (result.success) {
      setGroups([...groups, result.data]);
      setSelectedNodeIds([]);
      setSelectedGroupIds([result.data.id]);
      saveToHistory(nodes, edges);
    }
  };

  const handleUngroupSelectedWrapper = () => {
    if (selectedGroupIds.length === 0) return;
    let updated = false;
    selectedGroupIds.forEach(groupId => {
      if (groupManager.current.removeGroup(groupId).success) updated = true;
    });
    if (updated) {
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds([]);
      saveToHistory(nodes, edges);
    }
  };
  
  // ===== PASTE HANDLER =====
  const handlePasteGraphData = async (pastedData) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      let pastedNodes = [], pastedEdges = [], pastedGroups = [];

      if (!pastedData) return;

      // Parse input format
      if (Array.isArray(pastedData)) {
        if (pastedData[0]?.position && pastedData[0]?.id) pastedNodes = pastedData;
        else if (pastedData[0]?.source && pastedData[0]?.target) pastedEdges = pastedData;
        else if (pastedData[0]?.nodeIds) pastedGroups = pastedData;
      } else if (pastedData.nodes || pastedData.edges || pastedData.groups) {
        pastedNodes = pastedData.nodes || [];
        pastedEdges = pastedData.edges || [];
        pastedGroups = pastedData.groups || [];
      } else if (pastedData.id && pastedData.position) {
        pastedNodes = [pastedData];
      } else if (pastedData.id && pastedData.source && pastedData.target) {
        pastedEdges = [pastedData];
      } else if (pastedData.id && pastedData.nodeIds) {
        pastedGroups = [pastedData];
      }

      const sanitizeGroups = (groupsArray, availableNodeIdSet) => {
        return groupsArray.map(g => {
          const nodeIds = Array.isArray(g.nodeIds) ? g.nodeIds.filter(id => availableNodeIdSet.has(id)) : [];
          return { ...g, nodeIds };
        }).filter(g => g.nodeIds?.length >= 2);
      };

      let action = pastedData.action || (pastedNodes.length && pastedEdges.length ? 'replace' : 'add');

      if (action === 'replace') {
        const nodeIdSet = new Set(pastedNodes.map(n => n.id));
        const groupsSanitized = sanitizeGroups(pastedGroups, nodeIdSet);
        
        setNodes(prev => {
          nodesRef.current = pastedNodes;
          return pastedNodes;
        });
        setEdges(prev => {
          edgesRef.current = pastedEdges;
          return pastedEdges;
        });
        setGroups([]);
        groupManager.current?.clear?.();
        setGroups(groupsSanitized);
        
        groupsSanitized.forEach(g => {
          groupManager.current.groups.set(g.id, g);
          g.nodeIds?.forEach(nodeId => groupManager.current.nodeToGroup.set(nodeId, g.id));
        });
        
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        setSelectedGroupIds([]);
        saveToHistory(pastedNodes, pastedEdges, groupsSanitized);
      } else if (action === 'add') {
        const existingNodeIds = new Set(nodesRef.current.map(n => n.id));
        const existingEdgeIds = new Set(edgesRef.current.map(e => e.id));
        const existingGroupIds = new Set(groups.map(g => g.id));

        const nodesToAdd = pastedNodes.filter(n => !existingNodeIds.has(n.id));
        const edgesToAdd = pastedEdges.filter(e => !existingEdgeIds.has(e.id));
        const combinedNodeIds = new Set([...nodesRef.current.map(n => n.id), ...nodesToAdd.map(n => n.id)]);
        const groupsToAdd = sanitizeGroups(
          pastedGroups.filter(g => !existingGroupIds.has(g.id)),
          combinedNodeIds
        );

        const newNodes = [...nodesRef.current, ...nodesToAdd];
        const newEdges = [...edgesRef.current, ...edgesToAdd];
        const newGroups = [...groups, ...groupsToAdd];

        setNodes(prev => {
          nodesRef.current = newNodes;
          return newNodes;
        });
        setEdges(prev => {
          edgesRef.current = newEdges;
          return newEdges;
        });
        setGroups(newGroups);

        groupsToAdd.forEach(g => {
          groupManager.current.groups.set(g.id, g);
          g.nodeIds?.forEach(nodeId => groupManager.current.nodeToGroup.set(nodeId, g.id));
        });

        saveToHistory(newNodes, newEdges, newGroups);
      }
    } catch (err) {
      console.error('Error in handlePasteGraphData:', err);
      setSnackbar({ open: true, message: 'Error importing graph', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  return {
    // Node
    handleAddNode,
    handleUpdateNodeData,
    handleNodeListSelect,
    handleNodeFocus,
    handleNodeDoubleClick,
    
    // Edge
    handleUpdateEdge,
    handleEdgeDoubleClick,
    
    // Delete
    handleDeleteSelected,
    handleClearGraph,
    
    // Load/Save
    handleLoadGraph,
    handlePasteGraphData,
    
    // Group
    handleGroupListSelect,
    handleGroupFocus,
    handleGroupDoubleClickFromList,
    handleGroupToggleVisibility,
    handleGroupDelete,
    handleUpdateGroup,
    handleAddNodesToGroup,
    handleRemoveNodesFromGroup,
    handleCreateGroupWrapper,
    handleUngroupSelectedWrapper
  };
}

// Local helper: add a node directly to state (fallback path). Renamed to avoid clashing with exported handler.
let addNodeGuard = false;
export function handleAddNodeLocal({ nodesRef, setNodes, pan, zoom, defaultNodeColor = '#1976d2', nodeType = 'default' }) {
  if (addNodeGuard) return;
  addNodeGuard = true;
  setTimeout(() => { addNodeGuard = false; }, 100);

  setNodes(prev => {
    const existingIds = new Set(prev.map(n => n.id));
    const id = generateUUID(existingIds);
    const centerX = (window.innerWidth / 2 - (pan?.x || 0)) / (zoom || 1);
    const centerY = (window.innerHeight / 2 - (pan?.y || 0)) / (zoom || 1);

    const newNode = {
      id,
      label: 'New Node',
      type: nodeType,
      position: { x: centerX, y: centerY },
      width: 120,
      height: 60,
      color: defaultNodeColor,
      data: {}
    };

    // Deduplicate and add
    const next = deduplicateNodes([...prev, newNode]);
    console.log('handleAddNodeLocal: added', id);
    return next;
  });
}

// Import helper to merge imported nodes safely
export function handleImportNodes({ nodesRef, setNodes, importedNodes = [] }) {
  setNodes(prev => {
    const unique = ensureUniqueNodeIds(importedNodes, prev);
    const next = deduplicateNodes([...prev, ...unique]);
    console.log('handleImportNodes: setNodes ->', next.map(n => n.id));
    return next;
  });
}

// Helper for pasting nodes programmatically (used by external paste handlers)
export function handlePasteGraph({ nodesRef, setNodes, pastedNodes = [] }) {
  setNodes(prev => {
    const unique = ensureUniqueNodeIds(pastedNodes, prev);
    const next = deduplicateNodes([...prev, ...unique]);
    console.log('handlePasteGraph: setNodes ->', next.map(n => n.id));
    return next;
  });
}

// Keep previous export if present; ensure nothing else is broken
export { handleUpdateNodeData };
