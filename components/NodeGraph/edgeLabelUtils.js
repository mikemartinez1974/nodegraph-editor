// Edge label rendering utilities

// Get angle between two points
function getAngleBetweenPoints(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Get bezier tangent angle at t
function getBezierTangentAngle(t, x1, y1, cx1, cy1, cx2, cy2, x2, y2) {
  const dx = 3 * Math.pow(1 - t, 2) * (cx1 - x1) + 
             6 * (1 - t) * t * (cx2 - cx1) + 
             3 * Math.pow(t, 2) * (x2 - cx2);
  const dy = 3 * Math.pow(1 - t, 2) * (cy1 - y1) + 
             6 * (1 - t) * t * (cy2 - cy1) + 
             3 * Math.pow(t, 2) * (y2 - cy2);
  return Math.atan2(dy, dx);
}

export function drawEdgeLabel(ctx, edge, theme) {
  const specs = getEdgeLabelSpecs(edge);
  if (!specs.length) return;

  const style = getEdgeLabelStyle(edge, theme);

  // Calculate angle along the edge
  let angle = 0;
  if (edge.sourcePos && edge.targetPos) {
    // Check if edge is curved (check if edge has curve data or style)
    const isOrthogonal = edge.isOrthogonal === true || edge.style?.orthogonal === true;
    const isCurved = !isOrthogonal && (edge.style?.curved || false);
    
    if (isCurved && edge.cp1 && edge.cp2) {
      angle = getBezierTangentAngle(
        0.5,
        edge.sourcePos.x, edge.sourcePos.y,
        edge.cp1.x, edge.cp1.y,
        edge.cp2.x, edge.cp2.y,
        edge.targetPos.x, edge.targetPos.y
      );
    } else if (isCurved && edge.midX !== undefined) {
      // For curved edges, calculate tangent at midpoint (t=0.5)
      const curveDirection = edge.curveDirection || 'horizontal';
      if (curveDirection === 'horizontal') {
        angle = getBezierTangentAngle(
          0.5,
          edge.sourcePos.x, edge.sourcePos.y,
          edge.midX, edge.sourcePos.y,
          edge.midX, edge.targetPos.y,
          edge.targetPos.x, edge.targetPos.y
        );
      } else {
        angle = getBezierTangentAngle(
          0.5,
          edge.sourcePos.x, edge.sourcePos.y,
          edge.sourcePos.x, edge.midY,
          edge.targetPos.x, edge.midY,
          edge.targetPos.x, edge.targetPos.y
        );
      }
    } else if (isOrthogonal) {
      angle = 0;
    } else {
      // For straight edges
      angle = getAngleBetweenPoints(
        edge.sourcePos.x, edge.sourcePos.y,
        edge.targetPos.x, edge.targetPos.y
      );
    }
    
    // Normalize angle to avoid upside-down text
    if (angle > Math.PI / 2) {
      angle -= Math.PI;
    } else if (angle < -Math.PI / 2) {
      angle += Math.PI;
    }
  }

  // Save context
  ctx.save();
  
  ctx.font = style.font;
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;

  const padding = 8;
  const radius = 8;
  const textHeight = 20; // Approximate for 16px font

  const drawOne = (spec) => {
    const text = spec.text;
    if (!text) return;
    const pos = spec.position || { x: 0, y: 0 };
    const align = spec.align || 'center'; // 'left' | 'center' | 'right'

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = textHeight + padding * 2;
    const y = -boxHeight / 2;

    let x = -boxWidth / 2;
    if (align === 'left') x = 0;
    if (align === 'right') x = -boxWidth;

    // Draw rounded background
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + boxWidth - radius, y);
    ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
    ctx.lineTo(x + boxWidth, y + boxHeight - radius);
    ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
    ctx.lineTo(x + radius, y + boxHeight);
    ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = style.backgroundColor;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = style.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw text
    ctx.fillStyle = style.color;
    ctx.font = style.font;
    ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
    const textX = align === 'left' ? x + padding : align === 'right' ? x + boxWidth - padding : 0;
    ctx.fillText(text, textX, 0);

    ctx.restore();
  };

  specs.forEach(drawOne);
  
  ctx.restore();
}

const getPointOnSegments = (segments, t) => {
  const safeSegments = Array.isArray(segments) ? segments : [];
  if (safeSegments.length === 0) return null;
  const lengths = safeSegments.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  let remaining = t * total;
  for (let i = 0; i < safeSegments.length; i += 1) {
    const segLen = lengths[i];
    if (remaining <= segLen || i === safeSegments.length - 1) {
      const ratio = segLen === 0 ? 0 : remaining / segLen;
      const [a, b] = safeSegments[i];
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    }
    remaining -= segLen;
  }
  const last = safeSegments[safeSegments.length - 1];
  return last ? { x: last[1].x, y: last[1].y } : null;
};

