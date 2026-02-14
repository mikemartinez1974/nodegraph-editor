"use client";
// ============================================
// 1. GraphEditor/useGraphEditorState.js
// All state management in one hook
// ============================================
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import GroupManager from '../GroupManager';
import {
  dispatchGraph,
  getGraphSnapshot,
  initGraphCore,
  subscribeGraph
} from '../core/graphCore';

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const isMissingManifestError = (errors = []) =>
  errors.some((err) => String(err || '').toLowerCase().includes('missing manifest'));

const isDraftMode = () => {
  if (typeof window === 'undefined') return false;
  if (window.__Twilite_DRAFT__ === true || window.__TWILITE_DRAFT__ === true) return true;
  try {
    return new URLSearchParams(window.location.search).get('draft') === '1';
  } catch (err) {
    return false;
  }
};

const validateManifestNodes = (nodes = []) => {
  const manifestNodes = Array.isArray(nodes)
    ? nodes.filter((node) => node?.type === 'manifest')
    : [];

  if (manifestNodes.length !== 1) {
    if (manifestNodes.length === 0) {
      return { ok: true, errors: [], implicit: true, kind: 'fragment' };
    }
    return {
      ok: false,
      errors: ['Graph must contain exactly one Manifest node']
    };
  }

  const manifest = manifestNodes[0];
  const data = isPlainObject(manifest?.data) ? manifest.data : null;
  if (!data) {
    return { ok: false, errors: ['Manifest data must be an object'] };
  }

  const requiredIdentity = ['graphId', 'name', 'version', 'description', 'createdAt', 'updatedAt'];
  const requiredIntent = ['kind', 'scope'];
  const requiredDependencies = ['nodeTypes', 'portContracts', 'skills', 'schemaVersions'];
  const requiredAuthority = ['mutation', 'actors', 'styleAuthority', 'history'];

  const errors = [];
  if (!isPlainObject(data.identity)) {
    errors.push('Manifest.identity is required');
  } else {
    requiredIdentity.forEach((key) => {
      if (!hasOwn(data.identity, key)) {
        errors.push(`Manifest.identity.${key} is required`);
      }
    });
  }

  if (!isPlainObject(data.intent)) {
    errors.push('Manifest.intent is required');
  } else {
    requiredIntent.forEach((key) => {
      if (!hasOwn(data.intent, key)) {
        errors.push(`Manifest.intent.${key} is required`);
      }
    });
  }

  if (!isPlainObject(data.dependencies)) {
    errors.push('Manifest.dependencies is required');
  } else {
    requiredDependencies.forEach((key) => {
      if (!hasOwn(data.dependencies, key)) {
        errors.push(`Manifest.dependencies.${key} is required`);
      }
    });
  }

  if (!isPlainObject(data.authority)) {
    errors.push('Manifest.authority is required');
  } else {
    requiredAuthority.forEach((key) => {
      if (!hasOwn(data.authority, key)) {
        errors.push(`Manifest.authority.${key} is required`);
      }
    });
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return { ok: true, errors: [] };
};

const isLayoutOnlyChange = (currentNodes = [], nextNodes = []) => {
  if (!Array.isArray(currentNodes) || !Array.isArray(nextNodes)) return false;
  if (currentNodes.length !== nextNodes.length) return false;
  const currentMap = new Map(currentNodes.map((node) => [node?.id, node]));
  if (currentMap.size !== nextNodes.length) return false;
  for (const next of nextNodes) {
    if (!next || !next.id) return false;
    const current = currentMap.get(next.id);
    if (!current) return false;
    const { position: _posNext, width: _wNext, height: _hNext, ...restNext } = next;
    const { position: _posCur, width: _wCur, height: _hCur, ...restCur } = current;
    if (JSON.stringify(restNext) !== JSON.stringify(restCur)) {
      return false;
    }
  }
  return true;
};

const GRAPH_STORAGE_KEY = 'Twilite_local_graph';

const loadStoredGraph = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  if (window.__Twilite_HOST__ === 'vscode' || window.__Twilite_EMBED__ === true) return null;
  let allowRestore = false;
  try {
    const params = new URLSearchParams(window.location.search);
    allowRestore = params.get('restore') === '1' || window.__Twilite_RESTORE_LAST_GRAPH__ === true;
  } catch (err) {
    allowRestore = window.__Twilite_RESTORE_LAST_GRAPH__ === true;
  }
  if (!allowRestore) return null;
  try {
    const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
        clusters: Array.isArray(parsed.clusters) ? parsed.clusters : []
      };
    }
  } catch (err) {
    console.warn('Failed to load stored graph state:', err);
  }
  return null;
};

