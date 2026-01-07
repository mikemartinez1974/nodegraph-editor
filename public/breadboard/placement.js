//
// placement.js
//
// Responsible for snapping components to the correct pixel position
// based on where their pins actually connected.
//

import { determineOrientation } from './connectivity.js';

/**
 * Compute the snapped position of the component based on its pin targets.
 * 
 * We look at the computed connections (from connectivity.js)
 * and derive a clean center point for the component box.
 */
export function computeSnappedPosition(componentNode, connectionSpecs) {
  if (!connectionSpecs || connectionSpecs.length === 0) return null;

  const orientation = determineOrientation(componentNode);

  // Gather the precise pin target positions from the connection specs
  const xs = [];
  const ys = [];

  connectionSpecs.forEach(spec => {
    if (spec.pos) {
      xs.push(spec.pos.x);
      ys.push(spec.pos.y);
    }
  });

  if (xs.length === 0 || ys.length === 0) return null;

  // Horizontal components usually want midpoint between pin targets.
  if (orientation === 'horizontal') {
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const midX = (left + right) / 2;
    const midY = average(ys);
    return { x: midX, y: midY };
  }

  // Vertical parts (LED, tap) want midpoint vertically
  if (orientation === 'vertical') {
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const midY = (top + bottom) / 2;
    const midX = average(xs);
    return { x: midX, y: midY };
  }

  return null;
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Apply the snapped position to the component node.
 */
export function applySnappedPosition(api, componentNode, snappedPos) {
  if (!snappedPos) return;
  const w = typeof componentNode?.width === 'number' ? componentNode.width : typeof componentNode?.data?.width === 'number' ? componentNode.data.width : 0;
  const h = typeof componentNode?.height === 'number' ? componentNode.height : typeof componentNode?.data?.height === 'number' ? componentNode.data.height : 0;
  const pos = {
    x: snappedPos.x - w / 2,
    y: snappedPos.y - h / 2
  };

  api.applyCommands([
    {
      action: "update-node",
      id: componentNode.id,
      position: pos,
      data: {
        ...(componentNode.data || {}),
        breadboard: {
          ...(componentNode.data?.breadboard || {}),
          positionMode: 'topleft'
        }
      }
    }
  ]);
}
