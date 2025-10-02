"use client";
import React, { useState, useEffect, useRef } from 'react';
import NodeGraph from './NodeGraph';
import { nodes as initialNodes, edges as initialEdges } from '../components/NodeGraph/graphData';
import { createNode, createEdge } from './GraphEditor/nodeEdgeBase';
import Toolbar from './Toolbar.js';
import eventBus from './NodeGraph/eventBus';
import { edgeTypes } from './GraphEditor/edgeTypes';
import DefaultNode from './GraphEditor/Nodes/DefaultNode';
import DisplayNode from '../components/GraphEditor/Nodes/DisplayNode';
import ListNode from '../components/GraphEditor/Nodes/ListNode';
import { useTheme } from '@mui/material/styles';
import NodePropertiesPanel from './GraphEditor/NodePropertiesPanel';



export default function GraphEditor({ backgroundImage }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [history, setHistory] = useState([{ nodes: initialNodes, edges: initialEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);
 
  // Compute which handles should be extended for hovered edge
  let hoveredEdgeSource = null;
  let hoveredEdgeTarget = null;
  if (hoveredEdgeId) {
    const hoveredEdge = edges.find(e => e.id === hoveredEdgeId);
    if (hoveredEdge) {
      hoveredEdgeSource = hoveredEdge.source;
      hoveredEdgeTarget = hoveredEdge.target;
    }
  }

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const theme = useTheme();

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    function onHandleDrop(data) {
      //console.log('GraphEditor.js: handleDrop event received', data);
      const { graph, sourceNode, targetNode, edgeType, direction } = data;
  
      // Use the edgeType from the handle directly
      const edgeTypeKey = edgeType || 'child';
      const edgeTypePreset = edgeTypes[edgeTypeKey] || edgeTypes.child;
  
      if (!targetNode) {
        // Drop on blank field: create new node and edge
        const newNodeId = uuidv4();
        const newNode = createNode({
          id: newNodeId,
          type: 'default',
          label: `Node ${nodesRef.current.length + 1}`,
          data: {},
          position: { x: graph.x, y: graph.y },
          showLabel: true
        });
        setNodes(prev => [...prev, newNode]);
        //console.log('Created new node:', newNode.id);
  
        // Create edge - respect the direction of the handle
        const newEdgeId = uuidv4();
        const newEdge = addEdge({
          id: newEdgeId,
          type: edgeTypeKey,
          source: direction === 'source' ? sourceNode : newNodeId,
          target: direction === 'source' ? newNodeId : sourceNode,
          label: '',
          showLabel: false,
          style: edgeTypePreset.style
        });
        //console.log('Created new edge:', newEdge.id);
      } else {
        // Drop on another node: create edge between source and target
        if (targetNode !== sourceNode) {
          // Check if edge already exists
          const edgeExists = edgesRef.current.some(e => 
            (e.source === sourceNode && e.target === targetNode && e.type === edgeTypeKey) ||
            (e.source === targetNode && e.target === sourceNode && e.type === edgeTypeKey)
          );
  
          if (!edgeExists) {
            const newEdgeId = uuidv4();
            const newEdge = addEdge({
              id: newEdgeId,
              type: edgeTypeKey,
              source: direction === 'source' ? sourceNode : targetNode,
              target: direction === 'source' ? targetNode : sourceNode,
              label: '',
              showLabel: false,
              style: edgeTypePreset.style
            });
            setEdges(prev => [...prev, newEdge]);

            //console.log('Created edge between nodes:', newEdge.id);
          } else {
            //console.log('Edge already exists, skipping creation');
          }
        }
      }
      saveToHistory(nodesRef.current, edgesRef.current);
    }
    eventBus.on('handleDrop', onHandleDrop);
    return () => {
      eventBus.off('handleDrop', onHandleDrop);
    };
  }, [edgeTypes]);

  useEffect(() => {
    const savedBg = localStorage.getItem('backgroundImage');
    if (savedBg) {
      document.getElementById('graph-editor-background').style.backgroundImage = `url('/background art/${savedBg}')`;
    }
  }, []);

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function addNode() {
    const newId = uuidv4();
    const newNode = createNode({
      id: newId,
      type: 'default',
      label: `Node ${nodes.length + 1}`,
      data: {},
      position: { x: 100 + nodes.length * 100, y: 100 },
      showLabel: true
    });
    setNodes(prev => [...prev, newNode]);
    //  console.log('Added node:', newNode.id);
  }
  
  function addEdge(edgeProps) {
    const edge = createEdge(edgeProps);
    setEdges(prev => [...prev, edge]);
    return edge;
  }
  
  function deleteNode() {
    if (nodes.length === 0) return;
    const nodeId = nodes[nodes.length - 1].id;
    setNodes(prev => prev.slice(0, -1));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
  }

  function deleteEdge() {
    if (edges.length === 0) return;
    setEdges(prev => prev.slice(0, -1));
  }

  function handleUpdateNodeData(nodeId, newData, isLabelUpdate = false) {
    setNodes(prev => prev.map(node => {
      if (node.id === nodeId) {
        if (isLabelUpdate) {
          // Update the label directly on the node
          return { ...node, label: newData.label, data: { ...node.data, ...newData } };
        }
        // Update only the data property
        return { ...node, data: { ...node.data, ...newData } };
      }
      saveToHistory(nodes, edges);
      return node;
    }));
  }

  function handleLoadGraph(loadedNodes, loadedEdges) {
    // Replace current nodes and edges with loaded data
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    
    // Clear selections
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    
    console.log(`Loaded ${loadedNodes.length} nodes and ${loadedEdges.length} edges`);
  }

  // Save current state to history (for undo/redo)
const saveToHistory = (newNodes, newEdges) => {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push({ nodes: newNodes, edges: newEdges });
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
};

// Undo handler
const handleUndo = () => {
  if (historyIndex > 0) {
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setNodes(history[newIndex].nodes);
    setEdges(history[newIndex].edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    console.log('Undo performed');
  }
};

// Redo handler
const handleRedo = () => {
  if (historyIndex < history.length - 1) {
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setNodes(history[newIndex].nodes);
    setEdges(history[newIndex].edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    console.log('Redo performed');
  }
};

// Add node handler
const handleAddNode = () => {
  const newId = uuidv4();
  const newNode = createNode({
    id: newId,
    type: 'default',
    label: `Node ${nodes.length + 1}`,
    data: {},
    position: { 
      x: 100 + (nodes.length * 20), 
      y: 100 + (nodes.length * 20) 
    },
    showLabel: true
  });
  const newNodes = [...nodes, newNode];
  setNodes(newNodes);
  saveToHistory(newNodes, edges);
  console.log('Added node:', newNode.id);
};

// Delete selected handler
const handleDeleteSelected = () => {
  if (selectedNodeId) {
    const newNodes = nodes.filter(n => n.id !== selectedNodeId);
    const newEdges = edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodeId(null);
    saveToHistory(newNodes, newEdges);
    console.log('Deleted node:', selectedNodeId);
  } else if (selectedEdgeId) {
    const newEdges = edges.filter(e => e.id !== selectedEdgeId);
    setEdges(newEdges);
    setSelectedEdgeId(null);
    saveToHistory(nodes, newEdges);
    console.log('Deleted edge:', selectedEdgeId);
  }
};

// Clear graph handler
const handleClearGraph = () => {
  const newNodes = [];
  const newEdges = [];
  setNodes(newNodes);
  setEdges(newEdges);
  setSelectedNodeId(null);
  setSelectedEdgeId(null);
  saveToHistory(newNodes, newEdges);
  console.log('Graph cleared');
};

// Update the handleLoadGraph function to save to history:
function handleLoadGraph(loadedNodes, loadedEdges) {
  setNodes(loadedNodes);
  setEdges(loadedEdges);
  setSelectedNodeId(null);
  setSelectedEdgeId(null);
  saveToHistory(loadedNodes, loadedEdges);
  console.log(`Loaded ${loadedNodes.length} nodes and ${loadedEdges.length} edges`);
}
  

  // Node types mapping for the editor
  const nodeTypes = {
    default: DefaultNode,
    display: DisplayNode,
    list: ListNode
  };

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
        nodes={nodes} 
        edges={edges} 
        onLoadGraph={handleLoadGraph}
        onAddNode={handleAddNode}
        onDeleteSelected={handleDeleteSelected}
        onClearGraph={handleClearGraph}
        onUndo={handleUndo}
        onRedo={handleRedo}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />
      <NodeGraph 
        nodes={nodes} 
        edges={edges} 
        pan={pan} 
        zoom={zoom} 
        setPan={setPan} 
        setZoom={setZoom}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeMove={(id, position) => {
          setNodes(prev => prev.map(n => n.id === id ? { ...n, position } : n));
        }}
        onEdgeClick={(edge, event) => {
          setSelectedEdgeId(edge.id);
          setSelectedNodeId(null); // Deselect any node
          //console.log('GraphEditor onEdgeClick', edge, event);
        }}
        onNodeClick={nodeId => {
          setSelectedNodeId(nodeId);
          setSelectedEdgeId(null); // Deselect any edge
        }}
        onBackgroundClick={() => {
          setSelectedNodeId(null);
          setSelectedEdgeId(null); // Deselect both
          //console.log('GraphEditor onBackgroundClick (empty field clicked)');
        }}
        onEdgeHover={id => setHoveredEdgeId(id)}
        onNodeHover={id => setHoveredNodeId(id)}
        hoveredEdgeId={hoveredEdgeId}
        hoveredEdgeSource={hoveredEdgeSource}
        hoveredEdgeTarget={hoveredEdgeTarget}
      />
      {selectedNodeId && (
        <NodePropertiesPanel
          selectedNode={nodes.find(n => n.id === selectedNodeId)}
          onUpdateNode={handleUpdateNodeData}
          onClose={() => setSelectedNodeId(null)}
          theme={theme}
       />
      )}
    </div>

  );
}