export function useGraphEditorState() {
  const storedGraph = loadStoredGraph();
  const coreInitRef = useRef(false);
  if (!coreInitRef.current) {
    initGraphCore(storedGraph || {});
    coreInitRef.current = true;
  }

  const [graphSnapshot, setGraphSnapshot] = useState(() => getGraphSnapshot());
  useEffect(() => {
    const unsubscribe = subscribeGraph(() => {
      setGraphSnapshot(getGraphSnapshot());
    });
    return unsubscribe;
  }, []);

  const nodes = graphSnapshot.nodes;
  const edges = graphSnapshot.edges;
  const groups = graphSnapshot.clusters;
  const manifestStatus = useMemo(() => {
    if (isDraftMode()) {
      return { ok: true, errors: [] };
    }
    return validateManifestNodes(nodes);
  }, [nodes]);
  
  // View state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  
  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  
  // Hover state
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  
  // UI state
  const [showNodeList, setShowNodeList] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false);
  const [showEdgeList, setShowEdgeList] = useState(false);
  const [showGroupProperties, setShowGroupProperties] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [loading, setLoading] = useState(false);
  const [nodePanelAnchor, setNodePanelAnchor] = useState('left');
  const [nodeListAnchor, setNodeListAnchor] = useState('right');
  
  // Color preferences
  const [defaultNodeColor, setDefaultNodeColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nodegraph_default_color') || '#1976d2';
    }
    return '#1976d2';
  });
  
  const [defaultEdgeColor, setDefaultEdgeColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nodegraph_default_edge_color') || '#666666';
    }
    return '#666666';
  });
  
  // Refs for current state access
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const groupsRef = useRef(groups);
  const groupManager = useRef(new GroupManager());
  const initialGraphLoadedRef = useRef(false);
  
  // Keep refs synced
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  // Save color preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nodegraph_default_color', defaultNodeColor);
    }
    eventBus.emit('defaultNodeColorChanged', { color: defaultNodeColor });
  }, [defaultNodeColor]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nodegraph_default_edge_color', defaultEdgeColor);
    }
    eventBus.emit('defaultEdgeColorChanged', { color: defaultEdgeColor });
  }, [defaultEdgeColor]);
  
  // Computed hover edge endpoints
  const hoveredEdgeSource = hoveredEdgeId ? edges.find(e => e.id === hoveredEdgeId)?.source : null;
  const hoveredEdgeTarget = hoveredEdgeId ? edges.find(e => e.id === hoveredEdgeId)?.target : null;

  const blockMutationForManifest = useCallback((errors = []) => {
    const message = errors.length
      ? `Manifest required: ${errors[0]}`
      : 'Manifest required before mutating graph';
    setSnackbar({ open: true, message, severity: 'error' });
  }, [setSnackbar]);

  const setNodes = useCallback((value) => {
    const currentNodes = getGraphSnapshot().nodes;
    const next = typeof value === 'function' ? value(currentNodes) : value;
    const nextNodes = Array.isArray(next) ? next : currentNodes;
    if (typeof window !== 'undefined' && window.__Twilite_FORCE_LAYOUT_POSITIONS__) {
      const forced = window.__Twilite_FORCE_LAYOUT_POSITIONS__;
      window.__Twilite_FORCE_LAYOUT_POSITIONS__ = null;
      if (Array.isArray(forced) && forced.length > 0) {
        const forcedMap = new Map(forced.map((pos) => [pos.id, pos]));
        const merged = nextNodes.map((node) => {
          const target = forcedMap.get(node.id);
          if (!target) return node;
          return {
            ...node,
            position: { x: target.x, y: target.y },
            x: target.x,
            y: target.y
          };
        });
        dispatchGraph({
          type: 'setNodes',
          payload: merged
        });
        return;
      }
    }
    if (isDraftMode()) {
      dispatchGraph({
        type: 'setNodes',
        payload: nextNodes
      });
      return;
    }
    const validation = validateManifestNodes(nextNodes);
    if (!validation.ok) {
      if (typeof window !== 'undefined' && window.__Twilite_ALLOW_LAYOUT__ === true) {
        window.__Twilite_ALLOW_LAYOUT__ = false;
        dispatchGraph({
          type: 'setNodes',
          payload: nextNodes
        });
        return;
      }
      if (isMissingManifestError(validation.errors)) {
        dispatchGraph({
          type: 'setNodes',
          payload: nextNodes
        });
        return;
      }
      const currentManifestIds = currentNodes.filter((node) => node?.type === 'manifest').map((node) => node.id);
      const nextManifestIds = nextNodes.filter((node) => node?.type === 'manifest').map((node) => node.id);
      const removedIds = currentNodes.filter((node) => !nextNodes.some((nextNode) => nextNode.id === node.id)).map((node) => node.id);
      const addedNodes = nextNodes.some((node) => !currentNodes.some((currentNode) => currentNode.id === node.id));
      const removedOnlyManifests =
        currentManifestIds.length > 0 &&
        nextManifestIds.length === 0 &&
        removedIds.length > 0 &&
        removedIds.every((id) => currentManifestIds.includes(id)) &&
        !addedNodes;
      if (removedOnlyManifests) {
        dispatchGraph({
          type: 'setNodes',
          payload: nextNodes
        });
        return;
      }
      if (isLayoutOnlyChange(currentNodes, nextNodes)) {
        dispatchGraph({
          type: 'setNodes',
          payload: nextNodes
        });
        return;
      }
      blockMutationForManifest(validation.errors);
      return;
    }
    dispatchGraph({
      type: 'setNodes',
      payload: nextNodes
    });
  }, [blockMutationForManifest, setSnackbar]);

  const loadGraph = useCallback((nodesToLoad, edgesToLoad, groupsToLoad) => {
    dispatchGraph({
      type: 'setNodes',
      payload: Array.isArray(nodesToLoad) ? nodesToLoad : []
    });
    dispatchGraph({
      type: 'setEdges',
      payload: Array.isArray(edgesToLoad) ? edgesToLoad : []
    });
    dispatchGraph({
      type: 'setGroups',
      payload: Array.isArray(groupsToLoad) ? groupsToLoad : []
    });
  }, []);

  const setEdges = useCallback((value) => {
    const currentEdges = getGraphSnapshot().edges;
    const currentNodes = getGraphSnapshot().nodes;
    if (isDraftMode()) {
      const next = typeof value === 'function' ? value(currentEdges) : value;
      dispatchGraph({
        type: 'setEdges',
        payload: Array.isArray(next) ? next : currentEdges
      });
      return;
    }
    const manifestCheck = validateManifestNodes(currentNodes);
    if (!manifestCheck.ok) {
      if (isMissingManifestError(manifestCheck.errors)) {
        const next = typeof value === 'function' ? value(currentEdges) : value;
        dispatchGraph({
          type: 'setEdges',
          payload: Array.isArray(next) ? next : currentEdges
        });
        return;
      }
      blockMutationForManifest(manifestCheck.errors);
      return;
    }
    const next = typeof value === 'function' ? value(currentEdges) : value;
    dispatchGraph({
      type: 'setEdges',
      payload: Array.isArray(next) ? next : currentEdges
    });
  }, [blockMutationForManifest]);

  const setGroups = useCallback((value) => {
    const currentGroups = getGraphSnapshot().clusters;
    const currentNodes = getGraphSnapshot().nodes;
    if (isDraftMode()) {
      const next = typeof value === 'function' ? value(currentGroups) : value;
      dispatchGraph({
        type: 'setGroups',
        payload: Array.isArray(next) ? next : currentGroups
      });
      return;
    }
    const manifestCheck = validateManifestNodes(currentNodes);
    if (!manifestCheck.ok) {
      if (isMissingManifestError(manifestCheck.errors)) {
        const next = typeof value === 'function' ? value(currentGroups) : value;
        dispatchGraph({
          type: 'setGroups',
          payload: Array.isArray(next) ? next : currentGroups
        });
        return;
      }
      blockMutationForManifest(manifestCheck.errors);
      return;
    }
    const next = typeof value === 'function' ? value(currentGroups) : value;
    dispatchGraph({
      type: 'setGroups',
      payload: Array.isArray(next) ? next : currentGroups
    });
  }, [blockMutationForManifest]);
  
  return {
    // Graph data
    nodes, setNodes, nodesRef,
    edges, setEdges, edgesRef,
    groups, setGroups, groupsRef,
    manifestStatus,
    loadGraph,
    
    // View
    pan, setPan,
    zoom, setZoom,
    
    // Selection
    selectedNodeIds, setSelectedNodeIds,
    selectedEdgeIds, setSelectedEdgeIds,
    selectedGroupIds, setSelectedGroupIds,
    
    // Hover
    hoveredEdgeId, setHoveredEdgeId,
    hoveredNodeId, setHoveredNodeId,
    hoveredEdgeSource, hoveredEdgeTarget,
    
    // UI
    showNodeList, setShowNodeList,
    showGroupList, setShowGroupList,
    showEdgeList, setShowEdgeList,
    showGroupProperties, setShowGroupProperties,
    snackbar, setSnackbar,
    loading, setLoading,
    nodePanelAnchor, setNodePanelAnchor,
    nodeListAnchor, setNodeListAnchor,
    
    // Colors
    defaultNodeColor, setDefaultNodeColor,
    defaultEdgeColor, setDefaultEdgeColor,

    // Managers
    groupManager,
    initialGraphLoadedRef
  };
}
export default useGraphEditorState;
