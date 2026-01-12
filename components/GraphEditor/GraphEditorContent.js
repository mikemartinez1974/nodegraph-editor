"use client";

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { useTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { Snackbar, Alert, Backdrop, CircularProgress } from '@mui/material';
import GraphRendererAdapter from './renderers/GraphRendererAdapter';
import Toolbar from './components/Toolbar';
import MobileFabToolbar from './components/MobileFabToolbar';
import MobileAddNodeSheet from './components/MobileAddNodeSheet';
import PropertiesPanel from './components/PropertiesPanel';
import NodeListPanel from './components/NodeListPanel';
import NodePalettePanel from './components/NodePalettePanel';
import GroupListPanel from './components/GroupListPanel';
import DocumentPropertiesDialog from './components/DocumentPropertiesDialog';
import NewTabPage from './components/NewTabPage';
import ScriptRunner from './Scripting/ScriptRunner';
import ScriptPanel from './Scripting/ScriptPanel';
import BackgroundFrame from './components/BackgroundFrame';
import EdgeTypes from './edgeTypes';
import eventBus from '../NodeGraph/eventBus';
import { createThemeFromConfig } from './utils/themeUtils';
import {
  useGraphEditorStateContext,
  useGraphEditorLayoutContext,
  useGraphEditorServicesContext,
  useGraphEditorHistoryContext,
  useGraphEditorRpcContext
} from './providers/GraphEditorContext';
import useIntentEmitter from './hooks/useIntentEmitter';

const GraphEditorContent = () => {
  const theme = useTheme();
  const state = useGraphEditorStateContext();
  const layout = useGraphEditorLayoutContext();
  const services = useGraphEditorServicesContext();
  const historyHook = useGraphEditorHistoryContext();
  const rpc = useGraphEditorRpcContext();
  const isEmbedded = typeof window !== 'undefined' && window.__Twilite_EMBED__ === true;

  const {
    nodes,
    setNodes,
    nodesRef,
    edges,
    setEdges,
    edgesRef,
    groups,
    setGroups,
    pan,
    setPan,
    zoom,
    setZoom,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeIds,
    setSelectedEdgeIds,
    selectedGroupIds,
    setSelectedGroupIds,
    hoveredEdgeId,
    setHoveredEdgeId,
    hoveredNodeId,
    snackbar,
    setSnackbar,
    loading,
    nodePanelAnchor,
    defaultNodeColor,
    defaultEdgeColor,
    edgeRoutes,
    groupManager
  } = state || {};

  const {
    showMinimap,
    snapToGrid,
    setSnapToGrid,
    showGrid,
    lockedNodes,
    setLockedNodes,
    lockedEdges,
    setLockedEdges,
    showAllEdgeLabels,
    showPropertiesPanel,
    setShowPropertiesPanel,
    graphRenderKey,
    mobileAddNodeOpen,
    mobileAddNodeSearch,
    setMobileAddNodeSearch,
    memoAutoExpandToken,
    documentSettings,
    setDocumentSettings,
    documentTheme,
    documentBackgroundImage,
    projectMeta,
    backgroundUrl,
    setBackgroundUrl,
    backgroundInteractive,
    showDocumentPropertiesDialog,
    setShowDocumentPropertiesDialog,
    showNodePalette,
    setShowNodePalette,
    showNodeList,
    setShowNodeList,
    showGroupList,
    setShowGroupList,
    handleOpenDocumentProperties,
    handleOpenMobileAddNode,
    handleCloseMobileAddNode,
    togglePropertiesPanel,
    toggleNodePalette,
    toggleNodeList,
    toggleGroupList,
    handlePropertiesPanelAnchorChange,
    graphStats,
    recentSnapshots,
    storySnapshots,
    handleUpdateProjectMeta,
    handleResetProjectMeta,
    isMobile,
    isSmallScreen,
    isPortrait,
    isLandscape,
    addressBarHeight,
    backgroundImage,
    isFreeUser
  } = layout || {};

  const {
    handlers,
    graphAPI,
    graphCRUD,
    handleLoadGraph,
    handleFitToNodes,
    handleAlignSelection,
    handleDistributeSelection,
    modesHook,
    nodeTypes,
    nodeTypeMetadata,
    handleScriptRequest
  } = services || {};

  const { emitEdgeIntent } = useIntentEmitter();

  const {
    bgRef,
    handleHandshakeComplete
  } = rpc || {};

  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const memoizedEdges = useMemo(() => edges, [edges]);
  const memoizedGroups = useMemo(() => groups, [groups]);
  const memoizedSelectedNodeIds = useMemo(() => selectedNodeIds, [selectedNodeIds]);
  const memoizedSelectedEdgeIds = useMemo(() => selectedEdgeIds, [selectedEdgeIds]);
  const memoizedSelectedGroupIds = useMemo(() => selectedGroupIds, [selectedGroupIds]);

  const memoizedSetNodes = useCallback(setNodes, [setNodes]);
  const memoizedSetEdges = useCallback(setEdges, [setEdges]);
  const memoizedSetGroups = useCallback(setGroups, [setGroups]);
  const memoizedSetSelectedNodeIds = useCallback(setSelectedNodeIds, [setSelectedNodeIds]);
  const memoizedSetSelectedEdgeIds = useCallback(setSelectedEdgeIds, [setSelectedEdgeIds]);
  const memoizedSetPan = useCallback(setPan, [setPan]);
  const memoizedSetZoom = useCallback(setZoom, [setZoom]);

  const handleEdgeRoutingChange = useCallback((value) => {
    emitEdgeIntent('edgeRoutingChange', { value });
    if (typeof setDocumentSettings === 'function') {
      setDocumentSettings((prev) => ({ ...prev, edgeRouting: value }));
    }
  }, [emitEdgeIntent, setDocumentSettings]);

  const handleRerouteEdges = useCallback(() => {
    emitEdgeIntent('toolbarReroute');
  }, [emitEdgeIntent]);

  const handleApplyLayout = useCallback(() => {
    emitEdgeIntent('applyLayout', { layoutType: modesHook.autoLayoutType });
    modesHook.applyAutoLayout();
  }, [emitEdgeIntent, modesHook.applyAutoLayout, modesHook.autoLayoutType]);

  const documentMuiTheme = useMemo(() => {
    if (documentTheme) {
      return createThemeFromConfig(documentTheme);
    }
    return null;
  }, [documentTheme]);

  const handleToggleMinimap = useCallback(() => {
    emitEdgeIntent('toggleMinimap', { enabled: !showMinimap });
    eventBus.emit('toggleMinimap');
  }, [emitEdgeIntent, showMinimap]);

  const graphRendererKey = `${backgroundUrl || 'no-background'}-${graphRenderKey}`;
  const createGraphRenderer = () => (
    <GraphRendererAdapter
      graphKey={graphRendererKey}
      nodeTypes={nodeTypes}
      edgeTypes={EdgeTypes}
      edgeRoutes={edgeRoutes}
      mode={modesHook.mode}
      backgroundUrl={backgroundUrl}
      backgroundInteractive={backgroundInteractive}
      backgroundImage={documentBackgroundImage}
      setSnackbar={setSnackbar}
      showMinimap={showMinimap}
      snapToGrid={snapToGrid}
      showGrid={showGrid}
      gridSize={documentSettings.gridSize}
      defaultEdgeRouting={documentSettings.edgeRouting}
      edgeLaneGapPx={documentSettings.layout?.edgeLaneGapPx}
      lockedNodes={lockedNodes}
      lockedEdges={lockedEdges}
      onEdgeClick={undefined}
      onEdgeHover={undefined}
      hoveredEdgeId={hoveredEdgeId}
      showAllEdgeLabels={showAllEdgeLabels}
    />
  );

  useEffect(() => {
    const handleNodeDragEndIntent = () => {
      emitEdgeIntent('nodeDragEnd');
    };
    eventBus.on('nodeDragEnd', handleNodeDragEndIntent);
    return () => eventBus.off('nodeDragEnd', handleNodeDragEndIntent);
  }, [emitEdgeIntent]);

  const handleToggleSnapToGrid = useCallback(() => {
    setSnapToGrid(prev => {
      const next = !prev;
      emitEdgeIntent('toggleSnapToGrid', { enabled: next });
      return next;
    });
  }, [setSnapToGrid, emitEdgeIntent]);

  const showSnackbar = useCallback((message, severity = 'info', options = {}) => {
    setSnackbar({ open: true, message, severity, ...options });
  }, [setSnackbar]);

  const lastClipboardMessageRef = useRef('');
  const wasSnackbarOpenRef = useRef(false);

  useEffect(() => {
    const isOpen = Boolean(snackbar?.open);
    if (!isOpen) {
      wasSnackbarOpenRef.current = false;
      return;
    }
    if (!snackbar?.copyToClipboard) {
      wasSnackbarOpenRef.current = true;
      return;
    }
    const message = snackbar?.message ? String(snackbar.message) : '';
    const shouldCopy = !wasSnackbarOpenRef.current || message !== lastClipboardMessageRef.current;
    wasSnackbarOpenRef.current = true;
    if (!message || !shouldCopy) return;
    lastClipboardMessageRef.current = message;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(message).catch((err) => {
      console.warn('[Snackbar] Failed to copy message to clipboard', err);
    });
  }, [snackbar?.open, snackbar?.message, snackbar?.copyToClipboard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyGraph = (data) => {
      if (!data || typeof data !== 'object') return;
      const nodesToLoad = Array.isArray(data.nodes) ? data.nodes : [];
      const edgesToLoad = Array.isArray(data.edges) ? data.edges : [];
      const groupsToLoad = Array.isArray(data.groups) ? data.groups : [];

      if (typeof handleLoadGraph === 'function') {
        handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
        return;
      }

      if (nodesToLoad.length && typeof setNodes === 'function') {
        setNodes(nodesToLoad);
        if (nodesRef) nodesRef.current = nodesToLoad;
      }
      if (edgesToLoad.length && typeof setEdges === 'function') {
        setEdges(edgesToLoad);
        if (edgesRef) edgesRef.current = edgesToLoad;
      }
      if (groupsToLoad.length && typeof setGroups === 'function') {
        setGroups(groupsToLoad);
      }
    };

    window.__Twilite_APPLY_GRAPH__ = applyGraph;
    window.TwiliteApplyGraph = applyGraph;
    if (window.__Twilite_PENDING_GRAPH__) {
      const pending = window.__Twilite_PENDING_GRAPH__;
      window.__Twilite_PENDING_GRAPH__ = null;
      applyGraph(pending);
    }
    try {
      window.dispatchEvent(new CustomEvent('Twilite-ready'));
    } catch {}

    return () => {
      if (window.__Twilite_APPLY_GRAPH__ === applyGraph) {
        delete window.__Twilite_APPLY_GRAPH__;
      }
      if (window.TwiliteApplyGraph === applyGraph) {
        delete window.TwiliteApplyGraph;
      }
    };
  }, [handleLoadGraph, setNodes, setEdges, setGroups, nodesRef, edgesRef]);

  const isGraphEmpty = (!nodes || nodes.length === 0) && (!edges || edges.length === 0) && (!groups || groups.length === 0);
  // The gallery/new-tab surface now appears only when explicitly requested.
  const showNewTabPage = false;

  const handleCreateBlankGraph = useCallback(() => {
    const newNode = {
      id: `node_${Date.now()}`,
      label: 'New Node',
      type: 'default',
      position: { x: 0, y: 0 },
      width: 200,
      height: 120,
      data: { memo: '' }
    };

    setNodes(() => {
      const next = [newNode];
      nodesRef.current = next;
      return next;
    });

    setEdges(() => {
      const next = [];
      edgesRef.current = next;
      return next;
    });

    setGroups(() => []);
    historyHook.saveToHistory([newNode], []);
    setSelectedNodeIds([newNode.id]);
  }, [setNodes, nodesRef, setEdges, edgesRef, setGroups, historyHook, setSelectedNodeIds]);

  const handleImportGraph = useCallback((nodesToLoad, edgesToLoad, groupsToLoad) => {
    emitEdgeIntent('loadGraph', {
      nodes: Array.isArray(nodesToLoad) ? nodesToLoad.length : 0,
      edges: Array.isArray(edgesToLoad) ? edgesToLoad.length : 0,
      groups: Array.isArray(groupsToLoad) ? groupsToLoad.length : 0
    });
    if (typeof handleLoadGraph === 'function') {
      handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
    }
  }, [handleLoadGraph, emitEdgeIntent]);

  const handleDeleteSelectedIntent = useCallback(() => {
    emitEdgeIntent('deleteSelection', {
      selectedNodeCount: selectedNodeIds?.length || 0,
      selectedEdgeCount: selectedEdgeIds?.length || 0
    });
    handlers?.handleDeleteSelected?.();
  }, [emitEdgeIntent, handlers, selectedNodeIds, selectedEdgeIds]);

  const handleClearGraphIntent = useCallback(() => {
    emitEdgeIntent('clearGraph');
    handlers?.handleClearGraph?.();
  }, [emitEdgeIntent, handlers]);

  const handleUndoIntent = useCallback(() => {
    emitEdgeIntent('undo');
    historyHook.handleUndo();
  }, [emitEdgeIntent, historyHook.handleUndo]);

  const handleRedoIntent = useCallback(() => {
    emitEdgeIntent('redo');
    historyHook.handleRedo();
  }, [emitEdgeIntent, historyHook.handleRedo]);

  const handleTogglePropertiesPanelIntent = useCallback(() => {
    emitEdgeIntent('togglePropertiesPanel', { open: !showPropertiesPanel });
    togglePropertiesPanel?.();
  }, [emitEdgeIntent, togglePropertiesPanel, showPropertiesPanel]);

  const handleToggleNodeListIntent = useCallback(() => {
    emitEdgeIntent('toggleNodeList', { open: !showNodeList });
    toggleNodeList?.();
  }, [emitEdgeIntent, toggleNodeList, showNodeList]);

  const handleToggleGroupListIntent = useCallback(() => {
    emitEdgeIntent('toggleGroupList', { open: !showGroupList });
    toggleGroupList?.();
  }, [emitEdgeIntent, toggleGroupList, showGroupList]);

  const handleToggleNodePaletteIntent = useCallback(() => {
    emitEdgeIntent('toggleNodePalette', { open: !showNodePalette });
    toggleNodePalette?.();
  }, [emitEdgeIntent, toggleNodePalette, showNodePalette]);

  const handleOpenDocumentPropertiesIntent = useCallback(() => {
    emitEdgeIntent('openDocumentProperties');
    handleOpenDocumentProperties?.();
  }, [emitEdgeIntent, handleOpenDocumentProperties]);

  const handleToggleScriptPanelIntent = useCallback(() => {
    emitEdgeIntent('toggleScriptPanel');
    eventBus.emit('toggleScriptPanel');
  }, [emitEdgeIntent]);

  const handleNodeListSelectIntent = useCallback((nodeId, multiSelect) => {
    emitEdgeIntent('nodeListSelect', { nodeId, multiSelect });
    handlers?.handleNodeListSelect?.(nodeId, multiSelect);
  }, [emitEdgeIntent, handlers]);

  const handleNodeListFocusIntent = useCallback((nodeId) => {
    emitEdgeIntent('nodeListFocus', { nodeId });
    handlers?.handleNodeFocus?.(nodeId);
  }, [emitEdgeIntent, handlers]);

  const handleNodeListCloseIntent = useCallback(() => {
    emitEdgeIntent('closeNodeList');
    setShowNodeList(false);
  }, [emitEdgeIntent]);

  const handleGroupListSelectIntent = useCallback((groupId, multiSelect) => {
    emitEdgeIntent('groupListSelect', { groupId, multiSelect });
    handlers?.handleGroupListSelect?.(groupId, multiSelect);
  }, [emitEdgeIntent, handlers]);

  const handleGroupListFocusIntent = useCallback((groupId) => {
    emitEdgeIntent('groupListFocus', { groupId });
    handlers?.handleGroupFocus?.(groupId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupListDoubleClickIntent = useCallback((groupId) => {
    emitEdgeIntent('groupListDoubleClick', { groupId });
    handlers?.handleGroupDoubleClickFromList?.(groupId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupToggleVisibilityIntent = useCallback((groupId) => {
    emitEdgeIntent('groupToggleVisibility', { groupId });
    handlers?.handleGroupToggleVisibility?.(groupId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupDeleteIntent = useCallback((groupId) => {
    emitEdgeIntent('groupDelete', { groupId });
    handlers?.handleGroupDelete?.(groupId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupListCloseIntent = useCallback(() => {
    emitEdgeIntent('closeGroupList');
    setShowGroupList(false);
  }, [emitEdgeIntent]);

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
        position: 'relative'
      }}
    >
      {backgroundUrl && (
        <BackgroundFrame
          ref={bgRef}
          url={backgroundUrl}
          interactive={backgroundInteractive}
          onHandshakeComplete={handleHandshakeComplete}
        />
      )}

      {!isMobile && (
        <Toolbar
          onToggleNodeList={handleToggleNodeListIntent}
          showNodeList={showNodeList}
          onToggleGroupList={handleToggleGroupListIntent}
          showGroupList={showGroupList}
          onToggleNodePalette={handleToggleNodePaletteIntent}
          nodes={nodes}
          edges={edges}
          groups={groups}
          onLoadGraph={handleImportGraph}
          onDeleteSelected={handleDeleteSelectedIntent}
          onClearGraph={handleClearGraphIntent}
          onUndo={handleUndoIntent}
          onRedo={handleRedoIntent}
          selectedNodeId={selectedNodeIds[0] || null}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeId={selectedEdgeIds[0] || null}
          canUndo={historyHook.canUndo}
          canRedo={historyHook.canRedo}
          mode={modesHook.mode}
          autoLayoutType={modesHook.autoLayoutType}
          onModeChange={modesHook.handleModeChange}
          onAutoLayoutChange={modesHook.setAutoLayoutType}
          onApplyLayout={handleApplyLayout}
          onAlignSelection={handleAlignSelection}
          onDistributeSelection={handleDistributeSelection}
          onShowMessage={showSnackbar}
          pan={pan}
          zoom={zoom}
          setNodes={setNodes}
          setEdges={setEdges}
          setGroups={setGroups}
          nodesRef={nodesRef}
          edgesRef={edgesRef}
          saveToHistory={historyHook.saveToHistory}
          graphCRUD={graphCRUD}
          currentTheme={theme.palette.mode}
          backgroundImage={backgroundImage}
          backgroundUrl={backgroundUrl}
          setBackgroundUrl={setBackgroundUrl}
          defaultNodeColor={defaultNodeColor}
          defaultEdgeColor={defaultEdgeColor}
          isFreeUser={isFreeUser}
          showMinimap={showMinimap}
          onToggleMinimap={handleToggleMinimap}
          snapToGrid={snapToGrid}
          onToggleSnapToGrid={handleToggleSnapToGrid}
          gridSize={documentSettings.gridSize}
          edgeRouting={documentSettings.edgeRouting || 'auto'}
          onEdgeRoutingChange={handleEdgeRoutingChange}
          onRerouteEdges={handleRerouteEdges}
          githubSettings={documentSettings.github}
          onToggleProperties={handleTogglePropertiesPanelIntent}
          onToggleScriptPanel={handleToggleScriptPanelIntent}
          onOpenDocumentProperties={handleOpenDocumentPropertiesIntent}
          documentTheme={documentTheme}
          addressBarHeight={addressBarHeight}
          isMobile={isMobile}
          isSmallScreen={isSmallScreen}
          isPortrait={isPortrait}
          isLandscape={isLandscape}
        />
      )}

      {isMobile && <MobileFabToolbar />}

      <MobileAddNodeSheet
        open={Boolean(isMobile && mobileAddNodeOpen)}
        onClose={handleCloseMobileAddNode}
        search={mobileAddNodeSearch}
        onSearchChange={setMobileAddNodeSearch}
      />

      {showPropertiesPanel && (
      <PropertiesPanel
        selectedNode={selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : null}
        selectedEdge={selectedEdgeIds.length === 1 ? edges.find(e => e.id === selectedEdgeIds[0]) : null}
        selectedGroup={selectedGroupIds.length === 1 ? groups.find(g => g.id === selectedGroupIds[0]) : null}
        edges={edges}
        onUpdateNode={(id, updates, options) => {
          emitEdgeIntent('updateNode', {
            nodeId: id,
            changeCount: Object.keys(updates || {}).length,
            selectionCount: selectedNodeIds.length
          });
          setNodes(prev => {
            const next = prev.map(n => n.id === id ? { ...n, ...updates, data: updates?.data ? { ...n.data, ...updates.data } : n.data } : n);
            nodesRef.current = next;
            // Only save to history if not explicitly skipped
            if (!options || options !== true) {
              try { historyHook.saveToHistory(next, edgesRef.current); } catch (err) {}
            }
            return next;
          });
            const hasHandler = handlers && typeof handlers.handleUpdateNodeData === 'function';
            if (!options || options !== true) {
              try {
                if (hasHandler) {
                  handlers.handleUpdateNodeData(id, updates, options);
                }
              } catch (err) {}
            }
            if (options === true || !hasHandler) {
              try {
                eventBus.emit('nodeUpdated', { id, patch: updates || {} });
              } catch (err) {
                // ignore event bus errors
              }
            }
          }}
          onUpdateEdge={(id, updates) => {
            emitEdgeIntent('updateEdge', { edgeId: id, changeCount: Object.keys(updates || {}).length });
            setEdges(prev => {
              const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
              edgesRef.current = next;
              try { historyHook.saveToHistory(nodesRef.current, next); } catch (err) {}
              return next;
            });
            try {
              eventBus.emit('edgeUpdated', { id, patch: updates || {} });
            } catch (err) {
              // ignore event bus errors
            }
          }}
          onUpdateGroup={(id, updates) => {
            emitEdgeIntent('updateGroup', { groupId: id, changeCount: Object.keys(updates || {}).length });
            setGroups(prev => {
              const next = prev.map(g => g.id === id ? { ...g, ...updates } : g);
              const updatedGroup = next.find(g => g.id === id);
              if (updatedGroup) {
                try {
                  eventBus.emit('groupUpdated', { id, patch: updates || {}, group: updatedGroup });
                } catch (err) {
                  // ignore event bus errors
                }
              }
              return next;
            });
          }}
          theme={theme}
          defaultNodeColor={defaultNodeColor}
          defaultEdgeColor={defaultEdgeColor}
          lockedNodes={lockedNodes}
          lockedEdges={lockedEdges}
          lockedGroups={groupManager?.lockedGroups}
          onToggleNodeLock={(nodeId) => {
            setLockedNodes(prev => {
              const newSet = new Set(prev);
              if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
              } else {
                newSet.add(nodeId);
              }
              return newSet;
            });
          }}
          onToggleEdgeLock={(edgeId) => {
            setLockedEdges(prev => {
              const newSet = new Set(prev);
              if (newSet.has(edgeId)) {
                newSet.delete(edgeId);
              } else {
                newSet.add(edgeId);
              }
              return newSet;
            });
          }}
          onToggleGroupLock={groupManager?.toggleGroupLock}
          onClose={() => setShowPropertiesPanel(false)}
          anchor={nodePanelAnchor}
          onAnchorChange={handlePropertiesPanelAnchorChange}
          isMobile={isMobile}
          memoAutoExpandToken={memoAutoExpandToken}
        />
      )}

      <NodePalettePanel
        open={showNodePalette}
        onClose={() => setShowNodePalette(false)}
      />

      <NodeListPanel
        nodes={nodes}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        onNodeSelect={handleNodeListSelectIntent}
        onNodeFocus={handleNodeListFocusIntent}
        onClose={handleNodeListCloseIntent}
        isOpen={showNodeList}
        theme={theme}
        propertiesPanelAnchor={nodePanelAnchor}
        isMobile={isMobile}
        graphApiRef={graphAPI}
      />

      <GroupListPanel
        groups={groups}
        selectedGroupId={selectedGroupIds[0] || null}
        selectedGroupIds={selectedGroupIds}
        onGroupSelect={handleGroupListSelectIntent}
        onGroupFocus={handleGroupListFocusIntent}
        onGroupDoubleClick={handleGroupListDoubleClickIntent}
        onGroupToggleVisibility={handleGroupToggleVisibilityIntent}
        onGroupDelete={handleGroupDeleteIntent}
        onClose={handleGroupListCloseIntent}
        isOpen={showGroupList}
        theme={theme}
      />
      {showNewTabPage ? (
        <NewTabPage
          onCreateBlank={handleCreateBlankGraph}
          onImportGraph={handleImportGraph}
          onShowMessage={showSnackbar}
          recentSnapshots={recentSnapshots}
          isFreeUser={isFreeUser}
        />
      ) : documentMuiTheme ? (
        <MuiThemeProvider theme={documentMuiTheme}>
          {createGraphRenderer()}
        </MuiThemeProvider>
      ) : (
        createGraphRenderer()
      )}

      {!isEmbedded && <ScriptRunner onRequest={handleScriptRequest} />}
      {!isEmbedded && <ScriptPanel />}

      <DocumentPropertiesDialog
        open={showDocumentPropertiesDialog}
        onClose={() => setShowDocumentPropertiesDialog(false)}
        backgroundUrl={backgroundUrl}
        setBackgroundUrl={setBackgroundUrl}
        documentSettings={documentSettings}
        onDocumentSettingsChange={setDocumentSettings}
        projectMeta={projectMeta}
        onProjectMetaChange={handleUpdateProjectMeta}
        onResetProjectMeta={handleResetProjectMeta}
        graphStats={graphStats}
        recentSnapshots={recentSnapshots}
        storySnapshots={storySnapshots}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.autoHideDuration ?? 6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity || 'info'}
          action={snackbar.action || null}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Backdrop sx={{ color: '#fff', zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1 }} open={Boolean(loading)}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );
};

export default GraphEditorContent;
