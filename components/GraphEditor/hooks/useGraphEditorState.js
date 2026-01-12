"use client";
// ============================================
// 1. GraphEditor/useGraphEditorState.js
// All state management in one hook
// ============================================
import { useState, useRef, useEffect, useCallback } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import GroupManager from '../GroupManager';
import {
  dispatchGraph,
  getGraphSnapshot,
  initGraphCore,
  subscribeGraph
} from '../core/graphCore';

const GRAPH_STORAGE_KEY = 'Twilite_local_graph';

const loadStoredGraph = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : []
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
  const groups = graphSnapshot.groups;
  
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

  const setNodes = useCallback((value) => {
    const currentNodes = getGraphSnapshot().nodes;
    const next = typeof value === 'function' ? value(currentNodes) : value;
    dispatchGraph({
      type: 'setNodes',
      payload: Array.isArray(next) ? next : currentNodes
    });
  }, []);

  const setEdges = useCallback((value) => {
    const currentEdges = getGraphSnapshot().edges;
    const next = typeof value === 'function' ? value(currentEdges) : value;
    dispatchGraph({
      type: 'setEdges',
      payload: Array.isArray(next) ? next : currentEdges
    });
  }, []);

  const setGroups = useCallback((value) => {
    const currentGroups = getGraphSnapshot().groups;
    const next = typeof value === 'function' ? value(currentGroups) : value;
    dispatchGraph({
      type: 'setGroups',
      payload: Array.isArray(next) ? next : currentGroups
    });
  }, []);
  
  return {
    // Graph data
    nodes, setNodes, nodesRef,
    edges, setEdges, edgesRef,
    groups, setGroups, groupsRef,
    
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
