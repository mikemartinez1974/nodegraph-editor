import React from 'react';

// Context for handle position lookup
const HandlePositionContext = React.createContext({
  getHandlePosition: () => undefined
});

export default HandlePositionContext;

// Utility: Find intersection of line from center to target with node rectangle
export function getNodeEdgeIntersection(node, targetX, targetY) {
  const x = node.position?.x ?? node.x ?? 0;
  const y = node.position?.y ?? node.y ?? 0;
  const width = node.width || 60;
  const height = node.height || 60;
  const left = x - width / 2;
  const right = x + width / 2;
  const top = y - height / 2;
  const bottom = y + height / 2;

  // Center of node
  const cx = x;
  const cy = y;

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
