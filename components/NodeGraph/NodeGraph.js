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
import EdgeOverlay from './EdgeOverlay';
import EdgeHandles from './EdgeHandles';
import NodeLayer from './NodeLayer';
import { isPointNearLine, isPointNearBezier } from './utils';
import { handleCanvasClick, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleNodeMouseDown, handleNodeMouseMove, handleNodeMouseUp, onNodeDragStart, onNodeDragEnd } from './eventHandlers';
import { useCanvasSize } from './hooks/useCanvasSize';
import { useHandleProgress } from './hooks/useHandleProgress';
import { useEventBusHandlers } from './hooks/useEventBusHandlers';
import eventBus from './eventBus';

export default function NodeGraph({ nodes = [], edges = [], nodeTypes = {}, selectedNodeId, onNodeClick, onBackgroundClick }) {
  const theme = useTheme();
  const canvasRef = useRef(null);
  const edgeListRef = useRef(edges);
  const canvasSize = useCanvasSize();
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [nodeList, setNodeList] = useState(nodes);
  const [selectedNodeIdState, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isPanningState, setIsPanningState] = useState(false);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef(null);
  const hoverTimeoutRef = useRef({});

  // Pan/zoom logic via hook

  const {
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleWheel
  } = usePanZoom({ minZoom: 0.8, maxZoom: 1.5, zoomFactor: 1.05, panBound: 1000 });

  useEffect(() => {
    // Only update nodeList if nodes have actually changed
    if (JSON.stringify(nodeList) !== JSON.stringify(nodes)) {
      setNodeList(nodes.map(node => ({
        ...node,
        handleProgress: node.handleProgress !== undefined ? node.handleProgress : 0,
        showHandlesOnHover: node.showHandlesOnHover !== undefined ? node.showHandlesOnHover : true
      })));
    }
  }, [nodes]
  );

  useEffect(() => {
    
    function handleCanvasPan({ dx, dy }) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }

    function handleCanvasZoom({ direction }) {
      setZoom(prev => {
        const zoomFactor = 1.005; // gentler zoom
        if (direction > 0) {
          return Math.min(prev * zoomFactor, 2);
        } else {
          return Math.max(prev / zoomFactor, 0.5);
        }
      });
    }

    eventBus.on('canvasPan', handleCanvasPan);
    eventBus.on('canvasZoom', handleCanvasZoom);
    return () => {
      eventBus.off('canvasPan', handleCanvasPan);
      eventBus.off('canvasZoom', handleCanvasZoom);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Always use nodeList for edge rendering
    edgeListRef.current.forEach(edge => {
      const sourceNode = nodeList.find(n => n.id === edge.source);
      const targetNode = nodeList.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;
      const sourceHandle = getEdgeHandlePosition(sourceNode, 'source');
      const targetHandle = getEdgeHandlePosition(targetNode, 'target');
      ctx.save();
      // Edge style logic
      if (edge.type === 'dashed') {
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = theme.palette.warning.main;
      } else if (edge.type === 'curved') {
        ctx.strokeStyle = theme.palette.info.main;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sourceHandle.x, sourceHandle.y);
        // More pronounced curve
        const curveOffset = Math.max(Math.abs(targetHandle.y - sourceHandle.y), 100);
        ctx.bezierCurveTo(
          sourceHandle.x + curveOffset, sourceHandle.y,
          targetHandle.x - curveOffset, targetHandle.y,
          targetHandle.x, targetHandle.y
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Draw edge label for curved
        if (edge.label) {
          const midX = (sourceHandle.x + targetHandle.x) / 2;
          const midY = (sourceHandle.y + targetHandle.y) / 2 - curveOffset / 4;
          ctx.fillStyle = theme.palette.text.secondary;
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, midX, midY);
        }
        return;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.palette.secondary.main;
      }
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sourceHandle.x, sourceHandle.y);
      ctx.lineTo(targetHandle.x, targetHandle.y);
      ctx.stroke();
      ctx.restore();
      // Draw edge label for straight/dashed
      if (edge.label) {
        const midX = (sourceHandle.x + targetHandle.x) / 2;
        const midY = (sourceHandle.y + targetHandle.y) / 2;
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, midX, midY - 8);
      }
    });

    // Draw nodes as circles for debugging/tracking
    nodeList.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = theme.palette.primary.light;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }, [canvasSize, theme, pan, zoom, nodeList, edges]);


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
      setHoveredEdgeId(id);
      // Do NOT modify hoveredNodeId here
    }
    function handleNodeMouseEnter({ id }) {
      if (hoverTimeoutRef.current[id]) {
        clearTimeout(hoverTimeoutRef.current[id]);
        hoverTimeoutRef.current[id] = null;
      }
      setHoveredNodeId(id);
    }
    function handleNodeMouseLeave({ id }) {
      if (hoverTimeoutRef.current[id]) {
        clearTimeout(hoverTimeoutRef.current[id]);
      }
      hoverTimeoutRef.current[id] = setTimeout(() => {
        // Check if mouse is over any handle or node
        const handleHovered = document.querySelector(`div[key*='${id}-'][style*='z-index: 30']`);
        const nodeHovered = document.querySelector(`div[key='${id}']`);
        const isHandleHovered = handleHovered && handleHovered.matches(':hover');
        const isNodeHovered = nodeHovered && nodeHovered.matches(':hover');
        if (!isHandleHovered && !isNodeHovered) {
          setHoveredNodeId(prev => (prev === id ? null : prev));
        }
        hoverTimeoutRef.current[id] = null;
      }, 100);
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
      const newX = (e.clientX - dragOffset.current.x - pan.x) / zoom;
      const newY = (e.clientY - dragOffset.current.y - pan.y) / zoom;
      setNodeList(prev => prev.map(n => n.id === draggingNodeIdRef.current ? { ...n, position: { x: newX, y: newY } } : n));
    }
  }

  // Node drag logic
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

  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (container) {
      const wheelHandler = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.02 : 0.02;
        setZoom(prev => Math.max(0.1, Math.min(2, prev + delta)));
      };
      container.addEventListener('wheel', wheelHandler, { passive: false });
      return () => container.removeEventListener('wheel', wheelHandler);
    }
  }, []);

  // Animated handleProgress for smooth handle extension/retraction
  const [handleProgressMap, setHandleProgressMap] = useState({});
  useEffect(() => {
    let animationFrame;
    const duration = 125; // ms
    const start = performance.now();
    const initial = { ...handleProgressMap };
    const target = {};
    nodeList.forEach(node => {
      target[node.id] = hoveredNodeId === node.id ? 1 : 0;
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
  }, [hoveredNodeId, nodeList]);

  useEffect(() => {
    function handleHandleDragEnd({ nodeId, edgeId, mouse, event }) {
      // Convert mouse position to graph coordinates
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (mouse.x - rect.left - pan.x) / zoom;
      const y = (mouse.y - rect.top - pan.y) / zoom;
      eventBus.emit('createEdgeOrNode', { sourceNodeId: nodeId, edgeId, x, y, event });
      // You can use this event to show a node creation UI or create a new edge
    }
    eventBus.on('handleDragEnd', handleHandleDragEnd);
    return () => {
      eventBus.off('handleDragEnd', handleHandleDragEnd);
    };
  }, [pan, zoom]);

  // Top-level state
  const { hoveredNode, setHoveredNode } = useNodeHover(nodes);
  const { hoveredEdge, setHoveredEdge } = useEdgeHover(edges);
  const handleProgress = useHandleAnimation(hoveredNode || hoveredEdge);

  // console.log('NodeGraph nodes:', nodes);
  // console.log('NodeGraph edges:', edges);

  // Generate handles for each node using intersection with edge direction
  function getCircleLineIntersection(cx, cy, r, x2, y2) {
    // Returns intersection point on circle perimeter from center (cx,cy) toward (x2,y2)
    const dx = x2 - cx;
    const dy = y2 - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: cx, y: cy + r }; // fallback: bottom
    const nx = dx / len;
    const ny = dy / len;
    return {
      x: cx + nx * r,
      y: cy + ny * r
    };
  }

  const handles = [];
  nodeList.forEach(node => {
    const progress = handleProgressMap[node.id] || 0;
    const centerX = node.position.x;
    const centerY = node.position.y;
    const nodeRadius = (node.width || 60) / 2;
    edges.forEach(edge => {
      let otherNode = null;
      let isSource = false;
      let targetPoint = null;
      if (edge.source === node.id) {
        otherNode = nodeList.find(n => n.id === edge.target);
        isSource = true;
        if (edge.type === 'curved' && otherNode) {
          // For curved, use control point direction
          const curveOffset = Math.max(Math.abs(otherNode.position.y - centerY), 100);
          targetPoint = {
            x: centerX + curveOffset,
            y: centerY
          };
        } else if (otherNode) {
          targetPoint = { x: otherNode.position.x, y: otherNode.position.y };
        }
      } else if (edge.target === node.id) {
        otherNode = nodeList.find(n => n.id === edge.source);
        isSource = false;
        if (edge.type === 'curved' && otherNode) {
          // For curved, use control point direction
          const curveOffset = Math.max(Math.abs(centerY - otherNode.position.y), 100);
          targetPoint = {
            x: centerX - curveOffset,
            y: centerY
          };
        } else if (otherNode) {
          targetPoint = { x: otherNode.position.x, y: otherNode.position.y };
        }
      }
      if (!otherNode || !targetPoint) return;
      // Intersection point from center toward targetPoint
      const intersect = getCircleLineIntersection(centerX, centerY, nodeRadius, targetPoint.x, targetPoint.y);
      // Interpolate from center to intersection
      const x = centerX + (intersect.x - centerX) * progress;
      const y = centerY + (intersect.y - centerY) * progress;
      handles.push({
        id: `${node.id}-handle-${edge.id}`,
        x,
        y,
        radius: 12,
        color: theme.palette.primary.main,
        progress,
        isActive: hoveredNodeId === node.id,
        nodeId: node.id,
        edgeId: edge.id,
        isSource
      });
    });
  });

  // Track hover state for nodes and handles
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const [isHandleHovered, setIsHandleHovered] = useState(false);

  // Update hoveredNodeId only when neither node nor handle is hovered
  useEffect(() => {
    if (!isNodeHovered && !isHandleHovered) {
      setHoveredNodeId(null);
    }
  }, [isNodeHovered, isHandleHovered]);

  // Debounce handle retraction only when both node and handle are not hovered
  useEffect(() => {
    if (!isNodeHovered && !isHandleHovered) {
      const timeout = setTimeout(() => {
        setHoveredNodeId(null);
      }, 30);
      return () => clearTimeout(timeout);
    }
  }, [isNodeHovered, isHandleHovered]);

  // Handle drag state
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [draggingHandlePos, setDraggingHandlePos] = useState(null);
  const lastMousePosRef = useRef(null);
  const prevDraggingHandleRef = useRef(null);
  const sourceNodeRef = useRef(null);

  useEffect(() => {
    prevDraggingHandleRef.current = draggingHandle;
  }, [draggingHandle]);

  useEffect(() => {
    if (draggingHandle === null && lastMousePosRef.current) {
      const { x, y } = lastMousePosRef.current;
      // Convert mouse position to graph coordinates
      const rect = canvasRef.current.getBoundingClientRect();
      const graphX = (x - rect.left - pan.x) / zoom;
      const graphY = (y - rect.top - pan.y) / zoom;
      let targetNode = null;
      for (const node of nodeList) {
        const dx = graphX - node.position.x;
        const dy = graphY - node.position.y;
        const r = (node.width || 60) / 2;
        if (dx * dx + dy * dy <= r * r) {
          targetNode = node;
          break;
        }
      }
      const eventData = {
        mouse: { x, y },
        graph: { x: graphX, y: graphY },
        targetNode: targetNode ? targetNode : null,
        sourceNode: sourceNodeRef.current
      };
      eventBus.emit('handle-dropped', eventData);
    }
  }, [draggingHandle]);

  function onHandleDragStart(e, handle) {
    e.preventDefault();
    console.log('Handle grabbed:', handle);
    setDraggingHandle(handle);
    setDraggingHandlePos({ x: e.clientX, y: e.clientY });
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    sourceNodeRef.current = nodeList.find(n => n.id === handle.nodeId) || null;
    window.addEventListener('mousemove', onHandleDragMove);
    window.addEventListener('mouseup', onHandleDragEnd);
  }

  function onHandleDragMove(e) {
    setDraggingHandlePos({ x: e.clientX, y: e.clientY });
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  }

  function cleanupHandleDrag() {
    // console.log('cleanupHandleDrag called');
    setDraggingHandle(null);
    setDraggingHandlePos(null);
    setIsHandleHovered(false);
    setIsNodeHovered(false);
  }

  function onHandleDragEnd(e) {
    console.log('Handle released (mouse up)', e);
    window.removeEventListener('mousemove', onHandleDragMove);
    window.removeEventListener('mouseup', onHandleDragEnd);
    window.removeEventListener('mouseleave', cleanupHandleDrag);
    window.removeEventListener('blur', cleanupHandleDrag);

    // On handle drag end, emit drag/drop data and log it
    if (draggingHandle) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      let targetNode = null;
      for (const node of nodeList) {
        const dx = x - node.position.x;
        const dy = y - node.position.y;
        const r = (node.width || 60) / 2;
        if (dx * dx + dy * dy <= r * r) {
          targetNode = node;
          break;
        }
      }
      eventBus.emit('handleDrop', {
        sourceNodeId: draggingHandle.nodeId,
        edgeId: draggingHandle.edgeId,
        x,
        y,
        targetNode
      });
      console.log('Handle drag end at coordinates:', { x, y });
    }
    cleanupHandleDrag();
  }

  // During handle drag, show only the dragged handle at the mouse position, with pointerEvents: 'none'
  const displayHandles = draggingHandle && draggingHandlePos
    ? [
        {
          ...draggingHandle,
          x: (() => {
            const container = canvasRef.current?.parentElement;
            const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
            return (draggingHandlePos.x - rect.left - pan.x) / zoom;
          })(),
          y: (() => {
            const container = canvasRef.current?.parentElement;
            const rect = container ? container.getBoundingClientRect() : { top: 0 };
            return (draggingHandlePos.y - rect.top - pan.y) / zoom;
          })(),
          progress: 1,
          pointerEvents: 'none' // Custom property for HandleLayer
        }
      ]
    : handles;

  function handleClick(e) {
    // Clear selection if clicking on background
    if (e.target === e.currentTarget) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
    // Trigger background click handler if provided
    if (e.target === e.currentTarget && typeof onBackgroundClick === 'function') {
      onBackgroundClick();
    }
  }

  function handleBackgroundClick(e) {
    if (e.target === e.currentTarget && typeof onBackgroundClick === 'function') {
      onBackgroundClick();
    }
  }

  function handleNodeClick(id, e) {
    if (onNodeClick) onNodeClick(id);
    if (e) {
      e.stopPropagation();
    }
  }

  function handleAnyClick(e, nodeId = null) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let selectedNode = null;
    if (nodeId) {
      selectedNode = nodes.find(n => n.id === nodeId);
    } else if (selectedNodeId) {
      selectedNode = nodes.find(n => n.id === selectedNodeId);
    }
    if (selectedNode) {
      console.log('Selected node:', selectedNode);
      console.log('Node position:', selectedNode.position);
      console.log('Node size:', { width: selectedNode.width, height: selectedNode.height });
      const rect = e.currentTarget.parentElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      console.log('Mouse coordinates:', { x: mouseX, y: mouseY });
    } else {
      console.log('No node selected');
    }
    console.log('Mouse coordinates:', { x: mouseX, y: mouseY });
  }

  // Track mouse for distinguishing click vs drag (background only)
  const mouseDownPosRef = useRef(null);

  function handleBackgroundMouseDown(e) {
    if (e.button !== 0) return; // Only left mouse
    if (e.target !== e.currentTarget) return; // Only background
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleBackgroundMouseUp(e) {
    if (e.button !== 0) return;
    if (e.target !== e.currentTarget) return; // Only background
    if (!mouseDownPosRef.current) return;
    const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
    const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
    const moved = dx > 5 || dy > 5;
    if (!moved) {
      // Treat as click
      if (typeof onBackgroundClick === 'function') onBackgroundClick();
    }
    mouseDownPosRef.current = null;
  }

  // Background click handler for PanZoomLayer
  function handleBackgroundClickFromPanZoom(e) {
    if (typeof onBackgroundClick === 'function') onBackgroundClick(e);
    setSelectedNodeId(null);
    setSelectedEdgeId && setSelectedEdgeId(null);
    const rect = e.target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // console.log('No node selected');
    // console.log('Mouse coordinates:', { x: mouseX, y: mouseY });
  }

  return (
    <div
      style={{ width: '100vw', height: '100vh', position: 'absolute', left: 0, top: 0, pointerEvents: 'auto' }}
    >
      <PanZoomLayer pan={pan} zoom={zoom} onPanZoom={setPan} onBackgroundClick={handleBackgroundClickFromPanZoom} />
      <EdgeLayer edges={edges} onEdgeEvent={setHoveredEdge} />
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          background: theme.palette.background.paper,
          cursor: hoveredEdgeId ? 'pointer' : (isPanning.current ? 'grabbing' : 'grab'),
          pointerEvents: 'none'
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onMouseMove={handleCanvasMouseMove}
        onClick={handleCanvasClick}
      />
      <HandleLayer
        handles={displayHandles}
        pan={pan}
        zoom={zoom}
        onHandleEvent={handle => {
          setIsHandleHovered(!!handle);
          if (handle) setHoveredNodeId(handle.nodeId);
        }}
        onHandleDragStart={onHandleDragStart}
        isDraggingHandle={!!draggingHandle}
      />
      <NodeLayer
        nodes={nodeList}
        pan={pan}
        zoom={zoom}
        selectedNodeId={selectedNodeId}
        draggingNodeId={draggingNodeId}
        onNodeEvent={(id, e) => {
          if (onNodeClick) onNodeClick(id);
          if (e) {
            e.stopPropagation();
            const node = nodes.find(n => n.id === id);
            if (node) {
              // console.log('Selected node:', node);
              // console.log('Node position:', node.position);
              // console.log('Node size:', { width: node.width, height: node.height });
              // const rect = e.currentTarget.parentElement.getBoundingClientRect();
              // const mouseX = e.clientX - rect.left;
              // const mouseY = e.clientY - rect.top;
              //console.log('Mouse coordinates:', { x: mouseX, y: mouseY });
            }
          }
        }}
        onNodeDragStart={onNodeDragStart}
      />
      <EdgeHandles
        nodeList={nodeList.map(node => ({ ...node, handleProgress: handleProgressMap[node.id] || 0 }))}
        edges={edges}
        pan={pan}
        theme={theme}
        zoom={zoom}
      />
      {/* Preview edge during handle drag */}
      {draggingHandle && draggingHandlePos && (
        (() => {
          const container = canvasRef.current?.parentElement;
          const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
          const mouseX = draggingHandlePos.x - rect.left;
          const mouseY = draggingHandlePos.y - rect.top;
          const node = nodeList.find(n => n.id === draggingHandle.nodeId);
          const startX = node ? node.position.x * zoom + pan.x : draggingHandle.x * zoom + pan.x;
          const startY = node ? node.position.y * zoom + pan.y : draggingHandle.y * zoom + pan.y;
          return (
            <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100vw', height: '100vh' }}>
              <line
                x1={startX}
                y1={startY}
                x2={mouseX}
                y2={mouseY}
                stroke={theme.palette.primary.main}
                strokeWidth={2}
                strokeDasharray="6,4"
              />
            </svg>
          );
        })()
      )}
    </div>
  );
}
