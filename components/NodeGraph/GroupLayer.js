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
  onBackgroundClick, // Add this prop
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
    <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {groups.map((group) => {
        // Only hide if visible is explicitly false (don't hide collapsed groups)
        if (group.visible === false) return null;
        
        const isSelected = selectedGroupIds.includes(group.id);
        const bounds = getLiveBounds(group); // Calculate bounds live on every render
        
        // Handle both group.style and direct properties
        const style = group.style || {};
        const backgroundColor = style.backgroundColor || 'rgba(25, 118, 210, 0.1)';
        const borderColor = style.borderColor || '#1976d2';
        const borderWidth = style.borderWidth ?? 2;
        const borderRadius = style.borderRadius ?? 8;
        
        // If collapsed, show a small collapsed representation
        if (group.collapsed) {
          const collapsedWidth = 120;
          const collapsedHeight = 40;
          const collapsedX = bounds.x + bounds.width / 2 - collapsedWidth / 2;
          const collapsedY = bounds.y + bounds.height / 2 - collapsedHeight / 2;
          
          return (
            <g key={group.id}>
              {/* Collapsed group box */}
              <rect
                x={collapsedX * zoom + pan.x}
                y={collapsedY * zoom + pan.y}
                width={collapsedWidth * zoom}
                height={collapsedHeight * zoom}
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
              />
              
              {/* Collapsed group label */}
              <text
                x={(collapsedX + collapsedWidth / 2) * zoom + pan.x}
                y={(collapsedY + collapsedHeight / 2 + 5) * zoom + pan.y}
                fill={theme.palette.text.primary}
                fontSize={12}
                fontWeight="600"
                fontFamily={theme.typography.fontFamily}
                textAnchor="middle"
                style={{ 
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              >
                {group.label} ({group.nodeIds.length})
              </text>
              
              {/* Expand button */}
              <g>
                <circle
                  cx={(collapsedX + collapsedWidth - 16) * zoom + pan.x}
                  cy={(collapsedY + 16) * zoom + pan.y}
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
                    e.preventDefault();
                    if (onGroupClick) {
                      onGroupClick(group.id, e, 'toggle-collapse');
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                />
                <text
                  x={(collapsedX + collapsedWidth - 16) * zoom + pan.x}
                  y={(collapsedY + 20) * zoom + pan.y}
                  fill={theme.palette.primary.contrastText}
                  fontSize={12}
                  fontWeight="bold"
                  textAnchor="middle"
                  style={{ 
                    pointerEvents: 'none',
                    userSelect: 'none'
                  }}
                >
                  +
                </text>
              </g>
            </g>
          );
        }
        
        return (
          <div
            key={group.id}
            style={{
              position: 'absolute',
              left: bounds.x * zoom + pan.x,
              top: bounds.y * zoom + pan.y,
              width: bounds.width * zoom,
              height: bounds.height * zoom,
              border: `2px solid ${borderColor}`,
              borderRadius: '8px',
              backgroundColor: backgroundColor,
              cursor: 'move',
              zIndex: 10,
              pointerEvents: 'none', // Let clicks pass through
            }}
          >
            {/* Label - restore pointer events only here */}
            <div 
              className="group-label"
              style={{
                position: 'absolute',
                top: -32,
                left: 0,
                padding: '4px 8px',
                backgroundColor: borderColor,
                color: theme.palette.getContrastText(borderColor),
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'auto', // Enable events only on label
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onGroupClick) onGroupClick(group.id, e);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onGroupDragStart(e, group);
              }}
            >
              {group.label || `Group ${group.id}`}
              {/* Collapse button - also needs pointer-events: auto */}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default GroupLayer;