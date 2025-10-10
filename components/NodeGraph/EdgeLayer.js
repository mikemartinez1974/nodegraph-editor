"use client";

import React, { useRef, useEffect, useState, useContext, forwardRef, useImperativeHandle } from 'react';
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

// Helper to get label position on edge
function getEdgeLabelPosition(sourcePos, targetPos, isCurved, curveDirection) {
  if (isCurved) {
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;
    
    if (curveDirection === 'horizontal') {
      const t = 0.5;
      const x = Math.pow(1 - t, 3) * sourcePos.x + 
                3 * Math.pow(1 - t, 2) * t * midX + 
                3 * (1 - t) * Math.pow(t, 2) * midX + 
                Math.pow(t, 3) * targetPos.x;
      const y = Math.pow(1 - t, 3) * sourcePos.y + 
                3 * Math.pow(1 - t, 2) * t * sourcePos.y + 
                3 * (1 - t) * Math.pow(t, 2) * targetPos.y + 
                Math.pow(t, 3) * targetPos.y;
      return { x, y };
    } else {
      const t = 0.5;
      const x = Math.pow(1 - t, 3) * sourcePos.x + 
                3 * Math.pow(1 - t, 2) * t * sourcePos.x + 
                3 * (1 - t) * Math.pow(t, 2) * targetPos.x + 
                Math.pow(t, 3) * targetPos.x;
      const y = Math.pow(1 - t, 3) * sourcePos.y + 
                3 * Math.pow(1 - t, 2) * t * midY + 
                3 * (1 - t) * Math.pow(t, 2) * midY + 
                Math.pow(t, 3) * targetPos.y;
      return { x, y };
    }
  } else {
    return {
      x: (sourcePos.x + targetPos.x) / 2,
      y: (sourcePos.y + targetPos.y) / 2
    };
  }
}

