"use client";
import React, { useState, useEffect, useRef } from 'react';
import NodeGraph from './NodeGraph';
import Toolbar from './Toolbar';
import eventBus from './NodeGraph/eventBus';
import GraphCRUD from './GraphEditor/GraphCrud.js';
import EdgeTypes from './GraphEditor/edgeTypes';
import GroupManager from './GraphEditor/GroupManager';
import DefaultNode from './GraphEditor/Nodes/DefaultNode';
import DisplayNode from '../components/GraphEditor/Nodes/DisplayNode';
import ListNode from '../components/GraphEditor/Nodes/ListNode';
import NodeListPanel from './GraphEditor/NodeListPanel';
import { useTheme } from '@mui/material/styles';
import NodePropertiesPanel from './GraphEditor/NodePropertiesPanel';
import EdgePropertiesPanel from './GraphEditor/EdgePropertiesPanel';
import { v4 as uuidv4 } from 'uuid';
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
  const [showNodeList, setShowNodeList] = useState(true);
  const [showNodeProperties, setShowNodeProperties] = useState(false);
  const [showEdgeProperties, setShowEdgeProperties] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyIndexRef = useRef(0);
  const lastHandleDropTime = useRef(0);

  const theme = useTheme();
  const graphAPI = useRef(null);
  const groupManager = useRef(new GroupManager());

  // Track if initial graph has loaded and prevent reload after replace
  const initialGraphLoadedRef = useRef(false);

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
        const nodeResult = graphAPI.current.createNode({
          label: data.label || `Node-${Date.now()}`,
          position: data.graph,
          data: data.nodeData || {}
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
    
    eventBus.on('handleDrop', handleDrop);
    return () => {
      eventBus.off('handleDrop', handleDrop);
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

    if (typeof window !== 'undefined') {
      window.graphAPI = graphAPI.current;
      console.log('Graph CRUD API available at window.graphAPI');
      console.log('Examples:');
      console.log('  window.graphAPI.createNode({ label: "Test", position: { x: 200, y: 200 } })');
      console.log('  window.graphAPI.readNode() // Get all nodes');
      console.log('  window.graphAPI.getStats() // Get graph statistics');
    }
  }, []);

  // Load IntroGraph.json at startup (use public/data so we can override at runtime)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.__nodegraph_initial_loaded) return;
      window.__nodegraph_initial_loaded = true;
    }
    if (initialGraphLoadedRef.current) return;
    initialGraphLoadedRef.current = true;
    fetch('/data/IntroGraph.json')
      .then((resp) => {
        if (!resp.ok) throw new Error(`Failed to fetch IntroGraph.json: ${resp.status}`);
        return resp.json();
      })
      .then((data) => {
        if (data && data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          setGroups(data.groups || []);
          nodesRef.current = data.nodes;
          edgesRef.current = data.edges;
          saveToHistory(data.nodes, data.edges);
        } else {
          console.warn('IntroGraph.json does not contain nodes/edges');
        }
      })
      .catch((err) => {
        console.warn('Could not load IntroGraph from public/data:', err);
      });
  }, []);

  // Load a graph (replace nodes and edges), single implementation only
  function handleLoadGraph(loadedNodes, loadedEdges) {
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    nodesRef.current = loadedNodes;
    edgesRef.current = loadedEdges;
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    saveToHistory(loadedNodes, loadedEdges);
    console.log(`Loaded ${loadedNodes.length} nodes and ${loadedEdges.length} edges`);

    // Center, select, and open properties for the first node
    if (loadedNodes.length > 0) {
      const firstNode = loadedNodes[0];
      setPan({
        x: window.innerWidth / 2 - firstNode.position.x * zoom,
        y: window.innerHeight / 2 - firstNode.position.y * zoom
      });
      setSelectedNodeIds([firstNode.id]);
      setSelectedEdgeIds([]);
      setShowNodeProperties(true);
    }
  }

  // Add node handler (keeps refs & history consistent)
  const handleAddNode = () => {
    // Use GraphCRUD API - the single source of truth for node creation
    const result = graphAPI.current.createNode({
      type: 'default',
      label: `Node ${nodesRef.current.length + 1}`,
      data: { memo: '', link: '' },
      position: {
        x: 100 + (nodesRef.current.length * 20),
        y: 100 + (nodesRef.current.length * 20)
      },
      width: 80,
      height: 48,
      resizable: false,
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

  // Clear graph
  const handleClearGraph = () => {
    const newNodes = [];
    const newEdges = [];
    setNodes(newNodes);
    setEdges(newEdges);
    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    saveToHistory(newNodes, newEdges);
    console.log('Graph cleared');
  };

  // Node types mapping
  const nodeTypes = {
    default: DefaultNode,
    display: DisplayNode,
    list: ListNode
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
    setSelectedGroupIds,
    setShowNodeProperties,
    setShowEdgeProperties
  });

  const groupManagerHook = useGroupManager({
    groups,
    setGroups,
    nodes,
    setSelectedNodeIds,
    setSelectedGroupIds,
    selectedNodeIds,
    selectedGroupIds,
    groupManager,
    saveToHistory,
    edges
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
    setShowNodeProperties(true);
  };

  const handleEdgeDoubleClick = (edgeId) => {
    setShowEdgeProperties(true);
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

  // Paste/import handler for graph data
  function handlePasteGraphData(pastedData) {
    // Support explicit action field
    let explicitAction = pastedData.action;
    if (explicitAction) delete pastedData.action;

    // Detect type: full graph, partial graph, or single node/edge/group
    let nodes = [], edges = [], groups = [];
    if (Array.isArray(pastedData)) {
      // Array of nodes/edges/groups
      if (pastedData[0]?.id && pastedData[0]?.position) {
        nodes = pastedData;
      } else if (pastedData[0]?.source && pastedData[0]?.target) {
        edges = pastedData;
      } else if (pastedData[0]?.nodeIds) {
        groups = pastedData;
      }
    } else if (pastedData.nodes || pastedData.edges || pastedData.groups) {
      nodes = pastedData.nodes || [];
      edges = pastedData.edges || [];
      groups = pastedData.groups || [];
    } else if (pastedData.id && pastedData.position) {
      nodes = [pastedData];
    } else if (pastedData.id && pastedData.source && pastedData.target) {
      edges = [pastedData];
    } else if (pastedData.id && pastedData.nodeIds) {
      groups = [pastedData];
    } else {
      alert('Unrecognized graph data format.');
      return;
    }

    // Use explicit action if present, otherwise prompt user
    let action = explicitAction || 'add';
    if (!explicitAction) {
      if (nodes.length + edges.length + groups.length === 0) {
        alert('No nodes, edges, or groups found in pasted data.');
        return;
      }
      if ((nodes.length > 0 && nodes.length === (pastedData.nodes?.length || nodes.length)) &&
          (edges.length > 0 && edges.length === (pastedData.edges?.length || edges.length))) {
        // Looks like a full graph
        if (window.confirm('Replace your entire graph with this data? (Cancel to add instead)')) {
          action = 'replace';
        }
      } else if (nodes.length + edges.length + groups.length === 1) {
        if (window.confirm('Update existing node/edge/group if ID matches? (Cancel to add as new)')) {
          action = 'update';
        }
      } else {
        if (window.confirm('Add new items? (Cancel to update existing by ID)')) {
          action = 'add';
        } else {
          action = 'update';
        }
      }
    }

    // Perform action
    if (action === 'replace') {
      console.log('REPLACE action triggered. Setting nodes:', nodes, 'edges:', edges, 'groups:', groups);
      setNodes(nodes);
      setEdges(edges);
      setGroups(groups);
      nodesRef.current = nodes;
      edgesRef.current = edges;
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setSelectedGroupIds([]);
      if (typeof historyIndexRef !== 'undefined') historyIndexRef.current = 0;
      saveToHistory(nodes, edges);
      return;
    }

    if (action === 'add') {
      // Add new nodes/edges/groups, skip duplicates
      const existingNodeIds = new Set(nodesRef.current.map(n => n.id));
      const existingEdgeIds = new Set(edgesRef.current.map(e => e.id));
      const existingGroupIds = new Set(groups.map(g => g.id));
      const newNodes = [ ...nodesRef.current, ...nodes.filter(n => !existingNodeIds.has(n.id)) ];
      const newEdges = [ ...edgesRef.current, ...edges.filter(e => !existingEdgeIds.has(e.id)) ];
      const newGroups = [ ...groups, ...groups.filter(g => !existingGroupIds.has(g.id)) ];
      setNodes(newNodes);
      setEdges(newEdges);
      setGroups(newGroups);
      saveToHistory(newNodes, newEdges);
      return;
    }

    if (action === 'update') {
      // Update existing nodes/edges/groups by ID
      let updatedNodes = [...nodesRef.current];
      let updatedEdges = [...edgesRef.current];
      let updatedGroups = [...groups];
      nodes.forEach(n => {
        const idx = updatedNodes.findIndex(x => x.id === n.id);
        if (idx !== -1) updatedNodes[idx] = { ...updatedNodes[idx], ...n };
      });
      edges.forEach(e => {
        const idx = updatedEdges.findIndex(x => x.id === e.id);
        if (idx !== -1) updatedEdges[idx] = { ...updatedEdges[idx], ...e };
      });
      groups.forEach(g => {
        const idx = updatedGroups.findIndex(x => x.id === g.id);
        if (idx !== -1) updatedGroups[idx] = { ...updatedGroups[idx], ...g };
      });
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      setGroups(updatedGroups);
      saveToHistory(updatedNodes, updatedEdges);
      return;
    }
  }

  // Expose for testing (replace with UI integration later)
  if (typeof window !== 'undefined') {
    window.handlePasteGraphData = handlePasteGraphData;
  }

  return (
    <div id="graph-editor-background" style={{
      minHeight: '100vh',
      minWidth: '100vw',
      backgroundImage: backgroundImage ? `url('/background art/${backgroundImage}')` : undefined,
      backgroundSize: 'auto',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      <Toolbar 
        onToggleNodeList={() => setShowNodeList(!showNodeList)}
        showNodeList={showNodeList}
        nodes={nodes} 
        edges={edges} 
        onLoadGraph={handleLoadGraph}
        onAddNode={handleAddNode}
        onDeleteSelected={handleDeleteSelected}
        onClearGraph={handleClearGraph}
        onUndo={handleUndo}
        onRedo={handleRedo}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedEdgeId={selectedEdgeIds[0] || null}
        canUndo={canUndo}
        canRedo={canRedo}
        mode={mode}
        autoLayoutType={autoLayoutType}
        onModeChange={handleModeChange}
        onAutoLayoutChange={setAutoLayoutType}
        onApplyLayout={applyAutoLayout}
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
      />
      
      <NodeGraph 
        nodes={nodes} 
        edges={edges} 
        groups={groups}
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
          handleEdgeSelection(edge.id, isMultiSelect);
        }}
        onNodeClick={(nodeId, event) => {
          const isMultiSelect = event?.ctrlKey || event?.metaKey || false;
          handleNodeSelection(nodeId, isMultiSelect);
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
        onBackgroundClick={clearSelection}
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
      
      {showNodeProperties && selectedNodeIds.length === 1 && selectedEdgeIds.length === 0 && (
        <NodePropertiesPanel
          selectedNode={nodes.find(n => n.id === selectedNodeIds[0])}
          onUpdateNode={handleUpdateNodeData}
          onClose={() => setShowNodeProperties(false)}
          theme={theme}
        />
      )}
            
      {showEdgeProperties && selectedEdgeIds.length === 1 && selectedNodeIds.length === 0 && (
        <EdgePropertiesPanel
          selectedEdge={{
            ...edges.find(e => e.id === selectedEdgeIds[0]),
            sourceNode: nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeIds[0])?.source),
            targetNode: nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeIds[0])?.target)
          }}
          edgeTypes={EdgeTypes}
          onUpdateEdge={handleUpdateEdge}
          onClose={() => setShowEdgeProperties(false)}
          theme={theme}
        />
      )}
    </div>
  );
}