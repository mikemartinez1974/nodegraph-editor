"use client";

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { useTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { Snackbar, Alert, Backdrop, CircularProgress } from '@mui/material';
import NodeGraph from '../NodeGraph';
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

const GraphEditorContent = () => {
  const theme = useTheme();
  const state = useGraphEditorStateContext();
  const layout = useGraphEditorLayoutContext();
  const services = useGraphEditorServicesContext();
  const historyHook = useGraphEditorHistoryContext();
  const rpc = useGraphEditorRpcContext();

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

  const documentMuiTheme = useMemo(() => {
    if (documentTheme) {
      return createThemeFromConfig(documentTheme);
    }
    return null;
  }, [documentTheme]);

  const handleToggleMinimap = useCallback(() => {
    eventBus.emit('toggleMinimap');
  }, []);

  const handleToggleSnapToGrid = useCallback(() => {
    setSnapToGrid(prev => !prev);
  }, [setSnapToGrid]);

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

  // Surface snackbar errors to the console with a trace so we can debug deep render loops.
  useEffect(() => {
    if (!snackbar?.open) return;
    if (snackbar.severity === 'error') {
      console.error('[Snackbar:error]', snackbar.message);
      // Trace to reveal the call site that triggered this snackbar.
      console.trace('[Snackbar:error trace]');
    }
  }, [snackbar]);

  // Global safety net: surface uncaught errors/rejections with traces so we can pinpoint drag/drop failures.
  useEffect(() => {
    const handleError = (event) => {
      console.error('[GlobalError]', event.message || event.error || event);
      if (event?.error?.stack) {
        console.error(event.error.stack);
      }
      console.trace('[GlobalError trace]');
    };
    const handleRejection = (event) => {
      console.error('[UnhandledRejection]', event.reason);
      if (event?.reason?.stack) {
        console.error(event.reason.stack);
      }
      console.trace('[UnhandledRejection trace]');
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

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
    if (typeof handleLoadGraph === 'function') {
      handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
    }
  }, [handleLoadGraph]);

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
          onToggleNodeList={toggleNodeList}
          showNodeList={showNodeList}
          onToggleGroupList={toggleGroupList}
          showGroupList={showGroupList}
          onToggleNodePalette={toggleNodePalette}
          nodes={nodes}
          edges={edges}
          groups={groups}
          onLoadGraph={handleLoadGraph}
          onDeleteSelected={handlers?.handleDeleteSelected}
          onClearGraph={handlers?.handleClearGraph}
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
          edgeRouting={documentSettings.edgeRouting}
          documentTheme={documentTheme}
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
            setNodes(prev => {
              const next = prev.map(n => n.id === id ? { ...n, ...updates, data: updates?.data ? { ...n.data, ...updates.data } : n.data } : n);
              nodesRef.current = next;
              // Only save to history if not explicitly skipped
              if (!options || options !== true) {
                try { historyHook.saveToHistory(next, edgesRef.current); } catch (err) {}
              }
              return next;
            });
            try {
              if (handlers && typeof handlers.handleUpdateNodeData === 'function') {
                handlers.handleUpdateNodeData(id, updates, options);
              }
            } catch (err) {}
          }}
          onUpdateEdge={(id, updates) => {
            setEdges(prev => {
              const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
              edgesRef.current = next;
              try { historyHook.saveToHistory(nodesRef.current, next); } catch (err) {}
              return next;
            });
          }}
          onUpdateGroup={(id, updates) => {
            setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
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
        onNodeSelect={handlers?.handleNodeListSelect}
        onNodeFocus={handlers?.handleNodeFocus}
        onClose={() => setShowNodeList(false)}
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
        onGroupSelect={handlers?.handleGroupListSelect}
        onGroupFocus={handlers?.handleGroupFocus}
        onGroupDoubleClick={handlers?.handleGroupDoubleClickFromList}
        onGroupToggleVisibility={handlers?.handleGroupToggleVisibility}
        onGroupDelete={handlers?.handleGroupDelete}
        onClose={() => setShowGroupList(false)}
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
          <NodeGraph
            key={`${backgroundUrl || 'no-background'}-${graphRenderKey}`}
            nodes={memoizedNodes}
            setNodes={memoizedSetNodes}
            setEdges={memoizedSetEdges}
            edges={memoizedEdges}
            groups={memoizedGroups}
            setGroups={memoizedSetGroups}
            pan={pan}
            zoom={zoom}
            setPan={memoizedSetPan}
            setZoom={memoizedSetZoom}
            selectedNodeId={memoizedSelectedNodeIds[0] || null}
            selectedEdgeId={memoizedSelectedEdgeIds[0] || null}
            selectedNodeIds={memoizedSelectedNodeIds}
            selectedEdgeIds={memoizedSelectedEdgeIds}
            selectedGroupIds={memoizedSelectedGroupIds}
            setSelectedNodeIds={memoizedSetSelectedNodeIds}
            setSelectedEdgeIds={memoizedSetSelectedEdgeIds}
            hoveredNodeId={hoveredNodeId}
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
            lockedNodes={lockedNodes}
            lockedEdges={lockedEdges}
            onEdgeClick={undefined}
            onEdgeHover={undefined}
            hoveredEdgeId={hoveredEdgeId}
            showAllEdgeLabels={showAllEdgeLabels}
          />
        </MuiThemeProvider>
      ) : (
        <NodeGraph
          key={`${backgroundUrl || 'no-background'}-${graphRenderKey}`}
          nodes={memoizedNodes}
          setNodes={memoizedSetNodes}
          setEdges={memoizedSetEdges}
          edges={memoizedEdges}
          groups={memoizedGroups}
          setGroups={memoizedSetGroups}
          pan={pan}
          zoom={zoom}
          setPan={memoizedSetPan}
          setZoom={memoizedSetZoom}
          selectedNodeId={memoizedSelectedNodeIds[0] || null}
          selectedEdgeId={memoizedSelectedEdgeIds[0] || null}
          selectedNodeIds={memoizedSelectedNodeIds}
          selectedEdgeIds={memoizedSelectedEdgeIds}
          selectedGroupIds={memoizedSelectedGroupIds}
          setSelectedNodeIds={memoizedSetSelectedNodeIds}
          setSelectedEdgeIds={memoizedSetSelectedEdgeIds}
          hoveredNodeId={hoveredNodeId}
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
          lockedNodes={lockedNodes}
          lockedEdges={lockedEdges}
          onEdgeClick={undefined}
          onEdgeHover={undefined}
          hoveredEdgeId={hoveredEdgeId}
          showAllEdgeLabels={showAllEdgeLabels}
        />
      )}

      <ScriptRunner onRequest={handleScriptRequest} />
      <ScriptPanel />

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
