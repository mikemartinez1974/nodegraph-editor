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
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  // Add state for draggingHandlePos
  const [draggingHandlePos, setDraggingHandlePos] = useState(null);
  // Add isNodeHovered state
  const [isNodeHovered, setIsNodeHovered] = useState(false);

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
    // Always use nodes and edges from props for rendering
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    edges.forEach(edge => {
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
      // Always animate handleProgress for all nodes when hovered
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

  // Pass handleProgress to HandleLayer for all nodes
  const nodesWithProgress = nodeList.map(node => ({ ...node, handleProgress: handleProgressMap[node.id] || 0 }));

  function handleBackgroundClickFromPanZoom(e) {
    if (typeof onBackgroundClick === 'function') onBackgroundClick(e);
    setSelectedNodeId(null);
    setSelectedEdgeId && setSelectedEdgeId(null);
  }

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

  function handleDrop(data) {
    console.log('NodeGraph.js: handleDrop entered', data);
    console.log('Drop handle event fired successfully in NodeGraph.js');
    // ...existing code...
  }

  return (
    <div
      style={{ width: '100vw', height: '100vh', position: 'absolute', left: 0, top: 0, pointerEvents: 'auto' }}
    >
      <PanZoomLayer pan={pan} zoom={zoom} onPanZoom={setPan} onBackgroundClick={handleBackgroundClickFromPanZoom} />
      <EdgeLayer edges={edges} onEdgeEvent={setHoveredEdgeId} />
      
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          background: theme.palette.background.paper,
          cursor: 'default',
          pointerEvents: 'none'
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onMouseMove={handleCanvasMouseMove}
        onClick={handleCanvasClick}
      />

      <HandleLayer
        nodes={nodesWithProgress}
        edges={edges}
        pan={pan}
        zoom={zoom}
        theme={theme}
        onHandleEvent={handle => {
          setIsHandleHovered(!!handle);
          if (handle) {
            setHoveredNodeId(handle.nodeId);
            // Cancel retraction timer when hovering a handle
            if (hoverTimeoutRef.current[handle.nodeId]) {
              clearTimeout(hoverTimeoutRef.current[handle.nodeId]);
              hoverTimeoutRef.current[handle.nodeId] = null;
            }
          }
        }}
        onHandleDragStart={onHandleDragStart}
        isDraggingHandle={!!draggingHandle}
        onHandleDragEnd={(e, handle) => {
          //console.log('NodeGraph.js: handle drop event fired', handle);
          //console.log(e);
          const mouseX = e.clientX;
          const mouseY = e.clientY;
          const nodeUnderMouse = nodeList.find(node => {
            const { x, y } = node.position;
            const width = node.width || 60;
            const height = node.height || 60;
            const screenX = x * zoom + pan.x;
            const screenY = y * zoom + pan.y;
            return mouseX >= screenX && mouseX <= screenX + width && mouseY >= screenY && mouseY <= screenY + height;
          });
          eventBus.emit('handleDrop', {
            nodeId: handle?.nodeId,
            edgeId: handle?.edgeId,
            edgeType: handle?.edgeType,
            event: e,
            mouse: { x: mouseX, y: mouseY },
            nodeUnderMouse
          });
          // console.log('Drop handle event fired successfully in NodeGraph.js');
          // console.log('Mouse position:', { x: mouseX, y: mouseY });
          // console.log('Node under mouse:', nodeUnderMouse);
          setHoveredNodeId(null);
          handleNodeMouseLeave({ id: handle?.nodeId });
          setDraggingHandle(null);
          setDraggingHandlePos(null);
        }}
      />

      <NodeLayer
        nodes={nodeList}
        pan={pan}
        zoom={zoom}
        selectedNodeId={selectedNodeId}
        draggingNodeId={draggingNodeId}
        onNodeEvent={(id, e) => {
          if (onNodeClick) onNodeClick(id);
          // Pass click to handles if extended
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
                if (typeof window !== 'undefined') {
                  // You may want to trigger a custom event or callback here
                  // For now, just log
                  //console.log('Node click passed to handle:', { nodeId: id, edgeId: edge.id, handlePos });
                }
              }
            });
          }
          if (e) {
            e.stopPropagation();
            const node = nodes.find(n => n.id === id);
            if (node) {
              console.log('Selected node:', node);
              console.log('Node position:', node.position);
              console.log('Node size:', { width: node.width, height: node.height });
              const rect = e.currentTarget.parentElement.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;
              console.log('Mouse coordinates:', { x: mouseX, y: mouseY });
            }
          }
        }}
        onNodeDragStart={onNodeDragStart}
      />

      {/* Preview edge during handle drag */}
      console.log('Preview line condition:', [ draggingHandle, draggingHandlePos ]);
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
          // Debug statements
          // console.log('Preview line debug:', {
          //   nodeId: draggingHandle.nodeId,
          //   nodePos: node ? node.position : null,
          //   start: { x: startX, y: startY },
          //   mouse: { x: mouseX, y: mouseY },
          //   pan, zoom,
          //   rect,
          //   draggingHandlePos
          // });
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
    </div>
  );
}

