"use client";
import React, { useState, useEffect, useRef } from 'react';
import NodeGraph from './NodeGraph';
import { nodes as initialNodes, edges as initialEdges } from '../components/NodeGraph/graphData';
import { createNode, createEdge } from './NodeGraph/nodeEdgeBase';
import Toolbar from './Toolbar.js';
import eventBus from './NodeGraph/eventBus';
import { screenToGraphCoords } from './NodeGraph/utils/coords';
import { edgeTypes } from './GraphEditor/edgeTypes';

export default function GraphEditor() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

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

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    function onHandleDrop(data) {
      console.log('GraphEditor.js: handleDrop event received', data);
      console.log('Event data:', data);
      const { graph, screen, sourceNode, targetNode, edgeId } = data;
      let newEdgeType = 'straight';
      if (edgeId) {
        const foundEdge = edgesRef.current.find(e => e.id === edgeId);
        if (foundEdge && foundEdge.type) {
          newEdgeType = foundEdge.type;
        }
      }
      const graphX = graph.x;
      const graphY = graph.y;

      if (!targetNode) {
        // Drop on blank field: create new node and edge
        const newNodeId = uuidv4();
        const newNode = createNode({
          id: newNodeId,
          type: 'default',
          label: `Node ${nodes.length + 1}`,
          data: {},
          position: { x: graphX, y: graphY },
          showLabel: true
        });
        setNodes(prev => [...prev, newNode]);
        console.log('Added node:', newNode);

        // Determine edge type from the handle's associated edge, or default to 'child'
        let edgeTypeKey = 'child';
        if (edgeId) {
          const foundEdge = edgesRef.current.find(e => e.id === edgeId);
          if (foundEdge && foundEdge.type && edgeTypes[foundEdge.type]) {
            edgeTypeKey = foundEdge.type;
          }
        }
        const edgeTypePreset = edgeTypes[edgeTypeKey] || edgeTypes.child;
        const newEdgeId = uuidv4();
        const newEdge = addEdge({
          id: newEdgeId,
          type: edgeTypeKey,
          source: sourceNode,
          target: newNodeId,
          label: `${edgeTypePreset.label} ${edges.length + 1}`,
          showLabel: false,
          style: edgeTypePreset.style
        });
        console.log('Added edge:', newEdge);
      } else {
        // Drop on another node: create edge between source and target
        if (targetNode !== sourceNode) {
          // Determine edge type from the handle's associated edge, or default to 'child'
          let edgeTypeKey = 'child';
          if (edgeId) {
            const foundEdge = edgesRef.current.find(e => e.id === edgeId);
            if (foundEdge && foundEdge.type && edgeTypes[foundEdge.type]) {
              edgeTypeKey = foundEdge.type;
            }
          }
          const edgeTypePreset = edgeTypes[edgeTypeKey] || edgeTypes.child;
          console.log('DEBUG: Handle dropped on node', { sourceNode, targetNode, edgeId, edgeTypeKey, data });
          const newEdgeId = uuidv4();
          const newEdge = addEdge({
            id: newEdgeId,
            type: edgeTypeKey,
            source: sourceNode,
            target: targetNode,
            label: `${edgeTypePreset.label} ${edges.length + 1}`,
            showLabel: false,
            style: edgeTypePreset.style
          });
          setEdges(prev => [...prev, newEdge]);
        }
      }
    }
    eventBus.on('handleDrop', onHandleDrop);
    return () => {
      eventBus.off('handleDrop', onHandleDrop);
    };
  }, [pan, zoom]);

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
    console.log('Added node:', newNode.id);
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

  return (
      <div>
        <Toolbar />
        <NodeGraph 
          nodes={nodes} 
          edges={edges} 
          pan={pan} 
          zoom={zoom} 
          setPan={setPan} 
          setZoom={setZoom}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          onNodeMove={(id, position) => {
            setNodes(prev => prev.map(n => n.id === id ? { ...n, position } : n));
          }}
          onEdgeClick={(edge, event) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null); // Deselect any node
            console.log('GraphEditor onEdgeClick', edge, event);
          }}
          onNodeClick={nodeId => {
            setSelectedNodeId(nodeId);
            setSelectedEdgeId(null); // Deselect any edge
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
              console.log('Node clicked:', node);
            }
          }}
          onBackgroundClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null); // Deselect both
            console.log('GraphEditor onBackgroundClick (empty field clicked)');
          }}
          onEdgeHover={id => setHoveredEdgeId(id)}
          onNodeHover={id => setHoveredNodeId(id)}
          hoveredEdgeId={hoveredEdgeId}
          hoveredEdgeSource={hoveredEdgeSource}
          hoveredEdgeTarget={hoveredEdgeTarget}
        />
      </div>
  );
}
