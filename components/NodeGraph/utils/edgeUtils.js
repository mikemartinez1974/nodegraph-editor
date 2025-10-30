// Edge hit testing utilities
export function getEdgeHitTest(edge, point, tolerance = 8) {
  // Convert edge to line segments for hit testing
  const segments = getEdgeSegments(edge);
  
  for (const segment of segments) {
    if (isPointNearLineSegment(point, segment.start, segment.end, tolerance)) {
      return true;
    }
  }
  return false;
}

export function getEdgeSegments(edge) {
  const { source, target, style } = edge;
  
  if (style?.curved) {
    // For curved edges, approximate with multiple line segments
    return getCurvedEdgeSegments(source, target);
  } else {
    // Straight edge - single segment
    return [{ start: source, end: target }];
  }
}

export function getCurvedEdgeSegments(start, end, segments = 10) {
  const result = [];
  const controlPoint = getCurveControlPoint(start, end);
  
  for (let i = 0; i < segments; i++) {
    const t1 = i / segments;
    const t2 = (i + 1) / segments;
    
    const p1 = getQuadraticBezierPoint(start, controlPoint, end, t1);
    const p2 = getQuadraticBezierPoint(start, controlPoint, end, t2);
    
    result.push({ start: p1, end: p2 });
  }
  
  return result;
}

export function getCurveControlPoint(start, end) {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const offset = Math.min(100, Math.abs(end.x - start.x) * 0.3);
  
  return { x: midX, y: midY - offset };
}

export function getQuadraticBezierPoint(start, control, end, t) {
  const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
  const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;
  return { x, y };
}

export function isPointNearLineSegment(point, start, end, tolerance) {
  const distToLine = distanceFromPointToLineSegment(point, start, end);
  return distToLine <= tolerance;
}

export function distanceFromPointToLineSegment(point, start, end) {
  const A = point.x - start.x;
  const B = point.y - start.y;
  const C = end.x - start.x;
  const D = end.y - start.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return Math.sqrt(A * A + B * B);
  
  let param = dot / lenSq;
  param = Math.max(0, Math.min(1, param));

  const xx = start.x + param * C;
  const yy = start.y + param * D;

  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}