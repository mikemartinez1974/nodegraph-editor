import React, { useRef, useEffect, useState } from 'react';
import { getEdgeHandlePosition } from './utils';
import eventBus from './eventBus';

function getBezierPerimeterPoint(node, otherNode, edge) {
  // ...existing bezier logic from EdgeHandles.js...
  const x1 = node.position.x;
  const y1 = node.position.y;
  const x2 = otherNode.position.x;
  const y2 = otherNode.position.y;
  const dx = (x2 - x1) / 3;
  const dy = (y2 - y1) / 3;
  let cx1, cy1, cx2, cy2;
  if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
    cx1 = x1 + dx;
    cy1 = y1;
    cx2 = x2 - dx;
    cy2 = y2;
  } else {
    cx1 = x1;
    cy1 = y1 + dy;
    cx2 = x2;
    cy2 = y2 - dy;
  }
  const radius = (node.width || 60) / 2;
  const center = { x: x1, y: y1 };
  let best = { x: center.x, y: center.y };
  let bestDist = 0;
  let found = false;
  const steps = 50;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps * 0.4;
    const x = Math.pow(1 - t, 3) * x1 + 3 * Math.pow(1 - t, 2) * t * cx1 + 3 * (1 - t) * Math.pow(t, 2) * cx2 + Math.pow(t, 3) * x2;
    const y = Math.pow(1 - t, 3) * y1 + 3 * Math.pow(1 - t, 2) * t * cy1 + 3 * (1 - t) * Math.pow(t, 2) * cy2 + Math.pow(t, 3) * y2;
    const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
    if (Math.abs(dist - radius) < 1.5) {
      return { x, y };
    }
    if (!found || Math.abs(dist - radius) < Math.abs(bestDist - radius)) {
      best = { x, y };
      bestDist = dist;
      found = true;
    }
  }
  return best;
}

