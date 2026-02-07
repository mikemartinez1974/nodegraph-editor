// ============================================
// 5. GraphEditor.js (MAIN - significantly reduced)
// ============================================
"use client";
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Button, Stack } from '@mui/material';
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
import useInterpreterLayer from './hooks/useInterpreterLayer';
import usePluginRegistry from './hooks/usePluginRegistry';
import { pasteFromClipboardUnified } from './handlers/pasteHandler';
import { GraphEditorContextProvider } from './providers/GraphEditorContext';
import GraphEditorContent from './GraphEditorContent';
import useDocumentMetadata from './hooks/useDocumentMetadata';
import useProjectMetadata from './hooks/useProjectMetadata';
import useGraphInteractions from './hooks/useGraphInteractions';
import usePluginRuntime from './hooks/usePluginRuntime';
import useIntentEmitter from './hooks/useIntentEmitter';
import {
  getManifestSettings,
  getManifestDocumentUrl,
  setManifestDocumentUrl,
  setManifestSettings
} from './utils/manifestUtils';
import { validateGraphInvariants } from './validators/validateGraphInvariants';

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 120;
const encodeBase64 = (value) => {
  if (typeof window === 'undefined') return '';
  return window.btoa(unescape(encodeURIComponent(value)));
};

const decodeBase64 = (value) => {
  if (typeof window === 'undefined') return '';
  return decodeURIComponent(escape(window.atob(value)));
};

const postHostMessage = (payload) => {
  if (typeof window === 'undefined') return;
  if (typeof window.__Twilite_POST_MESSAGE__ === 'function') {
    window.__Twilite_POST_MESSAGE__(payload);
    return;
  }
  try {
    window.parent?.postMessage(payload, '*');
  } catch {}
};

const parseRepoString = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [owner, repo] = trimmed.split('/');
  if (!owner || !repo) return null;
  return { owner, repo };
};

