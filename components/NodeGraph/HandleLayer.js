"use client";

import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';
import { getEdgeHandlePosition } from './utils';

const handleRadius = 8;
const handleExtension = 12; // was 20, now closer to node
const nodeHoverMargin = 24; // px, for easier node hover
const getNodeHandleExtension = (node) => {
  const value = node?.extensions?.layout?.handleExtension;
  return typeof value === 'number' ? value : handleExtension;
};
const SNAP_DISTANCE = 28;

// --- NEW: Get handles from node schema ---
function getHandlePositions(node) {
  const x = node.position?.x ?? node.x ?? 0;
  const y = node.position?.y ?? node.y ?? 0;
  const width = node.width || 60;
  const height = node.height || 60;
  const extension = getNodeHandleExtension(node);
  const handles = [];
  // Inputs (left)
  if (Array.isArray(node.inputs)) {
    node.inputs.forEach((h, i) => {
      handles.push({
        id: `${node.id}-input-${h.key}`,
        nodeId: node.id,
        type: 'input',
        direction: 'target',
        key: h.key,
        label: h.label,
        handleType: h.type,
        position: {
          x: x - width / 2 - extension,
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
        id: `${node.id}-output-${h.key}`,
        nodeId: node.id,
        type: 'output',
        direction: 'source',
        key: h.key,
        label: h.label,
        handleType: h.type,
        position: {
          x: x + width / 2 + extension,
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
  const [snapHandle, setSnapHandle] = useState(null);
  const [handleTooltip, setHandleTooltip] = useState(null);
  const animationFrameRef = useRef(null);
  const handleHoverRef = useRef(false);
  const blurTimeoutRef = useRef();
  const tooltipTimeoutRef = useRef();

  useImperativeHandle(ref, () => ({
    redraw: () => {
      scheduleRender();
    },
    hitTest: (clientX, clientY) => {
      return findHandleAt(clientX, clientY);
    }
  }));

  // Listen to node hover events from event bus (single listener)
  const isPointerInsideNode = useCallback((node) => {
    if (!node) return false;
    const lastMouse = typeof window !== 'undefined' ? window.__NG_LAST_MOUSE : null;
    if (!lastMouse) return false;
    const graphX = (lastMouse.x - pan.x) / zoom;
    const graphY = (lastMouse.y - pan.y) / zoom;
    const nodeX = node.position?.x ?? node.x ?? 0;
    const nodeY = node.position?.y ?? node.y ?? 0;
    const width = node.width || 60;
    const height = node.height || 60;
    const left = nodeX - width / 2;
    const right = nodeX + width / 2;
    const top = nodeY - height / 2;
    const bottom = nodeY + height / 2;
    return graphX >= left && graphX <= right && graphY >= top && graphY <= bottom;
  }, [pan, zoom]);

  useEffect(() => {
    const handleNodeHover = ({ id }) => {
      setHoveredNodeId(id);
    };

    const handleNodeUnhover = () => {
      // Only clear node hover if not hovering handle and pointer actually left the node
      blurTimeoutRef.current = setTimeout(() => {
        if (!draggingHandle && !handleHoverRef.current) {
          const hoveredNode = nodes.find(n => n.id === hoveredNodeId);
          if (hoveredNode && isPointerInsideNode(hoveredNode)) {
            return;
          }
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
  }, [draggingHandle, nodes, hoveredNodeId, isPointerInsideNode]);

  const handlePositionMap = React.useMemo(() => {
    const map = {};
    nodes.filter(n => n.visible !== false).forEach(node => {
      const handles = getHandlePositions(node);
      handles.forEach(h => {
        map[h.id] = h;
      });
    });
    return map;
  }, [nodes]);

  const getHandlePosition = useCallback(handleId => handlePositionMap[handleId]?.position, [handlePositionMap]);
  const getHandleData = useCallback(handleId => handlePositionMap[handleId], [handlePositionMap]);

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

  const getHandleScreenPosition = useCallback((handle) => {
    return {
      x: handle.position.x * zoom + pan.x,
      y: handle.position.y * zoom + pan.y
    };
  }, [pan, zoom]);

  const showTooltipForHandle = useCallback((handle) => {
    if (!handle) return;
    const pos = getHandleScreenPosition(handle);
    clearTimeout(tooltipTimeoutRef.current);
    setHandleTooltip({
      id: handle.id,
      label: handle.label,
      type: handle.handleType,
      x: pos.x,
      y: pos.y,
      side: handle.type
    });
  }, [getHandleScreenPosition]);

  const hideTooltip = useCallback(() => {
    clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => setHandleTooltip(null), 60);
  }, []);

  const handleMouseDown = useCallback((e) => {
    const handle = findHandleAt(e.clientX, e.clientY);
    if (!handle) return;
    
    e.stopPropagation();
    e.preventDefault();
    showTooltipForHandle(handle);
    
    setDraggingHandle(handle);
    const rect = canvasRef.current.getBoundingClientRect();
    setPreviewLine({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    eventBus.emit('handleDragStart', { handle });
  }, [findHandleAt, showTooltipForHandle]);

  const handleMouseMove = useCallback((e) => {
    if (draggingHandle) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const graphX = (canvasX - pan.x) / zoom;
      const graphY = (canvasY - pan.y) / zoom;
      let hoveredNode = null;
      for (const node of nodes) {
        if (node.visible === false) continue;
        const nodeX = node.position?.x ?? node.x ?? 0;
        const nodeY = node.position?.y ?? node.y ?? 0;
        const width = node.width || 60;
        const height = node.height || 60;
        const extension = getNodeHandleExtension(node);
        const extendedX = extension + handleRadius * 2;
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

      let snappedHandle = null;
      if (hoveredNode) {
        const candidateHandles = getHandlePositions(hoveredNode).filter((h) => {
          if (!draggingHandle) return true;
          if (draggingHandle.type === 'output') {
            return h.type === 'input';
          }
          if (draggingHandle.type === 'input') {
            return h.type === 'output';
          }
          return true;
        });
        let bestDist = SNAP_DISTANCE;
        candidateHandles.forEach((handle) => {
          const handleCanvasX = handle.position.x * zoom + pan.x;
          const handleCanvasY = handle.position.y * zoom + pan.y;
          const dist = Math.hypot(handleCanvasX - canvasX, handleCanvasY - canvasY);
          if (dist <= bestDist) {
            bestDist = dist;
            snappedHandle = handle;
          }
        });
      }
      setSnapHandle(snappedHandle);
      if (snappedHandle) {
        setPreviewLine({
          x: snappedHandle.position.x * zoom + pan.x,
          y: snappedHandle.position.y * zoom + pan.y
        });
      } else {
        if (snapHandle) {
          setSnapHandle(null);
        }
        setPreviewLine({
          x: canvasX,
          y: canvasY
        });
      }
      scheduleRender();
      return;
    }
    
    // Check for handle hover
    const handle = findHandleAt(e.clientX, e.clientY);
    const handleId = handle?.id || null;
    if (handleId !== hoveredHandleId) {
      if (handle) {
        showTooltipForHandle(handle);
      } else {
        hideTooltip();
      }
      setHoveredHandleId(handleId);
      scheduleRender();
    }
  }, [draggingHandle, hoveredHandleId, canvasRef, findHandleAt, scheduleRender, pan, zoom, nodes, dragTargetNodeId, showTooltipForHandle, hideTooltip]);

  const handleMouseUp = useCallback((e) => {
    if (!draggingHandle) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const graphX = (e.clientX - rect.left - pan.x) / zoom;
    const graphY = (e.clientY - rect.top - pan.y) / zoom;
    // Find target handle (not just node)
    let targetHandle = snapHandle || null;
    let targetNode = null;
    if (!targetHandle) {
      for (const node of nodes) {
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
    } else {
      targetNode = nodes.find((node) => node.id === targetHandle.nodeId) || null;
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
    if (targetHandle) {
      let validation = { ok: true, message: '' };
      if (draggingHandle.type !== 'output') {
        validation = { ok: false, message: 'Start connections from an output handle.' };
      } else if (targetHandle.type !== 'input') {
        validation = { ok: false, message: 'Connections must end on an input handle.' };
      } else if (draggingHandle.nodeId === targetHandle.nodeId) {
        validation = { ok: false, message: 'Cannot connect a node to itself.' };
      } else if (
        draggingHandle.handleType &&
        targetHandle.handleType &&
        draggingHandle.handleType !== targetHandle.handleType
      ) {
        validation = {
          ok: false,
          message: `Handle types do not match: ${draggingHandle.handleType} → ${targetHandle.handleType}`
        };
      }
      dropEvent.validation = validation;
    }
    eventBus.emit('handleDrop', dropEvent);
    eventBus.emit('handleDragEnd', { handle: draggingHandle });
    setDraggingHandle(null);
    setDragTargetNodeId(null);
    hideTooltip();
    setSnapHandle(null);
    setPreviewLine(null);
    scheduleRender();
  }, [draggingHandle, nodes, pan, zoom, scheduleRender, hideTooltip, snapHandle]);

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

  useEffect(() => {
    return () => clearTimeout(tooltipTimeoutRef.current);
  }, []);

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
          pointerEvents: 'none',
          zIndex: 25
        }}
      />
      {getCurrentHandles().map(handle => {
        const screenX = handle.position.x * zoom + pan.x;
        const screenY = handle.position.y * zoom + pan.y;
        const hitRadius = handleRadius * 2;
        const extendedHit = hitRadius + 16;
        return (
          <div
            key={handle.id}
            style={{
              position: 'fixed',
              left: screenX - extendedHit,
              top: screenY - extendedHit,
              width: extendedHit * 2,
              height: extendedHit * 2,
              pointerEvents: 'auto',
              cursor: 'pointer',
              borderRadius: '50%',
              zIndex: 27
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => {
              handleHoverRef.current = true;
              setHoveredHandleId(handle.id);
              showTooltipForHandle(handle);
              scheduleRender();
              clearTimeout(blurTimeoutRef.current);
            }}
            onMouseLeave={() => {
              handleHoverRef.current = false;
              setHoveredHandleId(null);
              hideTooltip();
              const hoveredNode = nodes.find(n => n.id === handle.nodeId);
              if (hoveredNode && isPointerInsideNode(hoveredNode)) {
                setHoveredNodeId(handle.nodeId);
              }
              scheduleRender();
              blurTimeoutRef.current = setTimeout(() => {
                if (!draggingHandle && !handleHoverRef.current) {
                  const node = nodes.find(n => n.id === handle.nodeId);
                  if (node && isPointerInsideNode(node)) {
                    return;
                  }
                  setHoveredNodeId(null);
                }
              }, 30);
            }}
            title={`${handle.label || 'Handle'} • ${handle.handleType || 'unknown'}`}
          />
        );
      })}
      {handleTooltip && (
        <div
          style={{
            position: 'fixed',
            left: handleTooltip.side === 'output' ? handleTooltip.x + 14 : handleTooltip.x - 14,
            top: handleTooltip.y,
            transform: handleTooltip.side === 'output' ? 'translateY(-50%)' : 'translate(-100%, -50%)',
            background: 'rgba(19, 23, 32, 0.9)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 40,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <div>{handleTooltip.label || 'Handle'}</div>
          <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {handleTooltip.type || 'unknown'}
          </div>
        </div>
      )}
    </HandlePositionContext.Provider>
  );
});

export default HandleLayer;