// Draw edge label
function drawEdgeLabel(ctx, label, labelPos, theme, isSelected, isHovered) {
  if (!label) return;
  
  const fontSize = 12;
  const fontFamily = theme?.typography?.fontFamily || 'Arial, sans-serif';
  const padding = 6;
  
  ctx.font = `${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(label);
  const textWidth = metrics.width;
  const textHeight = fontSize;
  
  let bgColor = theme?.palette?.background?.paper || '#ffffff';
  let borderColor = theme?.palette?.divider || '#e0e0e0';
  let textColor = theme?.palette?.text?.primary || '#000000';
  
  if (isSelected) {
    bgColor = theme?.palette?.secondary?.light || '#f48fb1';
    borderColor = theme?.palette?.secondary?.main || '#dc004e';
    textColor = theme?.palette?.secondary?.contrastText || '#000000';
  } else if (isHovered) {
    borderColor = theme?.palette?.primary?.main || '#1976d2';
  }
  
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(
    labelPos.x - textWidth / 2 - padding,
    labelPos.y - textHeight / 2 - padding,
    textWidth + padding * 2,
    textHeight + padding * 2
  );
  
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeRect(
    labelPos.x - textWidth / 2 - padding,
    labelPos.y - textHeight / 2 - padding,
    textWidth + padding * 2,
    textHeight + padding * 2
  );
  
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, labelPos.x, labelPos.y);
  
  ctx.restore();
}

// Check if point is in label bounds (for clicking)
function isPointInLabel(x, y, labelPos, labelText, ctx) {
  if (!labelText || !labelPos) return false;
  
  ctx.save();
  ctx.font = '12px Arial, sans-serif';
  const metrics = ctx.measureText(labelText);
  const textWidth = metrics.width;
  const textHeight = 12;
  const padding = 6;
  
  ctx.restore();
  
  return (
    x >= labelPos.x - textWidth / 2 - padding &&
    x <= labelPos.x + textWidth / 2 + padding &&
    y >= labelPos.y - textHeight / 2 - padding &&
    y <= labelPos.y + textHeight / 2 + padding
  );
}

const EdgeLayer = forwardRef(({ 
  canvasRef, 
  edgeList = [], 
  nodeList = [], 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  selectedEdgeId, 
  selectedEdgeIds = [],
  theme, 
  onEdgeClick, 
  onEdgeDoubleClick, 
  onEdgeHover,
  draggingInfoRef 
}, ref) => {
  const [canvasSize, setCanvasSize] = useState({ width: '100vw', height: '100vh' });
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const { getHandlePositionForEdge } = useContext(HandlePositionContext);
  const prevHoveredEdgeRef = useRef(null);
  const edgeDataRef = useRef([]); // Store edge rendering data for hit testing

  // Expose redraw method via imperative handle
  useImperativeHandle(ref, () => ({
    redraw: () => {
      drawEdges();
    }
  }));

  function drawEdges() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvasContext(canvas);
    
    const devicePixelRatio = setupHiDPICanvas(canvas, ctx, canvasSize.width, canvasSize.height);
    clearCanvas(ctx, canvasSize.width, canvasSize.height);

    const newEdgeData = [];

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    edgeList.forEach(edge => {
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

      // Apply dragging offset if applicable
      if (draggingInfoRef.current && draggingInfoRef.current.nodeId === edge.source) {
        sourcePos = {
          x: sourcePos.x + draggingInfoRef.current.offset.x,
          y: sourcePos.y + draggingInfoRef.current.offset.y
        };
      } else if (draggingInfoRef.current && draggingInfoRef.current.nodeId === edge.target) {
        targetPos = {
          x: targetPos.x + draggingInfoRef.current.offset.x,
          y: targetPos.y + draggingInfoRef.current.offset.y
        };
      }
      
      ctx.save();
      
      const typeDef = edgeTypes[edge.type] || {};
      const styleDef = typeDef.style || {};
      
      let color = styleDef.color || theme.palette.primary.main;
      let lineWidth = styleDef.width || 2;
      let opacity = 1;
      
      if (isSelected) {
        color = theme.palette.secondary.main;
        lineWidth = lineWidth + 2;
        opacity = 1;
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
      
      const isCurved = styleDef.curved === true;
      
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
      
      const label = edge.label || edge.data?.label;
      let labelPos = null;
      
      if (label) {
        labelPos = getEdgeLabelPosition(sourcePos, targetPos, isCurved, curveDirection);
        drawEdgeLabel(ctx, label, labelPos, theme, isSelected, isHovered);
      }
      
      newEdgeData.push({
        id: edge.id,
        sourcePos,
        targetPos,
        isCurved,
        curveDirection,
        label,
        labelPos
      });
      
      ctx.setLineDash([]);
      ctx.restore();
    });
    
    edgeDataRef.current = newEdgeData;
    
    ctx.restore();
    
    // Request next frame for animation
    if (selectedEdgeIds.length > 0 || selectedEdgeId) {
      requestAnimationFrame(() => {
        setHoveredEdge(prev => prev);
      });
    }
  }

  useEffect(() => {
    if (getHandlePositionForEdge && getHandlePositionForEdge._handleKeys && getHandlePositionForEdge._handleKeys.length === 0) {
      return;
    }
    
    drawEdges();
  }, [edgeList, nodeList, pan, zoom, selectedEdgeId, selectedEdgeIds, canvasSize, hoveredEdge, theme, getHandlePositionForEdge, draggingInfoRef]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight * 0.9 });
    }
  }, []);

  useEffect(() => {
    function handleResize() {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleMouseMove(e) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    let found = null;
    
    const ctx = canvasRef.current.getContext('2d');
    
    for (const edgeData of edgeDataRef.current) {
      if (edgeData.label && edgeData.labelPos) {
        if (isPointInLabel(mouseX, mouseY, edgeData.labelPos, edgeData.label, ctx)) {
          found = edgeData.id;
          break;
        }
      }
    }
    
    if (!found) {
      for (const edgeData of edgeDataRef.current) {
        let hit = false;
        if (edgeData.isCurved) {
          const midX = (edgeData.sourcePos.x + edgeData.targetPos.x) / 2;
          const midY = (edgeData.sourcePos.y + edgeData.targetPos.y) / 2;
          
          if (edgeData.curveDirection === 'horizontal') {
            hit = isPointNearBezier(
              mouseX, mouseY,
              edgeData.sourcePos.x, edgeData.sourcePos.y,
              midX, edgeData.sourcePos.y,
              midX, edgeData.targetPos.y,
              edgeData.targetPos.x, edgeData.targetPos.y
            );
          } else {
            hit = isPointNearBezier(
              mouseX, mouseY,
              edgeData.sourcePos.x, edgeData.sourcePos.y,
              edgeData.sourcePos.x, midY,
              edgeData.targetPos.x, midY,
              edgeData.targetPos.x, edgeData.targetPos.y
            );
          }
        } else {
          hit = isPointNearLine(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        }
        
        if (hit) {
          found = edgeData.id;
          break;
        }
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
    
    const ctx = canvasRef.current.getContext('2d');
    
    for (const edge of edgeList) {
      const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
      if (edgeData?.label && edgeData?.labelPos) {
        if (isPointInLabel(mouseX, mouseY, edgeData.labelPos, edgeData.label, ctx)) {
          found = edge.id;
          foundEdge = edge;
          break;
        }
      }
    }
    
    if (!found) {
      for (const edge of edgeList) {
        const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
        if (!edgeData) continue;
        
        let hit = false;
        if (edgeData.isCurved) {
          const midX = (edgeData.sourcePos.x + edgeData.targetPos.x) / 2;
          const midY = (edgeData.sourcePos.y + edgeData.targetPos.y) / 2;
          
          if (edgeData.curveDirection === 'horizontal') {
            hit = isPointNearBezier(
              mouseX, mouseY,
              edgeData.sourcePos.x, edgeData.sourcePos.y,
              midX, edgeData.sourcePos.y,
              midX, edgeData.targetPos.y,
              edgeData.targetPos.x, edgeData.targetPos.y
            );
          } else {
            hit = isPointNearBezier(
              mouseX, mouseY,
              edgeData.sourcePos.x, edgeData.sourcePos.y,
              edgeData.sourcePos.x, midY,
              edgeData.targetPos.x, midY,
              edgeData.targetPos.x, edgeData.targetPos.y
            );
          }
        } else {
          hit = isPointNearLine(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        }
        
        if (hit) {
          found = edge.id;
          foundEdge = edge;
          break;
        }
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
    
    const ctx = canvasRef.current.getContext('2d');
    
    for (const edge of edgeList) {
      const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
      if (edgeData?.label && edgeData?.labelPos) {
        if (isPointInLabel(mouseX, mouseY, edgeData.labelPos, edgeData.label, ctx)) {
          found = edge.id;
          foundEdge = edge;
          break;
        }
      }
    }
    
    if (!found) {
      for (const edge of edgeList) {
        const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
        if (!edgeData) continue;
        
        let hit = false;
        if (edgeData.isCurved) {
          const midX = (edgeData.sourcePos.x + edgeData.targetPos.x) / 2;
          const midY = (edgeData.sourcePos.y + edgeData.targetPos.y) / 2;
          
          if (edgeData.curveDirection === 'horizontal') {
            hit = isPointNearBezier(
              mouseX, mouseY,
              edgeData.sourcePos.x, edgeData.sourcePos.y,
              midX, edgeData.sourcePos.y,
              midX, edgeData.targetPos.y,
              edgeData.targetPos.x, edgeData.targetPos.y
            );
          } else {
            hit = isPointNearBezier(
              mouseX, mouseY,
              edgeData.sourcePos.x, edgeData.sourcePos.y,
              edgeData.sourcePos.x, midY,
              edgeData.targetPos.x, midY,
              edgeData.targetPos.x, edgeData.targetPos.y
            );
          }
        } else {
          hit = isPointNearLine(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        }
        
        if (hit) {
          found = edge.id;
          foundEdge = edge;
          break;
        }
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
    
    const ctx = canvasRef.current.getContext('2d');
    
    for (const edge of edgeList) {
      const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
      if (!edgeData) continue;
      
      if (edgeData.label && edgeData.labelPos) {
        if (isPointInLabel(mouseX, mouseY, edgeData.labelPos, edgeData.label, ctx)) {
          e.stopPropagation();
          break;
        }
      }
      
      let hit = false;
      if (edgeData.isCurved) {
        const midX = (edgeData.sourcePos.x + edgeData.targetPos.x) / 2;
        const midY = (edgeData.sourcePos.y + edgeData.targetPos.y) / 2;
        
        if (edgeData.curveDirection === 'horizontal') {
          hit = isPointNearBezier(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            midX, edgeData.sourcePos.y,
            midX, edgeData.targetPos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        } else {
          hit = isPointNearBezier(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.sourcePos.x, midY,
            edgeData.targetPos.x, midY,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        }
      } else {
        hit = isPointNearLine(
          mouseX, mouseY,
          edgeData.sourcePos.x, edgeData.sourcePos.y,
          edgeData.targetPos.x, edgeData.targetPos.y
        );
      }
      
      if (hit) {
        e.stopPropagation();
        break;
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', zIndex: 10 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    />
  );
});

export default EdgeLayer;