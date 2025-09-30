// HandleLayerCanvas.js
import React, { useEffect, useState } from 'react';
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
      color: edgeTypes[type].color
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
      color: edgeTypes[type].color
    });
  });
  return handles;
}

const HandleLayerCanvas = ({ nodes = [], edges = [], pan = { x: 0, y: 0 }, zoom = 1, edgeTypes = {}, onDragStart, onDragMove, onDragEnd, children }) => {
  const [handlePositions, setHandlePositions] = useState([]);
  const [handlePositionMap, setHandlePositionMap] = useState({});

  // Debug: log nodes and edgeTypes received
  console.log('[HandleLayerCanvas] nodes:', nodes);
  console.log('[HandleLayerCanvas] edgeTypes:', edgeTypes);

  // Calculate handle positions for all visible nodes
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
    // Debug: log handlePositionMap keys:
    console.log('[HandleLayerCanvas] handlePositionMap keys:', Object.keys(handleMap));
    // Only update state if handle positions actually changed
    setHandlePositions(prev => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(allHandles);
      return prevStr === nextStr ? prev : allHandles;
    });
  }, [nodes, edgeTypes]);

  // Provide a function to get handle position by id
  const getHandlePosition = handleId => handlePositionMap[handleId];

  // Always define getHandlePositionForEdge inline so it uses latest handlePositionMap
  const getHandlePositionForEdge = (nodeId, edgeType, direction) => {
    const nodeStr = String(nodeId).trim();
    const typeStr = String(edgeType).trim();
    const dirStr = String(direction).trim();
    const handleId = `${nodeStr}-${typeStr}-${dirStr}`;
    console.log('[getHandlePositionForEdge] nodeId:', nodeId, typeof nodeId, 'edgeType:', edgeType, typeof edgeType, 'direction:', direction, typeof direction);
    console.log('[getHandlePositionForEdge] nodeStr:', nodeStr, 'typeStr:', typeStr, 'dirStr:', dirStr);
    console.log('[getHandlePositionForEdge] handleId:', handleId);
    console.log('[getHandlePositionForEdge] available keys:', Object.keys(handlePositionMap));
    console.log('[getHandlePositionForEdge] handleId exists:', handleId in handlePositionMap);
    if (Object.keys(handlePositionMap).length > 0) {
      console.log('[getHandlePositionForEdge] handlePositionMap sample:', JSON.stringify(handlePositionMap, null, 2));
    }
    console.log('[getHandlePositionForEdge] value:', handlePositionMap[handleId]);
    return handlePositionMap[handleId];
  };
  getHandlePositionForEdge._handleKeys = Object.keys(handlePositionMap);
  console.log('[HandleLayerCanvas] Providing getHandlePositionForEdge:', getHandlePositionForEdge);

  return (
    <HandlePositionContext.Provider value={{ getHandlePosition, getHandlePositionForEdge }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 20 }}>
        {handlePositions.map(handle => {
          const left = handle.position.x * zoom + pan.x - handleRadius;
          const top = handle.position.y * zoom + pan.y - handleRadius;
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
                border: '2px solid #fff',
                pointerEvents: 'auto',
                zIndex: 21,
                boxShadow: '0 0 4px #0002',
                cursor: 'pointer',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={() => eventBus.emit('handleHover', { nodeId: handle.nodeId, handleId: handle.id })}
              onMouseLeave={() => eventBus.emit('handleUnhover', { nodeId: handle.nodeId, handleId: handle.id })}
              onMouseDown={e => {
                if (onDragStart) onDragStart(e, handle);
              }}
              title={handle.id}
            />
          );
        })}
      </div>
      {children}
    </HandlePositionContext.Provider>
  );
};

export default HandleLayerCanvas;
