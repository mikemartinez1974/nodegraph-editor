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
  edgeLaneGapPx = 10,
  edgeRoutes = {}
}, ref) => {
  const [canvasSize, setCanvasSize] = useState({ width: '100vw', height: '100vh' });
  const BUNDLE_BUCKET = 160;
  const BUNDLE_SPACING = 14;
  const FAN_SPACING = (() => {
    const value = Number(edgeLaneGapPx);
    if (!Number.isFinite(value)) return 10;
    return Math.max(0, Math.min(50, value));
  })();
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const { getHandlePositionForEdge: getHandlePositionForEdgeContext } = useContext(HandlePositionContext);
  const getHandlePositionForEdge = getHandlePositionForEdgeProp || getHandlePositionForEdgeContext;
  const prevHoveredEdgeRef = useRef(null);
  const edgeDataRef = useRef([]);
  const getDirectionSide = useCallback((from, to) => {
    if (!from || !to) return null;
    const dx = (to.x ?? 0) - (from.x ?? 0);
    const dy = (to.y ?? 0) - (from.y ?? 0);
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax >= ay) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'bottom' : 'top';
  }, []);
  const applyEndpointLaneOffsetsToPoints = useCallback((points, startOffset, endOffset) => {
    const safePoints = Array.isArray(points) ? points : null;
    if (!safePoints || safePoints.length < 2) return safePoints;
    const start = Number(startOffset) || 0;
    const end = Number(endOffset) || 0;
    if (!start && !end) return safePoints;

    const normalizedPerp = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      if (!len) return null;
      return { x: -dy / len, y: dx / len };
    };

    // Sum per-index offsets so 2-point edges don't double-apply.
    const deltaByIndex = new Map();
    const addDelta = (index, delta) => {
      if (!delta) return;
      const prev = deltaByIndex.get(index) || { x: 0, y: 0 };
      deltaByIndex.set(index, { x: prev.x + delta.x, y: prev.y + delta.y });
    };

    if (start) {
      const a = safePoints[0];
      const b = safePoints[1];
      const perp = normalizedPerp((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
      if (perp) {
        const delta = { x: perp.x * start, y: perp.y * start };
        addDelta(0, delta);
        addDelta(1, delta);
      }
    }

    if (end) {
      const n = safePoints.length;
      const a = safePoints[n - 2];
      const b = safePoints[n - 1];
      const perp = normalizedPerp((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
      if (perp) {
        const delta = { x: perp.x * end, y: perp.y * end };
        addDelta(n - 2, delta);
        addDelta(n - 1, delta);
      }
    }

    return safePoints.map((pt, index) => {
      const delta = deltaByIndex.get(index);
      if (!delta) return pt;
      return { x: (pt?.x ?? 0) + delta.x, y: (pt?.y ?? 0) + delta.y };
    });
  }, []);
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
      .filter(
        (node) =>
          node &&
          node.id !== sourceId &&
          node.id !== targetId &&
          node.visible !== false &&
          node.type !== 'manifest' &&
          node.type !== 'legend' &&
          node.type !== 'dictionary'
      )
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

  const routeHasSelfOverlap = useCallback((segments = []) => {
    const eps = 0.5;
    const overlap1D = (a1, a2, b1, b2) => {
      const minA = Math.min(a1, a2);
      const maxA = Math.max(a1, a2);
      const minB = Math.min(b1, b2);
      const maxB = Math.max(b1, b2);
      return Math.min(maxA, maxB) - Math.max(minA, minB) > eps;
    };

    for (let i = 0; i < segments.length; i += 1) {
      const [a1, a2] = segments[i];
      if (!a1 || !a2) continue;
      const aHorizontal = Math.abs(a1.y - a2.y) < eps;
      const aVertical = Math.abs(a1.x - a2.x) < eps;
      if (!aHorizontal && !aVertical) continue;

      for (let j = i + 2; j < segments.length; j += 1) {
        const [b1, b2] = segments[j];
        if (!b1 || !b2) continue;
        const bHorizontal = Math.abs(b1.y - b2.y) < eps;
        const bVertical = Math.abs(b1.x - b2.x) < eps;

        // Ignore touching at endpoints; we only want true overlap.
        if (
          (Math.abs(a2.x - b1.x) < eps && Math.abs(a2.y - b1.y) < eps) ||
          (Math.abs(a1.x - b2.x) < eps && Math.abs(a1.y - b2.y) < eps)
        ) {
          continue;
        }

        if (aHorizontal && bHorizontal && Math.abs(a1.y - b1.y) < eps) {
          if (overlap1D(a1.x, a2.x, b1.x, b2.x)) return true;
        } else if (aVertical && bVertical && Math.abs(a1.x - b1.x) < eps) {
          if (overlap1D(a1.y, a2.y, b1.y, b2.y)) return true;
        }
      }
    }
    return false;
  }, []);

  const simplifyOrthogonalSegments = useCallback((segments = []) => {
    if (!Array.isArray(segments) || segments.length < 2) return segments;

    const eps = 0.5;
    const notchThreshold = 18;
    const points = [segments[0][0], ...segments.map(([, end]) => end)].filter(Boolean).map((p) => ({ x: p.x, y: p.y }));
    if (points.length < 3) return segments;

    const orientation = (a, b) => {
      if (!a || !b) return 'none';
      const dx = Math.abs((b.x || 0) - (a.x || 0));
      const dy = Math.abs((b.y || 0) - (a.y || 0));
      if (dx < eps && dy < eps) return 'none';
      return dx >= dy ? 'h' : 'v';
    };

    let changed = true;
    while (changed) {
      changed = false;

      // Remove zero-length and perfectly collinear waypoints.
      for (let i = 1; i < points.length - 1; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        const c = points[i + 1];
        const ab = orientation(a, b);
        const bc = orientation(b, c);
        if (ab === 'none' || bc === 'none' || ab === bc) {
          points.splice(i, 1);
          changed = true;
          break;
        }
      }
      if (changed) continue;

      // Remove tiny "crook/notch" patterns: h-v-h or v-h-v with a very short middle leg.
      for (let i = 0; i < points.length - 3; i += 1) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const p2 = points[i + 2];
        const p3 = points[i + 3];
        const o01 = orientation(p0, p1);
        const o12 = orientation(p1, p2);
        const o23 = orientation(p2, p3);
        if (o01 === 'none' || o12 === 'none' || o23 === 'none') continue;
        if (o01 !== o23 || o01 === o12) continue;

        const midLen = Math.hypot((p2.x || 0) - (p1.x || 0), (p2.y || 0) - (p1.y || 0));
        if (midLen > notchThreshold) continue;

        if (o01 === 'h' && Math.abs((p0.y || 0) - (p3.y || 0)) <= eps) {
          const m = { x: p2.x, y: p0.y };
          points.splice(i + 1, 2, m);
          changed = true;
          break;
        }
        if (o01 === 'v' && Math.abs((p0.x || 0) - (p3.x || 0)) <= eps) {
          const m = { x: p0.x, y: p2.y };
          points.splice(i + 1, 2, m);
          changed = true;
          break;
        }
      }
    }

    const simplified = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      if (Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps) continue;
      simplified.push([a, b]);
    }
    return simplified.length ? simplified : segments;
  }, []);
  
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
        const sourceHandleKey = edge.sourcePort || edge.portMeta?.source?.key;
        const targetHandleKey = edge.targetPort || edge.portMeta?.target?.key;
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
      }
      if (!targetPos) {
        const targetNode = nodeListRef.current.find(n => n.id === edge.target);
        targetPos = getNodeCenter(targetNode);
      }

      // If handle info didn't provide a side, infer side from direction for stable grouping/slotting.
      if (!sourceSide) {
        const sourceNode = nodeListRef.current.find(n => n.id === edge.source);
        const targetNode = nodeListRef.current.find(n => n.id === edge.target);
        if (sourceNode && targetNode) {
          sourceSide = getDirectionSide(getNodeCenter(sourceNode), getNodeCenter(targetNode));
        }
      }
      if (!targetSide) {
        const sourceNode = nodeListRef.current.find(n => n.id === edge.source);
        const targetNode = nodeListRef.current.find(n => n.id === edge.target);
        if (sourceNode && targetNode) {
          targetSide = getDirectionSide(getNodeCenter(targetNode), getNodeCenter(sourceNode));
        }
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
        const sourceHandleKey = edge.sourcePort || edge.portMeta?.source?.key;
        const targetHandleKey = edge.targetPort || edge.portMeta?.target?.key;
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
      
      const normalizeDash = (dashValue, dashedFlag, dashPattern) => {
        const toNums = (value) =>
          String(value || '')
            .split(',')
            .map((part) => Number(part.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (Array.isArray(dashValue)) {
          const nums = dashValue
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);
          if (nums.length) return nums;
        } else if (typeof dashValue === 'string') {
          const nums = toNums(dashValue);
          if (nums.length) return nums;
        } else if (typeof dashValue === 'number' && Number.isFinite(dashValue) && dashValue > 0) {
          return [dashValue, dashValue];
        }

        if (typeof dashPattern === 'string') {
          const nums = toNums(dashPattern);
          if (nums.length) return nums;
        }

        if (dashedFlag === true) return [8, 4];
        return [];
      };

      // Merge styles: edge.style overrides type defaults
      const style = {
        color: edge.color || edge.style?.color || styleDef.color || theme.palette.text.secondary,
        width: edge.style?.width ?? styleDef.width ?? 2,
        dash: normalizeDash(
          edge.style?.dash ?? styleDef.dash,
          edge.style?.dashed ?? styleDef.dashed,
          edge.style?.dashPattern ?? styleDef.dashPattern
        ),
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
      // Apply glow animation (modulate halo intensity)
      if (style.animation === 'glow' && !isSelected) {
        const glowPhase = Math.sin(time * Math.PI * 2 * style.animationSpeed);
        const glowFactor = 0.5 + glowPhase * 0.5; // 0..1
        ctx.shadowColor = style.color;
        ctx.shadowBlur = 6 + glowFactor * 14; // 6..20
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        opacity = Math.min(1, opacity * (0.85 + glowFactor * 0.3));
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
      
      // Routing geometry is controlled by per-edge properties (and global override),
      // not by edge-type defaults.
      const explicitRouteStyle = edge.style?.route ?? edge.style?.routing ?? edge.style?.router;
      const hasStyleObject = edge.style && typeof edge.style === 'object';
      const hasCurvedFlag = Boolean(hasStyleObject && Object.prototype.hasOwnProperty.call(edge.style, 'curved'));
      const hasOrthogonalFlag = Boolean(hasStyleObject && Object.prototype.hasOwnProperty.call(edge.style, 'orthogonal'));
      const curvedFlag = hasCurvedFlag ? edge.style.curved : undefined;
      const orthogonalFlag = hasOrthogonalFlag ? edge.style.orthogonal : undefined;
      const flagTruthy = (value) => !(
        value === false ||
        value === 'false' ||
        value === 0 ||
        value === '0' ||
        value === null ||
        value === undefined
      );
      const hasPerEdgeRoutingOverride =
        explicitRouteStyle === 'orthogonal' ||
        explicitRouteStyle === 'curved' ||
        explicitRouteStyle === 'straight' ||
        hasCurvedFlag ||
        hasOrthogonalFlag;
      const preferCurvedForEdge =
        explicitRouteStyle === 'curved' ||
        (hasCurvedFlag && flagTruthy(curvedFlag)) ||
        (!explicitRouteStyle && !hasCurvedFlag && hasOrthogonalFlag && !flagTruthy(orthogonalFlag));
      const preferOrthogonalForEdge =
        explicitRouteStyle === 'orthogonal' ||
        (hasOrthogonalFlag && flagTruthy(orthogonalFlag));
      const preferStraightForEdge = explicitRouteStyle === 'straight';
      const forceRouting = defaultEdgeRouting && defaultEdgeRouting !== 'auto';

      const routeOverride = edgeRoutesRef.current?.[edge.id];
      const routedPointsRaw = Array.isArray(routeOverride?.points) ? routeOverride.points : null;
      const routedMatchesEndpoints = Array.isArray(routedPointsRaw) && routedPointsRaw.length >= 2
        ? (() => {
            const first = routedPointsRaw[0];
            const last = routedPointsRaw[routedPointsRaw.length - 1];
            if (!first || !last) return false;
            const distStart = Math.hypot((first.x || 0) - sourcePos.x, (first.y || 0) - sourcePos.y);
            const distEnd = Math.hypot((last.x || 0) - targetPos.x, (last.y || 0) - targetPos.y);
            // Ignore stale cached routes that no longer touch current endpoints.
            return distStart <= 48 && distEnd <= 48;
          })()
        : false;
      const draggedNodeIds = draggingInfoRef?.current?.nodeIds;
      const allowRoutedSegments = Array.isArray(draggedNodeIds)
        ? !(draggedNodeIds.includes(edge.source) || draggedNodeIds.includes(edge.target))
        : true;
      const routedPoints = allowRoutedSegments
        ? applyEndpointLaneOffsetsToPoints(routedMatchesEndpoints ? routedPointsRaw : null, sourceFan, targetFan)
        : (routedMatchesEndpoints ? routedPointsRaw : null);
      const routedSegments = allowRoutedSegments ? buildSegmentsFromPoints(routedPoints) : null;
      const useRoutedSegments = Boolean(
        routedSegments &&
        routedSegments.length &&
        // When global routing is forced, ignore cached/ELK route points and
        // render from the requested global style.
        !forceRouting &&
        // Only apply cached/ELK routes when the edge has no explicit per-edge routing override.
        // Per-edge routing should be resolved from live geometry to keep behavior stable while editing.
        !hasPerEdgeRoutingOverride
      );

      if (useRoutedSegments) {
        sourcePos = { x: routedPoints[0].x, y: routedPoints[0].y };
        targetPos = { x: routedPoints[routedPoints.length - 1].x, y: routedPoints[routedPoints.length - 1].y };
        sourceFromHandle = true;
        targetFromHandle = true;
      }

      const applyForcedRouting = forceRouting;
      const isOrthogonal = useRoutedSegments
        ? true
        : applyForcedRouting
        ? defaultEdgeRouting === 'orthogonal'
        : (!preferStraightForEdge && preferOrthogonalForEdge);
      const isCurved = applyForcedRouting
        ? defaultEdgeRouting === 'curved'
        : !preferStraightForEdge && !isOrthogonal && (
          preferCurvedForEdge ||
          (hasCurvedFlag && flagTruthy(curvedFlag)) ||
          (!hasPerEdgeRoutingOverride)
        );
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
      } else if (isCurved) {
        // Ensure curved edges are visibly curved even when endpoints are almost aligned.
        const minBend = 36;
        if (curveDirection === 'horizontal') {
          const dy = targetPos.y - sourcePos.y;
          const bendY = Math.abs(dy) < minBend ? (dy >= 0 ? minBend : -minBend) : dy;
          cp1 = { x: midX, y: sourcePos.y + bendY * 0.5 };
          cp2 = { x: midX, y: targetPos.y - bendY * 0.5 };
        } else {
          const dx = targetPos.x - sourcePos.x;
          const bendX = Math.abs(dx) < minBend ? (dx >= 0 ? minBend : -minBend) : dx;
          cp1 = { x: sourcePos.x + bendX * 0.5, y: midY };
          cp2 = { x: targetPos.x - bendX * 0.5, y: midY };
        }
        curveDirection = 'custom';
      }
      const hasBezierControls = Boolean(cp1 && cp2);
      
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
          // Keep endpoint leads orthogonal so edges leave/enter nodes cleanly
          // instead of diagonal cuts that can appear to run under a node.
          add(sourcePos, sourceLead);
          add(sourceLead, sourceLeadAdj);
          coreSegments.forEach(([a, b]) => add(a, b));
          add(targetLeadAdj, targetLead);
          add(targetLead, targetPos);
          return fullSegments;
        };

        const tryRoutes = (candidates) => {
          const orientation = ([a, b]) => {
            if (!a || !b) return 'none';
            const dx = Math.abs((b.x || 0) - (a.x || 0));
            const dy = Math.abs((b.y || 0) - (a.y || 0));
            if (dx < 0.5 && dy < 0.5) return 'none';
            return dx >= dy ? 'h' : 'v';
          };

          const routeTurnCount = (segments = []) => {
            let turns = 0;
            let prev = null;
            for (const seg of segments) {
              const o = orientation(seg);
              if (o === 'none') continue;
              if (prev && o !== prev) turns += 1;
              prev = o;
            }
            return turns;
          };

          const routeLength = (segments = []) =>
            segments.reduce((sum, [a, b]) => sum + Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0)), 0);

          const obstacleHits = (segments = [], obstacles = []) => {
            let hits = 0;
            for (const [a, b] of segments) {
              for (const rect of obstacles) {
                if (segmentIntersectsRect(a, b, rect)) hits += 1;
              }
            }
            return hits;
          };

          const scored = [];
          candidates.forEach((coreSegments, index) => {
            const fullSegments = finalize(coreSegments);
            if (routeHasSelfOverlap(fullSegments)) return;
            scored.push({
              index,
              fullSegments,
              laneCost: index,
              obstacleCost: obstacleHits(fullSegments, obstacleRects),
              turns: routeTurnCount(fullSegments),
              length: routeLength(fullSegments)
            });
          });

          if (scored.length) {
            scored.sort((a, b) => {
              if (a.laneCost !== b.laneCost) return a.laneCost - b.laneCost;
              if (a.obstacleCost !== b.obstacleCost) return a.obstacleCost - b.obstacleCost;
              if (a.turns !== b.turns) return a.turns - b.turns;
              if (Math.abs(a.length - b.length) > 0.5) return a.length - b.length;
              return a.index - b.index;
            });
            return scored[0].fullSegments;
          }

          return finalize(candidates[0] || []);
        };

        if (sourceAxis === 'horizontal' && targetAxis === 'horizontal') {
          const offsets = [0, 40, -40, 80, -80, 120, -120];
          const candidates = [];

          const sourceBounds = sourceNode
            ? {
                left: (sourceNode.position?.x ?? sourceNode.x ?? 0),
                right: (sourceNode.position?.x ?? sourceNode.x ?? 0) + (sourceNode.width || 60)
              }
            : null;
          const targetBounds = targetNode
            ? {
                left: (targetNode.position?.x ?? targetNode.x ?? 0),
                right: (targetNode.position?.x ?? targetNode.x ?? 0) + (targetNode.width || 60)
              }
            : null;
          const outsideMargin = Math.max(36, lead + 12 + Math.abs(bundleOffset));

          // Prefer a side-respecting "digital 5" route for opposite horizontal ports.
          // We need two outside columns so each endpoint approaches from the correct side.
          if (sourceSide === 'right' && targetSide === 'left' && sourceBounds && targetBounds) {
            // If source is left of target, a single vertical lane between them is cleaner.
            if (sourceLeadAdj.x <= targetLeadAdj.x - 8) {
              const minLaneX = sourceLeadAdj.x + 10;
              const maxLaneX = targetLeadAdj.x - 10;
              const baseLaneX = Math.max(minLaneX, Math.min(maxLaneX, (sourceLeadAdj.x + targetLeadAdj.x) / 2));
              offsets.forEach((offset) => {
                const laneX = Math.max(minLaneX, Math.min(maxLaneX, baseLaneX + offset));
                const p1 = { x: laneX, y: sourceLeadAdj.y };
                const p2 = { x: laneX, y: targetLeadAdj.y };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]]);
              });
            } else {
              // Crossing case: keep two outside columns to preserve entry side constraints.
              const sourceOuterX = sourceBounds.right + outsideMargin;
              const targetOuterX = targetBounds.left - outsideMargin;
              const baseMidY = (sourceLeadAdj.y + targetLeadAdj.y) / 2 + bundleOffset;
              offsets.forEach((offset) => {
                const midY = baseMidY + offset;
                const p1 = { x: sourceOuterX, y: sourceLeadAdj.y };
                const p2 = { x: sourceOuterX, y: midY };
                const p3 = { x: targetOuterX, y: midY };
                const p4 = { x: targetOuterX, y: targetLeadAdj.y };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, p3], [p3, p4], [p4, targetLeadAdj]]);
              });
            }
          } else if (sourceSide === 'left' && targetSide === 'right' && sourceBounds && targetBounds) {
            if (sourceLeadAdj.x >= targetLeadAdj.x + 8) {
              const minLaneX = targetLeadAdj.x + 10;
              const maxLaneX = sourceLeadAdj.x - 10;
              const baseLaneX = Math.max(minLaneX, Math.min(maxLaneX, (sourceLeadAdj.x + targetLeadAdj.x) / 2));
              offsets.forEach((offset) => {
                const laneX = Math.max(minLaneX, Math.min(maxLaneX, baseLaneX + offset));
                const p1 = { x: laneX, y: sourceLeadAdj.y };
                const p2 = { x: laneX, y: targetLeadAdj.y };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]]);
              });
            } else {
              const sourceOuterX = sourceBounds.left - outsideMargin;
              const targetOuterX = targetBounds.right + outsideMargin;
              const baseMidY = (sourceLeadAdj.y + targetLeadAdj.y) / 2 + bundleOffset;
              offsets.forEach((offset) => {
                const midY = baseMidY + offset;
                const p1 = { x: sourceOuterX, y: sourceLeadAdj.y };
                const p2 = { x: sourceOuterX, y: midY };
                const p3 = { x: targetOuterX, y: midY };
                const p4 = { x: targetOuterX, y: targetLeadAdj.y };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, p3], [p3, p4], [p4, targetLeadAdj]]);
              });
            }
          }

          const sameSideClearance = Math.max(16, lead);
          let baseMid = (sourceLeadAdj.x + targetLeadAdj.x) / 2 + bundleOffset;
          let midGenerator = (offset) => baseMid + offset;
          if (sourceSide === 'right' && targetSide === 'right') {
            const outsideBase = Math.max(sourceLeadAdj.x, targetLeadAdj.x) + sameSideClearance;
            midGenerator = (offset) => outsideBase + Math.abs(offset);
          } else if (sourceSide === 'left' && targetSide === 'left') {
            const outsideBase = Math.min(sourceLeadAdj.x, targetLeadAdj.x) - sameSideClearance;
            midGenerator = (offset) => outsideBase - Math.abs(offset);
          }
          offsets.forEach((offset) => {
            const mid = midGenerator(offset);
            const p1 = { x: mid, y: sourceLeadAdj.y };
            const p2 = { x: mid, y: targetLeadAdj.y };
            candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]]);
          });
          return tryRoutes(candidates);
        }

        if (sourceAxis === 'vertical' && targetAxis === 'vertical') {
          const offsets = [0, 40, -40, 80, -80, 120, -120];
          const candidates = [];
          const sourceBounds = sourceNode
            ? {
                top: (sourceNode.position?.y ?? sourceNode.y ?? 0),
                bottom: (sourceNode.position?.y ?? sourceNode.y ?? 0) + (sourceNode.height || 60)
              }
            : null;
          const targetBounds = targetNode
            ? {
                top: (targetNode.position?.y ?? targetNode.y ?? 0),
                bottom: (targetNode.position?.y ?? targetNode.y ?? 0) + (targetNode.height || 60)
              }
            : null;
          const outsideMargin = Math.max(36, lead + 12 + Math.abs(bundleOffset));

          if (sourceSide === 'bottom' && targetSide === 'top' && sourceBounds && targetBounds) {
            // Normal top-down flow: route through a single middle horizontal lane.
            if (sourceLeadAdj.y <= targetLeadAdj.y - 8) {
              const minLaneY = sourceLeadAdj.y + 10;
              const maxLaneY = targetLeadAdj.y - 10;
              const baseLaneY = Math.max(minLaneY, Math.min(maxLaneY, (sourceLeadAdj.y + targetLeadAdj.y) / 2));
              offsets.forEach((offset) => {
                const laneY = Math.max(minLaneY, Math.min(maxLaneY, baseLaneY + offset));
                const p1 = { x: sourceLeadAdj.x, y: laneY };
                const p2 = { x: targetLeadAdj.x, y: laneY };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]]);
              });
            } else {
              // Crossing case: keep two outside rows to preserve endpoint side constraints.
              const sourceOuterY = sourceBounds.bottom + outsideMargin;
              const targetOuterY = targetBounds.top - outsideMargin;
              const baseMidX = (sourceLeadAdj.x + targetLeadAdj.x) / 2 + bundleOffset;
              offsets.forEach((offset) => {
                const midX = baseMidX + offset;
                const p1 = { x: sourceLeadAdj.x, y: sourceOuterY };
                const p2 = { x: midX, y: sourceOuterY };
                const p3 = { x: midX, y: targetOuterY };
                const p4 = { x: targetLeadAdj.x, y: targetOuterY };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, p3], [p3, p4], [p4, targetLeadAdj]]);
              });
            }
          } else if (sourceSide === 'top' && targetSide === 'bottom' && sourceBounds && targetBounds) {
            if (sourceLeadAdj.y >= targetLeadAdj.y + 8) {
              const minLaneY = targetLeadAdj.y + 10;
              const maxLaneY = sourceLeadAdj.y - 10;
              const baseLaneY = Math.max(minLaneY, Math.min(maxLaneY, (sourceLeadAdj.y + targetLeadAdj.y) / 2));
              offsets.forEach((offset) => {
                const laneY = Math.max(minLaneY, Math.min(maxLaneY, baseLaneY + offset));
                const p1 = { x: sourceLeadAdj.x, y: laneY };
                const p2 = { x: targetLeadAdj.x, y: laneY };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]]);
              });
            } else {
              const sourceOuterY = sourceBounds.top - outsideMargin;
              const targetOuterY = targetBounds.bottom + outsideMargin;
              const baseMidX = (sourceLeadAdj.x + targetLeadAdj.x) / 2 + bundleOffset;
              offsets.forEach((offset) => {
                const midX = baseMidX + offset;
                const p1 = { x: sourceLeadAdj.x, y: sourceOuterY };
                const p2 = { x: midX, y: sourceOuterY };
                const p3 = { x: midX, y: targetOuterY };
                const p4 = { x: targetLeadAdj.x, y: targetOuterY };
                candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, p3], [p3, p4], [p4, targetLeadAdj]]);
              });
            }
          }

          const sameSideClearance = Math.max(16, lead);
          let baseMid = (sourceLeadAdj.y + targetLeadAdj.y) / 2 + bundleOffset;
          let midGenerator = (offset) => baseMid + offset;
          if (sourceSide === 'bottom' && targetSide === 'bottom') {
            const outsideBase = Math.max(sourceLeadAdj.y, targetLeadAdj.y) + sameSideClearance;
            midGenerator = (offset) => outsideBase + Math.abs(offset);
          } else if (sourceSide === 'top' && targetSide === 'top') {
            const outsideBase = Math.min(sourceLeadAdj.y, targetLeadAdj.y) - sameSideClearance;
            midGenerator = (offset) => outsideBase - Math.abs(offset);
          }
          offsets.forEach((offset) => {
            const mid = midGenerator(offset);
            const p1 = { x: sourceLeadAdj.x, y: mid };
            const p2 = { x: targetLeadAdj.x, y: mid };
            candidates.push([[sourceLeadAdj, p1], [p1, p2], [p2, targetLeadAdj]]);
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

      const buildOrthBridge = (start, end, axisPreference = 'horizontal') => {
        if (!start || !end) return [];
        if (start.x === end.x && start.y === end.y) return [];
        if (start.x === end.x || start.y === end.y) return [[start, end]];
        if (axisPreference === 'vertical') {
          const mid = { x: start.x, y: end.y };
          return [[start, mid], [mid, end]];
        }
        const mid = { x: end.x, y: start.y };
        return [[start, mid], [mid, end]];
      };

      const stitchRoutedToPorts = (segments) => {
        if (!Array.isArray(segments) || !segments.length) return segments;
        const stitched = [];
        const sourceNormal = getSideNormal(sourceSide);
        const targetNormal = getSideNormal(targetSide);
        const lead = 24;
        const sourceExit = sourceNormal
          ? { x: sourcePos.x + sourceNormal.x * lead, y: sourcePos.y + sourceNormal.y * lead }
          : sourcePos;
        const targetEntry = targetNormal
          ? { x: targetPos.x + targetNormal.x * lead, y: targetPos.y + targetNormal.y * lead }
          : targetPos;

        const first = segments[0][0];
        const last = segments[segments.length - 1][1];
        const sourceAxis = sourceNormal && sourceNormal.x !== 0 ? 'horizontal' : 'vertical';
        const targetAxis = targetNormal && targetNormal.x !== 0 ? 'horizontal' : 'vertical';

        stitched.push(...buildOrthBridge(sourcePos, sourceExit, sourceAxis));
        stitched.push(...buildOrthBridge(sourceExit, first, sourceAxis));
        stitched.push(...segments);
        stitched.push(...buildOrthBridge(last, targetEntry, targetAxis));
        stitched.push(...buildOrthBridge(targetEntry, targetPos, targetAxis));

        const cleaned = stitched.filter(([a, b]) => a && b && !(a.x === b.x && a.y === b.y));
        return cleaned.length ? cleaned : segments;
      };

      const drawRoundedOrthogonalPath = (segments, radius = 12) => {
        if (!Array.isArray(segments) || !segments.length) return false;
        const points = [segments[0][0], ...segments.map(([, end]) => end)];
        if (points.length < 2) return false;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 1; i += 1) {
          const prev = points[i - 1];
          const curr = points[i];
          const next = points[i + 1];

          const inDx = curr.x - prev.x;
          const inDy = curr.y - prev.y;
          const outDx = next.x - curr.x;
          const outDy = next.y - curr.y;
          const inLen = Math.hypot(inDx, inDy);
          const outLen = Math.hypot(outDx, outDy);

          if (inLen === 0 || outLen === 0) {
            ctx.lineTo(curr.x, curr.y);
            continue;
          }

          const inUx = inDx / inLen;
          const inUy = inDy / inLen;
          const outUx = outDx / outLen;
          const outUy = outDy / outLen;

          // Straight-through segments should not introduce a curve.
          const dot = inUx * outUx + inUy * outUy;
          if (Math.abs(dot) > 0.999) {
            ctx.lineTo(curr.x, curr.y);
            continue;
          }

          const cornerRadius = Math.max(0, Math.min(radius, inLen * 0.5, outLen * 0.5));
          const p1 = { x: curr.x - inUx * cornerRadius, y: curr.y - inUy * cornerRadius };
          const p2 = { x: curr.x + outUx * cornerRadius, y: curr.y + outUy * cornerRadius };

          ctx.lineTo(p1.x, p1.y);
          ctx.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
        }

        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        return true;
      };

      const orthogonalSegmentsRaw = isOrthogonal
        ? (useRoutedSegments ? routedSegments : buildOrthogonalSegments())
        : null;
      const orthogonalSegments = isOrthogonal
        ? (Array.isArray(orthogonalSegmentsRaw) && orthogonalSegmentsRaw.length
          ? (useRoutedSegments ? stitchRoutedToPorts(orthogonalSegmentsRaw) : orthogonalSegmentsRaw)
          : [[sourcePos, targetPos]])
        : null;
      const orthogonalSegmentsFinal = isOrthogonal ? simplifyOrthogonalSegments(orthogonalSegments) : null;
      const useRoundedOrthogonal = isOrthogonal && hasCurvedFlag && flagTruthy(curvedFlag);

      // Draw edge path
      if (isOrthogonal) {
        if (!useRoundedOrthogonal || !drawRoundedOrthogonalPath(orthogonalSegmentsFinal, 14)) {
          ctx.beginPath();
          ctx.moveTo(sourcePos.x, sourcePos.y);
          orthogonalSegmentsFinal.forEach(([, end]) => {
            ctx.lineTo(end.x, end.y);
          });
          ctx.stroke();
        }
      } else if (isCurved) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        if (hasBezierControls) {
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
            const last = orthogonalSegmentsFinal[orthogonalSegmentsFinal.length - 1];
            angle = Math.atan2(last[1].y - last[0].y, last[1].x - last[0].x);
            arrowPos = targetPos;
          } else if (isCurved) {
            if (hasBezierControls) {
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
            const first = orthogonalSegmentsFinal[0];
            angle = Math.atan2(first[0].y - first[1].y, first[0].x - first[1].x);
            arrowPos = sourcePos;
          } else if (isCurved) {
            if (hasBezierControls) {
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
            particlePos = getPointOnSegments(orthogonalSegmentsFinal, t);
          } else if (isCurved) {
            if (hasBezierControls) {
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
          if (hasBezierControls) {
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
      
      const labels = Array.isArray(edge.labels) ? edge.labels : null;
      const hasAnyLabel =
        (typeof edge.label === 'string' && edge.label.trim() !== '') ||
        (labels && labels.some((value) => typeof value === 'string' && value.trim() !== ''));

      // Draw edge label(s) if showAllEdgeLabels or any label is non-empty
      if (showAllEdgeLabels || hasAnyLabel) {
        drawEdgeLabel(
          ctx,
          {
            ...edge,
            sourcePos,
            targetPos,
            midX,
            midY,
            cp1,
            cp2,
            isOrthogonal,
            curveDirection,
            segments: isOrthogonal ? orthogonalSegments : null,
            style: { ...edge.style, curved: isCurved }
          },
          theme
        );
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
        labels: Array.isArray(edge.labels) ? edge.labels : undefined,
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
