// Utility functions for NodeGraph

export function getEdgeHandlePosition(node, arg2, progress = 1, offset = { x: 0, y: 0 }, edgeType = 'straight') {
    // Support both node.x/y and node.position.x/y (position is top-left; derive center)
    const left = node.x !== undefined ? node.x : node.position?.x;
    const top = node.y !== undefined ? node.y : node.position?.y;
    const width = node.width || node.data?.width || 60;
    const height = node.height || node.data?.height || 60;
    const x = (left || 0) + width / 2;
    const y = (top || 0) + height / 2;
    // If called with handleType ('source'/'target'), return node center
    if (typeof arg2 === 'string' && (arg2 === 'source' || arg2 === 'target')) {
        return { x, y };
    }
    // If called with otherNode, calculate perimeter point
    const otherNode = arg2;
    if (!otherNode) return { x, y };
    const dx = (otherNode.x !== undefined ? otherNode.x : otherNode.position?.x) - x;
    const dy = (otherNode.y !== undefined ? otherNode.y : otherNode.position?.y) - y;
    const angle = Math.atan2(dy, dx);
    const radius = (node.width || 60) / 2;
    return {
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius
    };
}

export function isPointNearLine(px, py, x1, y1, x2, y2, tolerance = 8) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) param = dot / len_sq;
  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  const dx = px - xx;
  const dy = py - yy;
  return dx * dx + dy * dy < tolerance * tolerance;
}

export function isPointNearBezier(px, py, x1, y1, cx1, cy1, cx2, cy2, x2, y2, tolerance = 8) {
  let steps = 30;
  for (let t = 0; t <= 1; t += 1 / steps) {
    const x = Math.pow(1 - t, 3) * x1 + 3 * Math.pow(1 - t, 2) * t * cx1 + 3 * (1 - t) * Math.pow(t, 2) * cx2 + Math.pow(t, 3) * x2;
    const y = Math.pow(1 - t, 3) * y1 + 3 * Math.pow(1 - t, 2) * t * cy1 + 3 * (1 - t) * Math.pow(t, 2) * cy2 + Math.pow(t, 3) * y2;
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy < tolerance * tolerance) return true;
  }
  return false;
}
