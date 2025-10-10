"use client";

import React, { useRef, useEffect, useState, useContext } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';
import edgeTypes from '../GraphEditor/edgeTypes';
import { setupHiDPICanvas, getCanvasContext, clearCanvas } from './canvasUtils';

function isPointNearLine(x, y, x1, y1, x2, y2, threshold = 8) {
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

function EdgeLayer({ 
  edgeList = [], 
  nodeList = [], 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  selectedEdgeId, 
  selectedEdgeIds = [],
  theme, 
  onEdgeClick, 
  onEdgeDoubleClick, 
  onEdgeHover 
}) {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: '100vw', height: '100vh' });
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const { getHandlePositionForEdge } = useContext(HandlePositionContext);
  const prevHoveredEdgeRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight * 0.9 });
    }
  }, []);

  // Resize canvas when window size changes
  useEffect(() => {
    function handleResize() {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      const isCurved = edge.style?.curved === true;
      if (isCurved) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2 - 40;
        hit = isPointNearBezier(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, midX, sourceNode.position.y, midX, targetNode.position.y, targetNode.position.x, targetNode.position.y);
      } else {
        hit = isPointNearLine(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, targetNode.position.x, targetNode.position.y);
      }
      if (hit) {
        found = edge.id;
        break;
      }
    }
    if (prevHoveredEdgeRef.current !== found) {
      if (prevHoveredEdgeRef.current) {
        eventBus.emit('edgeMouseLeave', { id: prevHoveredEdgeRef.current });
      }
      if (found) {
        eventBus.emit('edgeMouseEnter', { id: found });
      }
      prevHoveredEdgeRef.current = found;
    }
    setHoveredEdge(found);
    if (onEdgeHover) onEdgeHover(found);
  }

  function handleMouseLeave() {
    if (prevHoveredEdgeRef.current) {
      eventBus.emit('edgeMouseLeave', { id: prevHoveredEdgeRef.current });
      prevHoveredEdgeRef.current = null;
    }
    setHoveredEdge(null);
    if (onEdgeHover) {
      onEdgeHover(null);
    }
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
      const isCurved = edge.style?.curved === true;

      if (isCurved) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2 - 40;
        hit = isPointNearBezier(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, midX, sourceNode.position.y, midX, targetNode.position.y, targetNode.position.x, targetNode.position.y);
      } else {
        hit = isPointNearLine(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, targetNode.position.x, targetNode.position.y);
      }
      
      if (hit) {
        found = edge.id;
        foundEdge = edge;
        break;
      }
    }
    
    if (found !== null && onEdgeClick) {
      console.log('Edge clicked:', found);
      e.stopPropagation();
      onEdgeClick(foundEdge, e);
    }
  }

  function handleDoubleClick(e) {
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
      const isCurved = edge.style?.curved === true;

      if (isCurved) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2 - 40;
        hit = isPointNearBezier(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, midX, sourceNode.position.y, midX, targetNode.position.y, targetNode.position.x, targetNode.position.y);
      } else {
        hit = isPointNearLine(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, targetNode.position.x, targetNode.position.y);
      }
      
      if (hit) {
        found = edge.id;
        foundEdge = edge;
        break;
      }
    }
    
    if (found !== null && onEdgeDoubleClick) {
      e.stopPropagation();
      onEdgeDoubleClick(foundEdge, e);
    }
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
      const isCurved = edge.style?.curved === true;
      
      if (isCurved) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2 - 40;
        hit = isPointNearBezier(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, midX, sourceNode.position.y, midX, targetNode.position.y, targetNode.position.x, targetNode.position.y);
      } else {
        hit = isPointNearLine(mouseX, mouseY, sourceNode.position.x, sourceNode.position.y, targetNode.position.x, targetNode.position.y);
      }
      
      if (hit) {
        e.stopPropagation();
        break;
      }
    }
  }

  // Draw edges on canvas
  useEffect(() => {
    if (getHandlePositionForEdge && getHandlePositionForEdge._handleKeys && getHandlePositionForEdge._handleKeys.length === 0) {
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvasContext(canvas);
    
    const devicePixelRatio = setupHiDPICanvas(canvas, ctx, canvasSize.width, canvasSize.height);
    clearCanvas(ctx, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    edgeList.forEach(edge => {
      // Determine if this edge is selected
      const isSelected = selectedEdgeIds.includes(edge.id) || selectedEdgeId === edge.id;
      const isHovered = hoveredEdge === edge.id;
      
      let sourcePos, targetPos, curveDirectionOverride;
      
      if (typeof getHandlePositionForEdge === 'function') {
        const sourceResult = getHandlePositionForEdge(edge.source, edge.type, 'source');
        const targetResult = getHandlePositionForEdge(edge.target, edge.type, 'target');
        
        if (sourceResult && typeof sourceResult === 'object') {
          sourcePos = { x: sourceResult.x, y: sourceResult.y };
          if (sourceResult.curveDirection) curveDirectionOverride = sourceResult.curveDirection;
        } else {
          sourcePos = sourceResult;
        }
        
        if (targetResult && typeof targetResult === 'object') {
          targetPos = { x: targetResult.x, y: targetResult.y };
          if (targetResult.curveDirection) curveDirectionOverride = targetResult.curveDirection;
        } else {
          targetPos = targetResult;
        }
      }
      
      // Fallback if not found
      if (!sourcePos) {
        const sourceNode = nodeList.find(n => n.id === edge.source);
        sourcePos = sourceNode ? { x: sourceNode.position.x, y: sourceNode.position.y } : { x: 0, y: 0 };
      }
      if (!targetPos) {
        const targetNode = nodeList.find(n => n.id === edge.target);
        targetPos = targetNode ? { x: targetNode.position.x, y: targetNode.position.y } : { x: 0, y: 0 };
      }
      
      ctx.save();
      
      // Look up style from edgeTypes
      const typeDef = edgeTypes[edge.type] || {};
      const styleDef = typeDef.style || {};
      
      // Base color
      let color = styleDef.color || theme.palette.primary.main;
      let lineWidth = styleDef.width || 2;
      let opacity = 1;
      
      // Apply selection styling
      if (isSelected) {
        color = theme.palette.secondary.main;
        lineWidth = lineWidth + 2;
        opacity = 1;
        
        // Add glow effect for selected edges
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else if (isHovered) {
        lineWidth = lineWidth + 1;
        opacity = 0.8;
        ctx.shadowColor = color;
        ctx.shadowBlur = 5;
      }
      
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = opacity;
      ctx.setLineDash(styleDef.dash || []);
      
      // Determine if edge should be curved
      const isCurved = styleDef.curved === true;
      
      // Choose curve direction
      let curveDirection = curveDirectionOverride;
      if (!curveDirection) {
        const dx = Math.abs(targetPos.x - sourcePos.x);
        const dy = Math.abs(targetPos.y - sourcePos.y);
        curveDirection = dx > dy ? 'horizontal' : 'vertical';
      }
      
      if (isCurved) {
        let midX = (sourcePos.x + targetPos.x) / 2;
        let midY = (sourcePos.y + targetPos.y) / 2;
        
        if (curveDirection === 'horizontal') {
          ctx.beginPath();
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.bezierCurveTo(
            midX, sourcePos.y,
            midX, targetPos.y,
            targetPos.x, targetPos.y
          );
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.bezierCurveTo(
            sourcePos.x, midY,
            targetPos.x, midY,
            targetPos.x, targetPos.y
          );
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
      }
      
      // Draw animated dash for selected edges
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        const time = Date.now() * 0.002;
        const dashLength = 10;
        const gapLength = 10;
        const offset = (time * 20) % (dashLength + gapLength);
        
        ctx.strokeStyle = theme.palette.background.paper || '#ffffff';
        ctx.lineWidth = Math.max(1, lineWidth - 2);
        ctx.globalAlpha = 0.8;
        ctx.setLineDash([dashLength, gapLength]);
        ctx.lineDashOffset = -offset;
        
        ctx.beginPath();
        if (isCurved) {
          let midX = (sourcePos.x + targetPos.x) / 2;
          let midY = (sourcePos.y + targetPos.y) / 2;
          
          if (curveDirection === 'horizontal') {
            ctx.moveTo(sourcePos.x, sourcePos.y);
            ctx.bezierCurveTo(
              midX, sourcePos.y,
              midX, targetPos.y,
              targetPos.x, targetPos.y
            );
          } else {
            ctx.moveTo(sourcePos.x, sourcePos.y);
            ctx.bezierCurveTo(
              sourcePos.x, midY,
              targetPos.x, midY,
              targetPos.x, targetPos.y
            );
          }
        } else {
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
        }
        ctx.stroke();
        
        ctx.restore();
      }
      
      ctx.setLineDash([]);
      ctx.restore();
    });
    
    ctx.restore();
    
    // Request next frame for animation
    if (selectedEdgeIds.length > 0 || selectedEdgeId) {
      requestAnimationFrame(() => {
        // Trigger re-render for animation
        setHoveredEdge(prev => prev);
      });
    }
  }, [edgeList, nodeList, pan, zoom, selectedEdgeId, selectedEdgeIds, canvasSize, hoveredEdge, theme, getHandlePositionForEdge]);

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
      onDoubleClick={handleDoubleClick}
    />
  );
}

export default EdgeLayer;