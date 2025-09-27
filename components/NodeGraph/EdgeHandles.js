"use client";
import React, { useRef, useState, useEffect } from 'react';
import eventBus from './eventBus';
import { getEdgeHandlePosition } from './utils';

function getBezierTangent(node, otherNode, edge, isSource) {
  // Cubic Bezier tangent at t=0 (source) or t=1 (target)
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
  if (isSource) {
    // Tangent at t=0: direction from node center to first control point
    return { x: cx1 - x1, y: cy1 - y1 };
  } else {
    // Tangent at t=1: direction from last control point to node center
    return { x: x2 - cx2, y: y2 - cy2 };
  }
}

function getBezierPerimeterPoint(node, otherNode, edge) {
  // Sample the Bezier curve from the current node's center outward to its perimeter
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
    const t = i / steps * 0.4; // t from 0.02 to 0.4
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

export default function EdgeHandles({ nodeList = [], edges = [], pan = { x: 0, y: 0 }, theme = {}, zoom = 1 }) {
  const [dragState, setDragState] = useState(null);
  const hoverCountRef = useRef({});
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
    // Get the handle's graph position from node data
    const handleNode = nodeList.find(n => n.id === dragState.nodeId);
    let startX, startY;
    if (handleNode) {
      startX = handleNode.position.x;
      startY = handleNode.position.y;
    } else {
      startX = (dragState.start.x - rect.left - pan.x) / zoom;
      startY = (dragState.start.y - rect.top - pan.y) / zoom;
    }
    const mouseX = (dragState.mouse.x - rect.left - pan.x) / zoom;
    const mouseY = (dragState.mouse.y - rect.top - pan.y) / zoom;
    ctx.strokeStyle = theme.palette.secondary.main;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, [dragState, pan, zoom]);

  function handleMouseEnter(nodeId) {
    hoverCountRef.current[nodeId] = (hoverCountRef.current[nodeId] || 0) + 1;
    eventBus.emit('nodeMouseEnter', { id: nodeId });
  }
  function handleMouseLeave(nodeId) {
    hoverCountRef.current[nodeId] = (hoverCountRef.current[nodeId] || 1) - 1;
    setTimeout(() => {
      if (hoverCountRef.current[nodeId] <= 0) {
        eventBus.emit('nodeMouseLeave', { id: nodeId });
      }
    }, 10);
  }

  function handleMouseDown(e, nodeId, edgeId, handlePos) {
    e.stopPropagation();
    setDragState({ nodeId, edgeId, start: handlePos });
    eventBus.emit('handleDragStart', { nodeId, edgeId, start: handlePos, event: e });
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', onDrop);
  }

  function onDrag(e) {
    if (!dragState) return;
    const mousePos = { x: e.clientX, y: e.clientY };
    setDragState(ds => ({ ...ds, mouse: mousePos }));
    eventBus.emit('handleDragMove', { ...dragState, mouse: mousePos, event: e });
  }

  function onDrop(e) {
    if (!dragState) return;
    const mousePos = { x: e.clientX, y: e.clientY };
    eventBus.emit('handleDragEnd', { ...dragState, mouse: mousePos, event: e });
    setDragState(null);
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', onDrop);
  }

  // For each node, render a handle for each connected edge at the intersection point
  return (
    <>
      {nodeList.map(node => {
        if (!node.handleProgress || node.handleProgress <= 0) return null;        
        const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
       
        // Only render default handle if there are truly no connected edges
        if (connectedEdges.length === 0) {

          // Render a default handle at the bottom (6:00 position)
          const handleSize = 22;
          const radius = ((node.width || 60) / 2) * zoom;
          const angle = Math.PI / 2;
          const centerX = node.position.x * zoom + pan.x;
          const centerY = node.position.y * zoom + pan.y;
          const handleX = centerX + radius * Math.cos(angle) - handleSize / 2;
          const handleY = centerY + radius * Math.sin(angle) - handleSize / 2;

          return (
            <div
              key={`${node.id}-default-handle`}
              style={{
                position: 'absolute',
                left: handleX,
                top: handleY,
                width: handleSize,
                height: handleSize,
                borderRadius: 8,
                background: theme.palette.secondary.main,
                pointerEvents: 'auto',
                cursor: 'grab',
                zIndex: 30,
                opacity: node.handleProgress
              }}
              onMouseDown={e => handleMouseDown(e, node.id, null, { x: handleX, y: handleY })}
              onMouseUp={e => eventBus.emit('edgeHandleMouseUp', { nodeId: node.id, edgeId: null, event: e })}
              onMouseEnter={e => eventBus.emit('edgeHandleMouseEnter', { nodeId: node.id, edgeId: null, event: e })}
              onMouseLeave={e => eventBus.emit('edgeHandleMouseLeave', { nodeId: node.id, edgeId: null, event: e })}
            />
          );
        }

        // Only render handles for connected edges
        if (connectedEdges.length > 0) {
          return connectedEdges.map(edge => {
            const isSource = edge.source === node.id;
            const otherNode = isSource
              ? nodeList.find(n => n.id === edge.target)
              : nodeList.find(n => n.id === edge.source);
            if (!otherNode) return null;
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
            const progress = node.handleProgress || 0;
            const interpRaw = {
              x: nodeCenterRaw.x + (connectionPoint.x - nodeCenterRaw.x) * progress,
              y: nodeCenterRaw.y + (connectionPoint.y - nodeCenterRaw.y) * progress
            };
            const handleSize = 22;
            const handlePos = {
              x: interpRaw.x * zoom + pan.x - handleSize / 2,
              y: interpRaw.y * zoom + pan.y - handleSize / 2
            };
            const handleKey = `${node.id}-${edge.id}-handle`;
            return (
              <div
                key={handleKey}
                style={{
                  position: 'absolute',
                  left: handlePos.x,
                  top: handlePos.y,
                  width: handleSize,
                  height: handleSize,
                  borderRadius: 8,
                  background: theme.palette.secondary.main,
                  pointerEvents: 'auto',
                  cursor: dragState && dragState.nodeId === node.id && dragState.edgeId === edge.id ? 'grabbing' : 'grab',
                  zIndex: 30,
                  opacity: node.handleProgress
                }}
                onMouseDown={e => handleMouseDown(e, node.id, edge.id, handlePos)}
                onMouseUp={e => eventBus.emit('edgeHandleMouseUp', { nodeId: node.id, edgeId: edge.id, event: e })}
                onMouseEnter={e => {
                  console.log('Handle mouse enter:', {
                    nodeId: node.id,
                    edgeId: edge ? edge.id : null,
                    handlePos
                  }
                );
                  eventBus.emit('edgeHandleMouseEnter', { nodeId: node.id, edgeId: edge ? edge.id : null, event: e });
                }}
                onMouseLeave={e => eventBus.emit('edgeHandleMouseLeave', { nodeId: node.id, edgeId: edge.id, event: e })}
              />
            );
          });
        }
        
        return null;
      })}

    </>
  );
}