const HandleLayer = ({ nodes, edges, pan, zoom = 1, theme, onHandleEvent, onHandleDragStart, isDraggingHandle, onHandleDragEnd, hoveredNodeId, hoveredEdgeSource, hoveredEdgeTarget, onHandlePositionsChange }) => {
  // Imperative handle progress map (not state)
  const handleProgressRef = useRef({});
  const animationRef = useRef();
  const [, forceUpdate] = useState(0);

  // Imperative animation function
  const animateHandle = (nodeId, target) => {
    if (!animationRef.current) animationRef.current = {};
    cancelAnimationFrame(animationRef.current[nodeId]);
    const start = performance.now();
    const initial = handleProgressRef.current[nodeId] || 0;
    const duration = 125;
    function animate(now) {
      const elapsed = Math.min(now - start, duration);
      const progress = elapsed / duration;
      handleProgressRef.current[nodeId] = initial + (target - initial) * progress;
      forceUpdate(f => f + 1); // trigger re-render
      if (elapsed < duration) {
        animationRef.current[nodeId] = requestAnimationFrame(animate);
      } else {
        handleProgressRef.current[nodeId] = target;
        forceUpdate(f => f + 1); // final re-render
      }
    }
    animationRef.current[nodeId] = requestAnimationFrame(animate);
  };

  // Listen for extend/retract events
  useEffect(() => {
    const onNodeMouseEnter = ({ id }) => {
      handleProgressRef.current[id] = 1;
      forceUpdate(f => f + 1);
    };
    const onNodeMouseLeave = ({ id }) => {
      handleProgressRef.current[id] = 0;
      forceUpdate(f => f + 1);
    };
    const onEdgeMouseEnter = ({ id }) => {
      // Extend handles for nodes connected to this edge only
      const edge = edges.find(e => e.id === id);
      if (edge) {
        handleProgressRef.current[edge.source] = 1;
        handleProgressRef.current[edge.target] = 1;
        forceUpdate(f => f + 1);
      }
    };
    const onEdgeMouseLeave = ({ id }) => {
      // Retract handles for nodes connected to this edge only
      const edge = edges.find(e => e.id === id);
      if (edge) {
        handleProgressRef.current[edge.source] = 0;
        handleProgressRef.current[edge.target] = 0;
        forceUpdate(f => f + 1);
      }
    };
    eventBus.on('nodeMouseEnter', onNodeMouseEnter);
    eventBus.on('nodeMouseLeave', onNodeMouseLeave);
    eventBus.on('edgeMouseEnter', onEdgeMouseEnter);
    eventBus.on('edgeMouseLeave', onEdgeMouseLeave);
    return () => {
      eventBus.off('nodeMouseEnter', onNodeMouseEnter);
      eventBus.off('nodeMouseLeave', onNodeMouseLeave);
      eventBus.off('edgeMouseEnter', onEdgeMouseEnter);
      eventBus.off('edgeMouseLeave', onEdgeMouseLeave);
    };
  }, [edges]
  );


  // Calculate handles for all nodes
  const nodesSafe = Array.isArray(nodes) ? nodes : [];
  const edgesSafe = Array.isArray(edges) ? edges : [];
  const handles = [];
  const handlePositions = {};
  nodesSafe.forEach(node => {
    // Only show handles for hovered node or hovered edge endpoints
    const connectedEdges = edgesSafe.filter(e => e.source === node.id || e.target === node.id);
    if (connectedEdges.length === 0) {
      // Default handle at bottom
      const handleSize = 22;
      const radius = ((node.width || 60) / 2) * zoom;
      const angle = Math.PI / 2;
      const centerX = node.position.x * zoom + pan.x;
      const centerY = node.position.y * zoom + pan.y;
      const handleX = centerX + radius * Math.cos(angle) - handleSize / 2;
      const handleY = centerY + radius * Math.sin(angle) - handleSize / 2;
      const interpRaw = {
        x: centerX + radius * Math.cos(angle) - handleSize / 2,
        y: centerY + radius * Math.sin(angle) - handleSize / 2
      };
      handlePositions[`${node.id}-default-handle`] = { x: interpRaw.x, y: interpRaw.y };
      handles.push({
        id: `${node.id}-default-handle`,
        x: interpRaw.x,
        y: interpRaw.y,
        radius: handleSize / 2,
        color: theme?.palette?.secondary?.main || '#888',
        progress: handleProgressRef.current[node.id] || 0,
        nodeId: node.id,
        edgeId: null,
        isActive: false
      });
      return;
    }
    connectedEdges.forEach((edge, edgeIdx) => {
      const isSource = edge.source === node.id;
      const otherNode = isSource
        ? nodes.find(n => n.id === edge.target)
        : nodes.find(n => n.id === edge.source);
      if (!otherNode) return;
      let connectionPoint;
      if (edge.type === 'curved') {
        connectionPoint = getBezierPerimeterPoint(node, otherNode, edge);
      } else {
        connectionPoint = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, edge.type);
      }
      const nodeCenterRaw = {
        x: node.position.x,
        y: node.position.y
      };
      // Use progress for handle extension
      let progress = handleProgressRef.current[node.id] || 0;
      const interpRaw = {
        x: node.position.x + (connectionPoint.x - node.position.x) * progress,
        y: node.position.y + (connectionPoint.y - node.position.y) * progress
      };
      handlePositions[`${node.id}-handle-${edge.id}-${isSource ? 'source' : 'target'}-${edgeIdx}`] = { x: interpRaw.x, y: interpRaw.y };
      handles.push({
        id: `${node.id}-handle-${edge.id}-${isSource ? 'source' : 'target'}-${edgeIdx}`,
        x: interpRaw.x,
        y: interpRaw.y,
        radius: 11,
        color: theme?.palette?.secondary?.main || '#888',
        progress,
        nodeId: node.id,
        edgeId: edge.id,
        isActive: false
      });
    });
  });

  // Add debug log when handle is shown
  function showHandle(handleId) {
    console.log('HandleLayer.js: handle shown', handleId);
    // ...existing code...
  }

  // Add debug log when handle is hidden
  function hideHandle(handleId) {
    console.log('HandleLayer.js: handle hidden', handleId);
    // ...existing code...
  }

  return (
    <div style={{ pointerEvents: 'none' }}>
      {handles.map(handle => {
        const scaledRadius = handle.radius * zoom;
        const left = handle.x * zoom + pan.x - scaledRadius;
        const top = handle.y * zoom + pan.y - scaledRadius;
        const isFullyExtended = handle.progress === 1;
        const pointerEvents = handle.pointerEvents || (isFullyExtended ? 'auto' : 'none');
        // Remove dragStateRef-dependent drag preview logic
        return (
          <div
            key={handle.id}
            style={{
              position: 'absolute',
              left,
              top,
              width: scaledRadius * 2,
              height: scaledRadius * 2,
              borderRadius: '50%',
              background: handle.color || '#888',
              opacity: handle.progress !== undefined ? handle.progress : 1,
              pointerEvents,
              transition: 'opacity 0.2s',
              boxShadow: handle.isActive ? '0 0 8px #00f' : undefined,
              cursor: 'default',
              zIndex: 10
            }}
            onMouseEnter={() => {
              if (isFullyExtended) {
                onHandleEvent && onHandleEvent(handle);
                eventBus.emit('handleHover', { nodeId: handle.nodeId, handleId: handle.id });
              }
            }}
            onMouseLeave={() => {
              if (isFullyExtended) {
                onHandleEvent && onHandleEvent(null);
                eventBus.emit('handleUnhover', { nodeId: handle.nodeId, handleId: handle.id });
              }
            }}
            onMouseDown={e => {
              if (isFullyExtended) {
                handleMouseDown(e, handle);
                if (typeof onHandleDragStart === 'function') {
                  onHandleDragStart(e, handle);
                }
              }
            }}
            className="handle"
          />
        );
      })}
    </div>
  );
}

export default HandleLayer;