const getCenterSegmentMidpoint = (segments) => {
  const safeSegments = Array.isArray(segments) ? segments : [];
  if (safeSegments.length === 0) return null;
  const lengths = safeSegments.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (!total) return null;
  const half = total / 2;
  let walked = 0;
  for (let i = 0; i < safeSegments.length; i += 1) {
    const segLen = lengths[i];
    const next = walked + segLen;
    if (half <= next || i === safeSegments.length - 1) {
      const [a, b] = safeSegments[i];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    walked = next;
  }
  return null;
};

export function getEdgeLabelSpecs(edge) {
  const labels = Array.isArray(edge?.labels) ? edge.labels : null;
  const legacy = typeof edge?.label === 'string' && edge.label.trim() ? edge.label : null;
  const resolved = labels ? labels : legacy ? [null, legacy, null] : null;
  if (!resolved) return [];

  const segments = edge?.isOrthogonal ? edge?.segments : null;

  const computePos = (slot) => {
    if (segments && Array.isArray(segments) && segments.length) {
      if (slot === 0) return getPointOnSegments(segments, 0.08) || edge.sourcePos || { x: 0, y: 0 };
      if (slot === 2) return getPointOnSegments(segments, 0.92) || edge.targetPos || { x: 0, y: 0 };
      return getCenterSegmentMidpoint(segments) || getPointOnSegments(segments, 0.5) || { x: 0, y: 0 };
    }

    if (edge?.sourcePos && edge?.targetPos) {
      const t = slot === 0 ? 0.12 : slot === 2 ? 0.88 : 0.5;
      if (edge?.style?.curved && edge?.cp1 && edge?.cp2) {
        const x = Math.pow(1 - t, 3) * edge.sourcePos.x + 3 * Math.pow(1 - t, 2) * t * edge.cp1.x + 3 * (1 - t) * Math.pow(t, 2) * edge.cp2.x + Math.pow(t, 3) * edge.targetPos.x;
        const y = Math.pow(1 - t, 3) * edge.sourcePos.y + 3 * Math.pow(1 - t, 2) * t * edge.cp1.y + 3 * (1 - t) * Math.pow(t, 2) * edge.cp2.y + Math.pow(t, 3) * edge.targetPos.y;
        return { x, y };
      }
      return {
        x: edge.sourcePos.x + (edge.targetPos.x - edge.sourcePos.x) * t,
        y: edge.sourcePos.y + (edge.targetPos.y - edge.sourcePos.y) * t
      };
    }

    return { x: 0, y: 0 };
  };

  const result = [];
  resolved.forEach((value, slot) => {
    if (typeof value !== 'string') return;
    const text = value.trim();
    if (!text) return;
    result.push({
      text,
      slot,
      align: slot === 0 ? 'left' : slot === 2 ? 'right' : 'center',
      position: computePos(slot)
    });
  });
  return result;
}

export function getEdgeLabelPosition(edge) {
  // Defensive: check for valid source/target positions
  if (!edge || !edge.sourcePos || !edge.targetPos) return { x: 0, y: 0 };
  // Midpoint between source and target
  const x = (edge.sourcePos.x + edge.targetPos.x) / 2;
  const y = (edge.sourcePos.y + edge.targetPos.y) / 2;
  return { x, y };
}

export function getEdgeLabelStyle(edge, theme) {
  const defaultStyle = {
    fontSize: '16px', // Larger font
    fontFamily: theme?.typography?.fontFamily || 'Arial, sans-serif',
    color: '#000000', // Black text
    backgroundColor: '#ffffff', // White background
    borderColor: '#000000', // Black border
    fontWeight: 'bold' // Bold text
  };
  
  // Merge with edge-specific style
  return {
    ...defaultStyle,
    ...edge.style?.label,
    font: `bold ${defaultStyle.fontSize} ${defaultStyle.fontFamily}`
  };
}

// Hit testing for edge labels
export function isPointInEdgeLabel(point, edge, theme) {
  const specs = getEdgeLabelSpecs(edge);
  if (!specs.length) return false;

  const style = getEdgeLabelStyle(edge, theme);
  const fontSize = typeof style.fontSize === 'string' ? parseFloat(style.fontSize) : (style.fontSize || 16);
  const basePadding = typeof style.padding === 'string' ? parseFloat(style.padding) : (style.padding || 4);
  const padding = basePadding * 2; // easier clicking
  const labelHeight = fontSize * 1.5;

  return specs.some((spec) => {
    const text = spec.text || '';
    if (!text) return false;
    const pos = spec.position || { x: 0, y: 0 };
    const align = spec.align || 'center';
    const labelWidth = text.length * fontSize * 0.7;

    let left = pos.x - labelWidth / 2 - padding;
    let right = pos.x + labelWidth / 2 + padding;
    if (align === 'left') {
      left = pos.x - padding;
      right = pos.x + labelWidth + padding;
    } else if (align === 'right') {
      left = pos.x - labelWidth - padding;
      right = pos.x + padding;
    }

    const bounds = {
      left,
      right,
      top: pos.y - labelHeight / 2 - padding,
      bottom: pos.y + labelHeight / 2 + padding
    };
    return (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    );
  });
}
