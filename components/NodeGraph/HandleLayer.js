// HandleLayer.js - Canvas-based handles for maximum performance
import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';

const handleOffset = 15;
const handleSpacing = 30;
const handleRadius = 6;

function getHandlePositions(node, edgeTypes) {
  const handles = [];
  const visibleEdgeTypes = Object.keys(edgeTypes);
  const x = node.position ? node.position.x : node.x;
  const y = node.position ? node.position.y : node.y;
  const width = node.width || 60;
  const height = node.height || 60;

  visibleEdgeTypes.forEach((type, i) => {
    if (type === 'child' || type === 'parent') {
      // Target handle (top)
      handles.push({
        id: `${node.id}-${type}-target`,
        nodeId: node.id,
        edgeType: type,
        direction: 'target',
        position: {
          x: x,
          y: y - height / 2 - handleOffset
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
          x: x,
          y: y + height / 2 + handleOffset
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
          x: x - width / 2 - handleOffset,
          y: y
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
          x: x + width / 2 + handleOffset,
          y: y
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
          x: x - width / 2 - handleOffset,
          y: y - ((visibleEdgeTypes.length - 1) * handleSpacing) / 2 + i * handleSpacing
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
      handles.push({
        id: `${node.id}-${type}-source`,
        nodeId: node.id,
        edgeType: type,
        direction: 'source',
        position: {
          x: x + width / 2 + handleOffset,
          y: y - ((visibleEdgeTypes.length - 1) * handleSpacing) / 2 + i * handleSpacing
        },
        color: edgeTypes[type].style?.color || '#1976d2'
      });
    }
  });
  return handles;
}

const HandleLayer = ({ 
  nodes = [], 
  edges = [], 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  edgeTypes = {}, 
  children 
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const draggingHandleRef = useRef(null);
  const hoveredHandleRef = useRef(null);
  const previewLineRef = useRef({ visible: false });
  const animationFrameRef = useRef(null);
  
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Calculate handles and position map with pure computation
  const { handlePositions, handlePositionMap } = useMemo(() => {
    const allHandles = [];
    const handleMap = {};
    nodes.filter(n => n.visible !== false).forEach(node => {
      const handles = getHandlePositions(node, edgeTypes);
      handles.forEach(h => {
        handleMap[h.id] = h.position;
      });
      allHandles.push(...handles);
    });
    return { handlePositions: allHandles, handlePositionMap: handleMap };
  }, [nodes, edgeTypes]);

  // Context functions
  const getHandlePosition = useCallback(handleId => handlePositionMap[handleId], [handlePositionMap]);

  const getHandlePositionForEdge = useCallback((nodeId, edgeType, direction) => {
    const nodeStr = String(nodeId).trim();
    const typeStr = String(edgeType).trim();
    const dirStr = String(direction).trim();
    const handleId = `${nodeStr}-${typeStr}-${dirStr}`;
    return handlePositionMap[handleId];
  }, [handlePositionMap]);
  
  getHandlePositionForEdge._handleKeys = Object.keys(handlePositionMap);

  // Find handle at screen coordinates
  const findHandleAt = useCallback((clientX, clientY) => {
    if (!canvasRef.current) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    for (const handle of handlePositions) {
      const screenX = handle.position.x * zoom + pan.x;
      const screenY = handle.position.y * zoom + pan.y;
      
      const distance = Math.sqrt(
        Math.pow(canvasX - screenX, 2) + 
        Math.pow(canvasY - screenY, 2)
      );
      
      if (distance <= handleRadius + 2) { // Add small padding for easier clicking
        return handle;
      }
    }
    
    return null;
  }, [handlePositions, pan, zoom]);

  // Canvas drawing function
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
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
  }, [handlePositions, pan, zoom]);

  // Optimized render loop
  const scheduleRender = useCallback(() => {
    if (animationFrameRef.current) return;
    
    animationFrameRef.current = requestAnimationFrame(() => {
      drawCanvas();
      animationFrameRef.current = null;
    });
  }, [drawCanvas]);

  // Event handlers
  const handleMouseDown = useCallback((e) => {
    const handle = findHandleAt(e.clientX, e.clientY);
    if (!handle) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    draggingHandleRef.current = handle;
    previewLineRef.current = {
      visible: true,
      endX: handle.position.x * zoom + pan.x,
      endY: handle.position.y * zoom + pan.y
    };
    
    scheduleRender();
    eventBus.emit('handleDragStart', { handle });
  }, [findHandleAt, scheduleRender, pan, zoom]);

  const handleMouseMove = useCallback((e) => {
    if (draggingHandleRef.current) {
      // Update preview line
      const rect = canvasRef.current.getBoundingClientRect();
      previewLineRef.current.endX = e.clientX - rect.left;
      previewLineRef.current.endY = e.clientY - rect.top;
      
      scheduleRender();
      
      // Check for target node hover
      const graphX = (e.clientX - pan.x) / zoom;
      const graphY = (e.clientY - pan.y) / zoom;
      
      const hoveredNode = nodes.find(node => {
        if (node.id === draggingHandleRef.current.nodeId) return false;
        const nodeX = node.position?.x || node.x;
        const nodeY = node.position?.y || node.y;
        const nodeWidth = node.width || 60;
        const nodeHeight = node.height || 60;
        
        return (
          graphX >= nodeX - nodeWidth / 2 &&
          graphX <= nodeX + nodeWidth / 2 &&
          graphY >= nodeY - nodeHeight / 2 &&
          graphY <= nodeY + nodeHeight / 2
        );
      });
      
      // Could emit node hover events here if needed
      return;
    }
    
    // Handle hover detection
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
        canvasRef.current.style.cursor = 'pointer';
      } else {
        canvasRef.current.style.cursor = 'default';
      }
      
      scheduleRender();
    }
  }, [findHandleAt, scheduleRender, nodes, pan, zoom]);

  const handleMouseUp = useCallback((e) => {
    if (!draggingHandleRef.current) return;
    
    const handle = draggingHandleRef.current;
    const graphX = (e.clientX - pan.x) / zoom;
    const graphY = (e.clientY - pan.y) / zoom;
    
    // Find target node
    const targetNode = nodes.find(node => {
      if (node.id === handle.nodeId) return false;
      const nodeX = node.position?.x || node.x;
      const nodeY = node.position?.y || node.y;
      const nodeWidth = node.width || 60;
      const nodeHeight = node.height || 60;
      
      return (
        graphX >= nodeX - nodeWidth / 2 &&
        graphX <= nodeX + nodeWidth / 2 &&
        graphY >= nodeY - nodeHeight / 2 &&
        graphY <= nodeY + nodeHeight / 2
      );
    });
    
    // Find associated edge
    const associatedEdge = edges.find(edge => {
      if (handle.direction === 'source') {
        return edge.source === handle.nodeId && edge.type === handle.edgeType;
      } else {
        return edge.target === handle.nodeId && edge.type === handle.edgeType;
      }
    });
    
    // Emit drop event
    eventBus.emit('handleDrop', {
      graph: { x: graphX, y: graphY },
      screen: { x: e.clientX, y: e.clientY },
      sourceNode: handle.nodeId,
      targetNode: targetNode?.id || null,
      edgeType: handle.edgeType,
      edgeId: associatedEdge?.id || null,
      direction: handle.direction
    });
    
    // Clean up
    draggingHandleRef.current = null;
    previewLineRef.current.visible = false;
    scheduleRender();
    
    eventBus.emit('handleDragEnd', { handle });
  }, [nodes, edges, pan, zoom, scheduleRender]);

  // Canvas setup and resize handling
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        setCanvasSize({ width, height });
        scheduleRender();
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [scheduleRender]);

  // Redraw when handles, pan, or zoom change
  useEffect(() => {
    scheduleRender();
  }, [handlePositions, pan, zoom, scheduleRender]);

  // Global mouse event handlers for dragging
  useEffect(() => {
    if (draggingHandleRef.current) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleMouseMove, handleMouseUp]);

  return (
    <HandlePositionContext.Provider value={{ getHandlePosition, getHandlePositionForEdge }}>
      <div 
        ref={containerRef}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          pointerEvents: 'none', 
          zIndex: 20 
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'auto',
            cursor: 'default'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      </div>
      {children}
    </HandlePositionContext.Provider>
  );
};

export default HandleLayer;