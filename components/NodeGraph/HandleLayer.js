import React, { useRef, useState, useEffect } from 'react';
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

const HandleLayer = ({ nodes, edges, pan, zoom = 1, theme, onHandleEvent, onHandleDragStart, isDraggingHandle, onHandleDragEnd }) => {
  // Drag state
  let dragState = null;
  const previewCanvasRef = useRef(null);

  useEffect(() => {
    if (!dragState || !dragState.start || !dragState.mouse) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    // Convert mouse position to graph coordinates
    const rect = canvas.getBoundingClientRect();
    let startX = dragState.start.x;
    let startY = dragState.start.y;
    const mouseX = dragState.mouse.x;
    const mouseY = dragState.mouse.y;
    ctx.strokeStyle = theme?.palette?.secondary?.main || '#888';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, [dragState, pan, zoom]);

  function handleMouseDown(e, handle) {
    e.stopPropagation();
    dragState = { nodeId: handle.nodeId, edgeId: handle.edgeId, start: { x: handle.x * zoom + pan.x, y: handle.y * zoom + pan.y } };
    eventBus.emit('handleDragStart', { nodeId: handle.nodeId, edgeId: handle.edgeId, start: { x: handle.x * zoom + pan.x, y: handle.y * zoom + pan.y }, event: e });
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', onDrop);
  }

  function onDrag(event) {
    if (!dragState) return;
    const mousePos = { x: event.clientX, y: event.clientY };
    // Update dragState with new properties, preserving existing ones
    if (dragState) {
      dragState = {
        ...dragState,
        // Add or update properties as needed, e.g.:
        mousePos: { x: event.clientX, y: event.clientY }
      };
    }
    eventBus.emit('handleDragMove', { ...dragState, mouse: mousePos, event });
  }

  const onDrop = (event) => {
    const mousePos = { x: event.clientX, y: event.clientY };
    if (typeof handleDrop === 'function') {
      handleDrop(dragState);
    }
    dragState = null;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', onDrop);
    // Debug statement for drop event
    //console.log('HandleLayer: handle drop event fired', { dragState, mousePos });
    // Call parent callback for drag end
    if (typeof onHandleDragEnd === 'function') {
      onHandleDragEnd(event, dragState);
    }
  }

  // Calculate handles for all nodes
  const nodesSafe = Array.isArray(nodes) ? nodes : [];
  const edgesSafe = Array.isArray(edges) ? edges : [];
  const handles = [];
  nodesSafe.forEach(node => {
    if (!node.handleProgress || node.handleProgress <= 0) return;
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
      handles.push({
        id: `${node.id}-default-handle`,
        x: (centerX + radius * Math.cos(angle) - handleSize / 2) / zoom,
        y: (centerY + radius * Math.sin(angle) - handleSize / 2) / zoom,
        radius: handleSize / 2,
        color: theme?.palette?.secondary?.main || '#888',
        progress: node.handleProgress,
        nodeId: node.id,
        edgeId: null,
        isActive: false
      });
      return;
    }
    connectedEdges.forEach(edge => {
      const isSource = edge.source === node.id;
      const otherNode = isSource
        ? nodes.find(n => n.id === edge.target)
        : nodes.find(n => n.id === edge.source);
      if (!otherNode) return;
      let connectionPoint;
      if (edge.type === 'curved') {
        connectionPoint = getBezierPerimeterPoint(node, otherNode, edge);
        //console.log('Curved handle:', { nodeId: node.id, edgeId: edge.id, connectionPoint });
      } else {
        connectionPoint = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, edge.type);
        //console.log('Straight handle:', { nodeId: node.id, edgeId: edge.id, connectionPoint, edgeType: edge.type });
      }
      const nodeCenterRaw = {
        x: node.position.x,
        y: node.position.y
      };
      const progress = node.handleProgress || 0;
      const interpRaw = {
        x: nodeCenterRaw.x + (connectionPoint.x - nodeCenterRaw.x) * progress,
        y: nodeCenterRaw.y + (connectionPoint.y - nodeCenterRaw.y) * progress
      };
      handles.push({
        id: `${node.id}-handle-${edge.id}`,
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

  const onDragStart = (event) => {
    console.log('HandleLayer.js: drag start handler entered', event);
    dragState = {/* ...set drag state... */};
    console.log('HandleLayer.js: dragState set on drag start', dragState);
    showHandle(dragState.handleId);
    // ...existing code...
  };

  const onDragEnd = (event) => {
    console.log('HandleLayer.js: drag end handler entered', event);
    hideHandle(dragState ? dragState.handleId : null);
    dragState = null;
    console.log('HandleLayer.js: dragState reset on drag end', dragState);
    // ...existing code...
  };

  return (
    <>
      <div style={{ pointerEvents: 'none' }}>
        {handles.map(handle => {
          const scaledRadius = handle.radius * zoom;
          const left = handle.x * zoom + pan.x - scaledRadius;
          const top = handle.y * zoom + pan.y - scaledRadius;
          const isFullyExtended = handle.progress === 1;
          const pointerEvents = handle.pointerEvents || (isFullyExtended ? 'auto' : 'none');
          //console.log('Rendering handle:', { nodeId: handle.nodeId, edgeId: handle.edgeId, position: { x: handle.x, y: handle.y }, left, top, isFullyExtended, pointerEvents }); 
          // If dragging this handle, show it at mouse position
          if (dragState && dragState.nodeId === handle.nodeId && dragState.edgeId === handle.edgeId && dragState.mouse) {
            const mouseGraphX = (dragState.mouse.x - pan.x) / zoom;
            const mouseGraphY = (dragState.mouse.y - pan.y) / zoom;
            return (
              <div
                key={handle.id + '-dragging'}
                style={{
                  position: 'absolute',
                  left: dragState.mouse.x - handle.radius * zoom,
                  top: dragState.mouse.y - handle.radius * zoom,
                  width: handle.radius * 2 * zoom,
                  height: handle.radius * 2 * zoom,
                  borderRadius: '50%',
                  background: theme?.palette?.primary?.main || '#f00',
                  opacity: 1,
                  pointerEvents: 'none',
                  boxShadow: '0 0 8px #00f',
                  zIndex: 20
                }}
              />
            );
          }
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
                if (isFullyExtended && !dragState) {
                  onHandleEvent && onHandleEvent(handle);
                //   console.log('Handle mouse enter:', {
                //     nodeId: handle.nodeId,
                //     edgeId: handle.edgeId,
                //     handlePos: { x: handle.x, y: handle.y },
                //     progress: handle.progress,
                //     type: handle.edgeId ? edgesSafe.find(e => e.id === handle.edgeId)?.type : 'default'
                //   });
                }
              }}
              onMouseLeave={() => {
                if (isFullyExtended && !dragState) onHandleEvent && onHandleEvent(null);
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
      {/* Preview edge during drag, drawn on canvas */}
      {/* Canvas preview line removed to avoid duplicate preview lines */}
    </>
  );
};

export default HandleLayer;