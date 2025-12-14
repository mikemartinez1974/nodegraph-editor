import React from 'react';

// Context for handle position lookup
const HandlePositionContext = React.createContext({
  getHandlePosition: () => undefined
});

export default HandlePositionContext;

// Utility: Find intersection of line from center to target with node rectangle
export function getNodeEdgeIntersection(node, targetX, targetY) {
  const left = node.position?.x ?? node.x ?? 0;
  const top = node.position?.y ?? node.y ?? 0;
  const width = node.width || 60;
  const height = node.height || 60;
  const right = left + width;
  const bottom = top + height;

  // Center of node derived from top-left
  const cx = left + width / 2;
  const cy = top + height / 2;

  // Direction vector
  const dx = targetX - cx;
  const dy = targetY - cy;

  // Avoid division by zero
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Calculate intersection with each side
  let tMin = Infinity;
  let ix = cx, iy = cy;
  // Left/right
  if (dx !== 0) {
    const t1 = (left - cx) / dx;
    const t2 = (right - cx) / dx;
    [t1, t2].forEach(t => {
      if (t > 0) {
        const yInt = cy + t * dy;
        if (yInt >= top && yInt <= bottom && t < tMin) {
          tMin = t;
          ix = cx + t * dx;
          iy = yInt;
        }
      }
    });
  }
  // Top/bottom
  if (dy !== 0) {
    const t3 = (top - cy) / dy;
    const t4 = (bottom - cy) / dy;
    [t3, t4].forEach(t => {
      if (t > 0) {
        const xInt = cx + t * dx;
        if (xInt >= left && xInt <= right && t < tMin) {
          tMin = t;
          ix = xInt;
          iy = cy + t * dy;
        }
      }
    });
  }
  return { x: ix, y: iy };
}
