"use client";
// ============================================
// 1. GraphEditor/useGraphEditorState.js
// All state management in one hook
// ============================================
import { useState, useRef, useEffect } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import GroupManager from '../GroupManager';

export function useGraphEditorState() {
  // Graph data
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [groups, setGroups] = useState([]);
  
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
  const groupManager = useRef(new GroupManager());
  const initialGraphLoadedRef = useRef(false);
  
  // Keep refs synced
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  
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
  
  return {
    // Graph data
    nodes, setNodes, nodesRef,
    edges, setEdges, edgesRef,
    groups, setGroups,
    
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