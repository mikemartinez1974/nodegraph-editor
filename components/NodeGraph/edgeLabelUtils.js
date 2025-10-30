// Edge label rendering utilities
export function drawEdgeLabel(ctx, edge, theme) {
  if (!edge.label) return;
  const labelPosition = getEdgeLabelPosition(edge);
  const style = getEdgeLabelStyle(edge, theme);

  // Save context
  ctx.save();
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;

  // Measure text
  const padding = 8;
  const radius = 8;
  const text = edge.label;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 20; // Approximate for 16px font
  const boxWidth = textWidth + padding * 2;
  const boxHeight = textHeight + padding * 2;
  const x = labelPosition.x - boxWidth / 2;
  const y = labelPosition.y - boxHeight / 2;

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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, labelPosition.x, labelPosition.y);
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
  if (!edge.showLabel || !edge.label) return false;
  
  const labelPosition = getEdgeLabelPosition(edge);
  const style = getEdgeLabelStyle(edge, theme);
  
  // Create temporary canvas to measure text
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = style.font;
  
  const metrics = tempCtx.measureText(edge.label);
  const textWidth = metrics.width;
  const textHeight = parseInt(style.fontSize);
  const padding = 4;
  
  // Check if point is within label bounds
  return (
    point.x >= labelPosition.x - textWidth/2 - padding &&
    point.x <= labelPosition.x + textWidth/2 + padding &&
    point.y >= labelPosition.y - textHeight/2 - padding &&
    point.y <= labelPosition.y + textHeight/2 + padding
  );
}