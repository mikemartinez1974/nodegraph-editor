// Edge styling utilities for hover and selection states
export function getEdgeStyle(edge, theme, state = {}) {
  const { isHovered = false, isSelected = false } = state;
  
  // Base style from edge definition
  const baseStyle = {
    width: 2,
    color: theme?.palette?.primary?.main || '#1976d2',
    curved: false,
    dashed: false,
    opacity: 1,
    ...edge.style
  };
  
  // Apply hover effects
  if (isHovered && !isSelected) {
    return {
      ...baseStyle,
      width: baseStyle.width + 1,
      color: lightenColor(baseStyle.color, 0.2),
      opacity: Math.min(1, baseStyle.opacity + 0.2),
      shadow: {
        color: baseStyle.color,
        blur: 4,
        offsetX: 0,
        offsetY: 0
      }
    };
  }
  
  // Apply selection effects
  if (isSelected) {
    return {
      ...baseStyle,
      width: baseStyle.width + 2,
      color: theme?.palette?.secondary?.main || '#dc004e',
      opacity: 1,
      shadow: {
        color: theme?.palette?.secondary?.main || '#dc004e',
        blur: 6,
        offsetX: 0,
        offsetY: 0
      },
      animated: true // Add animation for selected edges
    };
  }
  
  return baseStyle;
}

export function drawEdgeWithStyle(ctx, edge, theme, state = {}) {
  const style = getEdgeStyle(edge, theme, state);
  
  // Save context
  ctx.save();
  
  // Apply shadow if present
  if (style.shadow) {
    ctx.shadowColor = style.shadow.color;
    ctx.shadowBlur = style.shadow.blur;
    ctx.shadowOffsetX = style.shadow.offsetX;
    ctx.shadowOffsetY = style.shadow.offsetY;
  }
  
  // Set line properties
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.globalAlpha = style.opacity;
  
  if (style.dashed) {
    ctx.setLineDash([5, 5]);
  } else {
    ctx.setLineDash([]);
  }
  
  // Draw the edge path
  ctx.beginPath();
  
  if (style.curved) {
    drawCurvedEdge(ctx, edge.source, edge.target);
  } else {
    drawStraightEdge(ctx, edge.source, edge.target);
  }
  
  ctx.stroke();
  
  // Draw animated dash for selected edges
  if (style.animated && state.isSelected) {
    drawAnimatedEdge(ctx, edge, style, theme);
  }
  
  // Restore context
  ctx.restore();
}

export function drawAnimatedEdge(ctx, edge, style, theme) {
  const time = Date.now() * 0.002; // Animation speed
  
  ctx.save();
  
  // Create animated dashed line on top
  ctx.strokeStyle = theme?.palette?.background?.paper || '#ffffff';
  ctx.lineWidth = Math.max(1, style.width - 1);
  ctx.globalAlpha = 0.8;
  
  // Animate the dash pattern
  const dashLength = 10;
  const gapLength = 10;
  const offset = (time * 20) % (dashLength + gapLength);
  
  ctx.setLineDash([dashLength, gapLength]);
  ctx.lineDashOffset = -offset;
  
  ctx.beginPath();
  
  if (style.curved) {
    drawCurvedEdge(ctx, edge.source, edge.target);
  } else {
    drawStraightEdge(ctx, edge.source, edge.target);
  }
  
  ctx.stroke();
  ctx.restore();
}

export function drawStraightEdge(ctx, source, target) {
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x, target.y);
}

export function drawCurvedEdge(ctx, source, target) {
  const controlPoint = getCurveControlPoint(source, target);
  
  ctx.moveTo(source.x, source.y);
  ctx.quadraticCurveTo(
    controlPoint.x, 
    controlPoint.y, 
    target.x, 
    target.y
  );
}

// Utility functions
export function lightenColor(color, amount) {
  // Simple color lightening - in production, use a proper color library
  if (color.startsWith('#')) {
    const num = parseInt(color.slice(1), 16);
    const r = Math.min(255, Math.floor((num >> 16) + amount * 255));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + amount * 255));
    const b = Math.min(255, Math.floor((num & 0x0000FF) + amount * 255));
    return `rgb(${r}, ${g}, ${b})`;
  }
  return color;
}

export function darkenColor(color, amount) {
  return lightenColor(color, -amount);
}

// Edge hover detection with enhanced hit area for selected/hovered edges
export function getEdgeHitTolerance(edge, state = {}) {
  const { isHovered = false, isSelected = false } = state;
  
  let baseTolerance = 8;
  
  if (isSelected) {
    baseTolerance += 4; // Easier to interact with selected edges
  } else if (isHovered) {
    baseTolerance += 2; // Slightly easier when hovering
  }
  
  return baseTolerance;
}