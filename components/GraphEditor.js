"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import NodeGraph from './NodeGraph';
import Toolbar from './Toolbar';
import eventBus from './NodeGraph/eventBus';
import GraphCRUD from './GraphEditor/GraphCrud.js';
import EdgeTypes from './GraphEditor/edgeTypes';
import GroupManager from './GraphEditor/GroupManager';
import DefaultNode from './GraphEditor/Nodes/DefaultNode';
import FixedNode from './GraphEditor/Nodes/FixedNode';
import MarkdownNode from './GraphEditor/Nodes/MarkdownNode';
import NodeListPanel from './GraphEditor/NodeListPanel';
import GroupListPanel from './GraphEditor/GroupListPanel';
import GroupPropertiesPanel from './GraphEditor/GroupPropertiesPanel';
import { useTheme } from '@mui/material/styles';
import NodePropertiesPanel from './GraphEditor/NodePropertiesPanel';
import EdgePropertiesPanel from './GraphEditor/EdgePropertiesPanel';
import { v4 as uuidv4 } from 'uuid';
import { Snackbar, Alert, Backdrop, CircularProgress } from '@mui/material';
import useSelection from './GraphEditor/useSelection';
import useGraphHistory from './GraphEditor/useGraphHistory';
import useGraphShortcuts from './GraphEditor/useGraphShortcuts';
import useGroupManager from './GraphEditor/useGroupManager';
import useGraphModes from './GraphEditor/useGraphModes';

