"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';

const handleOffset = 15;
const handleSpacing = 30;
const handleRadius = 6;

function getHandlePositions(node, edgeTypes, draggingInfoRef) {
  const handles = [];
  const visibleEdgeTypes = Object.keys(edgeTypes);
  const x = node.position ? node.position.x : node.x;
  const y = node.position ? node.position.y : node.y;
  const width = node.width || 60;
  const height = node.height || 60;

  // Apply dragging offset if applicable
  let adjustedX = x;
  let adjustedY = y;
  if (draggingInfoRef.current && draggingInfoRef.current.nodeIds && draggingInfoRef.current.nodeIds.includes(node.id)) {
    adjustedX += draggingInfoRef.current.offset.x;
    adjustedY += draggingInfoRef.current.offset.y;
  }

  visibleEdgeTypes.forEach((type, i) => {
    if (type === 'child' || type === 'parent') {
      // Target handle (top)
      handles.push({
        id: `${node.id}-${type}-target`,
        nodeId: node.id,
        edgeType: type,
        direction: 'target',
        position: {
          x: adjustedX,
          y: adjustedY - height / 2
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
      // Source handle (bottom)
      handles.push({
        id: `${node.id}-${type}-source`,
        nodeId: node.id,
        edgeType: type,
        direction: 'source',
        position: {
          x: adjustedX,
          y: adjustedY + height / 2
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
    } else if (type === 'peer') {
      // Target handle (left)
      handles.push({
        id: `${node.id}-${type}-target`,
        nodeId: node.id,
        edgeType: type,
        direction: 'target',
        position: {
          x: adjustedX - width / 2,
          y: adjustedY
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
      // Source handle (right)
      handles.push({
        id: `${node.id}-${type}-source`,
        nodeId: node.id,
        edgeType: type,
        direction: 'source',
        position: {
          x: adjustedX + width / 2,
          y: adjustedY
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
    } else {
      // Default: left/right
      handles.push({
        id: `${node.id}-${type}-target`,
        nodeId: node.id,
        edgeType: type,
        direction: 'target',
        position: {
          x: adjustedX - width / 2,
          y: adjustedY - ((visibleEdgeTypes.length - 1) * handleSpacing) / 2 + i * handleSpacing
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
      handles.push({
        id: `${node.id}-${type}-source`,
        nodeId: node.id,
        edgeType: type,
        direction: 'source',
        position: {
          x: adjustedX + width / 2,
          y: adjustedY - ((visibleEdgeTypes.length - 1) * handleSpacing) / 2 + i * handleSpacing
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
    }
  });
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
  draggingInfoRef 
}, ref) => {
  const draggingHandleRef = useRef(null);
  const hoveredHandleRef = useRef(null);
  const previewLineRef = useRef({ visible: false });
  const animationFrameRef = useRef(null);
  const sensorRef = useRef(null);
  const [sensorActive, setSensorActive] = useState(false);

  // Expose redraw method via imperative handle
  useImperativeHandle(ref, () => ({
    redraw: () => {
      scheduleRender();
    }
  }));

  // Calculate handle position map for context (without dragging offsets)
  const handlePositionMap = useMemo(() => {
    const handleMap = {};
    nodes.filter(n => n.visible !== false).forEach(node => {
      const handles = getHandlePositions(node, edgeTypes, { current: null }); // Static positions for context
      handles.forEach(h => {
        handleMap[h.id] = h.position;
      });
    });
    return handleMap;
  }, [nodes, edgeTypes]);

  // Context functions
  const getHandlePosition = useCallback(handleId => handlePositionMap[handleId], [handlePositionMap]);

  const getHandlePositionForEdge = useCallback((nodeId, edgeType, direction) => {
    const nodeStr = String(nodeId).trim();
    const typeStr = String(edgeType).trim();
    const dirStr = String(direction).trim();
    const handleId = `${nodeStr}-${typeStr}-${dirStr}`;
    const pos = handlePositionMap[handleId];
    let curveDirection;
    if (typeStr === 'parent' || typeStr === 'child') {
      curveDirection = 'vertical';
    } else if (typeStr === 'peer') {
      curveDirection = 'horizontal';
    }
    if (pos) {
      return { x: pos.x, y: pos.y, curveDirection };
    }
    return undefined;
  }, [handlePositionMap]);

  // Find handle at screen coordinates
  const findHandleAt = useCallback((clientX, clientY) => {
    if (!canvasRef.current) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    // Compute handle positions dynamically for hit detection
    const handlePositions = nodes.filter(n => n.visible !== false).flatMap(node => 
      getHandlePositions(node, edgeTypes, draggingInfoRef)
    );

    for (const handle of handlePositions) {
      const screenX = handle.position.x * zoom + pan.x;
      const screenY = handle.position.y * zoom + pan.y;
      
      const distance = Math.sqrt(
        Math.pow(canvasX - screenX, 2) + 
        Math.pow(canvasY - screenY, 2)
      );
      
      if (distance <= handleRadius + 2) {
        return handle;
      }
    }
    
    return null;
  }, [nodes, edgeTypes, pan, zoom, draggingInfoRef]);

  // Canvas drawing function
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Compute handle positions dynamically for drawing
    const handlePositions = nodes.filter(n => n.visible !== false).flatMap(node => 
      getHandlePositions(node, edgeTypes, draggingInfoRef)
    );

    // Draw handles
    handlePositions.forEach(handle => {
      const screenX = handle.position.x * zoom + pan.x;
      const screenY = handle.position.y * zoom + pan.y;
      
      // Skip if outside visible area (performance optimization)
      if (screenX < -handleRadius || screenX > canvas.width + handleRadius || 
          screenY < -handleRadius || screenY > canvas.height + handleRadius) {
        return;
      }
      
      const isHovered = hoveredHandleRef.current?.id === handle.id;
      const radius = isHovered ? handleRadius * 1.2 : handleRadius;
      
      // Drop shadow
      if (isHovered) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
      }
      
      // Handle circle
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = handle.color;
      ctx.fill();
      
      // Border
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();
      
      if (isHovered) {
        ctx.restore();
      }
    });
    
    // Draw preview line if dragging
    if (previewLineRef.current.visible && draggingHandleRef.current) {
      const preview = previewLineRef.current;
      const startX = draggingHandleRef.current.position.x * zoom + pan.x;
      const startY = draggingHandleRef.current.position.y * zoom + pan.y;
      
      // Dashed line
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = draggingHandleRef.current.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(preview.endX, preview.endY);
      ctx.stroke();
      
      // End circle
      ctx.beginPath();
      ctx.arc(preview.endX, preview.endY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = draggingHandleRef.current.color;
      ctx.fill();
      
      ctx.restore();
    }
  }, [nodes, edgeTypes, pan, zoom, draggingInfoRef]);

  // Optimized render loop
  const scheduleRender = useCallback(() => {
    if (animationFrameRef.current) return;
    
    animationFrameRef.current = requestAnimationFrame(() => {
      drawCanvas();
      animationFrameRef.current = null;
    });
  }, [drawCanvas]);

  // Event handlers for sensor layer
  const handleSensorMouseDown = useCallback((e) => {
    const handle = findHandleAt(e.clientX, e.clientY);
    
    // Only block events if we actually hit a handle
    if (!handle) {
      // No handle hit - let event fall through to EdgeLayer
      return;
    }
    
    // We hit a handle - block the event and start drag
    e.stopPropagation();
    e.preventDefault();
    
    draggingHandleRef.current = handle;
    previewLineRef.current = {
      visible: true,
      endX: handle.position.x * zoom + pan.x,
      endY: handle.position.y * zoom + pan.y
    };
    
    setSensorActive(true);
    
    const handleGlobalMouseMove = (e) => {
      if (!draggingHandleRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      previewLineRef.current.endX = e.clientX - rect.left;
      previewLineRef.current.endY = e.clientY - rect.top;
      scheduleRender();
    };
    
    const handleGlobalMouseUp = (e) => {
      if (!draggingHandleRef.current) return;
      
      const handle = draggingHandleRef.current;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const graphX = (e.clientX - rect.left - pan.x) / zoom;
      const graphY = (e.clientY - rect.top - pan.y) / zoom;
      
      const targetNode = nodes.find(node => {
        if (node.id === handle.nodeId) return false;
        
        const nodeX = node.position?.x || node.x;
        const nodeY = node.position?.y || node.y;
        const nodeWidth = node.width || 60;
        const nodeHeight = node.height || 60;
        
        const nodeLeft = nodeX - nodeWidth / 2;
        const nodeRight = nodeX + nodeWidth / 2;
        const nodeTop = nodeY - nodeHeight / 2;
        const nodeBottom = nodeY + nodeHeight / 2;
        
        const isInside = (
          graphX >= nodeLeft && 
          graphX <= nodeRight && 
          graphY >= nodeTop && 
          graphY <= nodeBottom
        );
        
        return isInside;
      });
      
      const dropEvent = {
        graph: { x: graphX, y: graphY },
        screen: { x: e.clientX, y: e.clientY },
        sourceNode: handle.nodeId,
        targetNode: targetNode?.id || null,
        edgeType: handle.edgeType,
        direction: handle.direction
      };
      
      eventBus.emit('handleDrop', dropEvent);
      
      document.removeEventListener('mousemove', handleGlobalMouseMove, true);
      document.removeEventListener('mouseup', handleGlobalMouseUp, true);
      draggingHandleRef.current = null;
      previewLineRef.current.visible = false;
      setSensorActive(false);
      scheduleRender();
      eventBus.emit('handleDragEnd', { handle });
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove, true);
    document.addEventListener('mouseup', handleGlobalMouseUp, true);
    
    scheduleRender();
    eventBus.emit('handleDragStart', { handle });
  }, [findHandleAt, scheduleRender, pan, zoom, nodes]);

  const handleSensorMouseMove = useCallback((e) => {
    // If dragging, update preview line and block events
    if (draggingHandleRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      previewLineRef.current.endX = e.clientX - rect.left;
      previewLineRef.current.endY = e.clientY - rect.top;
      
      scheduleRender();
      e.stopPropagation(); // Block during drag
      return;
    }
    
    const handle = findHandleAt(e.clientX, e.clientY);
    
    if (hoveredHandleRef.current !== handle) {
      if (hoveredHandleRef.current) {
        eventBus.emit('handleUnhover', { 
          nodeId: hoveredHandleRef.current.nodeId, 
          handleId: hoveredHandleRef.current.id 
        });
      }
      
      hoveredHandleRef.current = handle;
      
      if (handle) {
        eventBus.emit('handleHover', { nodeId: handle.nodeId, handleId: handle.id });
        if (sensorRef.current) {
          sensorRef.current.style.cursor = 'pointer';
        }
        // Block events when hovering a handle
        e.stopPropagation();
      } else {
        if (sensorRef.current) {
          sensorRef.current.style.cursor = 'default';
        }
        // No handle hover - deactivate sensor and let event fall through
        setSensorActive(false);
      }
      
      scheduleRender();
    } else if (handle) {
      // Still hovering same handle - block events
      e.stopPropagation();
    } else {
      // No handle - make sure sensor is off
      setSensorActive(false);
    }
  }, [findHandleAt, scheduleRender]);

  // Listen for node proximity to activate sensor
  useEffect(() => {
    let proximityTimeout;
    
    const handleNodeProximity = () => {
      setSensorActive(true);
      clearTimeout(proximityTimeout);
      proximityTimeout = setTimeout(() => {
        if (!draggingHandleRef.current && !hoveredHandleRef.current) {
          setSensorActive(false);
        }
      }, 100);
    };
    
    eventBus.on('nodeProximity', handleNodeProximity);
    
    return () => {
      eventBus.off('nodeProximity', handleNodeProximity);
      clearTimeout(proximityTimeout);
    };
  }, []);

  // Canvas setup and resize handling
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        scheduleRender();
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [scheduleRender]);

  // Redraw when nodes, edges, pan, or zoom change
  useEffect(() => {
    scheduleRender();
  }, [nodes, edges, pan, zoom, scheduleRender]);

  return (
    <HandlePositionContext.Provider value={{ getHandlePosition, getHandlePositionForEdge }}>
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          pointerEvents: 'none', 
          zIndex: 20
        }}
        onWheel={(e) => {
          // Explicitly allow wheel events to pass through
          // Don't call stopPropagation or preventDefault
        }}
      >
        {/* Visual canvas - no pointer events */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            cursor: 'default'
          }}
        />
        
        {/* Context-aware sensor - only active when near nodes */}
        <div
          ref={sensorRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: sensorActive ? 'auto' : 'none', // Only block when near nodes
            cursor: 'default',
            background: 'transparent'
          }}
          onMouseDown={handleSensorMouseDown}
          onMouseMove={handleSensorMouseMove}
          onMouseLeave={() => {
            // Deactivate sensor when mouse leaves
            if (!draggingHandleRef.current) {
              setSensorActive(false);
              hoveredHandleRef.current = null;
            }
          }}
        />
      </div>
      {children}
    </HandlePositionContext.Provider>
  );
});

export default HandleLayer;