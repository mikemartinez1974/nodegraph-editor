"use client";
// NodeGraph.js
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { getEdgeHandlePosition } from './utils';
import EdgeLayer from './EdgeLayer';
import HandleLayer from './HandleLayer';
import PanZoomLayer from './PanZoomLayer';
import NodeLayer from './NodeLayer';
import { useCanvasSize } from './hooks/useCanvasSize';
import eventBus from './eventBus';

export default function NodeGraph({ nodes = [], edges = [], nodeTypes = {}, edgeTypes = {}, selectedNodeId, selectedNodeIds = [], selectedEdgeId, selectedEdgeIds = [], onNodeClick, onBackgroundClick, pan, zoom, setPan, setZoom, onNodeMove, onEdgeClick, onEdgeHover, onNodeHover, hoveredEdgeId, hoveredEdgeSource, hoveredEdgeTarget }) {
  const theme = useTheme();
  
  // Debug logging for multi-selection
  useEffect(() => {
    if (selectedNodeIds.length > 0) {
      console.log('NodeGraph received selectedNodeIds:', selectedNodeIds);
      console.log('NodeGraph received selectedNodeId:', selectedNodeId);
    }
  }, [selectedNodeIds, selectedNodeId]);
  const canvasRef = useRef(null);
  const [selectedNodeIdState, setSelectedNodeId] = useState(null);
  const [selectedEdgeIdState, setSelectedEdgeIdState] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef(null);
  const hoverTimeoutRef = useRef({});
  const dragRafRef = useRef(null);
  const lastDragPosition = useRef(null);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const [draggingHandlePos, setDraggingHandlePos] = useState(null);
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  // Add state for handlePositions
  const [handlePositions, setHandlePositions] = useState({});

  // Process nodes with defaults
  const nodeList = useMemo(() => nodes.map(node => ({
    ...node,
    handleProgress: node.handleProgress !== undefined ? node.handleProgress : 0,
    showHandlesOnHover: node.showHandlesOnHover !== undefined ? node.showHandlesOnHover : true
  })), [nodes]);



  // Event bus handlers for node/edge events
  useEffect(() => {
    function handleNodeClick({ id }) {
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
    }
    function handleEdgeClick({ id }) {
      setSelectedEdgeIdState(id);
      setSelectedNodeId(null);
    }
    // Only node/handle hover controls handle extension/retraction
    function handleEdgeHover(id) {
      setHoveredNodeId(id);
      // Do NOT modify hoveredNodeId here
    }
    function handleNodeMouseEnter({ id }) {
      setHoveredNodeId(id);
      setIsNodeHovered(true);
    }
    function handleNodeMouseLeave({ id }) {
      setIsNodeHovered(false);
      if (hoverTimeoutRef.current[id]) {
        clearTimeout(hoverTimeoutRef.current[id]);
      }
      hoverTimeoutRef.current[id] = setTimeout(() => {
        if (!isNodeHovered && !isHandleHovered && !draggingHandle) {
          setHoveredNodeId(prev => (prev === id ? null : prev));
        }
        hoverTimeoutRef.current[id] = null;
      }, 250);
    }
    eventBus.on('nodeClick', handleNodeClick);
    eventBus.on('edgeClick', handleEdgeClick);
    eventBus.on('nodeMouseEnter', handleNodeMouseEnter);
    eventBus.on('nodeMouseLeave', handleNodeMouseLeave);
    return () => {
      eventBus.off('nodeClick', handleNodeClick);
      eventBus.off('edgeClick', handleEdgeClick);
      eventBus.off('nodeMouseEnter', handleNodeMouseEnter);
      eventBus.off('nodeMouseLeave', handleNodeMouseLeave);
    };
  }, []);

  // Listen for node/handle hover events from the event bus
  useEffect(() => {
    const handleNodeHover = ({ id }) => setHoveredNodeId(id);
    const handleNodeUnhover = () => setHoveredNodeId(null);
    const handleHandleHover = ({ nodeId }) => setHoveredNodeId(nodeId);
    const handleHandleUnhover = () => setHoveredNodeId(null);
    eventBus.on('nodeHover', handleNodeHover);
    eventBus.on('nodeUnhover', handleNodeUnhover);
    eventBus.on('handleHover', handleHandleHover);
    eventBus.on('handleUnhover', handleHandleUnhover);
    return () => {
      eventBus.off('nodeHover', handleNodeHover);
      eventBus.off('nodeUnhover', handleNodeUnhover);
      eventBus.off('handleHover', handleHandleHover);
      eventBus.off('handleUnhover', handleHandleUnhover);
    };
  }, []);

  // Node drag logic (already updates nodeList)
  function onNodeDragMove(e) {
    if (draggingNodeIdRef.current) {
      const newX = (e.clientX - dragOffset.current.x - (typeof pan?.x === 'number' ? pan.x : 0)) / (typeof zoom === 'number' ? zoom : 1);
      const newY = (e.clientY - dragOffset.current.y - (typeof pan?.y === 'number' ? pan.y : 0)) / (typeof zoom === 'number' ? zoom : 1);
      lastDragPosition.current = { x: newX, y: newY };
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          if (typeof onNodeMove === 'function' && lastDragPosition.current) {
            onNodeMove(draggingNodeIdRef.current, lastDragPosition.current);
          }
          dragRafRef.current = null;
        });
      }
    }
  }
  function onNodeDragStart(e, node) {
    e.preventDefault();
    setDraggingNodeId(node.id);
    draggingNodeIdRef.current = node.id;
    dragOffset.current = {
      x: e.clientX - (node.position.x * zoom + pan.x),
      y: e.clientY - (node.position.y * zoom + pan.y)
    };
    window.addEventListener('mousemove', onNodeDragMove);
    window.addEventListener('mouseup', onNodeDragEnd);
  }
  function onNodeDragEnd() {
    setDraggingNodeId(null);
    draggingNodeIdRef.current = null;
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    window.removeEventListener('mousemove', onNodeDragMove);
    window.removeEventListener('mouseup', onNodeDragEnd);
  }

  // Pass handleProgress to HandleLayer for all nodes
  // const nodesWithProgress = nodeList.map(node => ({ ...node, handleProgress: handleProgressMap[node.id] || 0 }));

  function handleBackgroundClickFromPanZoom(e) {
    if (typeof onBackgroundClick === 'function') onBackgroundClick(e);
    setSelectedNodeId(null);
    setSelectedEdgeIdState(null);
  }



  //Edge Handle Events
  function onHandleDragStart(e, handle) {
    setDraggingHandle(handle);
    setDraggingHandlePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onHandleDragMove);
    window.addEventListener('mouseup', onHandleDragEnd);
    // Custom logic for handle drag start
    //console.log('Handle drag start:', { event: e, handle });
  }

  function onHandleDragMove(e) {
    setDraggingHandlePos({ x: e.clientX, y: e.clientY });
  }

  function onHandleDragEnd(e) {
    if (draggingHandle) {
      console.log('Handle dropped:', draggingHandle);
      setHoveredNodeId(null);
      handleNodeMouseLeave({ id: draggingHandle.nodeId });
    }
    setDraggingHandle(null);
    setDraggingHandlePos(null);
    window.removeEventListener('mousemove', onHandleDragMove);
    window.removeEventListener('mouseup', onHandleDragEnd);
  }

  // Ensure the graph resizes with the window
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse event handlers for node hover
  const handleNodeMouseEnter = (nodeId) => {
    setHoveredNodeId(nodeId);
  };
  const handleNodeMouseLeave = () => {
    setHoveredNodeId(null);
  };

  return (
    <div id="graph-canvas" style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      background: "none",
      zIndex: 0
    }}>
      <PanZoomLayer
        pan={pan}
        zoom={zoom}
        onPanZoom={setPan}
        setZoom={setZoom}
        onBackgroundClick={handleBackgroundClickFromPanZoom}
        theme={theme}
        style={{ pointerEvents: 'auto', width: '100vw', height: '100vh' }}
      >
        <HandleLayer
          canvasRef={canvasRef}
          nodes={nodeList}
          edges={edges}
          pan={pan}
          zoom={zoom}
          edgeTypes={edgeTypes}
          onDragStart={onHandleDragStart}
          onDragMove={onHandleDragMove}
          onDragEnd={onHandleDragEnd}
        >
          <EdgeLayer
            edgeList={edges}
            nodeList={nodeList}
            pan={pan}
            zoom={zoom}
            selectedEdgeId={selectedEdgeId}
            selectedEdgeIds={selectedEdgeIds}
            theme={theme}
            hoveredNodeId={hoveredNodeId}
            handlePositions={handlePositions}
            onEdgeClick={(edge, event) => {
              setSelectedEdgeIdState(edge?.id);
              eventBus.emit('edgeClick', { id: edge?.id });
              if (typeof onEdgeClick === 'function') onEdgeClick(edge, event);
            }}
            onEdgeHover={onEdgeHover}
          />
        </HandleLayer>
        {/* <HandleLayer
          nodes={nodeList}
          edges={edges}
          pan={pan}
          zoom={zoom}
          theme={theme}
          hoveredNodeId={hoveredNodeId}
          hoveredEdgeSource={hoveredEdgeSource}
          hoveredEdgeTarget={hoveredEdgeTarget}
          onHandleEvent={handle => {
            setIsHandleHovered(!!handle);
            if (handle) {
              setHoveredNodeId(handle.nodeId);
              if (hoverTimeoutRef.current[handle.nodeId]) {
                clearTimeout(hoverTimeoutRef.current[handle.nodeId]);
                hoverTimeoutRef.current[handle.nodeId] = null;
              }
            }
          }}
          onHandleDragStart={onHandleDragStart}
          isDraggingHandle={!!draggingHandle}
          onHandleDragEnd={onHandleDragEnd}
          onHandlePositionsChange={setHandlePositions}
        /> */}

        

     

        <NodeLayer
          nodes={nodeList}
          pan={pan}
          zoom={zoom}
          selectedNodeId={selectedNodeId}
          selectedNodeIds={selectedNodeIds}
          draggingNodeId={draggingNodeId}
          theme={theme}
          nodeTypes={nodeTypes}
          onNodeEvent={(id, e) => {
            if (onNodeClick) onNodeClick(id, e);
            const node = nodes.find(n => n.id === id);
            if (node && node.handleProgress === 1) {
              const connectedEdges = edges.filter(edge => edge.source === id || edge.target === id);
              connectedEdges.forEach(edge => {
                const isSource = edge.source === id;
                const otherNode = isSource ? nodeList.find(n => n.id === edge.target) : nodeList.find(n => n.id === edge.source);
                if (!otherNode) return;
                let handlePos;
                if (edge.type === 'curved') {
                  handlePos = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, edge.type);
                } else {
                  handlePos = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, edge.type);
                }
                if (handlePos && typeof handlePos === 'object') {
                  // Simulate handle event
                }
              });
            }
            if (e) {
              e.stopPropagation();
              const node = nodes.find(n => n.id === id);
            }
          }}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeDragStart={onNodeDragStart}
        />

        {/* Preview edge during handle drag */}
        {draggingHandle && draggingHandlePos && (
          (() => {
            const container = canvasRef.current?.parentElement;
            const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
            const mouseX = (draggingHandlePos.x - rect.left - pan.x) / zoom;
            const mouseY = (draggingHandlePos.y - rect.top - pan.y) / zoom;
            const node = nodeList.find(n => n.id === draggingHandle.nodeId);
            let startX, startY;
            if (node) {
              const otherNode = nodeList.find(n => n.id === draggingHandle.otherNodeId);
              const handlePos = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, draggingHandle.edgeType || 'straight');
              startX = handlePos.x;
              startY = handlePos.y;
            } else {
              startX = draggingHandle.x;
              startY = draggingHandle.y;
            }
            return (
              <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100vw', height: '100vh' }}>
                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={mouseX}
                    y2={mouseY}
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    strokeDasharray="6,4"
                  />
                </g>
              </svg>
            );
          })()
        )}
      </PanZoomLayer>
    </div>
  );
}
