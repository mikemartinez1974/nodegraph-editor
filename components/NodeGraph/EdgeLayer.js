"use client";

import React, { useRef, useEffect, useState } from 'react';

function isPointNearLine(x, y, x1, y1, x2, y2, threshold = 8) {
  // Distance from point (x, y) to line segment (x1, y1)-(x2, y2)
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) param = dot / len_sq;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy) < threshold;
}

function isPointNearBezier(x, y, x1, y1, cx1, cy1, cx2, cy2, x2, y2, threshold = 8) {
  // Sample the Bezier curve and check distance
  let minDist = Infinity;
  for (let t = 0; t <= 1; t += 0.05) {
    const bx = Math.pow(1 - t, 3) * x1 + 3 * Math.pow(1 - t, 2) * t * cx1 + 3 * (1 - t) * Math.pow(t, 2) * cx2 + Math.pow(t, 3) * x2;
    const by = Math.pow(1 - t, 3) * y1 + 3 * Math.pow(1 - t, 2) * t * cy1 + 3 * (1 - t) * Math.pow(t, 2) * cy2 + Math.pow(t, 3) * y2;
    const dist = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
    if (dist < minDist) minDist = dist;
    if (dist < threshold) return true;
  }
  return false;
}

function EdgeLayer({ edgeList = [], nodeList = [], pan = { x: 0, y: 0 }, zoom = 1, selectedEdgeId, theme, onEdgeClick, onEdgeHover }) {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [hoveredEdge, setHoveredEdge] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight * 0.9 });
    }
  }, []);

  // Mouse event handlers
  function handleMouseMove(e) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    let found = null;
    for (const edge of edgeList) {
      const sourceNode = nodeList.find(n => n.id === edge.source);
      const targetNode = nodeList.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;
      let hit = false;
      if (edge.type === 'curved') {
        const x1 = sourceNode.position.x, y1 = sourceNode.position.y;
        const x2 = targetNode.position.x, y2 = targetNode.position.y;
        const dx = (x2 - x1) / 3, dy = (y2 - y1) / 3;
        let cx1, cy1, cx2, cy2;
        if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
          cx1 = x1 + dx; cy1 = y1; cx2 = x2 - dx; cy2 = y2;
        } else {
          cx1 = x1; cy1 = y1 + dy; cx2 = x2; cy2 = y2 - dy;
        }
        hit = isPointNearBezier(mouseX, mouseY, x1, y1, cx1, cy1, cx2, cy2, x2, y2);
      } else {
        const sourceHandle = sourceNode.position;
        const targetHandle = targetNode.position;
        hit = isPointNearLine(mouseX, mouseY, sourceHandle.x, sourceHandle.y, targetHandle.x, targetHandle.y);
      }
      if (hit) {
        found = edge.id;
        break;
      }
    }
    setHoveredEdge(found);
    if (onEdgeHover) onEdgeHover(found);
  }

  function handleMouseLeave() {
    setHoveredEdge(null);
    if (onEdgeHover) onEdgeHover(null);
  }

  function handleClick(e) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    let found = null;
    let foundEdge = null;
    for (const edge of edgeList) {
      const sourceNode = nodeList.find(n => n.id === edge.source);
      const targetNode = nodeList.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;
      let hit = false;
      if (edge.type === 'curved') {
        const x1 = sourceNode.position.x, y1 = sourceNode.position.y;
        const x2 = targetNode.position.x, y2 = targetNode.position.y;
        const dx = (x2 - x1) / 3, dy = (y2 - y1) / 3;
        let cx1, cy1, cx2, cy2;
        if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
          cx1 = x1 + dx; cy1 = y1; cx2 = x2 - dx; cy2 = y2;
        } else {
          cx1 = x1; cy1 = y1 + dy; cx2 = x2; cy2 = y2 - dy;
        }
        hit = isPointNearBezier(mouseX, mouseY, x1, y1, cx1, cy1, cx2, cy2, x2, y2);
      } else {
        const sourceHandle = sourceNode.position;
        const targetHandle = targetNode.position;
        hit = isPointNearLine(mouseX, mouseY, sourceHandle.x, sourceHandle.y, targetHandle.x, targetHandle.y);
      }
      if (hit) {
        found = edge.id;
        foundEdge = edge;
        break;
      }
    }
    if (found !== null && onEdgeClick) {
      e.stopPropagation();
      onEdgeClick(foundEdge, e);
    }
    // If no edge is found, do nothing (let event bubble up)
  }

  function handleMouseDown(e) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    for (const edge of edgeList) {
      const sourceNode = nodeList.find(n => n.id === edge.source);
      const targetNode = nodeList.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;
      let hit = false;
      if (edge.type === 'curved') {
        const x1 = sourceNode.position.x, y1 = sourceNode.position.y;
        const x2 = targetNode.position.x, y2 = targetNode.position.y;
        const dx = (x2 - x1) / 3, dy = (y2 - y1) / 3;
        let cx1, cy1, cx2, cy2;
        if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
          cx1 = x1 + dx; cy1 = y1; cx2 = x2 - dx; cy2 = y2;
        } else {
          cx1 = x1; cy1 = y1 + dy; cx2 = x2; cy2 = y2 - dy;
        }
        hit = isPointNearBezier(mouseX, mouseY, x1, y1, cx1, cy1, cx2, cy2, x2, y2);
      } else {
        const sourceHandle = sourceNode.position;
        const targetHandle = targetNode.position;
        hit = isPointNearLine(mouseX, mouseY, sourceHandle.x, sourceHandle.y, targetHandle.x, targetHandle.y);
      }
      if (hit) {
        e.stopPropagation();
        break;
      }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    edgeList.forEach(edge => {
      const sourceNode = nodeList.find(n => n.id === edge.source);
      const targetNode = nodeList.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;
      ctx.save();
      ctx.beginPath();
      let x1 = sourceNode.position.x;
      let y1 = sourceNode.position.y;
      let x2 = targetNode.position.x;
      let y2 = targetNode.position.y;
      if (edge.type === 'curved') {
        const dx = (x2 - x1) / 3;
        const dy = (y2 - y1) / 3;
        ctx.moveTo(x1, y1);
        if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
          ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
        } else {
          ctx.bezierCurveTo(x1, y1 + dy, x2, y2 - dy, x2, y2);
        }
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      let isHovered = hoveredEdge === edge.id;
      ctx.strokeStyle = edge.id === selectedEdgeId ? (theme?.palette?.primary?.main || '#2196f3') : isHovered ? (theme?.palette?.secondary?.main || '#f50057') : (theme?.palette?.text?.disabled || '#888');
      ctx.lineWidth = edge.id === selectedEdgeId ? 3 : isHovered ? 2.5 : 1.5;
      if (edge.type === 'dashed') {
        ctx.setLineDash([10, 8]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }, [edgeList, nodeList, pan, zoom, selectedEdgeId, canvasSize, hoveredEdge, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', zIndex: 5 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    />
  );
}

export default EdgeLayer;
