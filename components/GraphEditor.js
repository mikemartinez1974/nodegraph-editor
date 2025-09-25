"use client";
import React, { useState } from 'react';
import NodeGraph from './NodeGraph';
import { nodes as initialNodes, edges as initialEdges } from '../components/NodeGraph/graphData';
import { createNode, createEdge } from './NodeGraph/nodeEdgeBase';
import Toolbar from './Toolbar.js';

export default function GraphEditor() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  function addNode() {
    const newId = `node${nodes.length + 1}`;
    const newNode = createNode({
      id: newId,
      type: 'default',
      label: `Node ${nodes.length + 1}`,
      data: {},
      position: { x: 100 + nodes.length * 100, y: 100 },
      showLabel: true
    });
    setNodes(prev => [...prev, newNode]);
  }
  
  function addEdge() {
    if (nodes.length < 2) return;
    const newId = `edge${edges.length + 1}`;
    const newEdge = createEdge({
      id: newId,
      source: nodes[nodes.length - 2].id,
      target: nodes[nodes.length - 1].id,
      label: `Edge ${edges.length + 1}`,
      type: 'straight'
    });
    setEdges(prev => [...prev, newEdge]);
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
        <NodeGraph nodes={nodes} edges={edges} />
      </div>
  );
}
