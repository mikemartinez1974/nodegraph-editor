"use client";

import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';

const handleRadius = 8;

function getHandlePositions(node) {
  const x = node.position?.x ?? node.x ?? 0;
  const y = node.position?.y ?? node.y ?? 0;
  const width = node.width || 60;
  const height = node.height || 60;
  const handleExtension = 20;
  // Position handle at lower right
  return [{
    id: `${node.id}-new-link`,
    nodeId: node.id,
    type: 'new-link',
    position: {
      x: x + width / 2 + handleExtension,
      y: y + height / 2 + handleExtension
    },
    color: '#1976d2'
  }];
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
  const [hoveredHandle, setHoveredHandle] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [previewLine, setPreviewLine] = useState(null);
  const animationFrameRef = useRef(null);

  useImperativeHandle(ref, () => ({
    redraw: () => {
      scheduleRender();
    },
    hitTest: (clientX, clientY) => {
      return findHandleAt(clientX, clientY);
    }
  }));

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

  const getHandlePositionForEdge = useCallback((nodeId, edgeType, direction) => {
    const handleId = `${nodeId}-${edgeType}-${direction}`;
    const pos = handlePositionMap[handleId];
    
    let curveDirection;
    if (edgeType === 'parent' || edgeType === 'child') {
      curveDirection = 'vertical';
    } else if (edgeType === 'peer') {
      curveDirection = 'horizontal';
    }
    
    if (pos) {
      return { x: pos.x, y: pos.y, curveDirection };
    }
    return undefined;
  }, [handlePositionMap]);

  const getCurrentHandles = useCallback(() => {
    const allHandles = [];
    
    nodes.filter(n => n.visible !== false).forEach(node => {
      const handles = getHandlePositions(node);
      
      if (draggingInfoRef?.current?.nodeIds?.includes(node.id)) {
        const offset = draggingInfoRef.current.offset;
        handles.forEach(h => {
          h.position.x += offset.x;
          h.position.y += offset.y;
        });
      }
      
      allHandles.push(...handles);
    });
    
    return allHandles;
  }, [nodes, draggingInfoRef]);

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
      
      const isHovered = hoveredHandle?.id === handle.id;
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
  }, [getCurrentHandles, pan, zoom, hoveredHandle, draggingHandle, previewLine]);

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
      scheduleRender();
      return;
    }
    
    const handle = findHandleAt(e.clientX, e.clientY);
    if (handle !== hoveredHandle) {
      setHoveredHandle(handle);
      scheduleRender();
    }
  }, [draggingHandle, findHandleAt, hoveredHandle, scheduleRender]);

  const handleMouseUp = useCallback((e) => {
    if (!draggingHandle) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const graphX = (e.clientX - rect.left - pan.x) / zoom;
    const graphY = (e.clientY - rect.top - pan.y) / zoom;
    
    const targetNode = nodes.find(node => {
      if (node.id === draggingHandle.nodeId) return false;
      
      const nodeX = node.position?.x ?? node.x ?? 0;
      const nodeY = node.position?.y ?? node.y ?? 0;
      const nodeWidth = node.width || 60;
      const nodeHeight = node.height || 60;
      
      return (
        graphX >= nodeX - nodeWidth / 2 && 
        graphX <= nodeX + nodeWidth / 2 && 
        graphY >= nodeY - nodeHeight / 2 && 
        graphY <= nodeY + nodeHeight / 2
      );
    });
    
    const dropEvent = {
      graph: { x: graphX, y: graphY },
      screen: { x: e.clientX, y: e.clientY },
      sourceNode: draggingHandle.nodeId,
      targetNode: targetNode?.id || null,
      edgeType: draggingHandle.edgeType,
      direction: draggingHandle.direction
    };
    
    eventBus.emit('handleDrop', dropEvent);
    eventBus.emit('handleDragEnd', { handle: draggingHandle });
    
    setDraggingHandle(null);
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
    scheduleRender();
  }, [nodes, edges, pan, zoom, scheduleRender]);

  useEffect(() => {
    if (!draggingHandle) return;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, handleMouseMove, handleMouseUp]);

  return (
    <HandlePositionContext.Provider value={{ getHandlePosition, getHandlePositionForEdge }}>
      {/* Canvas for drawing handles - no pointer events */}
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
      
      {/* Render clickable areas ONLY where handles are */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 26
      }}>
        {getCurrentHandles().map(handle => {
          const screenX = handle.position.x * zoom + pan.x;
          const screenY = handle.position.y * zoom + pan.y;
          const hitRadius = handleRadius * 2;
          
          return (
            <div
              key={handle.id}
              style={{
                position: 'absolute',
                left: screenX - hitRadius,
                top: screenY - hitRadius,
                width: hitRadius * 2,
                height: hitRadius * 2,
                pointerEvents: 'auto', // Only THIS div captures events
                cursor: 'pointer',
                borderRadius: '50%',
              }}
              onMouseDown={handleMouseDown}
              onMouseEnter={() => {
                setHoveredHandle(handle);
                scheduleRender();
              }}
              onMouseLeave={() => {
                if (!draggingHandle) {
                  setHoveredHandle(null);
                  scheduleRender();
                }
              }}
            />
          );
        })}
      </div>
    </HandlePositionContext.Provider>
  );
});

export default HandleLayer;