export default function GraphEditor({ backgroundImage }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showNodeList, setShowNodeList] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false);
  const [showGroupProperties, setShowGroupProperties] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [loading, setLoading] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyIndexRef = useRef(0);
  const lastHandleDropTime = useRef(0);
  const lastNodeClickTime = useRef(0);

  const theme = useTheme();
  const graphAPI = useRef(null);
  const groupManager = useRef(new GroupManager());

  // Track if initial graph has loaded and prevent reload after replace
  const initialGraphLoadedRef = useRef(false);

  // Default node color with localStorage persistence
  const [defaultNodeColor, setDefaultNodeColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nodegraph_default_color') || '#1976d2';
    }
    return '#1976d2';
  });

  // Default edge color with localStorage persistence
  const [defaultEdgeColor, setDefaultEdgeColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nodegraph_default_edge_color') || '#666666';
    }
    return '#666666';
  });

  // Save color preferences when they change
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

  // Keep refs in sync with state
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Compute hovered edge endpoints
  let hoveredEdgeSource = null;
  let hoveredEdgeTarget = null;
  if (hoveredEdgeId) {
    const hoveredEdge = edges.find(e => e.id === hoveredEdgeId);
    if (hoveredEdge) {
      hoveredEdgeSource = hoveredEdge.source;
      hoveredEdgeTarget = hoveredEdge.target;
    }
  }

  // Use history hook
  const {
    history,
    historyIndex,
    saveToHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo
  } = useGraphHistory(nodes, edges, groups, setNodes, setEdges, setGroups);

  // Handle drop events from handles
  useEffect(() => {
    const handleDrop = (data) => {
      console.log('GraphEditor received handleDrop:', data);
      
      if (!data || !data.sourceNode) return;
      
      if (data.targetNode) {
        // Drop on existing node - create edge directly
        console.log('Creating edge to existing node:', data.targetNode);
        graphAPI.current.createEdge({
          source: data.sourceNode,
          target: data.targetNode,
          type: data.edgeType
        });
      } else {
        // Drop on empty space - create new node and edge
        console.log('Creating new node and edge');
        
        // Find the source node to copy its type and size (use nodesRef for current state)
        const sourceNode = nodesRef.current.find(n => n.id === data.sourceNode);
        const nodeType = sourceNode?.type || 'default';
        const nodeWidth = sourceNode?.width || 80;
        const nodeHeight = sourceNode?.height || 48;
        
        console.log('Source node:', sourceNode, 'Type:', nodeType, 'Size:', nodeWidth, 'x', nodeHeight);
        
        const nodeResult = graphAPI.current.createNode({
          label: data.label || `Node-${Date.now()}`,
          position: data.graph,
          data: data.nodeData || {},
          type: nodeType,
          width: nodeWidth,
          height: nodeHeight
        });
        
        if (nodeResult.success) {
          setTimeout(() => {
            graphAPI.current.createEdge({
              source: data.sourceNode,
              target: nodeResult.data.id,
              type: data.edgeType
            });
          }, 50);
        }
      }
    };

    const handleNodeResize = (data) => {
      const { id, width, height } = data;
      setNodes(prev => {
        const next = prev.map(n => 
          n.id === id ? { ...n, width, height } : n
        );
        nodesRef.current = next;
        return next;
      });
    };

    const handleNodeResizeEnd = () => {
      // Save to history when resize completes
      saveToHistory(nodesRef.current, edgesRef.current);
    };
    
    eventBus.on('handleDrop', handleDrop);
    eventBus.on('nodeResize', handleNodeResize);
    eventBus.on('nodeResizeEnd', handleNodeResizeEnd);
    
    return () => {
      eventBus.off('handleDrop', handleDrop);
      eventBus.off('nodeResize', handleNodeResize);
      eventBus.off('nodeResizeEnd', handleNodeResizeEnd);
    };
  }, []);

  // Load background from localStorage (DOM access is safe in useEffect)
  useEffect(() => {
    const savedBg = localStorage.getItem('backgroundImage');
    if (savedBg) {
      const el = document.getElementById('graph-editor-background');
      if (el) el.style.backgroundImage = `url('/background art/${savedBg}')`;
    }
  }, []);

  // Initialize the GraphCRUD API and expose to window
  useEffect(() => {
    graphAPI.current = new GraphCRUD(
      () => nodesRef.current,
      setNodes,
      () => edgesRef.current,
      setEdges,
      saveToHistory
    );
    
    // Extend GraphAPI to use default color when creating nodes
    const originalCreateNode = graphAPI.current.createNode;
    graphAPI.current.createNode = (nodeData) => {
      return originalCreateNode.call(graphAPI.current, {
        ...nodeData,
        color: nodeData.color || defaultNodeColor
      });
    };
    
    // Extend GraphAPI to use default color when creating edges
    const originalCreateEdge = graphAPI.current.createEdge;
    graphAPI.current.createEdge = (edgeData) => {
      return originalCreateEdge.call(graphAPI.current, {
        ...edgeData,
        color: edgeData.color || defaultEdgeColor
      });
    };

    // Expose GraphCRUD API to window for console access
    if (typeof window !== 'undefined') {
      window.graphAPI = graphAPI.current;
      
      // Add direct state accessors for debugging
      window.graphAPI.getNodes = () => nodesRef.current;
      window.graphAPI.getEdges = () => edgesRef.current;
      
      window.setDefaultNodeColor = (color) => setDefaultNodeColor(color);
      window.setDefaultEdgeColor = (color) => setDefaultEdgeColor(color);
      console.log('Graph CRUD API available at window.graphAPI');
      console.log('Examples:');
      console.log('  window.graphAPI.createNode({ label: "Test", position: { x: 200, y: 200 } })');
      console.log('  window.graphAPI.readNode() // Get all nodes');
      console.log('  window.graphAPI.getStats() // Get graph statistics');
      console.log('  window.setDefaultNodeColor("#ff5722") // Change default color');
      console.log('  window.setDefaultEdgeColor("#00ff00") // Change default edge color');
    }
  }, [defaultNodeColor, defaultEdgeColor]);

  // Load IntroGraph.json at startup (use public/data so we can override at runtime)
  useEffect(() => {
    // Manage initial graph loading indicator
    (async () => {
      try {
        if (typeof window !== 'undefined') {
          if (window.__nodegraph_initial_loaded) return;
          window.__nodegraph_initial_loaded = true;
        }
        if (initialGraphLoadedRef.current) return;
        initialGraphLoadedRef.current = true;

        setLoading(true);
        const resp = await fetch('/data/IntroGraph.json');
        if (!resp.ok) throw new Error(`Failed to fetch IntroGraph.json: ${resp.status}`);
        const data = await resp.json();

        if (data && data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          const loadedGroups = data.groups || [];
          setGroups(loadedGroups);
          
          // Initialize GroupManager with loaded groups
          loadedGroups.forEach(group => {
            groupManager.current.groups.set(group.id, group);
            (group.nodeIds || []).forEach(nodeId => {
              groupManager.current.nodeToGroup.set(nodeId, group.id);
            });
          });
          
          nodesRef.current = data.nodes;
          edgesRef.current = data.edges;
          saveToHistory(data.nodes, data.edges);

          // Center the first node on screen after loading
          if (data.nodes.length > 0) {
            const firstNode = data.nodes[0];
            setPan({
              x: window.innerWidth / 2 - (firstNode.position?.x || 0) * zoom,
              y: window.innerHeight / 2 - (firstNode.position?.y || 0) * zoom
            });
            // Highlight the first node to hint the user
            setSelectedNodeIds([firstNode.id]);
            setSelectedEdgeIds([]);
            // Open properties panel after a short delay to ensure UI is ready
            setTimeout(() => {
              eventBus.emit('openNodeProperties');
            }, 300);
          }
        } else {
          console.warn('IntroGraph.json does not contain nodes/edges');
          setTimeout(() => eventBus.emit('openNodeProperties'), 300);
        }
      } catch (err) {
        console.warn('Could not load IntroGraph from public/data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load a graph (replace nodes and edges), single implementation only
  function handleLoadGraph(loadedNodes, loadedEdges, loadedGroups = []) {
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setGroups(loadedGroups);
    nodesRef.current = loadedNodes;
    edgesRef.current = loadedEdges;
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    saveToHistory(loadedNodes, loadedEdges);
    console.log(`Loaded ${loadedNodes.length} nodes, ${loadedEdges.length} edges, ${loadedGroups.length} groups`);

    // Center, select, and open properties for the first node
    if (loadedNodes.length > 0) {
      const firstNode = loadedNodes[0];
      setPan({
        x: window.innerWidth / 2 - firstNode.position.x * zoom,
        y: window.innerHeight / 2 - firstNode.position.y * zoom
      });
      setSelectedNodeIds([firstNode.id]);
      setSelectedEdgeIds([]);
      eventBus.emit('openNodeProperties');
    }
  }

  // Add node handler (keeps refs & history consistent)
  const handleAddNode = () => {
    // Calculate position at center of current view
    const centerX = (window.innerWidth / 2 - pan.x) / zoom;
    const centerY = (window.innerHeight / 2 - pan.y) / zoom;
    
    // Use GraphCRUD API - the single source of truth for node creation
    const result = graphAPI.current.createNode({
      type: 'default',  // Now creates resizable nodes by default
      label: `Node ${nodesRef.current.length + 1}`,
      data: { memo: '', link: '' },
      position: { x: centerX, y: centerY },
      width: 200,
      height: 100,
      resizable: true,
      handlePosition: 'center',
      showLabel: true
    });

    if (result.success) {
      console.log('Added node via GraphCRUD:', result.data.id);
    } else {
      console.error('Failed to create node:', result.error);
    }
  };

  // Delete selected nodes or edges
  const handleDeleteSelected = () => {
    if (selectedNodeIds.length > 0) {
      // Calculate both new nodes and edges first, then save history once
      const newNodes = nodes.filter(n => !selectedNodeIds.includes(n.id));
      const newEdges = edges.filter(e => 
        !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
      );
      
      // Update state
      setNodes(newNodes);
      setEdges(newEdges);
      
      // Update refs
      nodesRef.current = newNodes;
      edgesRef.current = newEdges;
      
      // Clear selection
      setSelectedNodeIds([]);
      
      // Save to history once
      saveToHistory(newNodes, newEdges);
      
      console.log('Deleted nodes:', selectedNodeIds);
    } else if (selectedEdgeIds.length > 0) {
      const newEdges = edges.filter(e => !selectedEdgeIds.includes(e.id));
      
      setEdges(newEdges);
      edgesRef.current = newEdges;
      setSelectedEdgeIds([]);
      saveToHistory(nodesRef.current, newEdges);
      
      console.log('Deleted edges:', selectedEdgeIds);
    } else if (selectedGroupIds.length > 0) {
      // Delete groups
      selectedGroupIds.forEach(groupId => {
        groupManager.current.removeGroup(groupId);
      });
      
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds([]);
      saveToHistory(nodes, edges);
      
      console.log('Deleted groups:', selectedGroupIds);
    }
  };

  // Clear graph (toolbar)
  const handleClearGraph = () => {
    // Replace/ensure clearing groups as well
    const newNodes = [];
    const newEdges = [];
    const newGroups = [];

    setNodes(newNodes);
    setEdges(newEdges);
    setGroups(newGroups);

    if (nodesRef) nodesRef.current = newNodes;
    if (edgesRef) edgesRef.current = newEdges;

    // Clear selections
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    if (typeof setSelectedGroupIds === 'function') setSelectedGroupIds([]);

    // Clear GroupManager internal maps if present
    if (groupManager && groupManager.current && typeof groupManager.current.clear === 'function') {
      groupManager.current.clear();
    }

    // Save cleared state to history
    if (typeof saveToHistory === 'function') saveToHistory(newNodes, newEdges, newGroups);
    console.log('Graph cleared');
  };

  // Node types mapping
  // - default: ResizableNode (the resizable, interactive default)
  // - fixed: DefaultNode (non-resizable, fixed-size)
  // - markdown: MarkdownNode (displays memo as formatted markdown)
  const nodeTypes = {
    default: DefaultNode,
    fixed: FixedNode,
    markdown: MarkdownNode,
  };

  // Use selection hook
  const {
    handleNodeSelection,
    handleEdgeSelection,
    handleGroupSelection,
    clearSelection
  } = useSelection({
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedGroupIds
  });

  const groupManagerHook = useGroupManager({
    groups,
    setGroups,
    nodes,
    setNodes,
    edges,
    setEdges,
    setSelectedNodeIds,
    setSelectedGroupIds,
    selectedNodeIds,
    selectedGroupIds,
    groupManager,
    saveToHistory
  });
  const {
    handleCreateGroup,
    handleUngroupSelected,
    handleToggleGroupCollapse,
    updateGroupBounds
  } = groupManagerHook;

  // Use graph modes hook
  const {
    mode,
    autoLayoutType,
    handleModeChange,
    setAutoLayoutType,
    applyAutoLayout
  } = useGraphModes({
    nodes,
    setNodes,
    selectedNodeIds,
    edges
  });

  // Update group bounds when nodes move
  const updateGroupBoundsWrapper = () => {
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
  };

  // Node List Panel handlers
  const handleNodeListSelect = (nodeId, isMultiSelect = false) => {
    if (isMultiSelect) {
      // Use the same multi-select logic as the graph
      handleNodeSelection(nodeId, true);
    } else {
      // Single select
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeIds([]);
    }
  };

  const handleNodeFocus = (nodeId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      setPan({
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

  const handleEdgeDoubleClick = (edgeId) => {
    eventBus.emit('openEdgeProperties');
  };

  // Group List Panel handlers
  const handleGroupListSelect = (groupId, isMultiSelect = false) => {
    handleGroupSelection(groupId, isMultiSelect);
  };

  const handleGroupFocus = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (group && group.bounds) {
      setPan({
        x: window.innerWidth / 2 - (group.bounds.x + group.bounds.width / 2) * zoom,
        y: window.innerHeight / 2 - (group.bounds.y + group.bounds.height / 2) * zoom
      });
      setSelectedGroupIds([groupId]);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
    }
  };

  const handleGroupDoubleClickFromList = (groupId) => {
    setShowGroupProperties(true);
  };

  const handleGroupToggleVisibility = (groupId) => {
    const updatedGroups = groups.map(g =>
      g.id === groupId ? { ...g, visible: g.visible === true ? false : true } : g
    );
    setGroups(updatedGroups);
    saveToHistory(nodes, edges);
  };

  const handleGroupDelete = (groupId) => {
    const result = groupManager.current.removeGroup(groupId);
    if (result.success) {
      const updatedGroups = groupManager.current.getAllGroups();
      setGroups(updatedGroups);
      setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
      saveToHistory(nodes, edges, updatedGroups);
      console.log('Deleted group:', groupId);
    } else {
      console.error('Failed to delete group:', result.error);
    }
  };

  // Group Properties Panel handlers
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
      console.log(`Added ${nodeIds.length} nodes to group ${groupId}`);
    }
  };

  const handleRemoveNodesFromGroup = (groupId, nodeIds) => {
    const result = groupManager.current.removeNodesFromGroup(groupId, nodeIds);
    if (result.success) {
      setGroups(groupManager.current.getAllGroups());
      saveToHistory(nodes, edges);
      console.log(`Removed ${nodeIds.length} nodes from group ${groupId}`);
    }
  };

  // Node update from properties panel - using GraphCRUD API
  const handleUpdateNodeData = (nodeId, newData, isLabelUpdate = false) => {
    const updateData = isLabelUpdate 
      ? { label: newData.label, data: newData }
      : { data: newData };
    
    const result = graphAPI.current.updateNode(nodeId, updateData);
    if (result.success) {
      console.log('Updated node via GraphCRUD:', nodeId);
    } else {
      console.error('Failed to update node:', result.error);
    }
  };

  // Update edge data - using GraphCRUD API
  const handleUpdateEdge = (edgeId, updates) => {
    const result = graphAPI.current.updateEdge(edgeId, updates);
    if (result.success) {
      console.log('Updated edge via GraphCRUD:', edgeId);
    } else {
      console.error('Failed to update edge:', result.error);
    }
  };

  // Group operations
  const handleCreateGroupWrapper = () => {
    if (selectedNodeIds.length < 2) {
      console.log('At least 2 nodes must be selected to create a group');
      return;
    }
    const result = groupManager.current.createGroup(selectedNodeIds, {
      nodes: nodes,
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
  };

  const handleUngroupSelectedWrapper = () => {
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
  };

  useGraphShortcuts({
    setNodes,
    setEdges,
    selectedNodeIds,
    selectedEdgeIds,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    handleDeleteSelected,
    clearSelection,
    handleCreateGroup: handleCreateGroupWrapper,
    handleUngroupSelected: handleUngroupSelectedWrapper,
    saveToHistory,
    edgesRef,
    nodesRef
  });

  // Paste/import graph data handler
  async function handlePasteGraphData(pastedData) {
    setLoading(true);
    // yield to the browser so the Backdrop/CircularProgress can render before heavy work
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      // Normalize pasted payload to nodes/edges/groups arrays
      let pastedNodes = [];
      let pastedEdges = [];
      let pastedGroups = [];

      if (!pastedData) {
        console.warn('handlePasteGraphData called with empty data');
        return;
      }

      if (Array.isArray(pastedData)) {
        // try to detect type
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

      // Helper to sanitize groups so nodeIds only reference nodes that will exist
      const sanitizeGroups = (groupsArray, availableNodeIdSet) => {
        return groupsArray.map(g => {
          const nodeIds = Array.isArray(g.nodeIds) ? g.nodeIds.filter(id => availableNodeIdSet.has(id)) : [];
          return { ...g, nodeIds };
        }).filter(g => (g.nodeIds && g.nodeIds.length >= 2));
      };

      // Decide action: replace/add/update. If full graph object with nodes+edges+groups, ask to replace
      let action = pastedData.action || null;
      if (!action) {
        if (pastedNodes.length && pastedEdges.length) action = 'replace';
        else action = 'add';
      }

      if (action === 'replace') {
        const nodesWithProps = pastedNodes.map(n => ({ ...n }));
        const edgesWithProps = pastedEdges.map(e => ({ ...e }));
        const nodeIdSet = new Set(nodesWithProps.map(n => n.id));
        const groupsSanitized = sanitizeGroups(pastedGroups.map(g => ({ ...g })), nodeIdSet);

        // Replace nodes/edges
        setNodes(nodesWithProps);
        setEdges(edgesWithProps);

        if (nodesRef) nodesRef.current = nodesWithProps;
        if (edgesRef) edgesRef.current = edgesWithProps;

        // Explicitly clear previous groups first, then set new groups
        setGroups([]);
        if (groupManager && groupManager.current) {
          groupManager.current.clear();
        }

        setGroups(groupsSanitized);

        // Initialize GroupManager with the new groups
        if (groupManager && groupManager.current) {
          groupsSanitized.forEach(g => {
            groupManager.current.groups.set(g.id, g);
            (g.nodeIds || []).forEach(nodeId => groupManager.current.nodeToGroup.set(nodeId, g.id));
          });
        }

        // Clear selections
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        if (typeof setSelectedGroupIds === 'function') setSelectedGroupIds([]);

        if (typeof saveToHistory === 'function') saveToHistory(nodesWithProps, edgesWithProps, groupsSanitized);
        return;
      }

      if (action === 'add') {
        // Add only items that don't already exist
        const existingNodeIds = new Set(nodesRef.current.map(n => n.id));
        const existingEdgeIds = new Set(edgesRef.current.map(e => e.id));
        const existingGroupIds = new Set(groups.map(g => g.id));

        const nodesToAdd = pastedNodes.filter(n => !existingNodeIds.has(n.id)).map(n => ({ ...n }));
        const edgesToAdd = pastedEdges.filter(e => !existingEdgeIds.has(e.id)).map(e => ({ ...e }));

        const combinedNodeIds = new Set([...nodesRef.current.map(n => n.id), ...nodesToAdd.map(n => n.id)]);
        const groupsToAddRaw = pastedGroups.filter(g => !existingGroupIds.has(g.id)).map(g => ({ ...g }));
        const groupsToAdd = sanitizeGroups(groupsToAddRaw, combinedNodeIds);

        const newNodes = [ ...nodesRef.current, ...nodesToAdd ];
        const newEdges = [ ...edgesRef.current, ...edgesToAdd ];
        const newGroups = [ ...groups, ...groupsToAdd ];

        setNodes(newNodes);
        setEdges(newEdges);
        setGroups(newGroups);

        // Update GroupManager
        if (groupManager && groupManager.current) {
          groupsToAdd.forEach(g => {
            groupManager.current.groups.set(g.id, g);
            (g.nodeIds || []).forEach(nodeId => groupManager.current.nodeToGroup.set(nodeId, g.id));
          });
        }

        if (typeof saveToHistory === 'function') saveToHistory(newNodes, newEdges, newGroups);
        return;
      }

      if (action === 'update') {
        // Update existing items by id
        const updatedNodes = [...nodesRef.current];
        const updatedEdges = [...edgesRef.current];
        const updatedGroups = [...groups];

        pastedNodes.forEach(n => {
          const idx = updatedNodes.findIndex(x => x.id === n.id);
          if (idx !== -1) updatedNodes[idx] = { ...updatedNodes[idx], ...n };
        });
        pastedEdges.forEach(e => {
          const idx = updatedEdges.findIndex(x => x.id === e.id);
          if (idx !== -1) updatedEdges[idx] = { ...updatedEdges[idx], ...e };
        });

        // Sanitize group updates against updated node set
        const currentNodeSet = new Set(updatedNodes.map(n => n.id));
        pastedGroups.forEach(g => {
          const idx = updatedGroups.findIndex(x => x.id === g.id);
          const sanitized = sanitizeGroups([g], currentNodeSet)[0];
          if (idx !== -1 && sanitized) updatedGroups[idx] = { ...updatedGroups[idx], ...sanitized };
        });

        setNodes(updatedNodes);
        setEdges(updatedEdges);
        setGroups(updatedGroups);

        if (typeof saveToHistory === 'function') saveToHistory(updatedNodes, updatedEdges, updatedGroups);
        return;
      }
    } catch (err) {
      console.error('Error in handlePasteGraphData:', err);
      setSnackbar({ open: true, message: 'Error importing graph', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }

  // Connect eventBus to paste handler
  useEffect(() => {
    eventBus.on('pasteGraphData', handlePasteGraphData);
    return () => eventBus.off('pasteGraphData', handlePasteGraphData);
  }, []);

  // Expose for testing (replace with UI integration later)
  if (typeof window !== 'undefined') {
    window.handlePasteGraphData = handlePasteGraphData;
  }

  // Keyboard navigation for accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Tab navigation for nodes
      if (e.key === 'Tab' && selectedNodeIds.length > 0) {
        e.preventDefault();
        const currentIndex = nodesRef.current.findIndex(n => n.id === selectedNodeIds[0]);
        const nextIndex = e.shiftKey 
          ? (currentIndex - 1 + nodesRef.current.length) % nodesRef.current.length
          : (currentIndex + 1) % nodesRef.current.length;
        
        if (nodesRef.current[nextIndex]) {
          setSelectedNodeIds([nodesRef.current[nextIndex].id]);
          setSelectedEdgeIds([]);
        }
      }
      
      // Arrow keys to move selected nodes (with Ctrl modifier)
      if (e.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const moveAmount = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -moveAmount : e.key === 'ArrowRight' ? moveAmount : 0;
        const dy = e.key === 'ArrowUp' ? -moveAmount : e.key === 'ArrowDown' ? moveAmount : 0;
        
        setNodes(prev => {
          const next = prev.map(node => {
            if (selectedNodeIds.includes(node.id)) {
              return {
                ...node,
                position: {
                  x: node.position.x + dx,
                  y: node.position.y + dy
                }
              };
            }
            return node;
          });
          nodesRef.current = next;
          return next;
        });
        
        // Save to history after keyboard move
        saveToHistory(nodesRef.current, edgesRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, setSelectedNodeIds, setSelectedEdgeIds, setNodes, saveToHistory]);

  // Handle paste from clipboard
  const handlePaste = useCallback(async (e) => {
    // Check if user is typing in a text field - if so, allow default paste behavior
    const activeElement = document.activeElement;
    const isTextInput = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable ||
      activeElement.getAttribute('contenteditable') === 'true'
    );
    
    if (isTextInput) {
      // User is in a text field, let browser handle paste normally
      return;
    }

    try {
      let text;
      
      // Get clipboard text
      if (e?.clipboardData) {
        text = e.clipboardData.getData('text');
      } else {
        text = await navigator.clipboard.readText();
      }
      
      if (!text || !text.trim()) {
        return;
      }

      // Try to parse as JSON first
      let parsedData;
      try {
        parsedData = JSON.parse(text);
      } catch (jsonError) {
        // Not JSON - treat as plain text and create a resizable node
        const lines = text.trim().split('\n');
        const label = lines[0].substring(0, 50); // First line, max 50 chars
        const memo = text.trim();
        
        // Calculate size based on text content
        const width = Math.max(200, Math.min(600, label.length * 8 + 100));
        const height = Math.max(100, Math.min(400, lines.length * 20 + 50));
        
        // Position at center of current view
        const centerX = (window.innerWidth / 2 - pan.x) / zoom;
        const centerY = (window.innerHeight / 2 - pan.y) / zoom;
        
        const newNode = {
          id: `node_${Date.now()}`,
          label: label,
          type: 'default',  // Resizable node type
          position: { x: centerX, y: centerY },
          width: width,
          height: height,
          resizable: true,
          data: {
            memo: memo
          }
        };
        
        setNodes(prev => {
          const next = [...prev, newNode];
          nodesRef.current = next;
          return next;
        });
        
        saveToHistory(nodesRef.current, edgesRef.current);
        setSnackbar({ open: true, message: 'Created resizable node from pasted text', severity: 'success' });
        return;
      }

      // JSON parsed successfully - continue with existing logic
      // ...existing JSON handling code...
    } catch (error) {
      console.error('Error handling paste:', error);
    }
  }, [nodesRef, setNodes, saveToHistory, setSnackbar, pan, zoom]);

  // Register paste handler on mount
  useEffect(() => {
    const handlePasteEvent = (e) => {
      // Check if user is in a text field first
      const activeElement = document.activeElement;
      const isTextInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      if (isTextInput) {
        // Let browser handle paste in text fields normally
        return;
      }
      
      e.preventDefault();
      handlePaste(e);
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [handlePaste]);

  // Track which side Node Properties Panel is docked to (initialized to left)
  const [nodePanelAnchor, setNodePanelAnchor] = useState('left');

  // Track which side Node List Panel is docked to (initialized to right, opposite of properties panel)
  const [nodeListAnchor, setNodeListAnchor] = useState('right');

  // Pass anchor change to NodePropertiesPanel
  const handleNodePanelAnchorChange = (newAnchor) => {
    setNodePanelAnchor(newAnchor);
  };

  // When Node Properties Panel opens OR changes sides, always position Node List Panel on opposite side
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
  }, [showNodeList, nodePanelAnchor]);

  return (
    <div 
      id="graph-editor-background" 
      role="application"
      aria-label="Node graph editor"
      style={{
        minHeight: '100vh',
        minWidth: '100vw',
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
        onLoadGraph={handleLoadGraph}
        onAddNode={handleAddNode}
        onDeleteSelected={handleDeleteSelected}
        onClearGraph={handleClearGraph}
        onUndo={handleUndo}
        onRedo={handleRedo}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeId={selectedEdgeIds[0] || null}
        canUndo={canUndo}
        canRedo={canRedo}
        mode={mode}
        autoLayoutType={autoLayoutType}
        onModeChange={handleModeChange}
        onAutoLayoutChange={setAutoLayoutType}
        onApplyLayout={applyAutoLayout}
        onShowMessage={(message, severity = 'info') => setSnackbar({ open: true, message, severity })}
        pan={pan}
        zoom={zoom}
        setNodes={setNodes}
        nodesRef={nodesRef}
        saveToHistory={saveToHistory}
        edgesRef={edgesRef}
      />
      
      <NodePropertiesPanel
        selectedNode={selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : null}
        onUpdateNode={handleUpdateNodeData}
        theme={theme}
        anchor={nodePanelAnchor}
        onAnchorChange={handleNodePanelAnchorChange}
        onClose={() => {}}
        defaultNodeColor={defaultNodeColor}
      />
      <NodeListPanel
        nodes={nodes}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        onNodeSelect={handleNodeListSelect}
        onNodeFocus={handleNodeFocus}
        onClose={() => setShowNodeList(false)}
        isOpen={showNodeList}
        theme={theme}
        anchor={nodeListAnchor}
        propertiesPanelAnchor={nodePanelAnchor} // Pass the propertiesPanelAnchor state
      />

      <GroupListPanel
        groups={groups}
        selectedGroupId={selectedGroupIds[0] || null}
        selectedGroupIds={selectedGroupIds}
        onGroupSelect={handleGroupListSelect}
        onGroupFocus={handleGroupFocus}
        onGroupDoubleClick={handleGroupDoubleClickFromList}
        onGroupToggleVisibility={handleGroupToggleVisibility}
        onGroupDelete={handleGroupDelete}
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
        mode={mode}
        onNodeMove={(id, position) => {
          setNodes(prev => {
            const next = prev.map(n => n.id === id ? { ...n, position } : n);
            nodesRef.current = next;
            return next;
          });
          // Update group bounds after node movement
          setTimeout(() => updateGroupBounds(), 0);
          eventBus.emit('nodeDrag', { nodeId: id, position });
        }}
        onEdgeClick={(edge, event) => {
          const isMultiSelect = event.ctrlKey || event.metaKey;
          const edgeId = typeof edge === 'string' ? edge : edge?.id;
          console.log('Edge clicked:', edge, 'ID:', edgeId);
          handleEdgeSelection(edgeId, isMultiSelect);
        }}
        onNodeClick={(nodeId, event) => {
          // Only handle actual click events, ignore mouseup (which doesn't pass event)
          if (!event || event.type !== 'click') {
            return;
          }
          
          const isMultiSelect = event?.ctrlKey || event?.metaKey || false;
          const isSelected = selectedNodeIds.includes(nodeId);
          
          if (isMultiSelect) {
            handleNodeSelection(nodeId, true);
          } else if (isSelected) {
            // Click on already selected node - toggle drawer
            eventBus.emit('selectedNodeClick', { nodeId });
          } else {
            // Click on unselected node - just select it
            setSelectedNodeIds([nodeId]);
            setSelectedEdgeIds([]);
          }
        }}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onGroupClick={(groupId, event, action) => {
          if (action === 'toggle-collapse') {
            handleToggleGroupCollapse(groupId);
          } else {
            const isMultiSelect = event?.ctrlKey || event?.metaKey || false;
            handleGroupSelection(groupId, isMultiSelect);
          }
        }}
        onBackgroundClick={() => {
          clearSelection();
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
            // Emit event and save to history when drag completes
            eventBus.emit('nodeDragEnd', { nodeId: id, position });
            saveToHistory(next, edgesRef.current);
            return next;
          });
        }}
      />
      
      <EdgePropertiesPanel
        selectedEdge={selectedEdgeIds.length === 1 ? {
          ...edges.find(e => e.id === selectedEdgeIds[0]),
          sourceNode: nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeIds[0])?.source),
          targetNode: nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeIds[0])?.target)
        } : null}
        edgeTypes={EdgeTypes}
        onUpdateEdge={handleUpdateEdge}
        theme={theme}
        defaultEdgeColor={defaultEdgeColor}
      />

      {showGroupProperties && selectedGroupIds.length === 1 && (
        <GroupPropertiesPanel
          selectedGroup={groups.find(g => g.id === selectedGroupIds[0])}
          nodes={nodes}
          onUpdateGroup={handleUpdateGroup}
          onUngroupGroup={handleUngroupSelectedWrapper}
          onAddNodes={handleAddNodesToGroup}
          onRemoveNodes={handleRemoveNodesFromGroup}
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