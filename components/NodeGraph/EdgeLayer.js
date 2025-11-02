"use client";

import React, { useRef, useEffect, useState, useContext, forwardRef, useImperativeHandle } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';
import edgeTypes from '../GraphEditor/edgeTypes';
import { setupHiDPICanvas, getCanvasContext, clearCanvas } from './canvasUtils';
import { drawEdgeLabel } from './edgeLabelUtils';
import { getEdgeHandlePosition, isPointNearLine, isPointNearBezier } from './utils';

// Draw arrow at position
function drawArrow(ctx, x, y, angle, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 2);
  ctx.lineTo(-size, size / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Get angle at point on bezier curve
function getBezierAngle(t, x1, y1, cx1, cy1, cx2, cy2, x2, y2) {
  const dx = 3 * Math.pow(1 - t, 2) * (cx1 - x1) + 
             6 * (1 - t) * t * (cx2 - cx1) + 
             3 * Math.pow(t, 2) * (x2 - cx2);
  const dy = 3 * Math.pow(1 - t, 2) * (cy1 - y1) + 
             6 * (1 - t) * t * (cy2 - cy1) + 
             3 * Math.pow(t, 2) * (y2 - cy2);
  return Math.atan2(dy, dx);
}

// Get point on bezier curve
function getBezierPoint(t, x1, y1, cx1, cy1, cx2, cy2, x2, y2) {
  const x = Math.pow(1 - t, 3) * x1 + 3 * Math.pow(1 - t, 2) * t * cx1 + 
            3 * (1 - t) * Math.pow(t, 2) * cx2 + Math.pow(t, 3) * x2;
  const y = Math.pow(1 - t, 3) * y1 + 3 * Math.pow(1 - t, 2) * t * cy1 + 
            3 * (1 - t) * Math.pow(t, 2) * cy2 + Math.pow(t, 3) * y2;
  return { x, y };
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
  draggingInfoRef,
  showAllEdgeLabels = false // <-- Add prop
}, ref) => {
  const [canvasSize, setCanvasSize] = useState({ width: '100vw', height: '100vh' });
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const { getHandlePositionForEdge } = useContext(HandlePositionContext);
  const prevHoveredEdgeRef = useRef(null);
  const edgeDataRef = useRef([]);
  const animationFrameRef = useRef(null);
  const animationTimeRef = useRef(0);
  
  // Keep fresh references to avoid stale closures in animation loop
  const edgeListRef = useRef(edgeList);
  const nodeListRef = useRef(nodeList);
  
  useEffect(() => {
    edgeListRef.current = edgeList;
    nodeListRef.current = nodeList;
  }, [edgeList, nodeList]);

  useImperativeHandle(ref, () => ({
    redraw: () => drawEdges()
  }));

  function drawEdges() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvasContext(canvas);
    
    const devicePixelRatio = setupHiDPICanvas(canvas, ctx, canvasSize.width, canvasSize.height);
    clearCanvas(ctx, canvasSize.width, canvasSize.height);

    const newEdgeData = [];
    const time = animationTimeRef.current;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    const visibleEdges = edgeListRef.current.filter(edge => {
      if (edge.visible === false) return false;
      const sourceNode = nodeListRef.current.find(n => n.id === edge.source);
      const targetNode = nodeListRef.current.find(n => n.id === edge.target);
      if (sourceNode?.visible === false || targetNode?.visible === false) return false;
      return true;
    });
    
    visibleEdges.forEach(edge => {
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
      
      if (!sourcePos) {
        const sourceNode = nodeListRef.current.find(n => n.id === edge.source);
        sourcePos = sourceNode ? { x: sourceNode.position.x, y: sourceNode.position.y } : { x: 0, y: 0 };
      }
      if (!targetPos) {
        const targetNode = nodeListRef.current.find(n => n.id === edge.target);
        targetPos = targetNode ? { x: targetNode.position.x, y: targetNode.position.y } : { x: 0, y: 0 };
      }

      // Apply dragging offset
      if (draggingInfoRef?.current?.nodeIds) {
        if (draggingInfoRef.current.nodeIds.includes(edge.source)) {
          sourcePos = {
            x: sourcePos.x + draggingInfoRef.current.offset.x,
            y: sourcePos.y + draggingInfoRef.current.offset.y
          };
        }
        if (draggingInfoRef.current.nodeIds.includes(edge.target)) {
          targetPos = {
            x: targetPos.x + draggingInfoRef.current.offset.x,
            y: targetPos.y + draggingInfoRef.current.offset.y
          };
        }
      }
      
      ctx.save();
      
      const typeDef = edgeTypes[edge.type] || {};
      const styleDef = typeDef.style || {};
      
      // Merge styles: edge.style overrides type defaults
      const style = {
        color: edge.color || edge.style?.color || styleDef.color || theme.palette.text.secondary,
        width: edge.style?.width ?? styleDef.width ?? 2,
        dash: edge.style?.dash ?? styleDef.dash ?? [],
        curved: edge.style?.curved ?? styleDef.curved ?? false,
        opacity: edge.style?.opacity ?? styleDef.opacity ?? 1,
        arrowSize: edge.style?.arrowSize ?? styleDef.arrowSize ?? 8,
        showArrow: edge.style?.showArrow ?? styleDef.showArrow ?? true,
        arrowPosition: edge.style?.arrowPosition ?? styleDef.arrowPosition ?? 'end',
        animation: edge.style?.animation ?? styleDef.animation ?? null,
        animationSpeed: edge.style?.animationSpeed ?? styleDef.animationSpeed ?? 1,
        gradient: edge.style?.gradient ?? styleDef.gradient ?? null
      };
      
      let lineWidth = style.width;
      let opacity = style.opacity;
      
      if (isSelected) {
        lineWidth = lineWidth + 2;
        opacity = 1;
        ctx.shadowColor = style.color;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else if (isHovered) {
        lineWidth = lineWidth + 1;
        opacity = Math.min(1, opacity + 0.2);
        ctx.shadowColor = style.color;
        ctx.shadowBlur = 5;
      }
      
      // Setup stroke style (gradient or solid)
      if (style.gradient) {
        const gradient = ctx.createLinearGradient(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
        gradient.addColorStop(0, style.gradient.start);
        gradient.addColorStop(1, style.gradient.end);
        ctx.strokeStyle = gradient;
      } else {
        ctx.strokeStyle = style.color;
      }
      
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = opacity;
      ctx.setLineDash(style.dash);
      
      // Animation offset for dashed lines
      if (style.animation === 'dash' && style.dash.length > 0) {
        const dashSum = style.dash.reduce((a, b) => a + b, 0);
        const offset = (time * 20 * style.animationSpeed) % dashSum;
        ctx.lineDashOffset = -offset;
      }
      
      const isCurved = style.curved;
      let curveDirection = curveDirectionOverride || styleDef.curveDirection || 'auto';
      
      if (curveDirection === 'auto') {
        const dx = Math.abs(targetPos.x - sourcePos.x);
        const dy = Math.abs(targetPos.y - sourcePos.y);
        curveDirection = dx > dy ? 'horizontal' : 'vertical';
      }
      
      let midX = (sourcePos.x + targetPos.x) / 2;
      let midY = (sourcePos.y + targetPos.y) / 2;
      
      // Draw edge path
      if (isCurved) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        
        if (curveDirection === 'horizontal') {
          ctx.bezierCurveTo(
            midX, sourcePos.y,
            midX, targetPos.y,
            targetPos.x, targetPos.y
          );
        } else {
          ctx.bezierCurveTo(
            sourcePos.x, midY,
            targetPos.x, midY,
            targetPos.x, targetPos.y
          );
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
      }
      
      // Draw arrows
      if (style.showArrow) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        const arrowColor = style.gradient ? style.gradient.end : style.color;
        
        if (style.arrowPosition === 'end' || style.arrowPosition === 'both') {
          let angle, arrowPos;
          if (isCurved) {
            if (curveDirection === 'horizontal') {
              angle = getBezierAngle(0.99, sourcePos.x, sourcePos.y, midX, sourcePos.y, midX, targetPos.y, targetPos.x, targetPos.y);
              arrowPos = getBezierPoint(0.99, sourcePos.x, sourcePos.y, midX, sourcePos.y, midX, targetPos.y, targetPos.x, targetPos.y);
            } else {
              angle = getBezierAngle(0.99, sourcePos.x, sourcePos.y, sourcePos.x, midY, targetPos.x, midY, targetPos.x, targetPos.y);
              arrowPos = getBezierPoint(0.99, sourcePos.x, sourcePos.y, sourcePos.x, midY, targetPos.x, midY, targetPos.x, targetPos.y);
            }
          } else {
            angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
            arrowPos = targetPos;
          }
          drawArrow(ctx, arrowPos.x, arrowPos.y, angle, style.arrowSize, arrowColor);
        }
        
        if (style.arrowPosition === 'start' || style.arrowPosition === 'both') {
          let angle, arrowPos;
          if (isCurved) {
            if (curveDirection === 'horizontal') {
              angle = getBezierAngle(0.01, sourcePos.x, sourcePos.y, midX, sourcePos.y, midX, targetPos.y, targetPos.x, targetPos.y) + Math.PI;
              arrowPos = getBezierPoint(0.01, sourcePos.x, sourcePos.y, midX, sourcePos.y, midX, targetPos.y, targetPos.x, targetPos.y);
            } else {
              angle = getBezierAngle(0.01, sourcePos.x, sourcePos.y, sourcePos.x, midY, targetPos.x, midY, targetPos.x, targetPos.y) + Math.PI;
              arrowPos = getBezierPoint(0.01, sourcePos.x, sourcePos.y, sourcePos.x, midY, targetPos.x, midY, targetPos.x, targetPos.y);
            }
          } else {
            angle = Math.atan2(sourcePos.y - targetPos.y, sourcePos.x - targetPos.x);
            arrowPos = sourcePos;
          }
          drawArrow(ctx, arrowPos.x, arrowPos.y, angle, style.arrowSize, style.gradient ? style.gradient.start : arrowColor);
        }
      }
      
      // Flow animation (moving particles)
      if (style.animation === 'flow' && !isSelected) {
        const particleCount = 3;
        const particleSize = 4;
        
        for (let i = 0; i < particleCount; i++) {
          const offset = (i / particleCount) + (time * 0.3 * style.animationSpeed);
          const t = (offset % 1);
          
          let particlePos;
          if (isCurved) {
            if (curveDirection === 'horizontal') {
              particlePos = getBezierPoint(t, sourcePos.x, sourcePos.y, midX, sourcePos.y, midX, targetPos.y, targetPos.x, targetPos.y);
            } else {
              particlePos = getBezierPoint(t, sourcePos.x, sourcePos.y, sourcePos.x, midY, targetPos.x, midY, targetPos.x, targetPos.y);
            }
          } else {
            particlePos = {
              x: sourcePos.x + (targetPos.x - sourcePos.x) * t,
              y: sourcePos.y + (targetPos.y - sourcePos.y) * t
            };
          }
          
          ctx.fillStyle = style.gradient ? 
            (t < 0.5 ? style.gradient.start : style.gradient.end) : 
            style.color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(particlePos.x, particlePos.y, particleSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Pulse animation (varying opacity)
      if (style.animation === 'pulse') {
        // Already handled by varying opacity based on time in future frames
        const pulseOpacity = 0.5 + 0.5 * Math.sin(time * 2 * style.animationSpeed);
        ctx.globalAlpha = pulseOpacity;
      }
      
      // Selection animation
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
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
          ctx.moveTo(sourcePos.x, sourcePos.y);
          if (curveDirection === 'horizontal') {
            ctx.bezierCurveTo(midX, sourcePos.y, midX, targetPos.y, targetPos.x, targetPos.y);
          } else {
            ctx.bezierCurveTo(sourcePos.x, midY, targetPos.x, midY, targetPos.x, targetPos.y);
          }
        } else {
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
        }
        ctx.stroke();
        ctx.restore();
      }
      
      // Draw edge label if showAllEdgeLabels or edge.label is non-empty
      if (showAllEdgeLabels || (edge.label && edge.label.trim() !== '')) {
        // Pass sourcePos and targetPos to drawEdgeLabel
        drawEdgeLabel(ctx, { ...edge, sourcePos, targetPos }, theme);
      }
      
      // Store edge data for hit testing
      newEdgeData.push({
        id: edge.id,
        sourcePos,
        targetPos,
        isCurved,
        curveDirection,
        midX,
        midY
      });
      
      ctx.setLineDash([]);
      ctx.restore();
    });
    
    edgeDataRef.current = newEdgeData;
    ctx.restore();
    
    // Continue animation if needed
    const hasAnimations = visibleEdges.some(e => {
      const typeDef = edgeTypes[e.type] || {};
      const animation = e.style?.animation ?? typeDef.style?.animation;
      return animation || selectedEdgeIds.length > 0 || selectedEdgeId;
    });
    
    if (hasAnimations) {
      animationTimeRef.current += 0.016; // ~60fps
      animationFrameRef.current = requestAnimationFrame(() => drawEdges());
    }
  }

  useEffect(() => {
    drawEdges();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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
    const graphX = (e.clientX - rect.left - pan.x) / zoom;
    const graphY = (e.clientY - rect.top - pan.y) / zoom;
    
    const nodeHit = nodeList.find(node => {
      const nodeX = node.position?.x || node.x;
      const nodeY = node.position?.y || node.y;
      const nodeWidth = node.width || 60;
      const nodeHeight = node.height || 60;
      const margin = 30;
      
      return (
        graphX >= nodeX - nodeWidth / 2 - margin &&
        graphX <= nodeX + nodeWidth / 2 + margin &&
        graphY >= nodeY - nodeHeight / 2 - margin &&
        graphY <= nodeY + nodeHeight / 2 + margin
      );
    });
    
    if (nodeHit) {
      eventBus.emit('nodeProximity', { nodeId: nodeHit.id });
      return;
    }
    
    let found = null;
    
    for (const edgeData of edgeDataRef.current) {
      let hit = false;
      if (edgeData.isCurved) {
        if (edgeData.curveDirection === 'horizontal') {
          hit = isPointNearBezier(
            graphX, graphY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.midX, edgeData.sourcePos.y,
            edgeData.midX, edgeData.targetPos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        } else {
          hit = isPointNearBezier(
            graphX, graphY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.sourcePos.x, edgeData.midY,
            edgeData.targetPos.x, edgeData.midY,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        }
      } else {
        hit = isPointNearLine(
          graphX, graphY,
          edgeData.sourcePos.x, edgeData.sourcePos.y,
          edgeData.targetPos.x, edgeData.targetPos.y
        );
      }
      
      if (hit) {
        found = edgeData.id;
        break;
      }
    }
    
    if (prevHoveredEdgeRef.current !== found) {
      if (prevHoveredEdgeRef.current) {
        eventBus.emit('edgeMouseLeave', { id: prevHoveredEdgeRef.current });
      }
      if (found) {
        eventBus.emit('edgeMouseEnter', { id: found });
        eventBus.emit('edgeHover', { edgeId: found });
      }
      prevHoveredEdgeRef.current = found;
    }
    setHoveredEdge(found);
  }

  function handleMouseLeave() {
    if (prevHoveredEdgeRef.current) {
      eventBus.emit('edgeMouseLeave', { id: prevHoveredEdgeRef.current });
      prevHoveredEdgeRef.current = null;
    }
    setHoveredEdge(null);
  }
  
  function handleClick(e) {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    let found = null;
    
    for (const edge of edgeList) {
      const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
      if (!edgeData) continue;
      
      let hit = false;
      if (edgeData.isCurved) {
        if (edgeData.curveDirection === 'horizontal') {
          hit = isPointNearBezier(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.midX, edgeData.sourcePos.y,
            edgeData.midX, edgeData.targetPos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        } else {
          hit = isPointNearBezier(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.sourcePos.x, edgeData.midY,
            edgeData.targetPos.x, edgeData.midY,
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
        break;
      }
    }
    
    if (found && onEdgeClick) {
      const foundEdge = edgeList.find(edge => edge.id === found);
      onEdgeClick(foundEdge || found, e);
    }
  }
  
  function handleDoubleClick(e) {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    let found = null;
    
    for (const edge of edgeList) {
      const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
      if (!edgeData) continue;
      
      let hit = false;
      if (edgeData.isCurved) {
        if (edgeData.curveDirection === 'horizontal') {
          hit = isPointNearBezier(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.midX, edgeData.sourcePos.y,
            edgeData.midX, edgeData.targetPos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        } else {
          hit = isPointNearBezier(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.sourcePos.x, edgeData.midY,
            edgeData.targetPos.x, edgeData.midY,
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
        break;
      }
    }
    
    if (found && onEdgeDoubleClick) {
      onEdgeDoubleClick(found, e);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasSize.width,
        height: canvasSize.height,
        touchAction: 'none',
        cursor: 'crosshair'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    />
  );
});

export default EdgeLayer;