// ============================================
// 5. GraphEditor.js (MAIN - significantly reduced)
// ============================================
"use client";
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../NodeGraph/eventBus';
import { useHandleClickHandler } from '../NodeGraph/eventHandlers';
import { generateUUID } from './utils/idUtils';
import { getNodeTypes, getAllNodeTypeMetadata } from './nodeTypeRegistry';
import EdgeTypes from './edgeTypes';
import { useGraphEditorState } from './hooks/useGraphEditorState';
import { createGraphEditorHandlers, handleUpdateNodeData } from './handlers/graphEditorHandlers';
import { useGraphEditorSetup } from './hooks/useGraphEditorSetup';
import useSelection from './hooks/useSelection';
import useGraphHistory from './hooks/useGraphHistory';
import useGraphShortcuts from './hooks/useGraphShortcuts';
import useGroupManager from './hooks/useGroupManager';
import useGraphModes from './hooks/useGraphModes';
import usePluginRegistry from './hooks/usePluginRegistry';
import { pasteFromClipboardUnified } from './handlers/pasteHandler';
import { GraphEditorContextProvider } from './providers/GraphEditorContext';
import GraphEditorContent from './GraphEditorContent';
import useDocumentMetadata from './hooks/useDocumentMetadata';
import useProjectMetadata from './hooks/useProjectMetadata';
import useGraphInteractions from './hooks/useGraphInteractions';
import usePluginRuntime from './hooks/usePluginRuntime';

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 120;
const roundTo3 = (value) => Math.round(value * 1000) / 1000;
const ensureNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
const BREADBOARD_SOCKET_NODE_TYPE = 'io.breadboard.sockets:socket';
const getNodeMetrics = (node) => {
  const position = node?.position || {};
  const x = ensureNumber(position.x, 0);
  const y = ensureNumber(position.y, 0);
  const width = ensureNumber(
    node?.width,
    ensureNumber(node?.data?.width, DEFAULT_NODE_WIDTH)
  );
  const height = ensureNumber(
    node?.height,
    ensureNumber(node?.data?.height, DEFAULT_NODE_HEIGHT)
  );
  const safeWidth = width > 0 ? width : DEFAULT_NODE_WIDTH;
  const safeHeight = height > 0 ? height : DEFAULT_NODE_HEIGHT;
  return {
    x,
    y,
    width: safeWidth,
    height: safeHeight,
    right: x + safeWidth,
    bottom: y + safeHeight,
    centerX: x + safeWidth / 2,
    centerY: y + safeHeight / 2
  };
};

const BREADBOARD_TARGET_RADIUS = 38;

const normalizeBoardRow = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
};

const buildBreadboardTargets = (allNodes = []) => {
  const targets = [];
  const socketNodes = allNodes.filter((node) => node?.type === 'io.breadboard.sockets:socket');
  socketNodes.forEach((node) => {
    const rows = Array.isArray(node?.data?.rows) ? node.data.rows : [];
    const column = Number(node?.data?.column);
    if (!Number.isFinite(column)) return;
    const baseX = Number(node?.position?.x) || 0;
    const baseY = Number(node?.position?.y) || 0;
    const height = Number(node?.height) || Number(node?.data?.height) || 0;
    const spacing = rows.length > 0 && height > 0 ? height / rows.length : 0;
    rows.forEach((row, index) => {
      const normalizedRow = normalizeBoardRow(row);
      if (!normalizedRow) return;
      const y = spacing
        ? baseY - height / 2 + spacing / 2 + spacing * index
        : baseY;
      targets.push({
        type: 'socket',
        row: normalizedRow,
        column,
        nodeId: node.id,
        handle: 'socket',
        label: `${normalizedRow}${column}`,
        x: baseX,
        y
      });
    });
  });

  const railNodes = allNodes.filter((node) => node?.type === 'io.breadboard.sockets:railSocket');
  railNodes.forEach((node) => {
    const rails = Array.isArray(node?.data?.rails) ? node.data.rails : [];
    const column = Number(node?.data?.column);
    if (!Number.isFinite(column)) return;
    const baseX = Number(node?.position?.x) || 0;
    const baseY = Number(node?.position?.y) || 0;
    const height = Number(node?.height) || Number(node?.data?.height) || 0;
    const spacing = rails.length > 0 && height > 0 ? height / rails.length : 0;
    rails.forEach((rail, index) => {
      const polarity = rail?.polarity === 'negative' ? 'negative' : 'positive';
      const y = spacing
        ? baseY - height / 2 + spacing / 2 + spacing * index
        : baseY;
      targets.push({
        type: 'rail',
        column,
        nodeId: node.id,
        handle: polarity === 'negative' ? 'negative' : 'positive',
        label: rail?.label || (polarity === 'negative' ? 'GND' : 'V+'),
        x: baseX,
        y
      });
    });
  });

  return targets;
};

const findNearestBreadboardTarget = (targets = [], point = {}, radius = BREADBOARD_TARGET_RADIUS) => {
  if (!Array.isArray(targets) || !targets.length) return null;
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const maxDist = radius * radius;
  let best = null;
  let bestDist = Infinity;
  targets.forEach((target) => {
    if (!target) return;
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  });
  if (bestDist <= maxDist) {
    return best;
  }
  return null;
};

export default function GraphEditor({ backgroundImage, isMobile, isSmallScreen, isPortrait, isLandscape }) {
  const theme = useTheme(); // Browser theme
  const { plugins } = usePluginRegistry();
  const nodeTypes = useMemo(() => getNodeTypes(), [plugins]);
  const nodeTypeMetadataList = useMemo(
    () => getAllNodeTypeMetadata(),
    [plugins]
  );
  const [showEdgePanel, setShowEdgePanel] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const autoSnapInitializedRef = useRef(false);
  const [showGrid, setShowGrid] = useState(false);
  const [lockedNodes, setLockedNodes] = useState(new Set());
  const [lockedEdges, setLockedEdges] = useState(new Set());
  const [showAllEdgeLabels, setShowAllEdgeLabels] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [graphRenderKey, setGraphRenderKey] = useState(0);
  const [mobileAddNodeOpen, setMobileAddNodeOpen] = useState(false);
  const [mobileAddNodeSearch, setMobileAddNodeSearch] = useState('');
  const [memoAutoExpandToken, setMemoAutoExpandToken] = useState(0);
  const firstGraphLoadHandledRef = useRef(false);

  const {
    documentSettings,
    documentUrl,
    documentBackgroundImage,
    documentTheme,
    setDocumentSettings,
    setDocumentUrl,
    setDocumentBackgroundImage,
    setDocumentTheme
  } = useDocumentMetadata();
  const {
    projectMeta,
    setProjectMeta,
    updateProjectMeta,
    resetProjectMeta,
    projectActivityInitializedRef
  } = useProjectMetadata();
  
  const backgroundRpcRef = useRef(() => Promise.reject(new Error('Background RPC not ready')));
  const backgroundRpcReadyRef = useRef(false);

  const state = useGraphEditorState();

// Destructure editor state immediately so variables like `pan` are available for subsequent effects
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
  } = state || {};

  const selectionSnapshotRef = useRef({
    nodeIds: Array.isArray(selectedNodeIds) ? [...selectedNodeIds] : [],
    edgeIds: Array.isArray(selectedEdgeIds) ? [...selectedEdgeIds] : [],
    groupIds: Array.isArray(selectedGroupIds) ? [...selectedGroupIds] : []
  });
  const lastPointerRef = useRef({ x: 0, y: 0, inside: false });
  const lastLoggedNodeIdRef = useRef(null);

  useEffect(() => {
    selectionSnapshotRef.current = {
      nodeIds: Array.isArray(selectedNodeIds) ? [...selectedNodeIds] : [],
      edgeIds: Array.isArray(selectedEdgeIds) ? [...selectedEdgeIds] : [],
      groupIds: Array.isArray(selectedGroupIds) ? [...selectedGroupIds] : []
    };
  }, [selectedNodeIds, selectedEdgeIds, selectedGroupIds]);

  useEffect(() => {
    if (!Array.isArray(selectedNodeIds) || selectedNodeIds.length !== 1) {
      lastLoggedNodeIdRef.current = null;
      return;
    }
    const currentId = selectedNodeIds[0];
    if (lastLoggedNodeIdRef.current === currentId) return;
    lastLoggedNodeIdRef.current = currentId;
    const node = Array.isArray(nodes) ? nodes.find((n) => n.id === currentId) : null;
    if (node) {
      console.info('[GraphEditor] Selected node snapshot:', node);
    }
  }, [selectedNodeIds, nodes]);

  // Track latest pointer (graph coords) from NodeGraph for smarter node placement.
  useEffect(() => {
    const handlePointerMove = (payload = {}) => {
      if (payload?.inside && payload.graph) {
        lastPointerRef.current = {
          x: Number(payload.graph.x) || 0,
          y: Number(payload.graph.y) || 0,
          inside: true,
          ts: Date.now()
        };
      } else {
        lastPointerRef.current = { x: 0, y: 0, inside: false, ts: Date.now() };
      }
    };
    eventBus.on('pointerMove', handlePointerMove);
    return () => eventBus.off('pointerMove', handlePointerMove);
  }, []);

  // Global mouse move fallback (ensures pointer stays fresh even when leaving the canvas briefly)
  useEffect(() => {
    const handleWindowMove = (e) => {
      const el = document.getElementById('graph-canvas');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const graphX = (e.clientX - rect.left - (pan?.x || 0)) / (zoom || 1);
      const graphY = (e.clientY - rect.top - (pan?.y || 0)) / (zoom || 1);
      lastPointerRef.current = {
        x: graphX,
        y: graphY,
        inside:
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom,
        ts: Date.now()
      };
    };
    window.addEventListener('mousemove', handleWindowMove);
    return () => window.removeEventListener('mousemove', handleWindowMove);
  }, [pan, zoom]);

  useEffect(() => {
    if (autoSnapInitializedRef.current) return;
    if (
      !snapToGrid &&
      Array.isArray(nodes) &&
      nodes.some(node => node?.type === BREADBOARD_SOCKET_NODE_TYPE)
    ) {
      setSnapToGrid(true);
      autoSnapInitializedRef.current = true;
    }
  }, [nodes, snapToGrid, setSnapToGrid]);

  // NEW: document (background page) state (no localStorage)
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [backgroundInteractive, setBackgroundInteractive] = useState(false);
const [showDocumentPropertiesDialog, setShowDocumentPropertiesDialog] = useState(false);
const handleOpenDocumentProperties = useCallback(() => {
  setShowDocumentPropertiesDialog(true);
}, [setShowDocumentPropertiesDialog]);


