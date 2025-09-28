"use client";
// NodeGraph.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { getEdgeHandlePosition } from './utils';
import { usePanZoom } from './hooks/usePanZoom';
import NodeComponent from './NodeComponent';
import EdgeLayer from './EdgeLayer';
import HandleLayer from './HandleLayer';
import PanZoomLayer from './PanZoomLayer';
import { useNodeHover } from './hooks/useNodeHover';
import { useEdgeHover } from './hooks/useEdgeHover';
import { useHandleAnimation } from './hooks/useHandleAnimation';
import EdgeHandles from './EdgeHandles';
import NodeLayer from './NodeLayer';
import { isPointNearLine, isPointNearBezier } from './utils';
import { handleCanvasClick, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleNodeMouseDown, handleNodeMouseMove, handleNodeMouseUp, onNodeDragStart, onNodeDragEnd } from './eventHandlers';
import { useCanvasSize } from './hooks/useCanvasSize';
import { useHandleProgress } from './hooks/useHandleProgress';
import { useEventBusHandlers } from './hooks/useEventBusHandlers';
import eventBus from './eventBus';

export default function NodeGraph({ nodes = [], edges = [], nodeTypes = {}, selectedNodeId, onNodeClick, onBackgroundClick, pan, zoom, setPan, setZoom, onNodeMove, onEdgeClick, onEdgeHover, onNodeHover, hoveredEdgeId, hoveredEdgeSource, hoveredEdgeTarget }) {
  const theme = useTheme();
  const canvasRef = useRef(null);
  const edgeListRef = useRef(edges);
  const canvasSize = useCanvasSize();
  const [nodeList, setNodeList] = useState(nodes);
  const [selectedNodeIdState, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isPanningState, setIsPanningState] = useState(false);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef(null);
  const hoverTimeoutRef = useRef({});
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  // Add state for draggingHandlePos
  const [draggingHandlePos, setDraggingHandlePos] = useState(null);
  // Add isNodeHovered state
  const [isNodeHovered, setIsNodeHovered] = useState(false);

  // Only update nodeList if nodes have actually changed
  useEffect(() => {
    if (JSON.stringify(nodeList) !== JSON.stringify(nodes)) {
      setNodeList(nodes.map(node => ({
        ...node,
        handleProgress: node.handleProgress !== undefined ? node.handleProgress : 0,
        showHandlesOnHover: node.showHandlesOnHover !== undefined ? node.showHandlesOnHover : true
      })));
    }
  }, [nodes]
  );


  //Draw Debug Nodes
  useEffect(() => {
    // Always use nodes and edges from props for rendering
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    nodes.forEach(node => {
      ctx.save();
      ctx.strokeStyle = theme.palette.info.main;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(node.position.x, node.position.y, node.width || 60, node.height || 60);
      ctx.restore();
    });

    ctx.restore();
  }, [canvasSize, theme, pan, zoom, nodes, edges]);


  // Event bus handlers for node/edge events
  useEffect(() => {
    function handleNodeMove({ id, position }) {
      setNodeList(prev => prev.map(n => n.id === id ? { ...n, position } : n));
    }
    function handleNodeClick({ id }) {
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
    }
    function handleEdgeClick({ id }) {
      setSelectedEdgeId(id);
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
    eventBus.on('nodeMove', handleNodeMove);
    eventBus.on('nodeClick', handleNodeClick);
    eventBus.on('edgeClick', handleEdgeClick);
    eventBus.on('nodeMouseEnter', handleNodeMouseEnter);
    eventBus.on('nodeMouseLeave', handleNodeMouseLeave);
    return () => {
      eventBus.off('nodeMove', handleNodeMove);
      eventBus.off('nodeClick', handleNodeClick);
      eventBus.off('edgeClick', handleEdgeClick);
      eventBus.off('nodeMouseEnter', handleNodeMouseEnter);
      eventBus.off('nodeMouseLeave', handleNodeMouseLeave);
    };
  }, []);

  // Node drag logic (already updates nodeList)
  function onNodeDragMove(e) {
    if (draggingNodeIdRef.current) {
      const newX = (e.clientX - dragOffset.current.x - (typeof pan?.x === 'number' ? pan.x : 0)) / (typeof zoom === 'number' ? zoom : 1);
      const newY = (e.clientY - dragOffset.current.y - (typeof pan?.y === 'number' ? pan.y : 0)) / (typeof zoom === 'number' ? zoom : 1);
      if (typeof onNodeMove === 'function') {
        onNodeMove(draggingNodeIdRef.current, { x: newX, y: newY });
      } else {
        setNodeList(prev => prev.map(n => n.id === draggingNodeIdRef.current ? { ...n, position: { x: newX, y: newY } } : n));
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
    window.removeEventListener('mousemove', onNodeDragMove);
    window.removeEventListener('mouseup', onNodeDragEnd);
  }

  // Animated handleProgress for smooth handle extension/retraction
  const [handleProgressMap, setHandleProgressMap] = useState({});
  useEffect(() => {
    let animationFrame;
    const duration = 125; // ms
    const start = performance.now();
    const initial = { ...handleProgressMap };
    const target = {};
    nodeList.forEach(node => {
      // Extend handle if node is hovered, or if it's the source/target of the hovered edge
      target[node.id] = (hoveredNodeId === node.id || hoveredEdgeSource === node.id || hoveredEdgeTarget === node.id) ? 1 : 0;
      if (initial[node.id] === undefined) initial[node.id] = 0;
    });
    function animate(now) {
      const elapsed = Math.min(now - start, duration);
      const progress = elapsed / duration;
      const next = {};
      nodeList.forEach(node => {
        const from = initial[node.id];
        const to = target[node.id];
        next[node.id] = from + (to - from) * progress;
      });
      setHandleProgressMap(next);
      if (elapsed < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setHandleProgressMap(target);
      }
    }
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [hoveredNodeId, hoveredEdgeSource, hoveredEdgeTarget, nodeList]);

  // Pass handleProgress to HandleLayer for all nodes
  const nodesWithProgress = nodeList.map(node => ({ ...node, handleProgress: handleProgressMap[node.id] || 0 }));

  function handleBackgroundClickFromPanZoom(e) {
    if (typeof onBackgroundClick === 'function') onBackgroundClick(e);
    setSelectedNodeId(null);
    setSelectedEdgeId && setSelectedEdgeId(null);
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

  // Add a placeholder for handleNodeMouseLeave if not defined
  function handleNodeMouseLeave({ id }) {
    // Implement node mouse leave logic here if needed
    // For now, just log for debug
    //console.log('handleNodeMouseLeave called for node', id);
  }

  return (
    <div id="graph-canvas" style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', background: 'none', zIndex: 0 }}>
      <PanZoomLayer
        pan={pan}
        zoom={zoom}
        onPanZoom={setPan}
        setZoom={setZoom}
        onBackgroundClick={handleBackgroundClickFromPanZoom}
        theme={theme}
        style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}
      >
        <HandleLayer
          nodes={nodesWithProgress}
          edges={edges}
          pan={pan}
          zoom={zoom}
          theme={theme}
          hoveredEdgeId={hoveredEdgeId}
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
        />
        <EdgeLayer
          edgeList={edges}
          nodeList={nodeList}
          pan={pan}
          zoom={zoom}
          selectedEdgeId={selectedEdgeId}
          theme={theme}
          hoveredNodeId={hoveredNodeId}
          onEdgeClick={(edge, event) => {
            setSelectedEdgeId(edge?.id);
            eventBus.emit('edgeClick', { id: edge?.id });
            if (typeof onEdgeClick === 'function') onEdgeClick(edge, event);
          }}
          onEdgeHover={onEdgeHover}
        />
        {/* <EdgeHandles nodes={nodesWithProgress} edges={edges} theme={theme} pan={pan} zoom={zoom} /> */}
        <NodeLayer
          nodes={nodeList}
          pan={pan}
          zoom={zoom}
          selectedNodeId={selectedNodeId}
          draggingNodeId={draggingNodeId}
          theme={theme}
          onNodeEvent={(id, e) => {
            if (onNodeClick) onNodeClick(id);
            const node = nodesWithProgress.find(n => n.id === id);
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
