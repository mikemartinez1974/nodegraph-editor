// Edge label rendering utilities
export function drawEdgeLabel(ctx, edge, theme) {
  if (!edge.showLabel || !edge.label) return;
  
  const labelPosition = getEdgeLabelPosition(edge);
  const style = getEdgeLabelStyle(edge, theme);
  
  // Save context
  ctx.save();
  
  // Set text properties
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Measure text for background
  const metrics = ctx.measureText(edge.label);
  const textWidth = metrics.width;
  const textHeight = parseInt(style.fontSize);
  
  // Draw background if specified
  if (style.backgroundColor) {
    const padding = 4;
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(
      labelPosition.x - textWidth/2 - padding,
      labelPosition.y - textHeight/2 - padding,
      textWidth + padding * 2,
      textHeight + padding * 2
    );
  }
  
  // Draw border if specified
  if (style.borderColor) {
    const padding = 4;
    ctx.strokeStyle = style.borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      labelPosition.x - textWidth/2 - padding,
      labelPosition.y - textHeight/2 - padding,
      textWidth + padding * 2,
      textHeight + padding * 2
    );
  }
  
  // Draw text
  ctx.fillStyle = style.color;
  ctx.fillText(edge.label, labelPosition.x, labelPosition.y);
  
  // Restore context
  ctx.restore();
}

export function getEdgeLabelPosition(edge) {
  const { source, target, style } = edge;
  
  if (style?.curved) {
    // For curved edges, place label at the curve peak
    const controlPoint = getCurveControlPoint(source, target);
    return getQuadraticBezierPoint(source, controlPoint, target, 0.5);
  } else {
    // For straight edges, place label at midpoint
    return {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2
    };
  }
}

export function getEdgeLabelStyle(edge, theme) {
  const defaultStyle = {
    fontSize: '12px',
    fontFamily: theme?.typography?.fontFamily || 'Arial, sans-serif',
    color: theme?.palette?.text?.primary || '#000000',
    backgroundColor: theme?.palette?.background?.paper || '#ffffff',
    borderColor: theme?.palette?.divider || '#e0e0e0'
  };
  
  // Merge with edge-specific style
  return {
    ...defaultStyle,
    ...edge.style?.label,
    font: `${defaultStyle.fontSize} ${defaultStyle.fontFamily}`
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