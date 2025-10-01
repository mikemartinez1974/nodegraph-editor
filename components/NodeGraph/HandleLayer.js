// HandleLayer.js - Complete drag and drop implementation
import React, { useEffect, useState, useRef } from 'react';
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
  
  // Target handles (left)
  visibleEdgeTypes.forEach((type, i) => {
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
  });
  
  // Source handles (right)
  visibleEdgeTypes.forEach((type, i) => {
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
  const [handlePositions, setHandlePositions] = useState([]);
  const [handlePositionMap, setHandlePositionMap] = useState({});
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [previewLine, setPreviewLine] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  
  const dragStartPosRef = useRef(null);
  const containerRef = useRef(null);

  // Calculate handle positions for all visible nodes
  // Use JSON.stringify to create a stable dependency that only changes when actual data changes
  const nodesKey = JSON.stringify(nodes.map(n => ({ 
    id: n.id, 
    x: n.position?.x || n.x, 
    y: n.position?.y || n.y,
    width: n.width,
    visible: n.visible 
  })));
  const edgeTypesKey = JSON.stringify(Object.keys(edgeTypes));

  useEffect(() => {
    const allHandles = [];
    const handleMap = {};
    nodes.filter(n => n.visible !== false).forEach(node => {
      const handles = getHandlePositions(node, edgeTypes);
      handles.forEach(h => {
        handleMap[h.id] = h.position;
      });
      allHandles.push(...handles);
    });
    setHandlePositions(allHandles);
    setHandlePositionMap(handleMap);
  }, [nodesKey, edgeTypesKey]);

  // Provide function to get handle position by id
  const getHandlePosition = handleId => handlePositionMap[handleId];

  const getHandlePositionForEdge = (nodeId, edgeType, direction) => {
    const nodeStr = String(nodeId).trim();
    const typeStr = String(edgeType).trim();
    const dirStr = String(direction).trim();
    const handleId = `${nodeStr}-${typeStr}-${dirStr}`;
    return handlePositionMap[handleId];
  };
  getHandlePositionForEdge._handleKeys = Object.keys(handlePositionMap);

  // Handle drag start
  const onHandleDragStart = (e, handle) => {
    e.stopPropagation();
    setDraggingHandle(handle);
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    
    // Set initial preview line
    setPreviewLine({
      x1: handle.position.x,
      y1: handle.position.y,
      x2: handle.position.x,
      y2: handle.position.y
    });

    window.addEventListener('mousemove', onHandleDragMove);
    window.addEventListener('mouseup', onHandleDragEnd);
    
    eventBus.emit('handleDragStart', { handle });
  };

  // Handle drag move
  const onHandleDragMove = (e) => {
    if (!draggingHandle) return;
    
    // Convert screen coordinates to graph coordinates
    const graphX = (e.clientX - pan.x) / zoom;
    const graphY = (e.clientY - pan.y) / zoom;
    
    // Update preview line
    setPreviewLine({
      x1: draggingHandle.position.x,
      y1: draggingHandle.position.y,
      x2: graphX,
      y2: graphY
    });

    // Check if hovering over a node
    const hoveredNode = nodes.find(node => {
      if (node.id === draggingHandle.nodeId) return false; // Can't connect to self
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

    setHoveredNodeId(hoveredNode?.id || null);
  };

  // Handle drag end
  const onHandleDragEnd = (e) => {
    if (!draggingHandle) return;

    window.removeEventListener('mousemove', onHandleDragMove);
    window.removeEventListener('mouseup', onHandleDragEnd);

    // Convert screen coordinates to graph coordinates
    const graphX = (e.clientX - pan.x) / zoom;
    const graphY = (e.clientY - pan.y) / zoom;
    const screenX = e.clientX;
    const screenY = e.clientY;

    // Find if dropped on a node
    const targetNode = nodes.find(node => {
      if (node.id === draggingHandle.nodeId) return false;
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

    // Find the associated edge ID if this handle is from an existing edge
    const associatedEdge = edges.find(edge => {
      if (draggingHandle.direction === 'source') {
        return edge.source === draggingHandle.nodeId && edge.type === draggingHandle.edgeType;
      } else {
        return edge.target === draggingHandle.nodeId && edge.type === draggingHandle.edgeType;
      }
    });

    // Emit handleDrop event with all necessary data
    eventBus.emit('handleDrop', {
      graph: { x: graphX, y: graphY },
      screen: { x: screenX, y: screenY },
      sourceNode: draggingHandle.nodeId,
      targetNode: targetNode?.id || null,
      edgeType: draggingHandle.edgeType,
      edgeId: associatedEdge?.id || null,
      direction: draggingHandle.direction
    });

    // Clean up
    setDraggingHandle(null);
    setPreviewLine(null);
    setHoveredNodeId(null);
    dragStartPosRef.current = null;

    eventBus.emit('handleDragEnd', { handle: draggingHandle });
  };

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
        {/* Render handles */}
        {handlePositions.map(handle => {
          const left = handle.position.x * zoom + pan.x - handleRadius;
          const top = handle.position.y * zoom + pan.y - handleRadius;
          const isHovered = hoveredNodeId === handle.nodeId;
          
          return (
            <div
              key={handle.id}
              style={{
                position: 'absolute',
                left,
                top,
                width: handleRadius * 2,
                height: handleRadius * 2,
                borderRadius: '50%',
                background: handle.color,
                border: isHovered ? '3px solid #fff' : '2px solid #fff',
                pointerEvents: 'auto',
                zIndex: 21,
                boxShadow: isHovered ? '0 0 8px rgba(0,0,0,0.3)' : '0 0 4px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                transform: isHovered ? 'scale(1.2)' : 'scale(1)',
              }}
              onMouseEnter={() => eventBus.emit('handleHover', { nodeId: handle.nodeId, handleId: handle.id })}
              onMouseLeave={() => eventBus.emit('handleUnhover', { nodeId: handle.nodeId, handleId: handle.id })}
              onMouseDown={e => onHandleDragStart(e, handle)}
              title={`${handle.edgeType} - ${handle.direction}`}
            />
          );
        })}

        {/* Preview line during drag */}
        {previewLine && draggingHandle && (
          <svg 
            style={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              width: '100%', 
              height: '100%',
              pointerEvents: 'none',
              zIndex: 19
            }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              <line
                x1={previewLine.x1}
                y1={previewLine.y1}
                x2={previewLine.x2}
                y2={previewLine.y2}
                stroke={draggingHandle.color}
                strokeWidth={2}
                strokeDasharray="6,4"
                opacity={0.6}
              />
              <circle
                cx={previewLine.x2}
                cy={previewLine.y2}
                r={4}
                fill={draggingHandle.color}
                opacity={0.6}
              />
            </g>
          </svg>
        )}
      </div>
      {children}
    </HandlePositionContext.Provider>
  );
};

export default HandleLayer;