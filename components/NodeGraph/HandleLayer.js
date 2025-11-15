"use client";

import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';
import { getEdgeHandlePosition } from './utils';

const handleRadius = 8;
const handleExtension = 12; // was 20, now closer to node
const nodeHoverMargin = 24; // px, for easier node hover

// --- NEW: Get handles from node schema ---
function getHandlePositions(node) {
  const x = node.position?.x ?? node.x ?? 0;
  const y = node.position?.y ?? node.y ?? 0;
  const width = node.width || 60;
  const height = node.height || 60;
  const handles = [];
  // Inputs (left)
  if (Array.isArray(node.inputs)) {
    node.inputs.forEach((h, i) => {
      handles.push({
        id: `${node.id}-${h.key}`,
        nodeId: node.id,
        type: 'input',
        direction: 'target',
        key: h.key,
        label: h.label,
        handleType: h.type,
        position: {
          x: x - width / 2 - handleExtension,
          y: y - height / 2 + ((i + 1) / (node.inputs.length + 1)) * height
        },
        color: '#0288d1',
      });
    });
  }
  // Outputs (right)
  if (Array.isArray(node.outputs)) {
    node.outputs.forEach((h, i) => {
      handles.push({
        id: `${node.id}-${h.key}`,
        nodeId: node.id,
        type: 'output',
        direction: 'source',
        key: h.key,
        label: h.label,
        handleType: h.type,
        position: {
          x: x + width / 2 + handleExtension,
          y: y - height / 2 + ((i + 1) / (node.outputs.length + 1)) * height
        },
        color: '#43a047',
      });
    });
  }
  return handles;
}