// Route node outputs through connected edges to target node inputs
useEffect(() => {
  const handleNodeOutput = ({ nodeId, outputName, value }) => {
    if (!nodeId) return;
    const currentEdges = edgesRef.current || [];
    currentEdges.forEach(edge => {
      if (!edge || edge.source !== nodeId) return;
      if (edge.sourceHandle && outputName && edge.sourceHandle !== outputName) return;
      if (!edge.target) return;
      eventBus.emit('nodeInput', {
        targetNodeId: edge.target,
        inputName: edge.targetHandle,
        value,
        edgeId: edge.id,
        sourceNodeId: nodeId,
        outputName: outputName || edge.sourceHandle || null
      });
    });
  };

  eventBus.on('nodeOutput', handleNodeOutput);
  return () => eventBus.off('nodeOutput', handleNodeOutput);
}, [edgesRef]);

// Normalize edges created with legacy handle objects so downstream logic sees string ids
useEffect(() => {
    if (!Array.isArray(edges) || edges.length === 0) return;
    let needsUpdate = false;
    const normalized = edges.map(edge => {
      if (edge && typeof edge.source === 'object' && edge.source !== null) {
        needsUpdate = true;
        const sourceNodeId = edge.source.nodeId ?? edge.source.id ?? '';
        const targetNodeObj = edge.target && typeof edge.target === 'object' ? edge.target : null;
        const targetNodeId = targetNodeObj ? (targetNodeObj.nodeId ?? targetNodeObj.id ?? '') : edge.target;
        return {
          ...edge,
          source: sourceNodeId || edge.source,
          target: targetNodeId || edge.target,
          sourceHandle: edge.source.handleKey || edge.sourceHandle,
          targetHandle: targetNodeObj?.handleKey || edge.targetHandle
        };
      }
      if (edge && typeof edge.target === 'object' && edge.target !== null) {
        needsUpdate = true;
        const targetNodeId = edge.target.nodeId ?? edge.target.id ?? '';
        return {
          ...edge,
          target: targetNodeId || edge.target,
          targetHandle: edge.target.handleKey || edge.targetHandle
        };
      }
      return edge;
    });
    if (needsUpdate) {
      setEdges(normalized);
    }
  }, [edges, setEdges]);

  const lastNodeTapRef = useRef({ id: null, time: 0 });
  const lastEdgeTapRef = useRef({ id: null, time: 0 });
  const lastGroupTapRef = useRef({ id: null, time: 0 });
  
  useEffect(() => {
    const relay = (eventName) => (payload = {}) => {
      const details = { nodeIds: Array.isArray(payload?.nodeIds) ? payload.nodeIds : [] };
      window.postMessage(
        {
          type: 'breadboard:relayNodeDrag',
          eventName,
          details
        },
        '*'
      );
    };
    const handleStart = relay('nodeDragStart');
    const handleEnd = relay('nodeDragEnd');
    eventBus.on('nodeDragStart', handleStart);
    eventBus.on('nodeDragEnd', handleEnd);
    return () => {
      eventBus.off('nodeDragStart', handleStart);
      eventBus.off('nodeDragEnd', handleEnd);
    };
  }, []);

  // Determine if user is free (replace with real logic)
  const isFreeUser = localStorage.getItem('isFreeUser') === 'true';

  // Initialize address bar to local file on mount
  useEffect(() => {
    eventBus.emit('setAddress', 'local://untitled.node');
  }, []);

  // Load saved document from settings when loading a file
  const selectionHook = useSelection({
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedGroupIds
  });
  
  useGraphInteractions({
    backgroundUrl,
    setPan,
    setZoom,
    nodes,
    setNodes,
    nodesRef,
    state,
    setDocumentUrl,
    setDocumentBackgroundImage,
    setDocumentSettings,
    setDocumentTheme,
    setBackgroundUrl,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setHoveredEdgeId,
    setHoveredNodeId,
    setShowEdgePanel,
    selectionHook
  });
  
  const historyHook = useGraphHistory(nodes, edges, groups, setNodes, setEdges, setGroups);

  useEffect(() => {
    if (!projectActivityInitializedRef.current) {
      projectActivityInitializedRef.current = true;
      return;
    }
    updateProjectMeta({ lastModified: new Date().toISOString() });
  }, [historyHook.historyIndex, projectActivityInitializedRef, updateProjectMeta]);

  useEffect(() => {
    if (memoAutoExpandToken > 0) {
      const timer = typeof window !== 'undefined'
        ? window.setTimeout(() => setMemoAutoExpandToken(0), 0)
        : null;
      return () => {
        if (timer !== null && typeof window !== 'undefined') {
          window.clearTimeout(timer);
        }
      };
    }
    return undefined;
  }, [memoAutoExpandToken, setMemoAutoExpandToken]);

  const graphStats = useMemo(() => {
    const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
    const edgeCount = Array.isArray(edges) ? edges.length : 0;
    const groupCount = Array.isArray(groups) ? groups.length : 0;
    return {
      nodeCount,
      edgeCount,
      groupCount,
      snapshotCount: historyHook.history.length,
      historyIndex: historyHook.historyIndex
    };
  }, [nodes, edges, groups, historyHook.history, historyHook.historyIndex]);

  const recentSnapshots = useMemo(() => {
    const snapshots = historyHook.history.slice(-5);
    const offset = historyHook.history.length - snapshots.length;
    return snapshots.map((snapshot, idx) => ({
      id: offset + idx + 1,
      nodeCount: (snapshot?.nodes || []).length,
      edgeCount: (snapshot?.edges || []).length,
      groupCount: (snapshot?.groups || []).length
    }));
  }, [historyHook.history]);

  const handleUpdateProjectMeta = useCallback(
    (updates) => updateProjectMeta(updates),
    [updateProjectMeta]
  );

  const handleResetProjectMeta = useCallback(
    () => resetProjectMeta(),
    [resetProjectMeta]
  );
  
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
  
  const breadboardTargets = useMemo(() => buildBreadboardTargets(nodes), [nodes]);
  const breadboardLayout = useMemo(() => ({ targets: breadboardTargets }), [breadboardTargets]);

  // Handlers are created after breadboardTargets to avoid referencing before init
  const handlers = useMemo(() => createGraphEditorHandlers({
      graphAPI: null, // Will be set by setup
      state,
      historyHook,
      groupManagerHook,
      selectionHook,
      modesHook,
      lastPointerRef,
      breadboardTargets,
      backgroundRpc: (method, args) => backgroundRpcRef.current?.(method, args),
      backgroundRpcReady: () => backgroundRpcReadyRef.current
    }), [
      state,
      historyHook,
      groupManagerHook,
      selectionHook,
      modesHook,
      lastPointerRef,
      breadboardTargets
    ]);
  
  const graphAPI = useGraphEditorSetup(state, handlers, historyHook);

  const pluginRuntime = usePluginRuntime({
    state,
    historyHook,
    graphAPI,
    selectionSnapshotRef,
    setSnackbar
  });

  const {
    graphCRUD,
    handleScriptRequest,
    backgroundRpc,
    backgroundRpcReady,
    backgroundPostEvent,
    backgroundRpcMethods,
    bgRef,
    handleHandshakeComplete,
    pluginRuntime: pluginRuntimeInfo
  } = pluginRuntime;

  useEffect(() => {
    backgroundRpcRef.current =
      typeof backgroundRpc === 'function'
        ? backgroundRpc
        : () => Promise.reject(new Error('Background RPC not ready'));
    backgroundRpcReadyRef.current = Boolean(backgroundRpcReady);
  }, [backgroundRpc, backgroundRpcReady]);

  useEffect(() => {
    eventBus.emit('backgroundRpc:methods', {
      ready: backgroundRpcReady,
      methods: backgroundRpcMethods || []
    });
  }, [backgroundRpcReady, backgroundRpcMethods]);

  useEffect(() => {
    if (!backgroundUrl) {
      eventBus.emit('backgroundRpc:methods', { ready: false, methods: [] });
    }
  }, [backgroundUrl]);

  useEffect(() => {
    const handleBackgroundLoadFailed = ({ url } = {}) => {
      setSnackbar({ open: true, message: `Document failed to load: ${url || ''}`, severity: 'warning' });
    };

    const handleClearBackground = () => {
      setBackgroundUrl('');
      setBackgroundInteractive(false);
      setSnackbar({ open: true, message: 'Document cleared', severity: 'info' });
    };

    const handleSetBackgroundUrl = ({ url }) => {
      setBackgroundUrl(url || '');
    };

    const handleSetBackgroundInteractive = ({ interactive }) => {
      setBackgroundInteractive(Boolean(interactive));
    };

    const handleSetBackgroundImage = ({ backgroundImage }) => {
      setDocumentBackgroundImage(backgroundImage || '');
    };

    const handleTestBackgroundRpc = async ({ method, args }) => {
      try {
        if (!backgroundRpcReady) {
          setSnackbar({ open: true, message: 'Background RPC not ready. Wait for handshake.', severity: 'warning' });
          return;
        }

        const result = await backgroundRpc(method || 'echo', args || { message: 'Hello from host!' });
        console.log('[GraphEditor] RPC result:', result);
        setSnackbar({ open: true, message: `RPC success: ${JSON.stringify(result)}`, severity: 'success' });
      } catch (err) {
        console.error('[GraphEditor] RPC error:', err);
        setSnackbar({ open: true, message: `RPC error: ${err.message}`, severity: 'error' });
      }
    };

    const handleExportGraph = async () => {
      try {
        const data = {
          nodes: nodesRef.current || nodes,
          edges: edgesRef.current || edges,
          groups: groups || [],
          settings: {
            defaultNodeColor,
            defaultEdgeColor,
            gridSize: documentSettings.gridSize,
            document: backgroundUrl ? { url: backgroundUrl } : null,
            theme: null
          },
          scripts: (function () {
            try {
              const raw = localStorage.getItem('scripts');
              return raw ? JSON.parse(raw) : [];
            } catch {
              return [];
            }
          })(),
          viewport: { pan, zoom }
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `graph_${Date.now()}.node`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setSnackbar({ open: true, message: 'Graph exported', severity: 'success' });
      } catch (err) {
        console.error('Failed to export graph', err);
        setSnackbar({ open: true, message: 'Failed to export graph', severity: 'error' });
      }
    };

    eventBus.on('backgroundLoadFailed', handleBackgroundLoadFailed);
    eventBus.on('clearBackgroundUrl', handleClearBackground);
    eventBus.on('setBackgroundUrl', handleSetBackgroundUrl);
    eventBus.on('setBackgroundInteractive', handleSetBackgroundInteractive);
    eventBus.on('setBackgroundImage', handleSetBackgroundImage);
    eventBus.on('exportGraph', handleExportGraph);
    eventBus.on('testBackgroundRpc', handleTestBackgroundRpc);

    return () => {
      eventBus.off('backgroundLoadFailed', handleBackgroundLoadFailed);
      eventBus.off('clearBackgroundUrl', handleClearBackground);
      eventBus.off('setBackgroundUrl', handleSetBackgroundUrl);
      eventBus.off('setBackgroundInteractive', handleSetBackgroundInteractive);
      eventBus.off('setBackgroundImage', handleSetBackgroundImage);
      eventBus.off('exportGraph', handleExportGraph);
      eventBus.off('testBackgroundRpc', handleTestBackgroundRpc);
    };
  }, [pan, zoom, nodes, edges, groups, defaultNodeColor, defaultEdgeColor, setSnackbar, backgroundRpc, backgroundRpcReady]);

  const handleOpenMobileAddNode = useCallback(() => {
    setMobileAddNodeOpen(true);
  }, []);

  const handleCloseMobileAddNode = useCallback(() => {
    setMobileAddNodeOpen(false);
    setMobileAddNodeSearch('');
  }, []);

  const togglePropertiesPanel = useCallback(() => {
    setShowPropertiesPanel(prev => !prev);
  }, []);

  const toggleNodeList = useCallback(() => {
    setShowNodeList(prev => !prev);
  }, [setShowNodeList]);

  const toggleGroupList = useCallback(() => {
    setShowGroupList(prev => !prev);
  }, [setShowGroupList]);

  const toggleNodePalette = useCallback(() => {
    setShowNodePalette(prev => !prev);
  }, []);

  const handlePropertiesPanelAnchorChange = useCallback((nextAnchor) => {
    setNodePanelAnchor(nextAnchor);
  }, [setNodePanelAnchor]);

  const handleFitToNodes = useCallback(() => {
    const fit = graphAPI?.current?.fitToNodes;
    if (typeof fit === 'function') {
      fit({
        padding: isSmallScreen ? 96 : 48,
        minZoom: 0.1,
        maxZoom: isMobile ? 1.2 : 3
      });
    }
  }, [graphAPI, isMobile, isSmallScreen]);

  const handleLoadGraph = useCallback((nodesToLoad = [], edgesToLoad = [], groupsToLoad = []) => {
    try {
      handlers.handleLoadGraph?.(nodesToLoad, edgesToLoad, groupsToLoad);
    } finally {
      setGraphRenderKey(prev => prev + 1);
      if (!firstGraphLoadHandledRef.current) {
        firstGraphLoadHandledRef.current = true;
        if (Array.isArray(nodesToLoad) && nodesToLoad.length > 0) {
          const firstNodeId = nodesToLoad[0]?.id;
          if (firstNodeId) {
            setSelectedNodeIds([firstNodeId]);
            setSelectedEdgeIds([]);
            setSelectedGroupIds([]);
          }
        }
        setShowPropertiesPanel(true);
        setMemoAutoExpandToken((token) => token + 1);
      }
    }
  }, [handlers, setSelectedNodeIds, setSelectedEdgeIds, setSelectedGroupIds, setShowPropertiesPanel, setMemoAutoExpandToken]);


  useEffect(() => {
    const handleRpcCallEvent = async ({ nodeId, method, args = {}, timeout = 10000 } = {}) => {
      if (!nodeId || !method) return;
      if (!backgroundRpcReady) {
        eventBus.emit('backgroundRpc:error', {
          nodeId,
          method,
          error: 'Background RPC not ready'
        });
        return;
      }
      try {
        const result = await backgroundRpc(method, args, timeout);
        eventBus.emit('backgroundRpc:response', { nodeId, method, result });
      } catch (err) {
        const message = err?.message || String(err);
        eventBus.emit('backgroundRpc:error', { nodeId, method, error: message });
      }
    };

    eventBus.on('backgroundRpc:call', handleRpcCallEvent);
    return () => eventBus.off('backgroundRpc:call', handleRpcCallEvent);
  }, [backgroundRpc, backgroundRpcReady]);

  useEffect(() => {
    const handlePostEvent = ({ eventName, payload } = {}) => {
      if (!eventName) return;
      try {
        backgroundPostEvent(eventName, payload);
      } catch (err) {
        console.warn('[GraphEditor] Failed to post background event:', err);
      }
    };

    eventBus.on('backgroundRpc:postEvent', handlePostEvent);
    return () => eventBus.off('backgroundRpc:postEvent', handlePostEvent);
  }, [backgroundPostEvent]);

  const handleAlignSelection = useCallback((mode) => {
    const selectedSet = new Set(selectedNodeIds);
    if (!mode || selectedSet.size <= 1) {
      return false;
    }

    let mutated = false;
    let snapshot = null;

    setNodes(prev => {
      const selectedNodes = prev.filter(node => selectedSet.has(node.id));
      if (selectedNodes.length <= 1) {
        snapshot = prev;
        return prev;
      }

      const metricsList = selectedNodes.map(getNodeMetrics);
      const bounds = {
        minX: Math.min(...metricsList.map(m => m.x)),
        minY: Math.min(...metricsList.map(m => m.y)),
        maxX: Math.max(...metricsList.map(m => m.right)),
        maxY: Math.max(...metricsList.map(m => m.bottom))
      };
      bounds.centerX = (bounds.minX + bounds.maxX) / 2;
      bounds.centerY = (bounds.minY + bounds.maxY) / 2;

      const updatePosition = (node, maybeX, maybeY) => {
        const currentPos = node.position || { x: 0, y: 0 };
        const targetX = typeof maybeX === 'number' ? roundTo3(maybeX) : currentPos.x;
        const targetY = typeof maybeY === 'number' ? roundTo3(maybeY) : currentPos.y;
        if (Math.abs(targetX - currentPos.x) < 0.0001 && Math.abs(targetY - currentPos.y) < 0.0001) {
          return node;
        }
        mutated = true;
        return {
          ...node,
          position: { ...currentPos, x: targetX, y: targetY }
        };
      };

      const next = prev.map(node => {
        if (!selectedSet.has(node.id)) return node;
        const metrics = getNodeMetrics(node);
        switch (mode) {
          case 'left':
            return updatePosition(node, bounds.minX, null);
          case 'right':
            return updatePosition(node, bounds.maxX - metrics.width, null);
          case 'center-horizontal':
            return updatePosition(node, bounds.centerX - metrics.width / 2, null);
          case 'top':
            return updatePosition(node, null, bounds.minY);
          case 'bottom':
            return updatePosition(node, null, bounds.maxY - metrics.height);
          case 'center-vertical':
            return updatePosition(node, null, bounds.centerY - metrics.height / 2);
          default:
            return node;
        }
      });

      snapshot = mutated ? next : prev;
      return mutated ? next : prev;
    });

    if (mutated && snapshot) {
      nodesRef.current = snapshot;
      historyHook.saveToHistory(snapshot, edgesRef.current);
    }

    return mutated;
  }, [selectedNodeIds, setNodes, nodesRef, historyHook, edgesRef]);

  const handleDistributeSelection = useCallback((axis) => {
    const selectedSet = new Set(selectedNodeIds);
    if (!axis || selectedSet.size <= 2) {
      return false;
    }

    let mutated = false;
    let snapshot = null;

    setNodes(prev => {
      const selectedNodes = prev.filter(node => selectedSet.has(node.id));
      if (selectedNodes.length <= 2) {
        snapshot = prev;
        return prev;
      }

      const metricsList = selectedNodes.map(node => ({
        id: node.id,
        metrics: getNodeMetrics(node)
      }));

      const sorted = [...metricsList].sort((a, b) => (
        axis === 'horizontal'
          ? a.metrics.centerX - b.metrics.centerX
          : a.metrics.centerY - b.metrics.centerY
      ));

      const firstMetrics = sorted[0].metrics;
      const lastMetrics = sorted[sorted.length - 1].metrics;
      const span = axis === 'horizontal'
        ? lastMetrics.centerX - firstMetrics.centerX
        : lastMetrics.centerY - firstMetrics.centerY;

      if (Math.abs(span) < 0.0001) {
        snapshot = prev;
        return prev;
      }

      const step = span / (sorted.length - 1);
      const centerMap = new Map();
      sorted.forEach((item, index) => {
        let targetCenter;
        if (index === 0 || index === sorted.length - 1) {
          targetCenter = axis === 'horizontal' ? item.metrics.centerX : item.metrics.centerY;
        } else {
          targetCenter = axis === 'horizontal'
            ? firstMetrics.centerX + step * index
            : firstMetrics.centerY + step * index;
        }
        centerMap.set(item.id, targetCenter);
      });

      const updatePosition = (node, maybeX, maybeY) => {
        const currentPos = node.position || { x: 0, y: 0 };
        const targetX = typeof maybeX === 'number' ? roundTo3(maybeX) : currentPos.x;
        const targetY = typeof maybeY === 'number' ? roundTo3(maybeY) : currentPos.y;
        if (Math.abs(targetX - currentPos.x) < 0.0001 && Math.abs(targetY - currentPos.y) < 0.0001) {
          return node;
        }
        mutated = true;
        return {
          ...node,
          position: { ...currentPos, x: targetX, y: targetY }
        };
      };

      const next = prev.map(node => {
        if (!selectedSet.has(node.id)) return node;
        const metrics = getNodeMetrics(node);
        const targetCenter = centerMap.get(node.id);
        if (targetCenter == null) return node;
        if (axis === 'horizontal') {
          const targetX = targetCenter - metrics.width / 2;
          return updatePosition(node, targetX, null);
        }
        const targetY = targetCenter - metrics.height / 2;
        return updatePosition(node, null, targetY);
      });

      snapshot = mutated ? next : prev;
      return mutated ? next : prev;
    });

    if (mutated && snapshot) {
      nodesRef.current = snapshot;
      historyHook.saveToHistory(snapshot, edgesRef.current);
    }

    return mutated;
  }, [selectedNodeIds, setNodes, nodesRef, historyHook, edgesRef]);

  // Listen for undo/redo events from keyboard shortcuts (placed after historyHook is created)
  useEffect(() => {
    const handleUndo = () => {
      if (historyHook && typeof historyHook.handleUndo === 'function') {
        historyHook.handleUndo();
      }
    };

    const handleRedo = () => {
      if (historyHook && typeof historyHook.handleRedo === 'function') {
        historyHook.handleRedo();
      }
    };

    eventBus.on('undo', handleUndo);
    eventBus.on('redo', handleRedo);

    return () => {
      eventBus.off('undo', handleUndo);
      eventBus.off('redo', handleRedo);
    };
  }, [historyHook]);

  // Update handlers with graphAPI reference
  handlers.graphAPI = graphAPI;

  // Wire up paste event listener
  useEffect(() => {
    const handlePaste = async (e) => {
      // Check if the active element is a form control
      const activeElement = document.activeElement;
      const isFormControl = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        activeElement.closest('[contenteditable="true"]') ||
        activeElement.closest('input') ||
        activeElement.closest('textarea')
      );

      // If a form control has focus, allow default paste behavior
      if (isFormControl) {
        return;
      }

      // Otherwise, handle graph paste
      e.preventDefault();
      e.stopPropagation();
      try {
        const result = await pasteFromClipboardUnified({
          handlers,
          state: {
            setNodes,
            nodesRef,
            setEdges,
            edgesRef,
            setGroups,
            pan,
            zoom
          },
          historyHook,
          onShowMessage: (message, severity) => setSnackbar({ open: true, message, severity }),
          graphCRUD
        });
        
        if (result && (result.nodes > 0 || result.edges > 0 || result.groups > 0)) {
          console.log('[GraphEditor] Successfully pasted:', result);
        }
      } catch (err) {
        console.error('[GraphEditor] Paste handler error:', err);
        setSnackbar({ open: true, message: 'Paste failed', severity: 'error' });
      }
    };

    // console.log('[GraphEditor] Registering paste listener with graphCRUD:', graphCRUD);
    window.addEventListener('paste', handlePaste, { capture: true });
    return () => {
      // console.log('[GraphEditor] Removing paste listener');
      window.removeEventListener('paste', handlePaste, { capture: true });
    };
  }, [graphCRUD, handlers, setNodes, nodesRef, setEdges, edgesRef, setGroups, pan, zoom, historyHook, setSnackbar]);
  
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
    nodesRef,
    setShowAllEdgeLabels,
    graphCRUD,
    setGroups,
    pan,
    zoom,
    onShowMessage: (message, severity) => setSnackbar({ open: true, message, severity })
  });

  // Keep node list docked opposite the properties panel
  useEffect(() => {
    const oppositeAnchor = nodePanelAnchor === 'right' ? 'left' : 'right';
    setNodeListAnchor(prev => (prev === oppositeAnchor ? prev : oppositeAnchor));
  }, [nodePanelAnchor, setNodeListAnchor]);
  
  // After GraphCRUD instance is created (assume variable is graphAPI)
  useEffect(() => {
    if (graphAPI && graphAPI.current) {
      window.graphAPI = graphAPI.current;
    }
  }, [graphAPI]);
  
  // Expose eventBus and RPC helpers to window for console testing
  useEffect(() => {
    // Expose eventBus for console access
    window.eventBus = eventBus;
    
    // Expose a helper for testing background RPC
    window.testBackgroundRpc = async (method, args) => {
      try {
        if (!backgroundRpcReady) {
          console.warn('Background RPC not ready. Wait for handshake.');
          return { error: 'RPC not ready' };
        }
        const result = await backgroundRpc(method, args);
        console.log('✅ RPC Success:', result);
        return result;
      } catch (err) {
        console.error('❌ RPC Error:', err.message);
        return { error: err.message };
      }
    };
    
    // Expose RPC status helper
    window.backgroundRpcStatus = () => {
      console.log('Background RPC Status:', {
        ready: backgroundRpcReady,
        methods: backgroundRpcMethods,
        url: backgroundUrl
      });
      return { ready: backgroundRpcReady, methods: backgroundRpcMethods, url: backgroundUrl };
    };
    
    // Log available helpers
    console.log('🔧 Global helpers available:');
    console.log('  - window.eventBus - Event bus');
    console.log('  - window.graphAPI - Graph API');
    console.log('  - window.testBackgroundRpc(method, args) - Test RPC');
    console.log('  - window.backgroundRpcStatus() - Check RPC status');
    
    return () => {
      delete window.testBackgroundRpc;
      delete window.backgroundRpcStatus;
    };
  }, [backgroundRpc, backgroundRpcReady, backgroundRpcMethods, backgroundUrl]);
  
  // Listen for 'fetchUrl' event from address bar
  useEffect(() => {
    const handleFetchUrl = async ({ url, source = 'unknown' }) => {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('[GraphEditor] fetchUrl event received', { url, source });
      }
      try {
        if (!url) return;
        let fullUrl = url;
        let originalTlzPath = null;

        const ensureAbsoluteFromRelative = (input) => {
          if (!input) return input;
          if (input.startsWith('http://') || input.startsWith('https://')) return input;
          if (typeof window === 'undefined') return input;
          const origin = window.location && window.location.origin && window.location.origin !== 'null'
            ? window.location.origin
            : '';
          if (!origin) return input;
          if (input.startsWith('/')) {
            return `${origin}${input}`;
          }
          if (input.startsWith('./')) {
            const base = window.location.pathname.replace(/\/[^/]*$/, '/');
            return `${origin}${base}${input.slice(2)}`;
          }
          if (input.startsWith('../')) {
            const baseParts = window.location.pathname.split('/');
            let remainder = input;
            while (remainder.startsWith('../') && baseParts.length > 1) {
              remainder = remainder.slice(3);
              baseParts.pop();
            }
            const basePath = baseParts.join('/');
            return `${origin}${basePath}/${remainder}`;
          }
          return `${origin}/${input}`;
        };

        // Normalize tlz:// to fetchable https://
        if (fullUrl.startsWith('tlz://')) {
          const rest = fullUrl.slice('tlz://'.length);
          const firstSlash = rest.indexOf('/');
          let host = '';
          let path = '';

          if (firstSlash !== -1) {
            host = rest.slice(0, firstSlash);
            path = rest.slice(firstSlash); // includes leading '/'
          } else {
            path = '/' + rest;
          }
          originalTlzPath = path;

          const localhostNames = ['localhost', '127.0.0.1', '[::1]'];
          if (!host) {
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
            fullUrl = origin + path;
          } else if (localhostNames.includes(host)) {
            const protocol = typeof window !== 'undefined' ? window.location.protocol || 'http:' : 'http:';
            fullUrl = `${protocol}//${host}${path}`;
          } else {
            fullUrl = `https://${host}${path}`;
          }
        }

        if (!originalTlzPath && (fullUrl.startsWith('/') || fullUrl.startsWith('./') || fullUrl.startsWith('../'))) {
          fullUrl = ensureAbsoluteFromRelative(fullUrl);
        }

        if (!/^https?:\/\//i.test(fullUrl)) {
          fullUrl = `https://${fullUrl}`;
        }

        try {
          const parsed = new URL(fullUrl);
          const localhostNames = ['localhost', '127.0.0.1', '[::1]'];
          const isLocalHost = localhostNames.includes(parsed.hostname);
          const matchesOrigin = typeof window !== 'undefined' && parsed.host === window.location.host;

          if (parsed.protocol === 'http:' && !isLocalHost && !matchesOrigin) {
            parsed.protocol = 'https:';
          }

          fullUrl = parsed.toString();
        } catch (parseError) {
          if (fullUrl.startsWith('http://')) {
            fullUrl = 'https://' + fullUrl.slice('http://'.length);
          }
        }

        // Log the final URL and fetch options
        const fetchOptions = { method: 'GET', mode: 'cors', credentials: 'omit' };

        // Update address/history immediately so header/back works
        try { eventBus.emit('setAddress', fullUrl); } catch (err) { /* ignore */ }

        const triedUrls = [];

        const tryFetch = async (u) => {
          triedUrls.push(u);
          // console.log('[GraphEditor] Attempting fetch:', u);
          const resp = await fetch(u, fetchOptions);
          // console.log('[GraphEditor] Fetch response status:', resp.status);
          // console.log('[GraphEditor] Fetch response headers:', Array.from(resp.headers.entries()));
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp;
        };

        let response = null;

        const localCandidates = [];
        if (originalTlzPath) {
          const relPath = originalTlzPath.startsWith('/') ? originalTlzPath : `/${originalTlzPath}`;
          const localOrigin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
            ? window.location.origin
            : null;
          if (localOrigin) {
            const localUrl = `${localOrigin}${relPath}`;
            if (!localCandidates.includes(localUrl)) localCandidates.push(localUrl);
          }
          if (!localCandidates.includes(relPath)) localCandidates.push(relPath);
        }

        for (const candidate of localCandidates) {
          if (candidate === fullUrl || triedUrls.includes(candidate)) continue;
          try {
            if (typeof window !== 'undefined') {
              // eslint-disable-next-line no-console
              console.log('[GraphEditor] trying local candidate', candidate);
            }
            response = await tryFetch(candidate);
            fullUrl = candidate;
            try { eventBus.emit('setAddress', fullUrl); } catch (err) { /* ignore */ }
            break;
          } catch (err) {
            // continue to next candidate
          }
        }

        try {
          if (!response) {
            response = await tryFetch(fullUrl);
          }
        } catch (err) {
          // generate alternates to try
          const alternates = [];
          if (fullUrl.match(/\.json($|[?#])/)) {
            alternates.push(fullUrl.replace(/\.json($|[?#])/, '.node$1'));
          }
          if (!fullUrl.endsWith('.node')) {
            alternates.push(fullUrl + '.node');
          }
          if (fullUrl.endsWith('/')) {
            alternates.push(fullUrl + 'index.node');
          }
          if (originalTlzPath) {
            const relPath = originalTlzPath.startsWith('/') ? originalTlzPath : `/${originalTlzPath}`;
            const localOrigin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
              ? window.location.origin
              : null;
            if (localOrigin) {
              const localUrl = `${localOrigin}${relPath}`;
              if (!alternates.includes(localUrl) && !triedUrls.includes(localUrl)) alternates.push(localUrl);
            }
            if (!alternates.includes(relPath) && !triedUrls.includes(relPath)) alternates.push(relPath);
          } else {
            try {
              const parsed = new URL(fullUrl);
              const localOrigin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
                ? window.location.origin
                : null;
              if (localOrigin && parsed.origin !== localOrigin) {
                const localUrl = `${localOrigin}${parsed.pathname}`;
                if (!alternates.includes(localUrl) && !triedUrls.includes(localUrl)) alternates.push(localUrl);
              }
            } catch (ignore) {
              // ignore parse failure
            }
          }

          for (const alt of alternates) {
            if (triedUrls.includes(alt)) continue;
            try {
              response = await tryFetch(alt);
              fullUrl = alt; // switch canonical to the working one
              try { eventBus.emit('setAddress', fullUrl); } catch (err) { /* ignore */ }
              break;
            } catch (e) {
              // continue to next
            }
          }
        }

        if (!response) {
          const errorMsg = 'Failed to fetch from any URL';
          console.error('[GraphEditor] Error fetching URL:', errorMsg, triedUrls);
          setSnackbar({ open: true, message: `Failed to fetch URL: ${errorMsg}`, severity: 'error' });
          return;
        }

        const text = await response.text();

        // Try to parse as JSON (graph data)
        try {
          const jsonData = JSON.parse(text);
          if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
            const nodesToLoad = jsonData.nodes;
            const edgesToLoadFromJson = jsonData.edges || [];
            const groupsToLoadFromJson = jsonData.groups || [];
            handleLoadGraph(nodesToLoad, edgesToLoadFromJson, groupsToLoadFromJson);
            try { eventBus.emit('forceRedraw'); } catch (e) { /* ignore */ }
            setSnackbar({ open: true, message: 'Graph loaded from URL', severity: 'success' });
            eventBus.emit('setAddress', fullUrl); // ensure address reflects final URL
            return;
          }
        } catch (e) {
          // Not JSON, fall through to create text node
        }

        // Create text node
        const lines = text.trim().split('\n');
        const label = lines[0] ? lines[0].substring(0, 50) : 'Fetched Text';
        const memo = text.trim();

        const width = Math.max(200, Math.min(600, (label.length || 10) * 8 + 100));
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
        eventBus.emit('setAddress', fullUrl);
      } catch (error) {
        console.error('[GraphEditor] Error fetching URL:', error);
        // Provide clearer snackbar with attempted info
        const msg = error && error.message ? error.message : 'Unknown error';
        setSnackbar({ open: true, message: `Failed to fetch URL: ${msg}`, severity: 'error' });
      }
    };

    eventBus.on('fetchUrl', handleFetchUrl);
    return () => eventBus.off('fetchUrl', handleFetchUrl);
  }, [pan, zoom, setNodes, nodesRef, historyHook, setSnackbar, handlers]);
  
  // Suppress specific error message about asynchronous responses
  useEffect(() => {
    const handleError = (event) => {
      if (event.message && event.message.includes("A listener indicated an asynchronous response")) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleError);

    // Also handle unhandled promise rejections that contain the same message
    const handleUnhandledRejection = (event) => {
      const reason = event && (event.reason || event.detail);
      const message = typeof reason === 'string' ? reason : (reason && reason.message) ? reason.message : '';
      if (message && message.includes("A listener indicated an asynchronous response")) {
        // prevent the default logging of unhandledrejection
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Close NodePropertiesPanel if selection is not exactly one node
  useEffect(() => {
    if (selectedNodeIds.length !== 1 && showNodeList) {
      setNodePanelAnchor(null);
    }
  }, [selectedNodeIds, showNodeList]);
  
  // Handle pasted graph data emitted by paste handler fallback
  useEffect(() => {
    const handlePastedData = (data) => {
      if (!data) return;
      try {
        // If full graph data present, use existing load handler
        if (data.nodes && Array.isArray(data.nodes)) {
          const nodesToLoad = data.nodes;
          const edgesToLoad = data.edges || [];
          const groupsToLoad = data.groups || [];
          if (handlers && typeof handlers.handleLoadGraph === 'function') {
            handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
            try { eventBus.emit('forceRedraw'); } catch (e) { }
          } else {
            // Fallback: merge into current state
            setNodes(prev => {
              const next = [...prev, ...nodesToLoad];
              nodesRef.current = next;
              return next;
            });
            setEdges(prev => {
              const next = [...prev, ...(data.edges || [])];
              edgesRef.current = next;
              return next;
            });
            if (groupsToLoad && groupsToLoad.length && setGroups) {
              setGroups(prev => {
                const next = [...prev, ...groupsToLoad];
                return next;
              });
            }
          }
          setSnackbar({ open: true, message: 'Pasted graph data', severity: 'success' });
          return;
        }

        // If only groups present
        if (data.groups && Array.isArray(data.groups) && setGroups) {
          setGroups(prev => {
            const next = [...prev, ...data.groups];
            return next;
          });
          setSnackbar({ open: true, message: 'Pasted groups', severity: 'success' });
        }
      } catch (err) {
        console.warn('Failed to apply pasted data:', err);
      }
    };

    eventBus.on('pasteGraphData', handlePastedData);
    return () => eventBus.off('pasteGraphData', handlePastedData);
  }, [handlers, setNodes, setEdges, setGroups, nodesRef, edgesRef]);
  
  // Keyboard shortcut: toggle background interactivity (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && backgroundUrl) {
        e.preventDefault();
        setBackgroundInteractive(prev => {
          const next = !prev;
          if (setSnackbar) {
            setSnackbar({ open: true, message: `Background ${next ? 'interactive' : 'locked'}`, severity: 'info' });
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [backgroundUrl, backgroundInteractive, setSnackbar]);

  useEffect(() => {
    if (!isMobile) {
      lastNodeTapRef.current = { id: null, time: 0 };
      return;
    }
    if (selectedNodeIds.length === 1) {
      const nodeId = selectedNodeIds[0];
      const now = Date.now();
      if (lastNodeTapRef.current.id === nodeId && now - lastNodeTapRef.current.time < 350) {
        setShowPropertiesPanel(true);
      }
      lastNodeTapRef.current = { id: nodeId, time: now };
    } else if (selectedNodeIds.length === 0) {
      lastNodeTapRef.current = { id: null, time: 0 };
    }
  }, [isMobile, selectedNodeIds, setShowPropertiesPanel]);

  useEffect(() => {
    if (!isMobile) {
      lastEdgeTapRef.current = { id: null, time: 0 };
      return;
    }
    if (selectedEdgeIds.length === 1) {
      const edgeId = selectedEdgeIds[0];
      const now = Date.now();
      if (lastEdgeTapRef.current.id === edgeId && now - lastEdgeTapRef.current.time < 350) {
        setShowPropertiesPanel(true);
      }
      lastEdgeTapRef.current = { id: edgeId, time: now };
    } else if (selectedEdgeIds.length === 0) {
      lastEdgeTapRef.current = { id: null, time: 0 };
    }
  }, [isMobile, selectedEdgeIds, setShowPropertiesPanel]);

  useEffect(() => {
    if (!isMobile) {
      lastGroupTapRef.current = { id: null, time: 0 };
      return;
    }
    if (selectedGroupIds.length === 1) {
      const groupId = selectedGroupIds[0];
      const now = Date.now();
      if (lastGroupTapRef.current.id === groupId && now - lastGroupTapRef.current.time < 350) {
        setShowPropertiesPanel(true);
      }
      lastGroupTapRef.current = { id: groupId, time: now };
    } else if (selectedGroupIds.length === 0) {
      lastGroupTapRef.current = { id: null, time: 0 };
    }
  }, [isMobile, selectedGroupIds, setShowPropertiesPanel]);
  
  useEffect(() => {
    const handleBreadboardPlacement = ({ nodeIds } = {}) => {
      const ids = Array.isArray(nodeIds) ? nodeIds : [];
      if (!ids.length || !graphAPI?.current) return;
      ids.forEach((id) => {
        if (!id) return;
        const node =
          (nodesRef.current || []).find((n) => n.id === id) || null;
        if (!node || !node.data?.breadboard) return;
        if (!node.data.breadboard.pendingPlacement) return;
        const nextBreadboard = {
          ...node.data.breadboard,
          pendingPlacement: false
        };
        // Optimistically update local state so downstream listeners see the change immediately.
        setNodes((prev) => {
          const next = prev.map((n) => {
            if (n.id !== id) return n;
            const updatedData = {
              ...(n.data || {}),
              breadboard: nextBreadboard
            };
            return {
              ...n,
              data: updatedData
            };
          });
          nodesRef.current = next;
          return next;
        });
        try {
          graphAPI.current.updateNode(id, {
            data: {
              ...(node.data || {}),
              breadboard: nextBreadboard
            }
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            '[GraphEditor] Failed to clear breadboard pendingPlacement',
            id,
            err
          );
        }
      });
    };
    eventBus.on('nodeDragEnd', handleBreadboardPlacement);
    return () => eventBus.off('nodeDragEnd', handleBreadboardPlacement);
  }, [graphAPI, setNodes, nodesRef]);

  useEffect(() => {
    eventBus.emit('breadboard:layoutUpdated', { layout: breadboardLayout });
  }, [breadboardLayout]);

  const pinStateSnapshotRef = useRef(new Map());
  useEffect(() => {
    const nextSummary = new Map();
    nodes.forEach((node) => {
      if (!node || !node.id) return;
      const pinState = node?.data?.breadboard?.pinState || null;
      const summary = pinState ? JSON.stringify(pinState) : '';
      const previous = pinStateSnapshotRef.current.get(node.id);
      if (summary !== previous) {
        eventBus.emit('breadboard.pinStateChanged', {
          nodeId: node.id,
          pinState: pinState || {}
        });
      }
      nextSummary.set(node.id, summary);
    });
    pinStateSnapshotRef.current = nextSummary;
  }, [nodes]);

  // Add this useEffect to your GraphEditor.js file
  // Place it with the other event listener useEffects
  useEffect(() => {
    const getNodeById = (id) => {
      const source = nodesRef?.current || [];
      return source.find(n => n.id === id) || null;
    };

    const fallbackHandle = (kind) => kind === 'inputs'
      ? { key: 'in', label: 'In', type: 'trigger' }
      : { key: 'out', label: 'Out', type: 'trigger' };

    const sanitizeHandle = (handle, kind, index = 0) => {
      if (handle && typeof handle === 'object') {
        const key = handle.key || handle.id || `${kind === 'inputs' ? 'in' : 'out'}-${index}`;
        return {
          key,
          label: handle.label || key,
          type: handle.type || handle.dataType || 'trigger'
        };
      }
      const fallback = fallbackHandle(kind);
      const suffix = index ? `-${index}` : '';
      return { ...fallback, key: `${fallback.key}${suffix}` };
    };

    const buildHandleSchema = (handles, kind) => {
      if (!Array.isArray(handles) || handles.length === 0) {
        return [fallbackHandle(kind)];
      }
      return handles.map((handle, index) => sanitizeHandle(handle, kind, index));
    };

    const pickHandle = (nodeLike, kind, desiredType) => {
      const list = buildHandleSchema(nodeLike?.[kind], kind);
      if (desiredType) {
        const exact = list.find(h => h.type === desiredType);
        if (exact) return exact;
        if (desiredType !== 'trigger') {
          const triggerHandle = list.find(h => h.type === 'trigger');
          if (triggerHandle) return triggerHandle;
        }
      }
      return list[0];
    };

    const createEdgeViaCrud = (api, payload, successMessage) => {
      const result = api.createEdge(payload);
      if (result?.success) {
        setSnackbar({ open: true, message: successMessage, severity: 'success' });
        return true;
      }
      setSnackbar({
        open: true,
        message: result?.error || 'Failed to create connection',
        severity: 'error'
      });
      return false;
    };

    const handleHandleDrop = ({
      graph,
      sourceNode,
      targetNode,
      edgeType,
      direction,
      targetHandle,
      validation,
      handle
    }) => {
      try {
        let resolvedValidation = validation;
        let resolvedTargetNodeId = targetNode;
        let resolvedTargetHandle = targetHandle;
        const api = graphAPI?.current;
        if (!api || typeof api.createEdge !== 'function') {
          console.warn('Graph API not ready; ignoring handle drop.');
          return;
        }

        const startHandleKey = handle?.key || handle?.handleKey || (direction === 'source' ? 'out' : 'in');
        const startHandleType = handle?.handleType || 'trigger';
        const resolvedEdgeType = edgeType || 'default';
        const edgeStyle = EdgeTypes[resolvedEdgeType]?.style || {};
        const sourceNodeObj = getNodeById(sourceNode);
        const isBreadboardComponent =
          !!sourceNodeObj && typeof sourceNodeObj.type === 'string' && sourceNodeObj.type.startsWith('io.breadboard.components:');

        if (!resolvedTargetNodeId && isBreadboardComponent) {
          const boardTarget = findNearestBreadboardTarget(breadboardTargets, graph || {});
          if (boardTarget) {
            resolvedTargetNodeId = boardTarget.nodeId;
            resolvedTargetHandle = {
              nodeId: boardTarget.nodeId,
              key: boardTarget.handle,
              label: boardTarget.label || boardTarget.handle,
              type: 'input',
              handleType: 'value'
            };
            resolvedValidation = { ok: true };
          }
        }

        if (resolvedValidation && resolvedValidation.ok === false) {
          if (setSnackbar && resolvedValidation.message) {
            setSnackbar({ open: true, message: resolvedValidation.message, severity: 'warning' });
          }
          return;
        }

        if (resolvedTargetNodeId) {
          const targetNodeObj = getNodeById(resolvedTargetNodeId);
          if (!targetNodeObj) {
            setSnackbar({ open: true, message: 'Target node not found', severity: 'error' });
            return;
          }
          const fallbackHandle = direction === 'source'
            ? pickHandle(targetNodeObj, 'inputs', startHandleType)
            : pickHandle(targetNodeObj, 'outputs', startHandleType);
          const counterpartHandleKey = resolvedTargetHandle?.key || fallbackHandle?.key;
          if (!counterpartHandleKey) {
            setSnackbar({
              open: true,
              message: 'No compatible handle found on target node',
              severity: 'error'
            });
            return;
          }

          const edgePayload = direction === 'source'
            ? {
                source: sourceNode,
                target: resolvedTargetNodeId,
                sourceHandle: startHandleKey,
                targetHandle: counterpartHandleKey,
                type: resolvedEdgeType,
                style: edgeStyle
              }
            : {
                source: resolvedTargetNodeId,
                target: sourceNode,
                sourceHandle: counterpartHandleKey,
                targetHandle: startHandleKey,
                type: resolvedEdgeType,
                style: edgeStyle
              };
          createEdgeViaCrud(api, edgePayload, 'Edge created');
          return;
        }

        const parentNode = getNodeById(sourceNode);
        if (!parentNode) {
          setSnackbar({ open: true, message: 'Source node not found', severity: 'error' });
          return;
        }

        const clonedInputs = buildHandleSchema(parentNode.inputs, 'inputs');
        const clonedOutputs = buildHandleSchema(parentNode.outputs, 'outputs');

        if (typeof api.createNode !== 'function') {
          setSnackbar({ open: true, message: 'Graph API unavailable for node creation', severity: 'error' });
          return;
        }

        const nodeResult = api.createNode({
          label: 'New Node',
          type: parentNode.type || 'default',
          position: { x: graph.x, y: graph.y },
          width: parentNode.width || 200,
          height: parentNode.height || 120,
          inputs: clonedInputs.map(h => ({ ...h })),
          outputs: clonedOutputs.map(h => ({ ...h }))
        });

        if (!nodeResult?.success || !nodeResult.data?.id) {
          setSnackbar({
            open: true,
            message: nodeResult?.error || 'Failed to create node',
            severity: 'error'
          });
          return;
        }

        const createdNodeId = nodeResult.data.id;
        const newNodeHandle = direction === 'source'
          ? pickHandle({ inputs: clonedInputs }, 'inputs', startHandleType)
          : pickHandle({ outputs: clonedOutputs }, 'outputs', startHandleType);

        const edgePayload = direction === 'source'
          ? {
              source: sourceNode,
              target: createdNodeId,
              sourceHandle: startHandleKey,
              targetHandle: newNodeHandle.key,
              type: resolvedEdgeType,
              style: edgeStyle
            }
          : {
              source: createdNodeId,
              target: sourceNode,
              sourceHandle: newNodeHandle.key,
              targetHandle: startHandleKey,
              type: resolvedEdgeType,
              style: edgeStyle
            };

        createEdgeViaCrud(api, edgePayload, 'Node and edge created');
      } catch (error) {
        console.error('Error in handleDrop:', error);
        setSnackbar({
          open: true,
          message: 'Failed to create connection',
          severity: 'error'
        });
      }
    };

    eventBus.on('handleDrop', handleHandleDrop);
    return () => eventBus.off('handleDrop', handleHandleDrop);
  }, [graphAPI, nodesRef, setSnackbar, breadboardTargets]);

  // NEW: Listen for toggleMinimap event to sync minimap visibility with toolbar button
  useEffect(() => {
    const handleToggleMinimap = () => {
      setShowMinimap(prev => !prev);
    };
    eventBus.on('toggleMinimap', handleToggleMinimap);
    return () => eventBus.off('toggleMinimap', handleToggleMinimap);
  }, []);

  // Listen for grid-related events
  useEffect(() => {
    const handleToggleShowGrid = () => {
      setShowGrid(prev => !prev);
    };

    const handleAlignToGrid = () => {
      setDocumentSettings(prevSettings => {
        const currentGridSize = prevSettings.gridSize;
        setNodes(prev => {
          const next = prev.map(node => ({
            ...node,
            position: {
              x: Math.round(node.position.x / currentGridSize) * currentGridSize,
              y: Math.round(node.position.y / currentGridSize) * currentGridSize
            }
          }));
          nodesRef.current = next;
          historyHook.saveToHistory(next, edgesRef.current);
          return next;
        });
        return prevSettings; // Don't modify settings
      });
    };

    const handleSetGridSize = ({ gridSize: newGridSize }) => {
      if (newGridSize && newGridSize >= 5 && newGridSize <= 100) {
        setDocumentSettings(prev => {
          const updated = { ...prev, gridSize: newGridSize };
          // Immediately respond with the new value
          setTimeout(() => eventBus.emit('currentGridSize', { gridSize: newGridSize }), 0);
          return updated;
        });
      }
    };

    const handleRequestGridSize = () => {
      eventBus.emit('currentGridSize', { gridSize: documentSettings.gridSize });
    };

    const handleRequestBackgroundImage = () => {
      eventBus.emit('currentBackgroundImage', { backgroundImage: documentBackgroundImage });
    };

    eventBus.on('toggleShowGrid', handleToggleShowGrid);
    eventBus.on('alignToGrid', handleAlignToGrid);
    eventBus.on('setGridSize', handleSetGridSize);
    eventBus.on('requestGridSize', handleRequestGridSize);
    eventBus.on('requestBackgroundImage', handleRequestBackgroundImage);

    return () => {
      eventBus.off('toggleShowGrid', handleToggleShowGrid);
      eventBus.off('alignToGrid', handleAlignToGrid);
      eventBus.off('setGridSize', handleSetGridSize);
      eventBus.off('requestGridSize', handleRequestGridSize);
      eventBus.off('requestBackgroundImage', handleRequestBackgroundImage);
    };
  }, [setNodes, nodesRef, edgesRef, historyHook]);

  // Listen for document theme updates from PreferencesDialog
  useEffect(() => {
    const handleUpdateDocumentTheme = (themeConfig) => {
      if (themeConfig) {
        setDocumentTheme(themeConfig);
      }
    };

    eventBus.on('updateDocumentTheme', handleUpdateDocumentTheme);
    return () => eventBus.off('updateDocumentTheme', handleUpdateDocumentTheme);
  }, []);

  // Register single handleClick event handler
  const handleClickHandlerId = Math.random().toString(36).substr(2, 8);
  useHandleClickHandler((payload) => {
    // console.log(`[GraphEditor.js] handleClick event received (handlerId: ${handleClickHandlerId})`, payload);
    // Your handleClick logic here
    // Example: console.log('Single handleClick event:', payload);
  });

  // Toggle properties panel via event
  useEffect(() => {
    const handleTogglePropertiesPanel = () => {
      togglePropertiesPanel();
    };
    eventBus.on('togglePropertiesPanel', handleTogglePropertiesPanel);
    return () => eventBus.off('togglePropertiesPanel', handleTogglePropertiesPanel);
  }, [togglePropertiesPanel]);

  // Toggle document properties dialog via event
  useEffect(() => {
    const handleToggleDocumentProperties = () => {
      setShowDocumentPropertiesDialog(prev => !prev);
    };
    eventBus.on('toggleDocumentProperties', handleToggleDocumentProperties);
    return () => eventBus.off('toggleDocumentProperties', handleToggleDocumentProperties);
  }, []);

  // Listen for node click events and select the node
  useEffect(() => {
    const handleNodeClick = ({ id }) => {
      setSelectedNodeIds([id]);
      setSelectedEdgeIds([]);
      // Removed any pan/zoom reset logic here
    };
    eventBus.on('nodeClick', handleNodeClick);
    return () => eventBus.off('nodeClick', handleNodeClick);
  }, [setSelectedNodeIds, setSelectedEdgeIds]);

  // Consolidated background/document repaint & redraw effect
  useEffect(() => {
    if (!backgroundUrl) return;

    const doRepaint = () => {
      try {
        // Only emit forceRedraw, don't modify pan
        try { eventBus.emit('forceRedraw'); } catch (e) { }

        // Dispatch a resize event as a fallback
        window.dispatchEvent(new Event('resize'));
      } catch (err) {
        console.warn('Repaint attempt failed:', err);
      }
    };

    // Emit forceRedraw a few times spaced out to cover async iframe renders
    const timers = [100, 300, 600].map(delay => setTimeout(() => {
      doRepaint();
    }, delay));

    // Initial immediate attempt
    doRepaint();

    return () => timers.forEach(clearTimeout);
  }, [backgroundUrl]);

  // Force redraw when nodes or edges change (fixes frame lag after delete)
  useEffect(() => {
    eventBus.emit('forceRedraw');
  }, [nodes, edges]);

  // Listen for addNode events from toolbar
  useEffect(() => {
    // console.log('[GraphEditor] Registering addNode event listener');
    const handleAddNodeEvent = ({ type, meta: incomingMeta }) => {
      if (!type) return;
      const fallbackMeta = nodeTypeMetadataList.find((m) => m.type === type);
      const meta = incomingMeta || fallbackMeta;
      const width =
        typeof meta?.defaultWidth === 'number' ? meta.defaultWidth : 200;
      const height =
        typeof meta?.defaultHeight === 'number' ? meta.defaultHeight : 120;
      if (handlers && handlers.handleAddNode) {
        handlers.handleAddNode(type, { width, height, meta });
      } else {
        console.error('[GraphEditor] handlers.handleAddNode is not available');
      }
    };
    
    eventBus.on('addNode', handleAddNodeEvent);
    return () => {
      // console.log('[GraphEditor] Unregistering addNode event listener');
      eventBus.off('addNode', handleAddNodeEvent);
    };
  }, [handlers, nodeTypeMetadataList]);

  const rpcContextValue = useMemo(() => ({
    bgRef,
    backgroundRpc,
    backgroundRpcReady,
    backgroundPostEvent,
    handleHandshakeComplete,
    backgroundRpcMethods
  }), [bgRef, backgroundRpc, backgroundRpcReady, backgroundPostEvent, handleHandshakeComplete, backgroundRpcMethods]);

  const layoutContextValue = useMemo(() => ({
    showEdgePanel,
    setShowEdgePanel,
    showMinimap,
    setShowMinimap,
    snapToGrid,
    setSnapToGrid,
    showGrid,
    setShowGrid,
    lockedNodes,
    setLockedNodes,
    lockedEdges,
    setLockedEdges,
    showAllEdgeLabels,
    setShowAllEdgeLabels,
    showPropertiesPanel,
    setShowPropertiesPanel,
    graphRenderKey,
    setGraphRenderKey,
    mobileAddNodeOpen,
    setMobileAddNodeOpen,
    mobileAddNodeSearch,
    setMobileAddNodeSearch,
    memoAutoExpandToken,
    setMemoAutoExpandToken,
    documentSettings,
    setDocumentSettings,
    documentTheme,
    setDocumentTheme,
    documentBackgroundImage,
    setDocumentBackgroundImage,
    documentUrl,
    setDocumentUrl,
    projectMeta,
    setProjectMeta,
    backgroundUrl,
    setBackgroundUrl,
    backgroundInteractive,
    setBackgroundInteractive,
    showDocumentPropertiesDialog,
    setShowDocumentPropertiesDialog,
    showNodePalette,
    setShowNodePalette,
    showNodeList,
    setShowNodeList,
    showGroupList,
    setShowGroupList,
    showGroupProperties,
    setShowGroupProperties,
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
    handleUpdateProjectMeta,
    handleResetProjectMeta,
    isMobile,
    isSmallScreen,
    isPortrait,
    isLandscape,
    backgroundImage,
    isFreeUser
  }), [
    showEdgePanel,
    setShowEdgePanel,
    showMinimap,
    setShowMinimap,
    snapToGrid,
    setSnapToGrid,
    showGrid,
    setShowGrid,
    lockedNodes,
    setLockedNodes,
    lockedEdges,
    setLockedEdges,
    showAllEdgeLabels,
    setShowAllEdgeLabels,
    showPropertiesPanel,
    setShowPropertiesPanel,
    graphRenderKey,
    setGraphRenderKey,
    mobileAddNodeOpen,
    setMobileAddNodeOpen,
    mobileAddNodeSearch,
    setMobileAddNodeSearch,
    memoAutoExpandToken,
    setMemoAutoExpandToken,
    documentSettings,
    setDocumentSettings,
    documentTheme,
    setDocumentTheme,
    documentBackgroundImage,
    setDocumentBackgroundImage,
    documentUrl,
    setDocumentUrl,
    projectMeta,
    setProjectMeta,
    backgroundUrl,
    setBackgroundUrl,
    backgroundInteractive,
    setBackgroundInteractive,
    showDocumentPropertiesDialog,
    setShowDocumentPropertiesDialog,
    showNodePalette,
    setShowNodePalette,
    showNodeList,
    setShowNodeList,
    showGroupList,
    setShowGroupList,
    showGroupProperties,
    setShowGroupProperties,
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
    handleUpdateProjectMeta,
    handleResetProjectMeta,
    isMobile,
    isSmallScreen,
    isPortrait,
    isLandscape,
    backgroundImage,
    isFreeUser
  ]);

  const servicesContextValue = useMemo(() => ({
    handlers,
    graphAPI,
    graphCRUD,
    handleLoadGraph,
    handleFitToNodes,
    handleAlignSelection,
    handleDistributeSelection,
    selectionHook,
    groupManagerHook,
    modesHook,
    nodeTypes,
    nodeTypeMetadata: nodeTypeMetadataList,
    handleScriptRequest,
    pluginRuntime: pluginRuntimeInfo
  }), [
    handlers,
    graphAPI,
    graphCRUD,
    handleLoadGraph,
    handleFitToNodes,
    handleAlignSelection,
    handleDistributeSelection,
    selectionHook,
    groupManagerHook,
    modesHook,
    nodeTypes,
    nodeTypeMetadataList,
    handleScriptRequest,
    pluginRuntimeInfo
  ]);

  return (
    <GraphEditorContextProvider
      state={state}
      history={historyHook}
      rpc={rpcContextValue}
      layout={layoutContextValue}
      services={servicesContextValue}
    >
      <GraphEditorContent />
    </GraphEditorContextProvider>
  );
}
