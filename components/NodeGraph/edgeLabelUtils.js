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
  if (!edge.label) return;
  
  const labelPosition = getEdgeLabelPosition(edge);
  const style = getEdgeLabelStyle(edge, theme);
  const text = edge.label;

  // Calculate angle along the edge
  let angle = 0;
  if (edge.sourcePos && edge.targetPos) {
    // Check if edge is curved (check if edge has curve data or style)
    const isCurved = edge.style?.curved || false;
    
    if (isCurved && edge.midX !== undefined) {
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
  
  // Move to label position and rotate
  ctx.translate(labelPosition.x, labelPosition.y);
  ctx.rotate(angle);
  
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;

  // Measure text
  const padding = 8;
  const radius = 8;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 20; // Approximate for 16px font
  const boxWidth = textWidth + padding * 2;
  const boxHeight = textHeight + padding * 2;
  const x = -boxWidth / 2;
  const y = -boxHeight / 2;

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

  // Draw text (at origin since we already translated)
  ctx.fillStyle = style.color;
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  
  ctx.restore();
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
  if (!edge.label) {
    return false;
  }
  
  // Use the same position calculation as drawing
  const labelPosition = getEdgeLabelPosition(edge);
  const style = getEdgeLabelStyle(edge, theme);
  
  // Parse fontSize and padding from string to number (e.g., "16px" -> 16)
  const fontSize = typeof style.fontSize === 'string' ? parseFloat(style.fontSize) : (style.fontSize || 16);
  const basePadding = typeof style.padding === 'string' ? parseFloat(style.padding) : (style.padding || 4);
  const padding = basePadding * 2; // Double padding for easier clicking
  const labelWidth = edge.label.length * fontSize * 0.7; // More generous width estimate
  const labelHeight = fontSize * 1.5; // Account for line height
  
  const bounds = {
    left: labelPosition.x - labelWidth / 2 - padding,
    right: labelPosition.x + labelWidth / 2 + padding,
    top: labelPosition.y - labelHeight / 2 - padding,
    bottom: labelPosition.y + labelHeight / 2 + padding
  };
  
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  );
}