const HandleLayer = forwardRef(({ 
  canvasRef,
  nodes = [], 
  edges = [], 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  edgeTypes = {}, 
  children,
  draggingInfoRef,
}, ref) => {
  const [hoveredHandleId, setHoveredHandleId] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [previewLine, setPreviewLine] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [dragTargetNodeId, setDragTargetNodeId] = useState(null);
  const animationFrameRef = useRef(null);
  const handleHoverRef = useRef(false);
  const blurTimeoutRef = useRef();

  useImperativeHandle(ref, () => ({
    redraw: () => {
      scheduleRender();
    },
    hitTest: (clientX, clientY) => {
      return findHandleAt(clientX, clientY);
    }
  }));

  // Listen to node hover events from event bus (single listener)
  useEffect(() => {
    const handleNodeHover = ({ id }) => {
      setHoveredNodeId(id);
    };

    const handleNodeUnhover = () => {
      // Only clear node hover if not hovering handle
      blurTimeoutRef.current = setTimeout(() => {
        if (!draggingHandle && !handleHoverRef.current) {
          setHoveredNodeId(null);
        }
      }, 30);
    };

    eventBus.on('nodeHover', handleNodeHover);
    eventBus.on('nodeUnhover', handleNodeUnhover);

    return () => {
      eventBus.off('nodeHover', handleNodeHover);
      eventBus.off('nodeUnhover', handleNodeUnhover);
      clearTimeout(blurTimeoutRef.current);
    };
  }, [draggingHandle]);

  const handlePositionMap = React.useMemo(() => {
    const map = {};
    nodes.filter(n => n.visible !== false).forEach(node => {
      const handles = getHandlePositions(node);
      handles.forEach(h => {
        map[h.id] = h.position;
      });
    });
    return map;
  }, [nodes]);

  const getHandlePosition = useCallback(handleId => handlePositionMap[handleId], [handlePositionMap]);

  const getNodeEdgeIntersection = (node, x, y) => {
    const nodeX = node.position?.x ?? node.x ?? 0;
    const nodeY = node.position?.y ?? node.y ?? 0;
    const nodeWidth = node.width || 60;
    const nodeHeight = node.height || 60;
    
    const halfWidth = nodeWidth / 2;
    const halfHeight = nodeHeight / 2;
    
    // Check which edge is closer to the point (x, y)
    const distances = {
      left: Math.abs(x - (nodeX - halfWidth)),
      right: Math.abs(x - (nodeX + halfWidth)),
      top: Math.abs(y - (nodeY - halfHeight)),
      bottom: Math.abs(y - (nodeY + halfHeight))
    };
    
    const minEdge = Object.keys(distances).reduce((a, b) => distances[a] < distances[b] ? a : b);
    
    switch (minEdge) {
      case 'left':
        return { x: nodeX - halfWidth, y: nodeY };
      case 'right':
        return { x: nodeX + halfWidth, y: nodeY };
      case 'top':
        return { x: nodeX, y: nodeY - halfHeight };
      case 'bottom':
        return { x: nodeX, y: nodeY + halfHeight };
      default:
        return { x: nodeX, y: nodeY };
    }
  };

  const getHandlePositionForEdge = useCallback((sourceId, targetId, direction) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);
    if (sourceNode && targetNode) {
      if (direction === 'source') {
        return getNodeEdgeIntersection(sourceNode, targetNode.position?.x ?? targetNode.x ?? 0, targetNode.position?.y ?? targetNode.y ?? 0);
      } else {
        return getNodeEdgeIntersection(targetNode, sourceNode.position?.x ?? sourceNode.x ?? 0, sourceNode.position?.y ?? sourceNode.y ?? 0);
      }
    }
    // Fallback: if only one node exists, use its center
    if (sourceNode && !targetNode) {
      return { x: sourceNode.position?.x ?? sourceNode.x ?? 0, y: sourceNode.position?.y ?? sourceNode.y ?? 0 };
    }
    if (!sourceNode && targetNode) {
      return { x: targetNode.position?.x ?? targetNode.x ?? 0, y: targetNode.position?.y ?? targetNode.y ?? 0 };
    }
    // If neither node exists, fallback to origin
    return { x: 0, y: 0 };
  }, [nodes]);

  // --- NEW: getCurrentHandles uses schema handles ---
  const getCurrentHandles = useCallback(() => {
    const allHandles = [];
    // Only show handles for the hovered node (or dragging node)
    const targetNodeId = draggingHandle
      ? (dragTargetNodeId || hoveredNodeId || draggingHandle.nodeId)
      : hoveredNodeId;
    if (!targetNodeId) return allHandles;
    const targetNode = nodes.find(n => n.id === targetNodeId && n.visible !== false);
    if (!targetNode) return allHandles;
    // If not dragging, check if mouse is within margin of node bounds
    if (!draggingHandle && hoveredNodeId === targetNodeId && window.__NG_LAST_MOUSE) {
      const { x, y } = window.__NG_LAST_MOUSE;
      const nodeX = targetNode.position?.x ?? targetNode.x ?? 0;
      const nodeY = targetNode.position?.y ?? targetNode.y ?? 0;
      const width = targetNode.width || 60;
      const height = targetNode.height || 60;
      const left = nodeX - width / 2 - nodeHoverMargin;
      const right = nodeX + width / 2 + nodeHoverMargin;
      const top = nodeY - height / 2 - nodeHoverMargin;
      const bottom = nodeY + height / 2 + nodeHoverMargin;
      // Convert screen to graph coords
      const graphX = (x - pan.x) / zoom;
      const graphY = (y - pan.y) / zoom;
      if (graphX < left || graphX > right || graphY < top || graphY > bottom) {
        return allHandles;
      }
    }
    // Use schema handles
    const handles = getHandlePositions(targetNode);
    if (draggingInfoRef?.current?.nodeIds?.includes(targetNode.id)) {
      const offset = draggingInfoRef.current.offset;
      handles.forEach(h => {
        h.position.x += offset.x;
        h.position.y += offset.y;
      });
    }
    allHandles.push(...handles);
    return allHandles;
  }, [nodes, draggingInfoRef, hoveredNodeId, draggingHandle, dragTargetNodeId, pan, zoom]);

  // Track last mouse position globally for node hover margin
  useEffect(() => {
    const update = e => {
      window.__NG_LAST_MOUSE = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', update);
    return () => window.removeEventListener('mousemove', update);
  }, []);

  const findHandleAt = useCallback((clientX, clientY) => {
    if (!canvasRef.current) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    const handles = getCurrentHandles();
    
    for (const handle of handles) {
      const screenX = handle.position.x * zoom + pan.x;
      const screenY = handle.position.y * zoom + pan.y;
      
      const distance = Math.sqrt(
        Math.pow(canvasX - screenX, 2) + 
        Math.pow(canvasY - screenY, 2)
      );
      
      if (distance <= handleRadius * 1.5) {
        return handle;
      }
    }
    
    return null;
  }, [getCurrentHandles, pan, zoom]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const handles = getCurrentHandles();

    handles.forEach(handle => {
      const screenX = handle.position.x * zoom + pan.x;
      const screenY = handle.position.y * zoom + pan.y;
      
      if (screenX < -handleRadius || screenX > canvas.width + handleRadius || 
          screenY < -handleRadius || screenY > canvas.height + handleRadius) {
        return;
      }
      
      const isHovered = hoveredHandleId === handle.id;
      const isDragging = draggingHandle?.id === handle.id;
      const radius = (isHovered || isDragging) ? handleRadius * 1.3 : handleRadius;
      
      if (isHovered || isDragging) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
      }
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = handle.color;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isHovered || isDragging ? 3 : 2;
      ctx.stroke();
      
      if (isHovered || isDragging) {
        ctx.restore();
      }
    });
    
    if (previewLine && draggingHandle) {
      const startX = draggingHandle.position.x * zoom + pan.x;
      const startY = draggingHandle.position.y * zoom + pan.y;
      
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = draggingHandle.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(previewLine.x, previewLine.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(previewLine.x, previewLine.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = draggingHandle.color;
      ctx.fill();
      
      ctx.restore();
    }
  }, [getCurrentHandles, pan, zoom, hoveredHandleId, draggingHandle, previewLine]);

  const scheduleRender = useCallback(() => {
    if (animationFrameRef.current) return;
    
    animationFrameRef.current = requestAnimationFrame(() => {
      drawCanvas();
      animationFrameRef.current = null;
    });
  }, [drawCanvas]);

  const handleMouseDown = useCallback((e) => {
    const handle = findHandleAt(e.clientX, e.clientY);
    if (!handle) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    setDraggingHandle(handle);
    const rect = canvasRef.current.getBoundingClientRect();
    setPreviewLine({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    eventBus.emit('handleDragStart', { handle });
  }, [findHandleAt]);

  const handleMouseMove = useCallback((e) => {
    if (draggingHandle) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPreviewLine({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      const graphX = (e.clientX - rect.left - pan.x) / zoom;
      const graphY = (e.clientY - rect.top - pan.y) / zoom;
      let hoveredNode = null;
      for (const node of nodes) {
        if (node.visible === false) continue;
        const nodeX = node.position?.x ?? node.x ?? 0;
        const nodeY = node.position?.y ?? node.y ?? 0;
        const width = node.width || 60;
        const height = node.height || 60;
        const extendedX = handleExtension + handleRadius * 2;
        const extendedY = handleRadius * 2;
        const left = nodeX - width / 2 - extendedX;
        const right = nodeX + width / 2 + extendedX;
        const top = nodeY - height / 2 - extendedY;
        const bottom = nodeY + height / 2 + extendedY;
        if (graphX >= left && graphX <= right && graphY >= top && graphY <= bottom) {
          hoveredNode = node;
          break;
        }
      }
      setDragTargetNodeId(hoveredNode?.id || null);
      if (hoveredNode) {
        setHoveredNodeId(hoveredNode.id);
      } else if (dragTargetNodeId) {
        setHoveredNodeId(null);
      }
      scheduleRender();
      return;
    }
    
    // Check for handle hover
    const handle = findHandleAt(e.clientX, e.clientY);
    if (handle !== hoveredHandleId) {
      setHoveredHandleId(handle);
      scheduleRender();
    }
  }, [draggingHandle, hoveredHandleId, canvasRef, findHandleAt, scheduleRender, pan, zoom, nodes, dragTargetNodeId]);

  const handleMouseUp = useCallback((e) => {
    if (!draggingHandle) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const graphX = (e.clientX - rect.left - pan.x) / zoom;
    const graphY = (e.clientY - rect.top - pan.y) / zoom;
    // Find target handle (not just node)
    let targetHandle = null;
    let targetNode = null;
    for (const node of nodes) {
      if (node.id === draggingHandle.nodeId) continue;
      const handles = getHandlePositions(node);
      for (const h of handles) {
        const screenX = h.position.x * zoom + pan.x;
        const screenY = h.position.y * zoom + pan.y;
        const dist = Math.sqrt(Math.pow(e.clientX - rect.left - screenX, 2) + Math.pow(e.clientY - rect.top - screenY, 2));
        if (dist <= handleRadius * 2) {
          targetHandle = h;
          targetNode = node;
          break;
        }
      }
      if (targetHandle) break;
    }
    const dropEvent = {
      graph: { x: graphX, y: graphY },
      screen: { x: e.clientX, y: e.clientY },
      sourceNode: draggingHandle.nodeId,
      targetNode: targetNode?.id || null,
      edgeType: draggingHandle.edgeType,
      direction: draggingHandle.direction,
      handle: draggingHandle,
      targetHandle: targetHandle
    };
    eventBus.emit('handleDrop', dropEvent);
    eventBus.emit('handleDragEnd', { handle: draggingHandle });
    setDraggingHandle(null);
    setDragTargetNodeId(null);
    setPreviewLine(null);
    scheduleRender();
  }, [draggingHandle, nodes, pan, zoom, scheduleRender]);

  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        scheduleRender();
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [scheduleRender]);



  useEffect(() => {
    if (!draggingHandle) return;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, handleMouseMove, handleMouseUp]);

  // Main rendering effect
  useEffect(() => {
    drawCanvas();
  }, [nodes, edges, pan, zoom, hoveredNodeId]); // Ensure hoveredNodeId is in dependencies

  return (
    <HandlePositionContext.Provider value={{ getHandlePosition, getHandlePositionForEdge }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none', // <-- ensure canvas does not block handle events
          zIndex: 25
        }}
      />
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 26 // <-- ensure handle hit areas are above canvas
      }}>
        {getCurrentHandles().map(handle => {
          const screenX = handle.position.x * zoom + pan.x;
          const screenY = handle.position.y * zoom + pan.y;
          const hitRadius = handleRadius * 2;
          const extendedHit = hitRadius + 16;
          return (
            <div
              key={handle.id}
              style={{
                position: 'absolute',
                left: screenX - extendedHit,
                top: screenY - extendedHit,
                width: extendedHit * 2,
                height: extendedHit * 2,
                pointerEvents: 'auto', // <-- ensure hit area receives mouse events
                cursor: 'pointer',
                borderRadius: '50%',
                zIndex: 27 // <-- above canvas and other overlays
              }}
              onMouseDown={handleMouseDown}
              onMouseEnter={() => {
                handleHoverRef.current = true;
                setHoveredHandleId(handle.id);
                scheduleRender();
                clearTimeout(blurTimeoutRef.current);
              }}
              onMouseLeave={() => {
                handleHoverRef.current = false;
                setHoveredHandleId(null);
                scheduleRender();
                // If node is not hovered, clear node hover after delay
                blurTimeoutRef.current = setTimeout(() => {
                  if (!draggingHandle && !handleHoverRef.current) {
                    setHoveredNodeId(null);
                  }
                }, 30);
              }}
            />
          );
        })}
      </div>
    </HandlePositionContext.Provider>
  );
});

export default HandleLayer;

