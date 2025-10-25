// ============================================
// 5. GraphEditor.js (MAIN - significantly reduced)
// ============================================
"use client";
import React, { useEffect } from 'react';
import NodeGraph from './NodeGraph';
import Toolbar from './Toolbar';
import DefaultNode from './GraphEditor/Nodes/DefaultNode';
import FixedNode from './GraphEditor/Nodes/FixedNode';
import MarkdownNode from './GraphEditor/Nodes/MarkdownNode';
import SvgNode from './GraphEditor/Nodes/SvgNode';
import NodeListPanel from './GraphEditor/NodeListPanel';
import GroupListPanel from './GraphEditor/GroupListPanel';
import GroupPropertiesPanel from './GraphEditor/GroupPropertiesPanel';
import { useTheme } from '@mui/material/styles';
import NodePropertiesPanel from './GraphEditor/NodePropertiesPanel';
import EdgePropertiesPanel from './GraphEditor/EdgePropertiesPanel';
import EdgeTypes from './GraphEditor/edgeTypes';
import { Snackbar, Alert, Backdrop, CircularProgress } from '@mui/material';
import eventBus from './NodeGraph/eventBus';

import { useGraphEditorState } from './GraphEditor/useGraphEditorState';
import { createGraphEditorHandlers, processQueuedUpdates } from './GraphEditor/graphEditorHandlers';
import { useGraphEditorSetup } from './GraphEditor/useGraphEditorSetup';
import useSelection from './GraphEditor/useSelection';
import useGraphHistory from './GraphEditor/useGraphHistory';
import useGraphShortcuts from './GraphEditor/useGraphShortcuts';
import useGroupManager from './GraphEditor/useGroupManager';
import useGraphModes from './GraphEditor/useGraphModes';

const nodeTypes = {
  default: DefaultNode,
  fixed: FixedNode,
  markdown: MarkdownNode,
  svg: SvgNode,
};

