// GroupLayer.js - Renders group backgrounds and labels
import React, { forwardRef } from 'react';
import { useTheme } from '@mui/material/styles';

const GroupLayer = forwardRef(({ 
  groups = [], 
  nodes = [], 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  selectedGroupIds = [], 
  onGroupClick, 
  onGroupDoubleClick, 
  onGroupDragStart, 
  theme: customTheme 
}, ref) => {
  const muiTheme = useTheme();
  const theme = customTheme || muiTheme;

  if (!groups || groups.length === 0) return null;

  // Calculate live bounds based on current node positions (no caching - updates every render)
  const getLiveBounds = (group) => {
    if (!group.nodeIds || group.nodeIds.length === 0) return group.bounds;
    
    const groupNodes = nodes.filter(n => group.nodeIds.includes(n.id));
    if (groupNodes.length === 0) return group.bounds;
    
    const padding = 20;
    const positions = groupNodes.map(n => ({
      x: n.position?.x || n.x || 0,
      y: n.position?.y || n.y || 0,
      width: n.width || 60,
      height: n.height || 60
    }));
    
    const minX = Math.min(...positions.map(p => p.x - p.width / 2)) - padding;
    const maxX = Math.max(...positions.map(p => p.x + p.width / 2)) + padding;
    const minY = Math.min(...positions.map(p => p.y - p.height / 2)) - padding;
    const maxY = Math.max(...positions.map(p => p.y + p.height / 2)) + padding;
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };
  
  return (
    <svg 
      style={{ 
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100vw', 
        height: '100vh', 
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 1 // Render behind nodes
      }}
    >
      <g>
          {groups.map((group) => {
            // Only show if visible is explicitly true
            if (group.visible !== true || group.collapsed) return null;
            
            const isSelected = selectedGroupIds.includes(group.id);
            const bounds = getLiveBounds(group); // Calculate bounds live on every render
            
            // Handle both group.style and direct properties
            const style = group.style || {};
            const backgroundColor = style.backgroundColor || 'rgba(25, 118, 210, 0.1)';
            const borderColor = style.borderColor || '#1976d2';
            const borderWidth = style.borderWidth ?? 2;
            const borderRadius = style.borderRadius ?? 8;
            
            return (
              <g key={group.id}>
                {/* Group background */}
                <rect
                  x={bounds.x * zoom + pan.x}
                  y={bounds.y * zoom + pan.y}
                  width={bounds.width * zoom}
                  height={bounds.height * zoom}
                  fill={backgroundColor}
                  stroke={isSelected ? theme.palette.secondary.main : borderColor}
                  strokeWidth={isSelected ? borderWidth + 1 : borderWidth}
                  strokeDasharray={isSelected ? "4,2" : "none"}
                  rx={borderRadius}
                  ry={borderRadius}
                  style={{ 
                    pointerEvents: 'auto',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGroupClick?.(group.id, e);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onGroupDoubleClick?.(group.id, e);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault(); // Prevent pan from starting
                    onGroupDragStart?.(e, group);
                  }}
                />
                
                {/* Group label */}
                <text
                  x={(bounds.x + 8) * zoom + pan.x}
                  y={(bounds.y + 16) * zoom + pan.y}
                  fill={theme.palette.text.primary}
                  fontSize={12}
                  fontWeight="600"
                  fontFamily={theme.typography.fontFamily}
                  style={{ 
                    pointerEvents: 'none',
                    userSelect: 'none'
                  }}
                >
                  {group.label} ({group.nodeIds.length})
                </text>
                
                {/* Collapse/expand button */}
                {group.collapsible !== false && (
                  <g>
                    <circle
                      cx={(bounds.x + bounds.width - 16) * zoom + pan.x}
                      cy={(bounds.y + 16) * zoom + pan.y}
                      r={10}
                      fill={theme.palette.primary.main}
                      stroke={theme.palette.background.paper}
                      strokeWidth={2}
                      style={{ 
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onGroupDoubleClick?.(group.id, e, 'toggle-collapse');
                      }}
                    />
                    {/* Collapse/expand icon */}
                    <text
                      x={(bounds.x + bounds.width - 16) * zoom + pan.x}
                      y={(bounds.y + 20) * zoom + pan.y}
                      fill={theme.palette.primary.contrastText}
                      fontSize={12}
                      fontWeight="bold"
                      textAnchor="middle"
                      style={{ 
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    >
                      {group.collapsed ? '+' : '−'}
                    </text>
                  </g>
                )}
                
                {/* Selection handles if selected */}
                {isSelected && (
                  <g>
                    {/* Corner resize handles */}
                    {[
                      { x: bounds.x, y: bounds.y }, // top-left
                      { x: bounds.x + bounds.width, y: bounds.y }, // top-right
                      { x: bounds.x, y: bounds.y + bounds.height }, // bottom-left
                      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // bottom-right
                    ].map((corner, index) => (
                      <circle
                        key={index}
                        cx={corner.x * zoom + pan.x}
                        cy={corner.y * zoom + pan.y}
                        r={4}
                        fill={theme.palette.secondary.main}
                        stroke={theme.palette.background.paper}
                        strokeWidth={2}
                        style={{ 
                          pointerEvents: 'auto',
                          cursor: index % 2 === 0 ? 'nw-resize' : 'ne-resize'
                        }}
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
  );
});

export default GroupLayer;