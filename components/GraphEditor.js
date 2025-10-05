"use client";
import React, { useState, useEffect, useRef } from 'react';
import NodeGraph from './NodeGraph';
import Toolbar from './Toolbar.js';
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
  const [history, setHistory] = useState([{ nodes: [], edges: [], groups: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyIndexRef = useRef(historyIndex);
  const lastHandleDropTime = useRef(0);

  const theme = useTheme();
  const graphAPI = useRef(null);
  const groupManager = useRef(new GroupManager());

  // Keep refs in sync with state
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

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

  // Centralized saveToHistory using refs and functional updates to avoid stale closure issues
  const saveToHistory = (newNodes, newEdges) => {
    setHistory(prevHistory => {
      const truncated = prevHistory.slice(0, historyIndexRef.current + 1);
      const next = [...truncated, { nodes: newNodes, edges: newEdges }];
      // update historyIndex after history set
      setHistoryIndex(next.length - 1);
      // sync ref
      historyIndexRef.current = next.length - 1;
      return next;
    });
  };

  // addNode/addEdge helpers (ensure refs are updated synchronously from within updater)
  function addNode(nodeProps) {
    const node = GraphCRUD.createNode(nodeProps);
    setNodes(prev => {
      const next = [...prev, node];
      nodesRef.current = next;
      return next;
    });
    return node;
  }

  function addEdge(edgeProps) {
    const edge = graphAPI.current.createEdge(edgeProps);
    setEdges(prev => {
      const next = [...prev, edge];
      edgesRef.current = next;
      return next;
    });
    return edge;
  }

  // Handle drop events from handles (avoid double setEdges and race conditions)
  useEffect(() => {
    const handleDrop = (data) => {
      if (!data || !data.sourceNode) return;
      // Create node
      const nodeResult = graphAPI.current.createNode({
        label: data.label || `Node-${Date.now()}`,
        position: data.graph,
        data: data.nodeData || {}
      });
      if (!nodeResult.success) return;
      // Delay edge creation to ensure node is in state
      setTimeout(() => {
        graphAPI.current.createEdge({
          source: data.sourceNode,
          target: nodeResult.data.id,
          type: data.edgeType // Only set type
        });
      }, 50);
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

  // Node update from properties panel (corrected: single saveToHistory after computing new nodes)
  function handleUpdateNodeData(nodeId, newData, isLabelUpdate = false) {
    setNodes(prev => {
      const next = prev.map(node => {
        if (node.id === nodeId) {
          if (isLabelUpdate) {
            return { ...node, label: newData.label, data: { ...node.data, ...newData } };
          }
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      });
      nodesRef.current = next;
      // persist history with current edges
      saveToHistory(next, edgesRef.current);
      return next;
    });
  }

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
  }

  // Update edge data and save history reliably
  function handleUpdateEdge(edgeId, updates) {
    setEdges(prev => {
      const next = prev.map(edge => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            ...updates,
            style: updates.style ? { ...edge.style, ...updates.style } : edge.style
          };
        }
        return edge;
      });
      edgesRef.current = next;
      saveToHistory(nodesRef.current, next);
      return next;
    });
  }

  // History handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      const snapshot = history[newIndex];
      if (snapshot) {
        setNodes(snapshot.nodes);
        nodesRef.current = snapshot.nodes;
        setEdges(snapshot.edges);
        edgesRef.current = snapshot.edges;
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        console.log('Undo performed');
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      const snapshot = history[newIndex];
      if (snapshot) {
        setNodes(snapshot.nodes);
        nodesRef.current = snapshot.nodes;
        setEdges(snapshot.edges);
        edgesRef.current = snapshot.edges;
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        console.log('Redo performed');
      }
    }
  };

  // Add node handler (keeps refs & history consistent)
  const handleAddNode = () => {
    const newId = `node-${Date.now()}`;
    const newNode = {
      id: newId,
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
    };

    setNodes(prev => {
      const next = [...prev, newNode];
      nodesRef.current = next;
      saveToHistory(next, edgesRef.current);
      return next;
    });

    console.log('Added node:', newNode.id);
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

  // Selection handlers for multi-select
  const handleNodeSelection = (nodeId, isMultiSelect = false) => {
    if (isMultiSelect) {
      setSelectedNodeIds(prev => {
        const newSelection = prev.includes(nodeId) 
          ? prev.filter(id => id !== nodeId) // Deselect if already selected
          : [...prev, nodeId]; // Add to selection
        console.log('Multi-select nodes:', newSelection);
        return newSelection;
      });
    } else {
      setSelectedNodeIds([nodeId]); // Single select
      console.log('Single-select node:', nodeId);
    }
    setSelectedEdgeIds([]); // Clear edge selection
    setShowEdgeProperties(false); // Close edge properties panel
  };

  const handleEdgeSelection = (edgeId, isMultiSelect = false) => {
    if (isMultiSelect) {
      setSelectedEdgeIds(prev => {
        if (prev.includes(edgeId)) {
          return prev.filter(id => id !== edgeId); // Deselect if already selected
        } else {
          return [...prev, edgeId]; // Add to selection
        }
      });
    } else {
      setSelectedEdgeIds([edgeId]); // Single select
    }
    setSelectedNodeIds([]); // Clear node selection
    setShowNodeProperties(false); // Close node properties panel
  };

  const clearSelection = () => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    setShowNodeProperties(false);
    setShowEdgeProperties(false);
  };

  // Group operations
  const handleCreateGroup = () => {
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
      setSelectedNodeIds([]); // Clear node selection
      setSelectedGroupIds([result.data.id]); // Select the new group
      saveToHistory(nodes, edges);
      console.log('Created group:', result.data.id);
    } else {
      console.error('Failed to create group:', result.error);
    }
  };

  const handleUngroupSelected = () => {
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

  const handleGroupSelection = (groupId, isMultiSelect = false) => {
    if (isMultiSelect) {
      setSelectedGroupIds(prev => {
        if (prev.includes(groupId)) {
          return prev.filter(id => id !== groupId);
        } else {
          return [...prev, groupId];
        }
      });
    } else {
      setSelectedGroupIds([groupId]);
    }
    // Clear other selections when selecting groups
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  };

  // Toggle group collapse/expand
  const handleToggleGroupCollapse = (groupId) => {
    const result = groupManager.current.toggleGroupCollapse(groupId);
    if (result.success) {
      const group = result.data;
      
      // Update nodes visibility
      setNodes(prev => {
        const updated = prev.map(node => {
          if (group.nodeIds.includes(node.id)) {
            return { ...node, visible: !group.collapsed };
          }
          return node;
        });
        nodesRef.current = updated;
        return updated;
      });
      
      // Update group state
      setGroups(groupManager.current.getAllGroups());
      
      console.log(`Group ${groupId} ${group.collapsed ? 'collapsed' : 'expanded'}`);
    }
  };

  // Update group bounds when nodes move
  const updateGroupBounds = () => {
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyboardShortcuts(e) {
      // Resize all nodes to 80x48 on Ctrl+Q
      if (e.ctrlKey && (e.key === 'q' || e.key === 'Q')) {
        setNodes(prev => {
          const updated = prev.map(n => ({ ...n, width: 80, height: 48 }));
          nodesRef.current = updated;
          saveToHistory(updated, edgesRef.current);
          return updated;
        });
        console.log('All nodes resized to 80x48');
      }
      // Select all nodes on Ctrl+A
      else if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSelectedNodeIds(nodesRef.current.map(n => n.id));
        setSelectedEdgeIds([]);
        console.log(`Selected ${nodesRef.current.length} nodes`);
      }
      // Delete selected on Delete key
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || selectedGroupIds.length > 0) {
          handleDeleteSelected();
        }
      }
      // Escape to clear selection
      else if (e.key === 'Escape') {
        clearSelection();
      }
      // Create group on Ctrl+G
      else if (e.ctrlKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        handleCreateGroup();
      }
      // Ungroup on Ctrl+Shift+G
      else if (e.ctrlKey && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        handleUngroupSelected();
      }
    }
    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [selectedNodeIds, selectedEdgeIds, selectedGroupIds]);

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
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
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