export default function GraphEditor({ backgroundImage }) {
  const theme = useTheme();
  const state = useGraphEditorState();
  
  const {
    nodes, setNodes, nodesRef,
    edges, setEdges, edgesRef,
    groups, setGroups,
    pan, setPan, zoom, setZoom,
    selectedNodeIds, setSelectedNodeIds,
    selectedEdgeIds, setSelectedEdgeIds,
    selectedGroupIds, setSelectedGroupIds,
    hoveredEdgeId, setHoveredEdgeId,
    hoveredNodeId, setHoveredNodeId,
    hoveredEdgeSource, hoveredEdgeTarget,
    showNodeList, setShowNodeList,
    showGroupList, setShowGroupList,
    showGroupProperties, setShowGroupProperties,
    snackbar, setSnackbar,
    loading,
    nodePanelAnchor, setNodePanelAnchor,
    nodeListAnchor, setNodeListAnchor,
    defaultNodeColor, defaultEdgeColor,
    groupManager
  } = state;
  
  // Determine if user is free (replace with real logic)
  const isFreeUser = localStorage.getItem('isFreeUser') === 'true';
  
  const selectionHook = useSelection({
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedGroupIds
  });
  
  const historyHook = useGraphHistory(nodes, edges, groups, setNodes, setEdges, setGroups);
  
  const modesHook = useGraphModes({
    nodes,
    setNodes,
    selectedNodeIds,
    edges
  });
  
  const groupManagerHook = useGroupManager({
    groups, setGroups,
    nodes, setNodes,
    edges, setEdges,
    setSelectedNodeIds,
    setSelectedGroupIds,
    selectedNodeIds,
    selectedGroupIds,
    groupManager,
    saveToHistory: historyHook.saveToHistory
  });
  
  const handlers = createGraphEditorHandlers({
    graphAPI: null, // Will be set by setup
    state,
    historyHook,
    groupManagerHook,
    selectionHook,
    modesHook
  });
  
  const graphAPI = useGraphEditorSetup(state, handlers, historyHook);
  
  // Update handlers with graphAPI reference
  handlers.graphAPI = graphAPI;
  
  useGraphShortcuts({
    setNodes,
    setEdges,
    selectedNodeIds,
    selectedEdgeIds,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    handleDeleteSelected: handlers.handleDeleteSelected,
    clearSelection: selectionHook.clearSelection,
    handleCreateGroup: handlers.handleCreateGroupWrapper,
    handleUngroupSelected: handlers.handleUngroupSelectedWrapper,
    saveToHistory: historyHook.saveToHistory,
    edgesRef,
    nodesRef
  });
  
  // Panel anchor synchronization
  useEffect(() => {
    const handlePropertiesOpen = () => {
      const oppositeAnchor = nodePanelAnchor === 'right' ? 'left' : 'right';
      setNodeListAnchor(oppositeAnchor);
    };
    
    eventBus.on('openNodeProperties', handlePropertiesOpen);
    
    if (showNodeList) {
      const oppositeAnchor = nodePanelAnchor === 'right' ? 'left' : 'right';
      setNodeListAnchor(oppositeAnchor);
    }
    
    return () => {
      eventBus.off('openNodeProperties', handlePropertiesOpen);
    };
  }, [showNodeList, nodePanelAnchor, setNodeListAnchor]);
  
  // After GraphCRUD instance is created (assume variable is graphAPI)
  useEffect(() => {
    if (graphAPI && graphAPI.current) {
      window.graphAPI = graphAPI.current;
    }
  }, [graphAPI]);
  
  // Log Graph API initialization
  useEffect(() => {
    if (graphAPI && graphAPI.current) {
      console.log("Graph API initialized:", graphAPI.current);

      // Process any queued updates
      try {
        processQueuedUpdates();
      } catch (err) {
        console.warn('processQueuedUpdates failed:', err);
      }
    } else {
      console.warn("Graph API is not yet initialized.");
    }
  }, [graphAPI]);
  
  // Listen for 'loadSaveFile' event and apply optional settings/viewport: setPan, setZoom, defaultNodeColor/defaultEdgeColor, and apply theme if theme object present in settings.
  useEffect(() => {
    function handleLoadSaveFile({ settings = {}, viewport = {} }) {
      try {
        if (viewport.pan) setPan(viewport.pan);
        if (typeof viewport.zoom === 'number') setZoom(viewport.zoom);
        if (settings.defaultNodeColor) state.defaultNodeColor = settings.defaultNodeColor;
        if (settings.defaultEdgeColor) state.defaultEdgeColor = settings.defaultEdgeColor;
        // Optionally apply theme colors if provided (emit event for UI-level theming)
        if (settings.theme) {
          eventBus.emit('applyThemeFromSave', settings.theme);
        }
      } catch (err) {
        console.warn('Failed to apply loaded save settings:', err);
      }
    }

    eventBus.on('loadSaveFile', handleLoadSaveFile);
    return () => eventBus.off('loadSaveFile', handleLoadSaveFile);
  }, [setPan, setZoom, state]);
  
  // Listen for 'fetchUrl' event from address bar
  useEffect(() => {
    const handleFetchUrl = async ({ url }) => {
      try {
        let fullUrl = url;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
          fullUrl = 'https://' + fullUrl;
        }
        console.log('Fetching URL:', fullUrl);
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error('Failed to fetch');
        const text = await response.text();
        
        // Try to parse as JSON (graph data)
        try {
          const jsonData = JSON.parse(text);
          // Check if it's graph data (has nodes or edges)
          if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
            // Load as graph
            const nodesToLoad = jsonData.nodes;
            const edgesToLoadFromJson = jsonData.edges || [];
            const groupsToLoadFromJson = jsonData.groups || [];
            handlers.handleLoadGraph(nodesToLoad, edgesToLoadFromJson, groupsToLoadFromJson);
            setSnackbar({ open: true, message: 'Graph loaded from URL', severity: 'success' });
            eventBus.emit('setAddress', fullUrl); // Update address bar
            return;
          }
        } catch {
          // Not JSON, treat as text
        }
        
        // Create text node
        const lines = text.trim().split('\n');
        const label = lines[0].substring(0, 50);
        const memo = text.trim();
        
        const width = Math.max(200, Math.min(600, label.length * 8 + 100));
        const height = Math.max(100, Math.min(400, lines.length * 20 + 50));
        
        const centerX = (window.innerWidth / 2 - pan.x) / zoom;
        const centerY = (window.innerHeight / 2 - pan.y) / zoom;
        
        const newNode = {
          id: `node_${Date.now()}`,
          label: label,
          type: 'default',
          position: { x: centerX, y: centerY },
          width: width,
          height: height,
          resizable: true,
          data: { memo: memo }
        };
        
        setNodes(prev => {
          const next = [...prev, newNode];
          nodesRef.current = next;
          return next;
        });
        
        historyHook.saveToHistory(nodesRef.current, edgesRef.current);
        setSnackbar({ open: true, message: 'Fetched and created node from URL', severity: 'success' });
        eventBus.emit('setAddress', fullUrl); // Update address bar
      } catch (error) {
        console.error('Error fetching URL:', error);
        setSnackbar({ open: true, message: 'Failed to fetch URL. Check the address and try again.', severity: 'error' });
      }
    };

    eventBus.on('fetchUrl', handleFetchUrl);
    return () => eventBus.off('fetchUrl', handleFetchUrl);
  }, [pan, zoom, setNodes, nodesRef, historyHook, setSnackbar, handlers]);
  
  // Suppress specific error message about asynchronous responses
  useEffect(() => {
    const handleError = (event) => {
      if (event.message.includes("A listener indicated an asynchronous response")) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("error", handleError);
    };
  }, []);
  
  // Close NodePropertiesPanel if selection is not exactly one node
  useEffect(() => {
    if (selectedNodeIds.length !== 1 && showNodeList) {
      setNodePanelAnchor(null);
    }
  }, [selectedNodeIds, showNodeList]);
  
  return (
    <div 
      id="graph-editor-background" 
      role="application"
      aria-label="Node graph editor"
      style={{
        minHeight: '100vh',
        minWidth: '100vw',
        backgroundColor: theme.palette.background.default,
        backgroundImage: backgroundImage ? `url('/background art/${backgroundImage}')` : undefined,
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Toolbar 
        onToggleNodeList={() => setShowNodeList(!showNodeList)}
        showNodeList={showNodeList}
        onToggleGroupList={() => setShowGroupList(!showGroupList)}
        showGroupList={showGroupList}
        nodes={nodes} 
        edges={edges} 
        groups={groups}
        onLoadGraph={handlers.handleLoadGraph}
        onAddNode={(type) => {
          console.log('GraphEditor.js: onAddNode called from Toolbar with type:', type);
          handlers.handleAddNode(type);
        }}
        onDeleteSelected={handlers.handleDeleteSelected}
        onClearGraph={handlers.handleClearGraph}
        onUndo={historyHook.handleUndo}
        onRedo={historyHook.handleRedo}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeId={selectedEdgeIds[0] || null}
        canUndo={historyHook.canUndo}
        canRedo={historyHook.canRedo}
        mode={modesHook.mode}
        autoLayoutType={modesHook.autoLayoutType}
        onModeChange={modesHook.handleModeChange}
        onAutoLayoutChange={modesHook.setAutoLayoutType}
        onApplyLayout={modesHook.applyAutoLayout}
        onShowMessage={(message, severity = 'info') => setSnackbar({ open: true, message, severity })}
        pan={pan}
        zoom={zoom}
        setNodes={setNodes}
        nodesRef={nodesRef}
        saveToHistory={historyHook.saveToHistory}
        edgesRef={edgesRef}
        isFreeUser={isFreeUser}
      />
      
      {selectedNodeIds.length === 1 && (
        <NodePropertiesPanel
          selectedNode={selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : null}
          onUpdateNode={(id, updates, options) => {
            // Immediate local update to keep UI responsive
            setNodes(prev => {
              const next = prev.map(n => {
                if (n.id === id) {
                  return {
                    ...n,
                    ...updates,
                    data: updates && updates.data ? { ...n.data, ...updates.data } : n.data,
                    position: updates && updates.position ? { ...n.position, ...updates.position } : n.position
                  };
                }
                return n;
              });
              nodesRef.current = next;
              try {
                historyHook.saveToHistory(next, edgesRef.current);
              } catch (err) {
                console.warn('Failed to save history after node update:', err);
              }
              return next;
            });

            // Also call existing handler if available (will queue/process appropriately)
            try {
              if (handlers && typeof handlers.handleUpdateNodeData === 'function') {
                handlers.handleUpdateNodeData(id, updates, options);
              }
            } catch (err) {
              console.warn('handlers.handleUpdateNodeData failed:', err);
            }
          }}
          theme={theme}
          anchor={nodePanelAnchor}
          onAnchorChange={setNodePanelAnchor}
          onClose={() => {}}
          defaultNodeColor={defaultNodeColor}
        />
      )}
      
      <NodeListPanel
        nodes={nodes}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        onNodeSelect={handlers.handleNodeListSelect}
        onNodeFocus={handlers.handleNodeFocus}
        onClose={() => setShowNodeList(false)}
        isOpen={showNodeList}
        theme={theme}
        anchor={nodeListAnchor}
        propertiesPanelAnchor={nodePanelAnchor}
      />

      <GroupListPanel
        groups={groups}
        selectedGroupId={selectedGroupIds[0] || null}
        selectedGroupIds={selectedGroupIds}
        onGroupSelect={handlers.handleGroupListSelect}
        onGroupFocus={handlers.handleGroupFocus}
        onGroupDoubleClick={handlers.handleGroupDoubleClickFromList}
        onGroupToggleVisibility={handlers.handleGroupToggleVisibility}
        onGroupDelete={handlers.handleGroupDelete}
        onClose={() => setShowGroupList(false)}
        isOpen={showGroupList}
        theme={theme}
      />
      
      <NodeGraph 
        nodes={nodes} 
        setNodes={setNodes}
        edges={edges} 
        groups={groups}
        setGroups={setGroups}
        pan={pan} 
        zoom={zoom} 
        setPan={setPan} 
        setZoom={setZoom}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedEdgeId={selectedEdgeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeIds={selectedEdgeIds}
        selectedGroupIds={selectedGroupIds}
        setSelectedNodeIds={setSelectedNodeIds}
        setSelectedEdgeIds={setSelectedEdgeIds}
        hoveredNodeId={hoveredNodeId}
        nodeTypes={nodeTypes}
        edgeTypes={EdgeTypes}
        mode={modesHook.mode}
        onNodeMove={(id, position) => {
          setNodes(prev => {
            const next = prev.map(n => n.id === id ? { ...n, position } : n);
            nodesRef.current = next;
            setTimeout(() => groupManagerHook.updateGroupBounds(), 0);
            eventBus.emit('nodeDrag', { nodeId: id, position });
            return next;
          });
        }}
        onEdgeClick={(edge, event) => {
          const isMultiSelect = event.ctrlKey || event.metaKey;
          const edgeId = typeof edge === 'string' ? edge : edge?.id;
          selectionHook.handleEdgeSelection(edgeId, isMultiSelect);
        }}
        onNodeClick={(nodeId, event) => {
          if (!event || event.type !== 'click') return;
          
          const isMultiSelect = event?.ctrlKey || event?.metaKey || false;
          const isSelected = selectedNodeIds.includes(nodeId);
          
          if (isMultiSelect) {
            selectionHook.handleNodeSelection(nodeId, true);
          } else if (isSelected) {
            eventBus.emit('selectedNodeClick', { nodeId });
          } else {
            setSelectedNodeIds([nodeId]);
            setSelectedEdgeIds([]);
          }
        }}
        onNodeDoubleClick={handlers.handleNodeDoubleClick}
        onEdgeDoubleClick={handlers.handleEdgeDoubleClick}
        onGroupClick={(groupId, event, action) => {
          if (action === 'toggle-collapse') {
            groupManagerHook.handleToggleGroupCollapse(groupId);
            return;
          }

          if (action === 'select-members') {
            const group = groups.find(g => g.id === groupId);
            if (group) {
              setSelectedGroupIds([groupId]);
              setSelectedNodeIds(group.nodeIds ? [...group.nodeIds] : []);
              setSelectedEdgeIds([]);
            } else {
              const isMultiSelect = event?.ctrlKey || event?.metaKey || false;
              selectionHook.handleGroupSelection(groupId, isMultiSelect);
            }
            return;
          }

          const isMultiSelect = event?.ctrlKey || event?.metaKey || false;
          selectionHook.handleGroupSelection(groupId, isMultiSelect);
        }}
        onBackgroundClick={() => {
          selectionHook.clearSelection();
          eventBus.emit('backgroundClick');
        }}
        onEdgeHover={id => setHoveredEdgeId(id)}
        onNodeHover={id => setHoveredNodeId(id)}
        hoveredEdgeId={hoveredEdgeId}
        hoveredEdgeSource={hoveredEdgeSource}
        hoveredEdgeTarget={hoveredEdgeTarget}
        onNodeDragEnd={(id, position) => {
          setNodes(prev => {
            const next = prev.map(n => n.id === id ? { ...n, position } : n);
            nodesRef.current = next;
            eventBus.emit('nodeDragEnd', { nodeId: id, position });
            historyHook.saveToHistory(next, edgesRef.current);
            return next;
          });
        }}
      />
      
      {selectedEdgeIds.length === 1 && edges.find(e => e.id === selectedEdgeIds[0]) && (
        <EdgePropertiesPanel
          selectedEdge={{
            ...edges.find(e => e.id === selectedEdgeIds[0]),
            sourceNode: nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeIds[0])?.source),
            targetNode: nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeIds[0])?.target)
          }}
          edgeTypes={EdgeTypes}
          onUpdateEdge={handlers.handleUpdateEdge}
          theme={theme}
          defaultEdgeColor={defaultEdgeColor}
        />
      )}

      {showGroupProperties && selectedGroupIds.length === 1 && (
        <GroupPropertiesPanel
          selectedGroup={groups.find(g => g.id === selectedGroupIds[0])}
          nodes={nodes}
          onUpdateGroup={handlers.handleUpdateGroup}
          onUngroupGroup={handlers.handleUngroupSelectedWrapper}
          onAddNodes={handlers.handleAddNodesToGroup}
          onRemoveNodes={handlers.handleRemoveNodesFromGroup}
          onClose={() => setShowGroupProperties(false)}
          theme={theme}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Backdrop open={loading} sx={{ zIndex: 1900, color: '#fff' }}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );
}