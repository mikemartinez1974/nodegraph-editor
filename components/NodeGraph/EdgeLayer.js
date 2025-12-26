"use client";

import React, { useRef, useEffect, useState, useContext, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from './eventBus';
import HandlePositionContext from './HandlePositionContext';
import edgeTypes from '../GraphEditor/edgeTypes';
import { setupHiDPICanvas, getCanvasContext, clearCanvas } from './canvasUtils';
import { drawEdgeLabel, isPointInEdgeLabel } from './edgeLabelUtils';
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

// Helper to rotate a point around a center
function rotatePoint(px, py, cx, cy, angleDeg) {
  const angleRad = angleDeg * Math.PI / 180;
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  };
}

// Get intersection point of line from (x1,y1) to (x2,y2) with node boundary, accounting for rotation
function getNodeBoundaryIntersection(x1, y1, x2, y2, nodeX, nodeY, nodeWidth, nodeHeight, rotation = 0) {
  // Transform the line into the node's local (unrotated) space
  const angleRad = -rotation * Math.PI / 180;
  const rotate = (px, py) => {
    const dx = px - nodeX;
    const dy = py - nodeY;
    return {
      x: nodeX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
      y: nodeY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
    };
  };
  const p1 = rotate(x1, y1);
  const p2 = rotate(x2, y2);

  // Intersection math in local space
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: nodeX, y: nodeY };

  const nx = dx / distance;
  const ny = dy / distance;
  const hw = nodeWidth / 2;
  const hh = nodeHeight / 2;
  let t = Infinity;
  if (nx > 0) t = Math.min(t, (hw - (p1.x - nodeX)) / nx);
  if (nx < 0) t = Math.min(t, (-hw - (p1.x - nodeX)) / nx);
  if (ny > 0) t = Math.min(t, (hh - (p1.y - nodeY)) / ny);
  if (ny < 0) t = Math.min(t, (-hh - (p1.y - nodeY)) / ny);
  t = Math.max(0, t);

  // Intersection point in local space
  const localIntersect = {
    x: p1.x + nx * t,
    y: p1.y + ny * t
  };
  // Rotate back to global space
  const globalIntersect = rotatePoint(localIntersect.x, localIntersect.y, nodeX, nodeY, rotation);
  return globalIntersect;
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
  getHandlePositionForEdge: getHandlePositionForEdgeProp,
  showAllEdgeLabels = false, // <-- Add prop
  defaultEdgeRouting = 'auto',
  edgeRoutes = {}
}, ref) => {
  const [canvasSize, setCanvasSize] = useState({ width: '100vw', height: '100vh' });
  const BUNDLE_BUCKET = 160;
  const BUNDLE_SPACING = 14;
  const FAN_SPACING = 10;
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const { getHandlePositionForEdge: getHandlePositionForEdgeContext } = useContext(HandlePositionContext);
  const getHandlePositionForEdge = getHandlePositionForEdgeProp || getHandlePositionForEdgeContext;
  const prevHoveredEdgeRef = useRef(null);
  const edgeDataRef = useRef([]);
  const getNodeCenter = useCallback((node) => {
    if (!node) return { x: 0, y: 0 };
    const w = node.width || 60;
    const h = node.height || 60;
    const left = node.position?.x ?? node.x ?? 0;
    const top = node.position?.y ?? node.y ?? 0;
    return { x: left + w / 2, y: top + h / 2 };
  }, []);

  const getNodeSideFromPoint = useCallback((node, point) => {
    if (!node || !point) return null;
    const w = node.width || 60;
    const h = node.height || 60;
    const left = node.position?.x ?? node.x ?? 0;
    const top = node.position?.y ?? node.y ?? 0;
    const right = left + w;
    const bottom = top + h;
    const distances = {
      left: Math.abs(point.x - left),
      right: Math.abs(point.x - right),
      top: Math.abs(point.y - top),
      bottom: Math.abs(point.y - bottom)
    };
    return Object.keys(distances).reduce((a, b) => (distances[a] < distances[b] ? a : b));
  }, []);

  const getSideNormal = useCallback((side) => {
    switch (side) {
      case 'left':
        return { x: -1, y: 0 };
      case 'right':
        return { x: 1, y: 0 };
      case 'top':
        return { x: 0, y: -1 };
      case 'bottom':
        return { x: 0, y: 1 };
      default:
        return null;
    }
  }, []);

  const getPerpFromNormal = useCallback((normal) => {
    if (!normal) return null;
    return Math.abs(normal.x) > 0 ? { x: 0, y: 1 } : { x: 1, y: 0 };
  }, []);

  const getObstacleRects = useCallback((nodes, sourceId, targetId, padding = 12) => {
    return (nodes || [])
      .filter((node) => node && node.id !== sourceId && node.id !== targetId && node.visible !== false)
      .map((node) => {
        const w = node.width || 60;
        const h = node.height || 60;
        const left = node.position?.x ?? node.x ?? 0;
        const top = node.position?.y ?? node.y ?? 0;
        return {
          left: left - padding,
          right: left + w + padding,
          top: top - padding,
          bottom: top + h + padding
        };
      });
  }, []);

  const segmentIntersectsRect = useCallback((a, b, rect) => {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    if (a.x === b.x) {
      if (a.x < rect.left || a.x > rect.right) return false;
      return maxY >= rect.top && minY <= rect.bottom;
    }
    if (a.y === b.y) {
      if (a.y < rect.top || a.y > rect.bottom) return false;
      return maxX >= rect.left && minX <= rect.right;
    }
    return maxX >= rect.left && minX <= rect.right && maxY >= rect.top && minY <= rect.bottom;
  }, []);

  const routeIsClear = useCallback((segments, obstacles) => {
    for (const [start, end] of segments) {
      for (const rect of obstacles) {
        if (segmentIntersectsRect(start, end, rect)) return false;
      }
    }
    return true;
  }, [segmentIntersectsRect]);
  
  // Animation refs
  const animationStartTimeRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Keep fresh references to avoid stale closures in animation loop
  const edgeListRef = useRef(edgeList);
  const nodeListRef = useRef(nodeList);
  const edgeRoutesRef = useRef(edgeRoutes);
  
  useEffect(() => {
    edgeListRef.current = edgeList;
    nodeListRef.current = nodeList;
    edgeRoutesRef.current = edgeRoutes;
  }, [edgeList, nodeList, edgeRoutes]);

  useImperativeHandle(ref, () => ({
    redraw: () => drawEdges()
  }));

  const buildSegmentsFromPoints = (points = []) => {
    if (!Array.isArray(points) || points.length < 2) return null;
    const segments = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i];
      const end = points[i + 1];
      if (!start || !end) continue;
      if (start.x === end.x && start.y === end.y) continue;
      segments.push([{ x: start.x, y: start.y }, { x: end.x, y: end.y }]);
    }
    return segments.length > 0 ? segments : null;
  };

  function drawEdges() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvasContext(canvas);
    
    const devicePixelRatio = setupHiDPICanvas(canvas, ctx, canvasSize.width, canvasSize.height);
    clearCanvas(ctx, canvasSize.width, canvasSize.height);

    const newEdgeData = [];
    
    // Calculate time in seconds from animation start
    if (!animationStartTimeRef.current) {
      animationStartTimeRef.current = performance.now();
    }
    const elapsed = (performance.now() - animationStartTimeRef.current) / 1000;
    const time = elapsed;

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

    const bundleGroups = new Map();
    const bundleOffsets = new Map();
    const fanSourceGroups = new Map();
    const fanTargetGroups = new Map();
    const fanSourceOffsets = new Map();
    const fanTargetOffsets = new Map();

    visibleEdges.forEach((edge) => {
      let sourcePos = null;
      let targetPos = null;
      let sourceSide = null;
      let targetSide = null;

      if (typeof getHandlePositionForEdge === 'function') {
        const sourceHandleKey = edge.sourceHandle || edge.handleMeta?.source?.key;
        const targetHandleKey = edge.targetHandle || edge.handleMeta?.target?.key;
        const sourceResult = getHandlePositionForEdge(edge.source, edge.target, 'source', sourceHandleKey, targetHandleKey);
        const targetResult = getHandlePositionForEdge(edge.source, edge.target, 'target', sourceHandleKey, targetHandleKey);
        if (sourceResult && typeof sourceResult === 'object') {
          sourcePos = { x: sourceResult.x, y: sourceResult.y };
          if (sourceResult.side) sourceSide = sourceResult.side;
        }
        if (targetResult && typeof targetResult === 'object') {
          targetPos = { x: targetResult.x, y: targetResult.y };
          if (targetResult.side) targetSide = targetResult.side;
        }
      }

      if (!sourcePos) {
        const sourceNode = nodeListRef.current.find(n => n.id === edge.source);
        sourcePos = getNodeCenter(sourceNode);
        if (!sourceSide && sourceNode) sourceSide = getNodeSideFromPoint(sourceNode, sourcePos);
      }
      if (!targetPos) {
        const targetNode = nodeListRef.current.find(n => n.id === edge.target);
        targetPos = getNodeCenter(targetNode);
        if (!targetSide && targetNode) targetSide = getNodeSideFromPoint(targetNode, targetPos);
      }

      const midX = (sourcePos.x + targetPos.x) / 2;
      const midY = (sourcePos.y + targetPos.y) / 2;
      const sourceAxis = getSideNormal(sourceSide)
        ? (getSideNormal(sourceSide).x !== 0 ? 'horizontal' : 'vertical')
        : 'mixed';
      const targetAxis = getSideNormal(targetSide)
        ? (getSideNormal(targetSide).x !== 0 ? 'horizontal' : 'vertical')
        : 'mixed';

      let key;
      if (sourceAxis === 'horizontal' && targetAxis === 'horizontal') {
        key = `h-${Math.round(midX / BUNDLE_BUCKET)}`;
      } else if (sourceAxis === 'vertical' && targetAxis === 'vertical') {
        key = `v-${Math.round(midY / BUNDLE_BUCKET)}`;
      } else {
        key = `m-${Math.round(midX / BUNDLE_BUCKET)}-${Math.round(midY / BUNDLE_BUCKET)}`;
      }

      const groupKey = `${sourceSide || 'none'}-${targetSide || 'none'}-${key}`;
      if (!bundleGroups.has(groupKey)) bundleGroups.set(groupKey, []);
      bundleGroups.get(groupKey).push(edge.id);

      if (sourceSide) {
        const sourceKey = `source-${edge.source}-${sourceSide}`;
        if (!fanSourceGroups.has(sourceKey)) fanSourceGroups.set(sourceKey, []);
        fanSourceGroups.get(sourceKey).push(edge.id);
      }
      if (targetSide) {
        const targetKey = `target-${edge.target}-${targetSide}`;
        if (!fanTargetGroups.has(targetKey)) fanTargetGroups.set(targetKey, []);
        fanTargetGroups.get(targetKey).push(edge.id);
      }
    });

    for (const ids of bundleGroups.values()) {
      if (ids.length < 2) continue;
      const sorted = [...ids].sort();
      const mid = (sorted.length - 1) / 2;
      sorted.forEach((id, index) => {
        bundleOffsets.set(id, (index - mid) * BUNDLE_SPACING);
      });
    }

    const assignFanOffsets = (groupMap, targetMap) => {
      for (const ids of groupMap.values()) {
        if (ids.length < 2) continue;
        const sorted = [...ids].sort();
        const mid = (sorted.length - 1) / 2;
        sorted.forEach((id, index) => {
          targetMap.set(id, (index - mid) * FAN_SPACING);
        });
      }
    };
    assignFanOffsets(fanSourceGroups, fanSourceOffsets);
    assignFanOffsets(fanTargetGroups, fanTargetOffsets);
    
    visibleEdges.forEach(edge => {
      const isSelected = selectedEdgeIds.includes(edge.id) || selectedEdgeId === edge.id;
      const isHovered = hoveredEdge === edge.id;
      const bundleOffset = bundleOffsets.get(edge.id) || 0;
      const sourceFan = fanSourceOffsets.get(edge.id) || 0;
      const targetFan = fanTargetOffsets.get(edge.id) || 0;
      
      let sourcePos, targetPos, curveDirectionOverride;
      let sourceFromHandle = false;
      let targetFromHandle = false;
      let sourceSide = null;
      let targetSide = null;
      
      if (typeof getHandlePositionForEdge === 'function') {
        const sourceHandleKey = edge.sourceHandle || edge.handleMeta?.source?.key;
        const targetHandleKey = edge.targetHandle || edge.handleMeta?.target?.key;
        const sourceResult = getHandlePositionForEdge(edge.source, edge.target, 'source', sourceHandleKey, targetHandleKey);
        const targetResult = getHandlePositionForEdge(edge.source, edge.target, 'target', sourceHandleKey, targetHandleKey);
        
        if (sourceResult && typeof sourceResult === 'object') {
          sourcePos = { x: sourceResult.x, y: sourceResult.y };
          sourceFromHandle = sourceResult.fromHandle === true;
          if (sourceResult.side) sourceSide = sourceResult.side;
          if (sourceResult.curveDirection) curveDirectionOverride = sourceResult.curveDirection;
        } else {
          sourcePos = sourceResult;
        }
        
        if (targetResult && typeof targetResult === 'object') {
          targetPos = { x: targetResult.x, y: targetResult.y };
          targetFromHandle = targetResult.fromHandle === true;
          if (targetResult.side) targetSide = targetResult.side;
          if (targetResult.curveDirection) curveDirectionOverride = targetResult.curveDirection;
        } else {
          targetPos = targetResult;
        }
      }
      
      if (!sourcePos) {
        const sourceNode = nodeListRef.current.find(n => n.id === edge.source);
        sourcePos = getNodeCenter(sourceNode);
      }
      if (!targetPos) {
        const targetNode = nodeListRef.current.find(n => n.id === edge.target);
        targetPos = getNodeCenter(targetNode);
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

      // Calculate edge-to-edge intersection points
      const sourceNode = nodeListRef.current.find(n => n.id === edge.source);
      const targetNode = nodeListRef.current.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const sourceWidth = sourceNode.width || 60;
        const sourceHeight = sourceNode.height || 60;
        const targetWidth = targetNode.width || 60;
        const targetHeight = targetNode.height || 60;
        const sourceRotation = sourceNode.data?.rotation || 0;
        const targetRotation = targetNode.data?.rotation || 0;
        const sourceCenter = getNodeCenter(sourceNode);
        const targetCenter = getNodeCenter(targetNode);

        if (!sourceFromHandle) {
          const start = sourcePos || sourceCenter;
          const end = targetPos || targetCenter;
          sourcePos = getNodeBoundaryIntersection(
            start.x, start.y,
            end.x, end.y,
            sourceCenter.x, sourceCenter.y,
            sourceWidth, sourceHeight,
            sourceRotation
          );
        }

        if (!targetFromHandle) {
          const start = targetPos || targetCenter;
          const end = sourcePos || sourceCenter;
          targetPos = getNodeBoundaryIntersection(
            start.x, start.y,
            end.x, end.y,
            targetCenter.x, targetCenter.y,
            targetWidth, targetHeight,
            targetRotation
          );
        }
      }

      if (!sourceSide && sourceNode && sourcePos) {
        sourceSide = getNodeSideFromPoint(sourceNode, sourcePos);
      }
      if (!targetSide && targetNode && targetPos) {
        targetSide = getNodeSideFromPoint(targetNode, targetPos);
      }

      const obstacleRects = getObstacleRects(nodeListRef.current, edge.source, edge.target, 12);
      
      ctx.save();
      
      const typeDef = edgeTypes[edge.type] || {};
      const styleDef = typeDef.style || {};
      
      // Merge styles: edge.style overrides type defaults
      const style = {
        color: edge.color || edge.style?.color || styleDef.color || theme.palette.text.secondary,
        width: edge.style?.width ?? styleDef.width ?? 2,
        dash: edge.style?.dash ?? styleDef.dash ?? [],
        curved: edge.style?.curved ?? styleDef.curved ?? false,
        route: edge.style?.route ?? edge.style?.routing ?? edge.style?.router ?? styleDef.route,
        orthogonal: edge.style?.orthogonal ?? styleDef.orthogonal ?? false,
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
      
      // Apply pulse animation (modulate width and opacity)
      if (style.animation === 'pulse') {
        const pulsePhase = Math.sin(time * Math.PI * 2 * style.animationSpeed);
        const pulseFactor = 0.5 + pulsePhase * 0.5; // 0 to 1
        lineWidth = lineWidth * (1 + pulseFactor * 0.5); // Pulse width 100% to 150%
        opacity = opacity * (0.6 + pulseFactor * 0.4); // Pulse opacity 60% to 100%
      }
      
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
      
      // Setup dash pattern
      if (style.animation === 'dash') {
        // Use dash pattern for animated dash, or create one if none exists
        const dashArray = style.dash.length > 0 ? style.dash : [8, 4];
        ctx.setLineDash(dashArray);
        const dashSum = dashArray.reduce((a, b) => a + b, 0);
        const offset = (time * 30 * style.animationSpeed) % dashSum;
        ctx.lineDashOffset = -offset;
      } else {
        ctx.setLineDash(style.dash);
      }
      
      const routeOverride = edgeRoutesRef.current?.[edge.id];
      const routedPoints = Array.isArray(routeOverride?.points) ? routeOverride.points : null;
      const allowRoutedSegments = !(draggingInfoRef?.current?.nodeIds?.length);
      const routedSegments = allowRoutedSegments ? buildSegmentsFromPoints(routedPoints) : null;
      const useRoutedSegments = Boolean(routedSegments && routedSegments.length);

      if (useRoutedSegments) {
        sourcePos = { x: routedPoints[0].x, y: routedPoints[0].y };
        targetPos = { x: routedPoints[routedPoints.length - 1].x, y: routedPoints[routedPoints.length - 1].y };
        sourceFromHandle = true;
        targetFromHandle = true;
      }

      const routeStyle = style.route;
      const forceRouting = defaultEdgeRouting && defaultEdgeRouting !== 'auto';
      const isOrthogonal = useRoutedSegments
        ? true
        : forceRouting
        ? defaultEdgeRouting === 'orthogonal'
        : routeStyle === 'orthogonal' || style.orthogonal === true;
      const isCurved = forceRouting
        ? defaultEdgeRouting === 'curved'
        : !isOrthogonal && style.curved;
      let curveDirection = curveDirectionOverride || styleDef.curveDirection || 'auto';
      
      if (curveDirection === 'auto') {
        const dx = Math.abs(targetPos.x - sourcePos.x);
        const dy = Math.abs(targetPos.y - sourcePos.y);
        curveDirection = dx > dy ? 'horizontal' : 'vertical';
      }
      
      let midX = (sourcePos.x + targetPos.x) / 2;
      let midY = (sourcePos.y + targetPos.y) / 2;
      let cp1 = null;
      let cp2 = null;
      const useHandleControls = isCurved && (sourceSide || targetSide || sourceFromHandle || targetFromHandle);

      if (useHandleControls) {
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const dist = Math.hypot(dx, dy) || 1;
        const base = Math.max(40, Math.min(220, dist * 0.35));
        const normalize = (x, y, fallbackX, fallbackY) => {
          const len = Math.hypot(x, y);
          if (!len) return { x: fallbackX, y: fallbackY };
          return { x: x / len, y: y / len };
        };

        const sourceCenter = sourceNode ? getNodeCenter(sourceNode) : sourcePos;
        const targetCenter = targetNode ? getNodeCenter(targetNode) : targetPos;
        const fallbackDir = normalize(dx, dy, 1, 0);
        const sourceNormal = getSideNormal(sourceSide);
        const targetNormal = getSideNormal(targetSide);
        const sourceDir = sourceNormal
          ? sourceNormal
          : sourceFromHandle
          ? normalize(sourcePos.x - sourceCenter.x, sourcePos.y - sourceCenter.y, fallbackDir.x, fallbackDir.y)
          : fallbackDir;
        const targetDir = targetNormal
          ? targetNormal
          : targetFromHandle
          ? normalize(targetPos.x - targetCenter.x, targetPos.y - targetCenter.y, -fallbackDir.x, -fallbackDir.y)
          : { x: -fallbackDir.x, y: -fallbackDir.y };

        cp1 = { x: sourcePos.x + sourceDir.x * base, y: sourcePos.y + sourceDir.y * base };
        cp2 = { x: targetPos.x + targetDir.x * base, y: targetPos.y + targetDir.y * base };
        curveDirection = 'custom';
        const midPoint = getBezierPoint(0.5, sourcePos.x, sourcePos.y, cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y);
        midX = midPoint.x;
        midY = midPoint.y;
      }
      
      const buildOrthogonalSegments = () => {
        const lead = 24;
        const sourceNormal = getSideNormal(sourceSide);
        const targetNormal = getSideNormal(targetSide);
        const sourcePerp = getPerpFromNormal(sourceNormal);
        const targetPerp = getPerpFromNormal(targetNormal);
        const sourceLead = sourceNormal
          ? { x: sourcePos.x + sourceNormal.x * lead, y: sourcePos.y + sourceNormal.y * lead }
          : sourcePos;
        const targetLead = targetNormal
          ? { x: targetPos.x + targetNormal.x * lead, y: targetPos.y + targetNormal.y * lead }
          : targetPos;

        const sourceLeadAdj = sourcePerp
          ? { x: sourceLead.x + sourcePerp.x * sourceFan, y: sourceLead.y + sourcePerp.y * sourceFan }
          : sourceLead;
        const targetLeadAdj = targetPerp
          ? { x: targetLead.x + targetPerp.x * targetFan, y: targetLead.y + targetPerp.y * targetFan }
          : targetLead;

        const sourceAxis = sourceNormal
          ? (sourceNormal.x !== 0 ? 'horizontal' : 'vertical')
          : curveDirection;
        const targetAxis = targetNormal
          ? (targetNormal.x !== 0 ? 'horizontal' : 'vertical')
          : curveDirection;

        const segments = [];
        const push = (a, b) => {
          if (!a || !b) return;
          if (a.x === b.x && a.y === b.y) return;
          segments.push([a, b]);
        };

        const finalize = (coreSegments) => {
          const fullSegments = [];
          const add = (a, b) => {
            if (!a || !b) return;
            if (a.x === b.x && a.y === b.y) return;
            fullSegments.push([a, b]);
          };
          add(sourcePos, sourceLeadAdj);
          coreSegments.forEach(([a, b]) => add(a, b));
          add(targetLeadAdj, targetPos);
          return fullSegments;
        };

        const tryRoutes = (candidates) => {
          for (const coreSegments of candidates) {
            const fullSegments = finalize(coreSegments);
            if (routeIsClear(fullSegments, obstacleRects)) return fullSegments;
          }
          return finalize(candidates[0] || []);
        };

        if (sourceAxis === 'horizontal' && targetAxis === 'horizontal') {
          const baseMid = (sourceLeadAdj.x + targetLeadAdj.x) / 2 + bundleOffset;
          const offsets = [0, 40, -40, 80, -80, 120, -120];
          const candidates = offsets.map((offset) => {
            const mid = baseMid + offset;
            const p1 = { x: mid, y: sourceLeadAdj.y };
            const p2 = { x: mid, y: targetLeadAdj.y };
            return [[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]];
          });
          return tryRoutes(candidates);
        }

        if (sourceAxis === 'vertical' && targetAxis === 'vertical') {
          const baseMid = (sourceLeadAdj.y + targetLeadAdj.y) / 2 + bundleOffset;
          const offsets = [0, 40, -40, 80, -80, 120, -120];
          const candidates = offsets.map((offset) => {
            const mid = baseMid + offset;
            const p1 = { x: sourceLeadAdj.x, y: mid };
            const p2 = { x: targetLeadAdj.x, y: mid };
            return [[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]];
          });
          return tryRoutes(candidates);
        }

        if (sourceAxis === 'horizontal' && targetAxis === 'vertical') {
          const corner = { x: targetLeadAdj.x, y: sourceLeadAdj.y + bundleOffset };
          const altCorner = { x: sourceLeadAdj.x + lead, y: targetLeadAdj.y + bundleOffset };
          const candidates = [
            [[sourceLeadAdj, corner], [corner, targetLeadAdj]],
            [[sourceLeadAdj, altCorner], [altCorner, targetLeadAdj]]
          ];
          return tryRoutes(candidates);
        }

        if (sourceAxis === 'vertical' && targetAxis === 'horizontal') {
          const corner = { x: sourceLeadAdj.x + bundleOffset, y: targetLeadAdj.y };
          const altCorner = { x: targetLeadAdj.x + bundleOffset, y: sourceLeadAdj.y - lead };
          const candidates = [
            [[sourceLeadAdj, corner], [corner, targetLeadAdj]],
            [[sourceLeadAdj, altCorner], [altCorner, targetLeadAdj]]
          ];
          return tryRoutes(candidates);
        }

        const p1 = { x: midX, y: sourcePos.y };
        const p2 = { x: midX, y: targetPos.y };
        return finalize([[sourcePos, p1], [p1, p2], [p2, targetPos]]);
      };

      const getPointOnSegments = (segments, t) => {
        const lengths = segments.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
        const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
        let remaining = t * total;
        for (let i = 0; i < segments.length; i += 1) {
          const segLen = lengths[i];
          if (remaining <= segLen || i === segments.length - 1) {
            const ratio = segLen === 0 ? 0 : remaining / segLen;
            const [a, b] = segments[i];
            return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
          }
          remaining -= segLen;
        }
        return segments[segments.length - 1][1];
      };

      const orthogonalSegments = isOrthogonal
        ? (useRoutedSegments ? routedSegments : buildOrthogonalSegments())
        : null;

      // Draw edge path
      if (isOrthogonal) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        orthogonalSegments.forEach(([, end]) => {
          ctx.lineTo(end.x, end.y);
        });
        ctx.stroke();
      } else if (isCurved) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        if (useHandleControls && cp1 && cp2) {
          ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y);
        } else if (curveDirection === 'horizontal') {
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
          if (isOrthogonal) {
            const last = orthogonalSegments[orthogonalSegments.length - 1];
            angle = Math.atan2(last[1].y - last[0].y, last[1].x - last[0].x);
            arrowPos = targetPos;
          } else if (isCurved) {
            if (useHandleControls && cp1 && cp2) {
              angle = getBezierAngle(0.99, sourcePos.x, sourcePos.y, cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y);
              arrowPos = getBezierPoint(0.99, sourcePos.x, sourcePos.y, cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y);
            } else if (curveDirection === 'horizontal') {
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
          if (isOrthogonal) {
            const first = orthogonalSegments[0];
            angle = Math.atan2(first[0].y - first[1].y, first[0].x - first[1].x);
            arrowPos = sourcePos;
          } else if (isCurved) {
            if (useHandleControls && cp1 && cp2) {
              angle = getBezierAngle(0.01, sourcePos.x, sourcePos.y, cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y) + Math.PI;
              arrowPos = getBezierPoint(0.01, sourcePos.x, sourcePos.y, cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y);
            } else if (curveDirection === 'horizontal') {
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
          if (isOrthogonal) {
            particlePos = getPointOnSegments(orthogonalSegments, t);
          } else if (isCurved) {
            if (useHandleControls && cp1 && cp2) {
              particlePos = getBezierPoint(t, sourcePos.x, sourcePos.y, cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y);
            } else if (curveDirection === 'horizontal') {
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
        if (isOrthogonal) {
          ctx.moveTo(sourcePos.x, sourcePos.y);
          orthogonalSegments.forEach(([, end]) => {
            ctx.lineTo(end.x, end.y);
          });
        } else if (isCurved) {
          ctx.moveTo(sourcePos.x, sourcePos.y);
          if (useHandleControls && cp1 && cp2) {
            ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, targetPos.x, targetPos.y);
          } else if (curveDirection === 'horizontal') {
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
        // Pass sourcePos, targetPos, curve info to drawEdgeLabel
        drawEdgeLabel(ctx, { 
          ...edge, 
          sourcePos, 
          targetPos, 
          midX, 
          midY, 
          cp1,
          cp2,
          isOrthogonal,
          curveDirection,
          style: { ...edge.style, curved: isCurved }
        }, theme);
      }
      
      // Store edge data for hit testing
      newEdgeData.push({
        id: edge.id,
        sourcePos,
        targetPos,
        isCurved,
        isOrthogonal,
        curveDirection,
        midX,
        midY,
        cp1,
        cp2,
        segments: orthogonalSegments,
        label: edge.label,
        style: edge.style
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
    
    // Only schedule next frame if we don't already have one pending
    if (hasAnimations && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null;
        drawEdges();
      });
    }
  }



  useEffect(() => {
    // Cancel any existing animation frame before starting new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    drawEdges();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
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
    let hitLabel = false;
    
    for (const edgeData of edgeDataRef.current) {
      // Check label hit test FIRST (labels take priority)
      const labelHit = isPointInEdgeLabel({ x: graphX, y: graphY }, edgeData, theme);
      
      if (labelHit) {
        found = edgeData.id;
        hitLabel = true;
        break;
      }
      
      // Then check edge path hit test
      let edgeHit = false;
      if (edgeData.isOrthogonal && edgeData.segments) {
        edgeHit = edgeData.segments.some(([start, end]) =>
          isPointNearLine(graphX, graphY, start.x, start.y, end.x, end.y)
        );
      } else if (edgeData.isCurved) {
        if (edgeData.cp1 && edgeData.cp2) {
          edgeHit = isPointNearBezier(
            graphX, graphY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.cp1.x, edgeData.cp1.y,
            edgeData.cp2.x, edgeData.cp2.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        } else if (edgeData.curveDirection === 'horizontal') {
          edgeHit = isPointNearBezier(
            graphX, graphY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.midX, edgeData.sourcePos.y,
            edgeData.midX, edgeData.targetPos.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        } else {
          edgeHit = isPointNearBezier(
            graphX, graphY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.sourcePos.x, edgeData.midY,
            edgeData.targetPos.x, edgeData.midY,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        }
      } else {
        edgeHit = isPointNearLine(
          graphX, graphY,
          edgeData.sourcePos.x, edgeData.sourcePos.y,
          edgeData.targetPos.x, edgeData.targetPos.y
        );
      }
      
      if (edgeHit) {
        found = edgeData.id;
        hitLabel = false;
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
  
  const handleEdgeHitTest = useCallback((clientX, clientY) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (clientX - rect.left - pan.x) / zoom;
    const mouseY = (clientY - rect.top - pan.y) / zoom;

    for (const edge of edgeListRef.current) {
      const edgeData = edgeDataRef.current.find(ed => ed.id === edge.id);
      if (!edgeData) continue;

      let hit = false;
      if (edgeData.isOrthogonal && edgeData.segments) {
        hit = edgeData.segments.some(([start, end]) =>
          isPointNearLine(mouseX, mouseY, start.x, start.y, end.x, end.y)
        );
      } else if (edgeData.isCurved) {
        if (edgeData.cp1 && edgeData.cp2) {
          hit = isPointNearBezier(
            mouseX, mouseY,
            edgeData.sourcePos.x, edgeData.sourcePos.y,
            edgeData.cp1.x, edgeData.cp1.y,
            edgeData.cp2.x, edgeData.cp2.y,
            edgeData.targetPos.x, edgeData.targetPos.y
          );
        } else if (edgeData.curveDirection === 'horizontal') {
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
      if (!hit) {
        hit = isPointInEdgeLabel({ x: mouseX, y: mouseY }, edgeData, theme);
      }
      if (hit) {
        return edge;
      }
    }
    return null;
  }, [pan, zoom, theme]);

  const handleClick = useCallback((e) => {
    const edge = handleEdgeHitTest(e.clientX, e.clientY);
    if (edge && onEdgeClick) {
      onEdgeClick(edge, e);
    }
  }, [handleEdgeHitTest, onEdgeClick]);

  const handleDoubleClick = useCallback((e) => {
    const edge = handleEdgeHitTest(e.clientX, e.clientY);
    if (edge && onEdgeDoubleClick) {
      onEdgeDoubleClick(edge, e);
    }
  }, [handleEdgeHitTest, onEdgeDoubleClick]);

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