const buildGitHubContentUrl = ({ owner, repo, path, branch, includeRef = false }) => {
  const safePath = (path || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  let url = `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}`;
  if (includeRef && branch) {
    url += `?ref=${encodeURIComponent(branch)}`;
  }
  return url;
};
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

export default function GraphEditor({ backgroundImage, isMobile, isSmallScreen, isPortrait, isLandscape, addressBarHeight = 64 }) {
  const theme = useTheme(); // Browser theme
  const { plugins } = usePluginRegistry();
  const nodeTypes = useMemo(() => getNodeTypes(), [plugins]);
  const nodeTypeMetadataList = useMemo(
    () => getAllNodeTypeMetadata(),
    [plugins]
  );
  const [showEdgePanel, setShowEdgePanel] = useState(false);
  const [showEdgeList, setShowEdgeList] = useState(false);
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
  const [showEntitiesPanel, setShowEntitiesPanel] = useState(false);
  const [entityView, setEntityView] = useState('nodes');

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
  const lastLoadedHashRef = useRef(new Map());

  const state = useGraphEditorState();
  const { emitEdgeIntent } = useIntentEmitter();
  const [edgeRoutes, setEdgeRoutes] = useState({});
  const currentDocUriRef = useRef(null);
  const skipRerouteRef = useRef(false);
  const edgeRoutesSaveTimerRef = useRef(null);

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
    defaultNodeColor, setDefaultNodeColor,
    defaultEdgeColor, setDefaultEdgeColor,
    groupManager
  } = state || {};

  const selectionSnapshotRef = useRef({
    nodeIds: Array.isArray(selectedNodeIds) ? [...selectedNodeIds] : [],
    edgeIds: Array.isArray(selectedEdgeIds) ? [...selectedEdgeIds] : [],
    groupIds: Array.isArray(selectedGroupIds) ? [...selectedGroupIds] : []
  });
  const lastPointerRef = useRef({ x: 0, y: 0, inside: false });
  const lastLoggedNodeIdRef = useRef(null);
  const pendingThemePasteRef = useRef(null);

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
    if (typeof window === 'undefined') return undefined;
    const handleLoadGraphMessage = (event) => {
      const { data } = event || {};
      if (!data || data.type !== 'loadGraph') return;
      const forceLoad = Boolean(data.force);
      if (window.__Twilite_DIRTY__ && !forceLoad) {
        return;
      }
      try {
        window.__Twilite_SYNCING__ = true;
      } catch {}
      const payload = data.content;
      if (!payload || typeof payload !== 'object') return;
      if (window.__Twilite_DIRTY__ && forceLoad) {
        window.__Twilite_DIRTY__ = false;
      }
      const incomingUri = typeof data.uri === 'string' ? data.uri : null;
      const incomingHash = Number.isFinite(Number(data.hash)) ? Number(data.hash) : 0;
      const incomingEdgeRoutes = data.edgeRoutes && typeof data.edgeRoutes === 'object' ? data.edgeRoutes : null;
      const incomingEdgeRouteIds = Array.isArray(data.edgeRouteIds) ? data.edgeRouteIds : null;
      if (incomingUri) {
        const cachedHash = lastLoadedHashRef.current.get(incomingUri);
        if (!forceLoad && cachedHash === incomingHash && incomingHash !== 0) {
          console.log('[GraphEditor] loadGraph skipped (same hash)', { uri: incomingUri });
          return;
        }
        if (incomingHash) {
          lastLoadedHashRef.current.set(incomingUri, incomingHash);
        }
        currentDocUriRef.current = incomingUri;
      }
      const nextNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      const nextEdges = Array.isArray(payload.edges) ? payload.edges : [];
      const nextGroups = Array.isArray(payload.clusters)
        ? payload.clusters
        : Array.isArray(payload.groups)
        ? payload.groups
        : [];
      let cachedRoutesApplied = false;
      if (incomingUri && typeof window !== 'undefined' && window.__Twilite_EMBED__) {
        try {
          const cacheKey = `twilite.edgeRoutes.${encodeURIComponent(incomingUri)}`;
          const cachedRaw = window.localStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            const cachedEdges = Array.isArray(cached?.edgeIds) ? cached.edgeIds : [];
            const incomingEdgeIds = nextEdges.map((edge) => edge?.id).filter(Boolean);
            const sameEdges =
              cachedEdges.length === incomingEdgeIds.length &&
              cachedEdges.every((id, idx) => id === incomingEdgeIds[idx]);
            if (sameEdges && cached?.routes && typeof cached.routes === 'object') {
              console.log('[EdgeReroute] cache hit for routes', { edgeCount: incomingEdgeIds.length });
              setEdgeRoutes(cached.routes);
              skipRerouteRef.current = true;
              cachedRoutesApplied = true;
            } else {
              console.log('[EdgeReroute] cache miss (edge ids changed)', {
                cachedCount: cachedEdges.length,
                incomingCount: incomingEdgeIds.length
              });
            }
          } else {
            console.log('[EdgeReroute] cache miss (no stored routes)');
          }
        } catch (err) {
          // ignore cache errors
        }
      }
      if (!cachedRoutesApplied && incomingEdgeRoutes) {
        const incomingEdgeIds = Array.isArray(nextEdges) ? nextEdges.map((edge) => edge?.id).filter(Boolean) : [];
        const sameEdges =
          Array.isArray(incomingEdgeRouteIds) &&
          incomingEdgeRouteIds.length === incomingEdgeIds.length &&
          incomingEdgeRouteIds.every((id, idx) => id === incomingEdgeIds[idx]);
        if (sameEdges) {
          console.log('[EdgeReroute] host cache applied', { edgeCount: incomingEdgeIds.length });
          setEdgeRoutes(incomingEdgeRoutes);
          skipRerouteRef.current = true;
          cachedRoutesApplied = true;
        }
      }
      setNodes(nextNodes);
      setEdges(nextEdges);
      setGroups(nextGroups);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setSelectedGroupIds([]);
      try {
        const manifestSettings = getManifestSettings(nextNodes);
        const settings = manifestSettings || payload.settings || {};
        const documentUrl = getManifestDocumentUrl(nextNodes) || payload.document?.url || null;
        eventBus.emit('loadSaveFile', { ...payload, settings, documentUrl });
      } catch (err) {
        console.warn('Failed to emit loadSaveFile from loadGraph message:', err);
      }
      try {
        window.__Twilite_HOST_GRAPH_READY__ = true;
      } catch {}
      try {
        if (typeof window !== 'undefined' && window.__Twilite_EMBED__) {
          postHostMessage({ type: 'graphLoaded', seq: data.seq ?? null });
        }
      } catch (err) {
        // ignore postMessage failures
      }
      try {
        window.setTimeout(() => {
          try { window.__Twilite_SYNCING__ = false; } catch {}
        }, 120);
      } catch {}
    };

    window.addEventListener('message', handleLoadGraphMessage);
    return () => window.removeEventListener('message', handleLoadGraphMessage);
  }, [
    setNodes,
    setEdges,
    setGroups,
    setPan,
    setZoom,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedGroupIds
  ]);

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
  const [storySnapshots, setStorySnapshots] = useState([]);

  const captureStorySnapshot = useCallback((reason = 'auto', label = '') => {
    const historyIndex = historyHook.historyIndex;
    setStorySnapshots((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.historyIndex === historyIndex && reason !== 'milestone') return prev;
      const nodeCount = nodesRef.current ? nodesRef.current.length : nodes.length;
      const edgeCount = edgesRef.current ? edgesRef.current.length : edges.length;
      const groupCount = Array.isArray(groups) ? groups.length : 0;
      const nextId = last ? last.id + 1 : 1;
      const timestamp = new Date().toISOString();
      const next = [
        ...prev,
        {
          id: nextId,
          historyIndex,
          timestamp,
          reason,
          label: label ? String(label).trim() : '',
          nodeCount,
          edgeCount,
          groupCount
        }
      ];
      return next;
    });
  }, [historyHook.historyIndex, nodes, edges, groups, nodesRef, edgesRef]);

  useEffect(() => {
    try {
      eventBus.emit('storySnapshotsUpdated', { snapshots: storySnapshots });
    } catch (err) {
      // ignore event bus errors
    }
  }, [storySnapshots]);

  useEffect(() => {
    if (storySnapshots.length === 0 && historyHook.history.length > 0) {
      captureStorySnapshot('init');
    }
  }, [storySnapshots.length, historyHook.history.length, captureStorySnapshot]);

  useEffect(() => {
    if (historyHook.history.length > 0) {
      captureStorySnapshot('edit');
    }
  }, [historyHook.historyIndex, historyHook.history.length, captureStorySnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      captureStorySnapshot('auto');
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [captureStorySnapshot]);

  const buildGraphSaveData = useCallback(() => {
    const now = new Date().toISOString();
    const nodeList = nodesRef.current || nodes;
    const edgeList = edgesRef.current || edges;
    const groupsList = groups || [];
    const manifestSettings = {
      theme: documentTheme || documentSettings?.theme || null,
      backgroundImage: documentBackgroundImage || null,
      defaultNodeColor: defaultNodeColor,
      defaultEdgeColor: defaultEdgeColor,
      snapToGrid: snapToGrid,
      gridSize: documentSettings?.gridSize || 20,
      edgeRouting: documentSettings?.edgeRouting || 'auto',
      layout: documentSettings?.layout || null,
      github: documentSettings?.github || null,
      autoSave: false
    };
    const nodesWithManifestSettings = setManifestSettings(nodeList, manifestSettings);
    const nodesWithManifestData = setManifestDocumentUrl(
      nodesWithManifestSettings,
      backgroundUrl || ''
    );
    return {
      fileVersion: '1.0',
      metadata: {
        title: projectMeta?.title || 'Untitled Graph',
        description: projectMeta?.description || '',
        created: projectMeta?.createdAt || now,
        modified: now,
        author: '',
        tags: Array.isArray(projectMeta?.tags) ? projectMeta.tags : []
      },
      nodes: nodesWithManifestData.map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: node.position,
        width: node.width,
        height: node.height,
        color: node.color,
        visible: node.visible !== false,
        showLabel: node.showLabel !== false,
        data: node.data || {}
      })),
      edges: edgeList.map((edge) => {
        const sourceNodeId = typeof edge.source === 'object' && edge.source
          ? (edge.source.nodeId ?? edge.source.id ?? '')
          : edge.source;
        const targetNodeId = typeof edge.target === 'object' && edge.target
          ? (edge.target.nodeId ?? edge.target.id ?? '')
          : edge.target;
        const sourceHandle = edge.sourceHandle || (typeof edge.source === 'object' && edge.source ? edge.source.handleKey : undefined);
        const targetHandle = edge.targetHandle || (typeof edge.target === 'object' && edge.target ? edge.target.handleKey : undefined);
        return {
          id: edge.id,
          type: edge.type,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          handleMeta: edge.handleMeta || undefined,
          label: edge.label || '',
          style: edge.style || {},
          data: edge.data || {}
        };
      }),
      clusters: groupsList.map((group) => ({
        id: group.id,
        label: group.label || '',
        nodeIds: group.nodeIds || [],
        bounds: group.bounds || { x: 0, y: 0, width: 0, height: 0 },
        visible: group.visible !== false,
        style: group.style || {}
      }))
    };
  }, [
    nodes,
    edges,
    groups,
    nodesRef,
    edgesRef,
    projectMeta,
    documentTheme,
    documentSettings,
    documentBackgroundImage,
    defaultNodeColor,
    defaultEdgeColor,
    snapToGrid,
    pan,
    zoom,
    backgroundUrl,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const exportGraph = () => buildGraphSaveData();
    window.__Twilite_EXPORT_GRAPH__ = exportGraph;
    return () => {
      if (window.__Twilite_EXPORT_GRAPH__ === exportGraph) {
        delete window.__Twilite_EXPORT_GRAPH__;
      }
    };
  }, [buildGraphSaveData]);

  useEffect(() => {
    try {
      eventBus.emit('projectMetaUpdated', { meta: projectMeta || {} });
    } catch (err) {
      // ignore event bus errors
    }
  }, [projectMeta]);

  useEffect(() => {
    try {
      eventBus.emit('documentSettingsUpdated', { settings: documentSettings || {} });
    } catch (err) {
      // ignore event bus errors
    }
  }, [documentSettings]);

  useEffect(() => {
    try {
      eventBus.emit('documentThemeUpdated', { theme: documentTheme || null });
    } catch (err) {
      // ignore event bus errors
    }
  }, [documentTheme]);

  useEffect(() => {
    try {
      eventBus.emit('documentUpdated', {
        document: backgroundUrl ? { url: backgroundUrl } : null,
        interactive: Boolean(backgroundInteractive)
      });
    } catch (err) {
      // ignore event bus errors
    }
  }, [backgroundUrl, backgroundInteractive]);

  useEffect(() => {
    try {
      eventBus.emit('backgroundImageUpdated', { backgroundImage: documentBackgroundImage || null });
    } catch (err) {
      // ignore event bus errors
    }
  }, [documentBackgroundImage]);

  useEffect(() => {
    if (!projectActivityInitializedRef.current) {
      projectActivityInitializedRef.current = true;
      return;
    }
    updateProjectMeta({ lastModified: new Date().toISOString() });
  }, [historyHook.historyIndex, projectActivityInitializedRef, updateProjectMeta]);

  useEffect(() => {
    const handleRestoreHistory = ({ index } = {}) => {
      if (typeof index !== 'number') return;
      const restored = historyHook.restoreToIndex(index);
      if (restored) {
        setSnackbar({ open: true, message: `Restored snapshot #${index + 1}`, severity: 'success' });
      }
    };

    const handleGraphSaved = ({ reason } = {}) => {
      captureStorySnapshot(reason || 'save');
    };

    const handleStoryMilestone = ({ label } = {}) => {
      captureStorySnapshot('milestone', label || '');
    };

    eventBus.on('restoreHistoryToIndex', handleRestoreHistory);
    eventBus.on('graphSaved', handleGraphSaved);
    eventBus.on('storyMilestone', handleStoryMilestone);
    return () => {
      eventBus.off('restoreHistoryToIndex', handleRestoreHistory);
      eventBus.off('graphSaved', handleGraphSaved);
      eventBus.off('storyMilestone', handleStoryMilestone);
    };
  }, [historyHook, captureStorySnapshot, setSnackbar]);

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

  useEffect(() => {
    try {
      eventBus.emit('recentSnapshotsUpdated', { snapshots: recentSnapshots });
    } catch (err) {
      // ignore event bus errors
    }
  }, [recentSnapshots]);

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
    edges,
    setEdgeRoutes,
    layoutSettings: documentSettings?.layout,
    edgeRouting: documentSettings?.edgeRouting || 'auto',
    setSnackbar,
    skipRerouteRef
  });

  const defaultLayoutSyncRef = useRef(null);
  const pendingRerouteOnLoadRef = useRef(false);

  useInterpreterLayer({
    nodes,
    edges,
    edgeRoutes,
    groups,
    lockedNodes,
    documentSettings,
    modesHook,
    setNodes,
    setEdgeRoutes,
    setSnackbar,
    lastPointerRef
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event) => {
      const detail = event?.detail || {};
      const positions = Array.isArray(detail.positions) ? detail.positions : [];
      if (!positions.length) return;
      if (typeof modesHook.applyLayoutPositions === 'function') {
        modesHook.applyLayoutPositions(positions);
      }
    };
    window.addEventListener('Twilite-elkLayout', handler);
    return () => window.removeEventListener('Twilite-elkLayout', handler);
  }, [modesHook]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__Twilite_EMBED__) return () => {};
    const uri = currentDocUriRef.current;
    if (!uri) return () => {};
    if (!edgeRoutes || Object.keys(edgeRoutes).length === 0) return () => {};
    if (edgeRoutesSaveTimerRef.current) {
      clearTimeout(edgeRoutesSaveTimerRef.current);
    }
    edgeRoutesSaveTimerRef.current = window.setTimeout(() => {
      try {
        const edgeIds = Array.isArray(edges) ? edges.map((edge) => edge?.id).filter(Boolean) : [];
        const cacheKey = `twilite.edgeRoutes.${encodeURIComponent(uri)}`;
        window.localStorage.setItem(cacheKey, JSON.stringify({ edgeIds, routes: edgeRoutes }));
        postHostMessage({ type: 'edgeRoutes', uri, edgeIds, routes: edgeRoutes });
      } catch (err) {
        // ignore cache errors
      }
    }, 200);
    return () => {
      if (edgeRoutesSaveTimerRef.current) {
        clearTimeout(edgeRoutesSaveTimerRef.current);
      }
    };
  }, [edgeRoutes, edges]);

  useEffect(() => {
    const defaultLayout = documentSettings?.layout?.defaultLayout;
    if (!defaultLayout) return;
    if (typeof modesHook.setAutoLayoutType !== 'function') return;
    if (defaultLayoutSyncRef.current === defaultLayout) return;
    try {
      modesHook.setAutoLayoutType(defaultLayout);
      if (typeof modesHook.applyAutoLayout === 'function') {
        modesHook.applyAutoLayout(defaultLayout);
      }
      defaultLayoutSyncRef.current = defaultLayout;
    } catch {
      // ignore
    }
  }, [documentSettings?.layout?.defaultLayout, modesHook.setAutoLayoutType]);

  
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

  const openEntitiesPanel = useCallback((view) => {
    setEntityView(view);
    setShowEntitiesPanel(true);
    setShowNodeList(view === 'nodes');
    setShowEdgeList(view === 'edges');
    setShowGroupList(view === 'groups');
  }, [setShowEdgeList, setShowGroupList, setShowNodeList]);

  const closeEntitiesPanel = useCallback(() => {
    setShowEntitiesPanel(false);
    setShowNodeList(false);
    setShowEdgeList(false);
    setShowGroupList(false);
  }, [setShowEdgeList, setShowGroupList, setShowNodeList]);

  const toggleEntityView = useCallback((view) => {
    if (showEntitiesPanel && entityView === view) {
      closeEntitiesPanel();
      return;
    }
    openEntitiesPanel(view);
  }, [closeEntitiesPanel, entityView, openEntitiesPanel, showEntitiesPanel]);

  const toggleNodeList = useCallback(() => toggleEntityView('nodes'), [toggleEntityView]);
  const toggleGroupList = useCallback(() => toggleEntityView('groups'), [toggleEntityView]);
  const toggleEdgeList = useCallback(() => toggleEntityView('edges'), [toggleEntityView]);

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
      pendingRerouteOnLoadRef.current = Array.isArray(edgesToLoad) && edgesToLoad.length > 0;
      setGraphRenderKey(prev => prev + 1);
      setStorySnapshots([]);
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
        setMemoAutoExpandToken((token) => token + 1);
      }
    }
  }, [handlers, setSelectedNodeIds, setSelectedEdgeIds, setSelectedGroupIds, setShowPropertiesPanel, setMemoAutoExpandToken, setStorySnapshots]);

  useEffect(() => {
    if (!pendingRerouteOnLoadRef.current) return;
    if (!Array.isArray(edges) || edges.length === 0) return;
    if (documentSettings?.edgeRouting && documentSettings.edgeRouting !== 'auto') {
      pendingRerouteOnLoadRef.current = false;
      return;
    }
    pendingRerouteOnLoadRef.current = false;
    if (typeof modesHook.rerouteEdges === 'function') {
      Promise.resolve(modesHook.rerouteEdges())
        .catch((err) => {
          console.warn('[EdgeReroute] Failed on load:', err);
          setSnackbar({ open: true, message: 'Failed to reroute edges on load', severity: 'error', copyToClipboard: true });
        });
    }
  }, [edges, documentSettings?.edgeRouting, modesHook.rerouteEdges, setSnackbar]);

  useEffect(() => {
    const showMessage = (message, severity = 'info') => {
      if (setSnackbar) {
        setSnackbar({ open: true, message, severity });
      }
    };

    const handleGithubCommit = async ({ token, settings = {}, message } = {}) => {
      if (!token) {
        showMessage('GitHub PAT is required.', 'error');
        return;
      }
      const repoInfo = parseRepoString(settings.repo || '');
      if (!repoInfo) {
        showMessage('GitHub repo must be in the form owner/name.', 'error');
        return;
      }
      const path = (settings.path || '').trim();
      if (!path) {
        showMessage('GitHub file path is required.', 'error');
        return;
      }
      const branch = (settings.branch || 'main').trim();
      const { owner, repo } = repoInfo;
      const headers = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json'
      };

      try {
        showMessage('Committing graph to GitHub...', 'info');
        const readUrl = buildGitHubContentUrl({ owner, repo, path, branch, includeRef: true });
        const putUrl = buildGitHubContentUrl({ owner, repo, path, branch, includeRef: false });
        let sha = null;

        const readResp = await fetch(readUrl, { headers });
        if (readResp.ok) {
          const existing = await readResp.json();
          if (existing && existing.type === 'file' && existing.sha) {
            sha = existing.sha;
          } else {
            showMessage('GitHub path points to a directory, not a file.', 'error');
            return;
          }
        } else if (readResp.status !== 404) {
          const errorJson = await readResp.json().catch(() => ({}));
          showMessage(`GitHub read failed: ${errorJson.message || readResp.statusText}`, 'error');
          return;
        }

        const payload = {
          message: (message || '').trim() || `Update ${path}`,
          content: encodeBase64(JSON.stringify(buildGraphSaveData(), null, 2)),
          branch
        };
        if (sha) {
          payload.sha = sha;
        }

        const writeResp = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!writeResp.ok) {
          const errorJson = await writeResp.json().catch(() => ({}));
          showMessage(`GitHub commit failed: ${errorJson.message || writeResp.statusText}`, 'error');
          return;
        }

        showMessage('GitHub commit successful.', 'success');
        eventBus.emit('setAddress', `github://${owner}/${repo}/${path}`);
        captureStorySnapshot('github');
      } catch (err) {
        showMessage(`GitHub commit error: ${err.message || String(err)}`, 'error');
      }
    };

    const handleGithubLoad = async ({ token, settings = {} } = {}) => {
      if (!token) {
        showMessage('GitHub PAT is required.', 'error');
        return;
      }
      const repoInfo = parseRepoString(settings.repo || '');
      if (!repoInfo) {
        showMessage('GitHub repo must be in the form owner/name.', 'error');
        return;
      }
      const path = (settings.path || '').trim();
      if (!path) {
        showMessage('GitHub file path is required.', 'error');
        return;
      }
      const branch = (settings.branch || 'main').trim();
      const { owner, repo } = repoInfo;
      const headers = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json'
      };

      try {
        showMessage('Loading graph from GitHub...', 'info');
        const readUrl = buildGitHubContentUrl({ owner, repo, path, branch, includeRef: true });
        const readResp = await fetch(readUrl, { headers });
        if (!readResp.ok) {
          const errorJson = await readResp.json().catch(() => ({}));
          showMessage(`GitHub load failed: ${errorJson.message || readResp.statusText}`, 'error');
          return;
        }

        const payload = await readResp.json();
        if (!payload || payload.type !== 'file' || !payload.content) {
          showMessage('GitHub response did not include file content.', 'error');
          return;
        }

        const decoded = decodeBase64(payload.content.replace(/\n/g, ''));
        const data = JSON.parse(decoded);
        const nodesToLoad = Array.isArray(data.nodes) ? data.nodes : [];
        const edgesToLoad = Array.isArray(data.edges) ? data.edges : [];
        const groupsToLoad = Array.isArray(data.clusters)
          ? data.clusters
          : Array.isArray(data.groups)
          ? data.groups
          : [];
        handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);

        try {
          const manifestSettings = getManifestSettings(nodesToLoad);
          const documentUrl = getManifestDocumentUrl(nodesToLoad) || data.document?.url || null;
          eventBus.emit('loadSaveFile', {
            settings: manifestSettings || data.settings || {},
            viewport: data.viewport || {},
            scripts: data.scripts || null,
            filename: path.split('/').pop() || path,
            documentUrl
          });
        } catch (err) {
          console.warn('Failed to emit loadSaveFile after GitHub load:', err);
        }

        showMessage('GitHub load successful.', 'success');
        eventBus.emit('setAddress', `github://${owner}/${repo}/${path}`);
      } catch (err) {
        showMessage(`GitHub load error: ${err.message || String(err)}`, 'error');
      }
    };

    eventBus.on('githubCommit', handleGithubCommit);
    eventBus.on('githubLoad', handleGithubLoad);
    return () => {
      eventBus.off('githubCommit', handleGithubCommit);
      eventBus.off('githubLoad', handleGithubLoad);
    };
  }, [buildGraphSaveData, handleLoadGraph, setSnackbar]);


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
      emitEdgeIntent('alignSelection', {
        mode,
        selectionCount: selectedSet.size
      });
    }

    return mutated;
  }, [selectedNodeIds, setNodes, nodesRef, historyHook, edgesRef, emitEdgeIntent]);

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
      emitEdgeIntent('distributeSelection', {
        axis,
        selectionCount: selectedSet.size
      });
    }

    return mutated;
  }, [selectedNodeIds, setNodes, nodesRef, historyHook, edgesRef, emitEdgeIntent]);

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
          onShowMessage: (message, severity) => setSnackbar({ open: true, message, severity, copyToClipboard: true }),
          graphCRUD
        });
        
        if (result && (result.nodes > 0 || result.edges > 0 || result.groups > 0)) {
          console.log('[GraphEditor] Successfully pasted:', result);
        }
      } catch (err) {
        console.error('[GraphEditor] Paste handler error:', err);
        setSnackbar({ open: true, message: 'Paste failed', severity: 'error', copyToClipboard: true });
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
    onShowMessage: (message, severity) => setSnackbar({ open: true, message, severity, copyToClipboard: true })
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

    // Expose execution spine test helper
    window.testExecutionIntent = (payload = {}) => {
      const now = Date.now();
      const proposals = payload.proposals || [
        {
          action: 'createNode',
          node: {
            label: 'Execution Spine Test',
            type: 'default',
            position: { x: 240 + (now % 120), y: 240 + (now % 120) },
            data: { memo: 'Created via executionIntent' }
          }
        }
      ];
      try {
        eventBus.emit('executionIntent', {
          trigger: payload.trigger || 'applyScriptProposals',
          proposals,
          source: payload.source || 'test'
        });
        console.log('✅ executionIntent dispatched', { proposals });
      } catch (err) {
        console.error('❌ executionIntent failed', err);
      }
    };
    
    // Log available helpers
    console.log('🔧 Global helpers available:');
    console.log('  - window.eventBus - Event bus');
    console.log('  - window.graphAPI - Graph API');
    console.log('  - window.testBackgroundRpc(method, args) - Test RPC');
    console.log('  - window.backgroundRpcStatus() - Check RPC status');
    console.log('  - window.testExecutionIntent(payload) - Test execution spine');
    
    return () => {
      delete window.testBackgroundRpc;
      delete window.backgroundRpcStatus;
      delete window.testExecutionIntent;
    };
  }, [backgroundRpc, backgroundRpcReady, backgroundRpcMethods, backgroundUrl]);
  
  // Listen for 'fetchUrl' event from address bar
  useEffect(() => {
    const handleFetchUrl = async ({ url, source = 'unknown' }) => {
      try {
        if (!url) return;
        let fullUrl = url;
        let originalTlzPath = null;
        let directTlzPath = null;

        if (typeof fullUrl === 'string' && fullUrl.startsWith('/tlz/')) {
          directTlzPath = fullUrl;
        }

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
          const resp = await fetch(u, fetchOptions);
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

        const hostReadFile = async (path) => {
          if (typeof window === 'undefined') return null;
          if (window.__Twilite_HOST__ !== 'vscode') return null;
          if (typeof window.__Twilite_POST_MESSAGE__ !== 'function') return null;

          const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const normalized = path.replace(/^\/+/, '');

          return new Promise((resolve) => {
            let finished = false;
            const timeoutId = window.setTimeout(() => {
              if (finished) return;
              finished = true;
              window.removeEventListener('Twilite-readFile', handler);
              resolve({ text: '', error: 'timeout' });
            }, 3000);

            const handler = (event) => {
              const detail = event?.detail;
              if (!detail || detail.requestId !== requestId) return;
              if (finished) return;
              finished = true;
              window.clearTimeout(timeoutId);
              window.removeEventListener('Twilite-readFile', handler);
              resolve(detail);
            };

            window.addEventListener('Twilite-readFile', handler);
            window.__Twilite_POST_MESSAGE__({
              type: 'readFile',
              requestId,
              path: normalized
            });
          });
        };

        const makeTextResponse = (body, contentType = 'text/plain') => ({
          ok: true,
          status: 200,
          headers: {
            get: (name) => (name && name.toLowerCase() === 'content-type' ? contentType : null)
          },
          text: async () => body
        });

        if (!response && (originalTlzPath || directTlzPath)) {
          const relPathRaw = directTlzPath || originalTlzPath;
          const relPath = relPathRaw.startsWith('/') ? relPathRaw : `/${relPathRaw}`;
          const tlzCandidates = [];
          const addCandidate = (candidate) => {
            if (candidate && !tlzCandidates.includes(candidate)) tlzCandidates.push(candidate);
          };
          addCandidate(relPath);
          if (relPath.endsWith('.json')) {
            addCandidate(relPath.replace(/\.json$/, '.node'));
          }
          if (!relPath.endsWith('.node')) {
            addCandidate(relPath + '.node');
          }
          if (relPath.endsWith('/')) {
            addCandidate(relPath + 'index.node');
          } else {
            const lastSegment = relPath.split('/').pop() || '';
            if (!lastSegment.includes('.')) {
              addCandidate(relPath + '/index.node');
            }
          }

          for (const candidate of tlzCandidates) {
            const hostResult = await hostReadFile(candidate);
            if (hostResult && !hostResult.error) {
              response = makeTextResponse(hostResult.text || '', 'text/plain');
              fullUrl = candidate;
              break;
            }
          }
        }

        for (const candidate of localCandidates) {
          if (candidate === fullUrl || triedUrls.includes(candidate)) continue;
          try {
            response = await tryFetch(candidate);
            fullUrl = candidate;
            try { eventBus.emit('setAddress', fullUrl); } catch (err) { /* ignore */ }
            break;
          } catch (err) {
            // continue to next candidate
          }
        }

        const shouldTryIndexNode = (candidateUrl) => {
          try {
            const parsed = new URL(candidateUrl);
            const path = parsed.pathname || '';
            if (path.endsWith('/')) return true;
            const lastSegment = path.split('/').pop() || '';
            if (!lastSegment) return true;
            return !lastSegment.includes('.');
          } catch (err) {
            return false;
          }
        };

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
          } else if (shouldTryIndexNode(fullUrl)) {
            alternates.push(fullUrl + '/index.node');
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
        const contentType = response.headers.get('content-type') || '';

        const applyManifestBoundary = (nodes, edges, clusters) => {
          const manifestNodes = Array.isArray(nodes)
            ? nodes.filter(node => node && node.type === 'manifest')
            : [];
          const manifestNode = manifestNodes[0] || null;
          const STRUCTURE_EDGE_TYPES = new Set(['contains', 'child']);

          const boundary = manifestNode?.data?.authority?.graphBoundary || 'none';
          if (!manifestNode || boundary === 'none') {
            const boundaryWarnings = [];
            if (manifestNodes.length > 1) {
              boundaryWarnings.push({
                code: 'manifest-order',
                message: `Multiple manifests found (${manifestNodes.length}). Using the first in file order.`
              });
            }
            return { nodes, edges, clusters, boundaryWarnings };
          }

          const nodeMap = new Map(nodes.map(node => [node.id, node]));
          const clusterList = Array.isArray(clusters) ? clusters : [];
          const boundaryWarnings = [];
          let includedNodeIds = new Set();

          if (boundary === 'cluster') {
            const manifestCluster = clusterList.find(cluster => Array.isArray(cluster?.nodeIds) && cluster.nodeIds.includes(manifestNode.id));
            if (!manifestCluster) {
              return { nodes, edges, clusters, boundaryWarnings };
            }
            includedNodeIds = new Set(manifestCluster.nodeIds);
          } else if (boundary === 'root') {
            const adjacency = new Map();
            const addAdjacency = (from, to) => {
              if (!from || !to) return;
              if (!adjacency.has(from)) adjacency.set(from, []);
              adjacency.get(from).push(to);
            };

            edges.forEach(edge => {
              if (!edge?.source || !edge?.target) return;
              if (!STRUCTURE_EDGE_TYPES.has(edge.type)) return;
              addAdjacency(edge.source, edge.target);
              addAdjacency(edge.target, edge.source);
            });

            clusterList.forEach(cluster => {
              const members = Array.isArray(cluster?.nodeIds) ? cluster.nodeIds.filter(Boolean) : [];
              if (members.length < 2) return;
              const anchor = members[0];
              for (let i = 1; i < members.length; i += 1) {
                const memberId = members[i];
                addAdjacency(anchor, memberId);
                addAdjacency(memberId, anchor);
              }
            });

            const queue = [manifestNode.id];
            while (queue.length > 0) {
              const currentId = queue.shift();
              if (includedNodeIds.has(currentId)) continue;
              const currentNode = nodeMap.get(currentId);
              if (!currentNode) continue;
              if (currentId !== manifestNode.id && currentNode.type === 'manifest') {
                continue;
              }
              includedNodeIds.add(currentId);
              const neighbors = adjacency.get(currentId) || [];
              neighbors.forEach(nextId => {
                if (includedNodeIds.has(nextId)) return;
                const nextNode = nodeMap.get(nextId);
                if (nextNode && nextNode.type === 'manifest' && nextId !== manifestNode.id) return;
                queue.push(nextId);
              });
            }
          }

          if (manifestNodes.length > 1) {
            boundaryWarnings.push({
              code: 'manifest-order',
              message: `Multiple manifests found (${manifestNodes.length}). Using the first in file order.`
            });
          }
          if (includedNodeIds.size === 0) {
            return { nodes, edges, clusters, boundaryWarnings };
          }

          const filteredNodes = nodes.filter(node => includedNodeIds.has(node.id));
          const filteredEdges = edges.filter(edge => includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target));
          const filteredClusters = clusterList
            .map(cluster => {
              const originalIds = Array.isArray(cluster.nodeIds) ? cluster.nodeIds : [];
              const nodeIds = originalIds.filter(nodeId => includedNodeIds.has(nodeId));
              if (nodeIds.length > 0) {
                if (nodeIds.length !== originalIds.length) {
                  boundaryWarnings.push({
                    code: 'cluster-boundary',
                    message: `Cluster "${cluster.id}" referenced ${originalIds.length - nodeIds.length} out-of-bounds node(s); ignoring them.`
                  });
                }
                return { ...cluster, nodeIds };
              }
              return null;
            })
            .filter(Boolean);

          if (filteredNodes.length !== nodes.length) {
            boundaryWarnings.push({
              code: 'manifest-boundary',
              message: `Manifest boundary "${boundary}" filtered ${nodes.length - filteredNodes.length} nodes.`
            });
          }

          return {
            nodes: filteredNodes,
            edges: filteredEdges,
            clusters: filteredClusters,
            boundaryWarnings
          };
        };

        // Try to parse as JSON (graph data)
        try {
          const jsonData = JSON.parse(text);
          if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
            const nodesToLoad = jsonData.nodes;
            const edgesToLoadFromJson = jsonData.edges || [];
            const groupsToLoadFromJson = jsonData.clusters || jsonData.groups || [];
            const boundaryResult = applyManifestBoundary(nodesToLoad, edgesToLoadFromJson, groupsToLoadFromJson);
            const filteredNodes = boundaryResult.nodes;
            const filteredEdges = boundaryResult.edges;
            const filteredClusters = boundaryResult.clusters;
            const { errors, warnings } = validateGraphInvariants({
              nodes: filteredNodes,
              edges: filteredEdges,
              clusters: filteredClusters,
              mode: 'load'
            });
            if (errors.length > 0) {
              const message = errors[0]?.message || 'Manifest validation failed.';
              setSnackbar({
                open: true,
                message: `Load blocked: ${message}`,
                severity: 'error'
              });
              return;
            }
            handleLoadGraph(filteredNodes, filteredEdges, filteredClusters);
            try { eventBus.emit('forceRedraw'); } catch (e) { /* ignore */ }
            const combinedWarnings = [...(warnings || []), ...(boundaryResult.boundaryWarnings || [])];
            if (combinedWarnings.length > 0) {
              setSnackbar({
                open: true,
                message: `Graph loaded with ${combinedWarnings.length} warning${combinedWarnings.length === 1 ? '' : 's'}.`,
                severity: 'warning'
              });
            } else {
              setSnackbar({ open: true, message: 'Graph loaded from URL', severity: 'success' });
            }
            eventBus.emit('setAddress', fullUrl); // ensure address reflects final URL

            try {
              const parsedUrl = new URL(fullUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
              const params = parsedUrl.searchParams;
              const targetNodeId = params.get('node') || params.get('nodeId');
              if (targetNodeId) {
                const handleId = params.get('handle') || 'root';
                const rawValue = params.get('value');
                let value = rawValue;
                if (rawValue !== null) {
                  try {
                    value = JSON.parse(rawValue);
                  } catch (err) {
                    value = rawValue;
                  }
                }
                eventBus.emit('nodeInput', {
                  targetNodeId,
                  handleId,
                  value,
                  source: 'url',
                  meta: { query: parsedUrl.search }
                });
              }
            } catch (err) {
              // ignore query parsing errors
            }

            try {
              filteredNodes
                .filter((node) => node?.data?.autoRunOnLoad)
                .forEach((node) => {
                  eventBus.emit('nodeInput', {
                    targetNodeId: node.id,
                    handleId: 'root',
                    value: node.data?.autoRunPayload || {},
                    source: 'autoRun',
                    meta: { reason: 'autoRunOnLoad' }
                  });
                });
            } catch (err) {
              // ignore auto-run errors
            }
            return;
          }
        } catch (e) {
          // Not JSON or missing nodes
        }

        // If it's HTML, we should probably NOT create a node if it was intended to be a graph
        if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html')) {
           if (fullUrl.endsWith('.node') || fullUrl.endsWith('.json')) {
             setSnackbar({ open: true, message: `Failed to load graph: Received HTML instead of graph data. (Check if the file exists at ${fullUrl})`, severity: 'error' });
             return;
           }
        }

        // Create text node (fallback for actual text files)
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
          const groupsToLoad = data.clusters || data.groups || [];
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
          setSnackbar({ open: true, message: 'Pasted graph data', severity: 'success', copyToClipboard: true });
          return;
        }

        // If only groups present
        if ((data.clusters || data.groups) && Array.isArray(data.clusters || data.groups) && setGroups) {
          setGroups(prev => {
            const next = [...prev, ...(data.clusters || data.groups)];
            return next;
          });
          setSnackbar({ open: true, message: 'Pasted clusters', severity: 'success', copyToClipboard: true });
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
    // Intentionally do not auto-open the properties panel on selection for desktop.
  }, [isMobile, selectedNodeIds, selectedEdgeIds, selectedGroupIds, setShowPropertiesPanel]);

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

    const fallbackHandle = () => ({
      key: 'root',
      label: 'Root',
      type: 'value',
      position: { side: 'left', offset: 0.5 }
    });

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

    const emitUiIntent = (proposals) => {
      const list = Array.isArray(proposals) ? proposals : [proposals];
      try {
        eventBus.emit('executionIntent', {
          trigger: 'ui',
          proposals: list,
          source: 'ui'
        });
        return true;
      } catch (err) {
        console.error('Failed to emit execution intent', err);
        return false;
      }
    };

    const nextGeneratedId = () => {
      const raw = graphAPI?.current?._raw || window.graphAPIRaw;
      if (raw && typeof raw._generateId === 'function') {
        let candidate = raw._generateId();
        const existing = new Set((raw.getNodes?.() || []).map((n) => n.id));
        while (existing.has(candidate)) {
          candidate = raw._generateId();
        }
        return candidate;
      }
      return `node_${Date.now()}`;
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

      const startHandleKey = handle?.key || handle?.handleKey || 'root';
        const startHandleType = handle?.handleType || 'trigger';
        const resolvedEdgeType = edgeType || 'relates';
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

        const createdNodeId = nextGeneratedId();
        const newNodePayload = {
          id: createdNodeId,
          label: 'New Node',
          type: parentNode.type || 'default',
          position: { x: graph.x, y: graph.y },
          width: parentNode.width || 200,
          height: parentNode.height || 120,
          inputs: clonedInputs.map(h => ({ ...h })),
          outputs: clonedOutputs.map(h => ({ ...h }))
        };

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

        const queued = emitUiIntent([
          { action: 'createNode', node: newNodePayload },
          { action: 'createEdge', edge: edgePayload }
        ]);

        if (queued) {
          setSnackbar({ open: true, message: 'Node and edge created', severity: 'success' });
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
        const fallbackNodeId = nodeResult.data.id;
        const fallbackHandle = direction === 'source'
          ? pickHandle({ inputs: clonedInputs }, 'inputs', startHandleType)
          : pickHandle({ outputs: clonedOutputs }, 'outputs', startHandleType);

        const fallbackEdgePayload = direction === 'source'
          ? {
              source: sourceNode,
              target: fallbackNodeId,
              sourceHandle: startHandleKey,
              targetHandle: fallbackHandle.key,
              type: resolvedEdgeType,
              style: edgeStyle
            }
          : {
              source: fallbackNodeId,
              target: sourceNode,
              sourceHandle: fallbackHandle.key,
              targetHandle: startHandleKey,
              type: resolvedEdgeType,
              style: edgeStyle
            };

        createEdgeViaCrud(api, fallbackEdgePayload, 'Node and edge created');
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

  // Apply theme paste commands after validation (toast confirm + rollback)
  useEffect(() => {
    const handleThemePasteValidated = (payload = {}) => {
      const { theme, defaultNodeColor: nextNodeColor, defaultEdgeColor: nextEdgeColor } = payload;
      const previous = {
        theme: documentTheme || documentSettings?.theme || null,
        defaultNodeColor,
        defaultEdgeColor
      };
      pendingThemePasteRef.current = previous;

      if (theme !== undefined && theme !== null) {
        setDocumentTheme(theme);
      }
      if (typeof nextNodeColor === 'string' && nextNodeColor.trim()) {
        setDefaultNodeColor(nextNodeColor.trim());
      }
      if (typeof nextEdgeColor === 'string' && nextEdgeColor.trim()) {
        setDefaultEdgeColor(nextEdgeColor.trim());
      }

      const handleKeep = () => {
        pendingThemePasteRef.current = null;
        setSnackbar((prev) => ({ ...prev, open: false }));
      };

      const handleRevert = () => {
        const rollback = pendingThemePasteRef.current || previous;
        if (rollback) {
          setDocumentTheme(rollback.theme || null);
          setDefaultNodeColor(rollback.defaultNodeColor);
          setDefaultEdgeColor(rollback.defaultEdgeColor);
        }
        pendingThemePasteRef.current = null;
        setSnackbar({ open: true, message: 'Theme reverted', severity: 'info' });
      };

      setSnackbar({
        open: true,
        message: 'Theme applied. Keep changes?',
        severity: 'info',
        autoHideDuration: null,
        action: (
          <Stack direction="row" spacing={1}>
            <Button size="small" color="inherit" onClick={handleKeep}>
              Keep
            </Button>
            <Button size="small" color="inherit" onClick={handleRevert}>
              Revert
            </Button>
          </Stack>
        )
      });
    };

    eventBus.on('themePasteValidated', handleThemePasteValidated);
    return () => eventBus.off('themePasteValidated', handleThemePasteValidated);
  }, [
    documentTheme,
    documentSettings,
    defaultNodeColor,
    defaultEdgeColor,
    setDocumentTheme,
    setDefaultNodeColor,
    setDefaultEdgeColor,
    setSnackbar
  ]);

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
    showEdgeList,
    setShowEdgeList,
    showGroupProperties,
    setShowGroupProperties,
    showEntitiesPanel,
    setShowEntitiesPanel,
    entityView,
    setEntityView,
    handleOpenDocumentProperties,
    handleOpenMobileAddNode,
    handleCloseMobileAddNode,
    togglePropertiesPanel,
    toggleNodePalette,
    toggleNodeList,
    toggleGroupList,
    toggleEdgeList,
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
    showEdgeList,
    setShowEdgeList,
    showGroupProperties,
    setShowGroupProperties,
    showEntitiesPanel,
    setShowEntitiesPanel,
    entityView,
    setEntityView,
    handleOpenDocumentProperties,
    handleOpenMobileAddNode,
    handleCloseMobileAddNode,
    togglePropertiesPanel,
    toggleNodePalette,
    toggleNodeList,
    toggleGroupList,
    toggleEdgeList,
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

  const stateWithEdgeRoutes = useMemo(() => {
    if (!state) return state;
    return { ...state, edgeRoutes, setEdgeRoutes };
  }, [state, edgeRoutes]);

  return (
    <GraphEditorContextProvider
      state={stateWithEdgeRoutes}
      history={historyHook}
      rpc={rpcContextValue}
      layout={layoutContextValue}
      services={servicesContextValue}
    >
      <GraphEditorContent />
    </GraphEditorContextProvider>
  );
}
