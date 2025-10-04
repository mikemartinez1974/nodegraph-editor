// GroupLayer.js - Renders group backgrounds and labels
import React from 'react';
import { useTheme } from '@mui/material/styles';

const GroupLayer = ({ 
  groups = [], 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  onGroupClick, 
  onGroupDoubleClick,
  onGroupDragStart,
  selectedGroupIds = [],
  theme: customTheme 
}) => {
  const muiTheme = useTheme();
  const theme = customTheme || muiTheme;

  if (!groups || groups.length === 0) return null;

  return (
    <div 
      style={{ 
        position: 'absolute', 
        left: 0, 
        top: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none',
        zIndex: -1 // Render behind nodes
      }}
    >
      <svg 
        style={{ 
          width: '100%', 
          height: '100%', 
          overflow: 'visible',
          pointerEvents: 'none'
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {groups.map(group => {
            if (!group.visible || group.collapsed) return null;
            
            const isSelected = selectedGroupIds.includes(group.id);
            const bounds = group.bounds;
            
            return (
              <g key={group.id}>
                {/* Group background */}
                <rect
                  x={bounds.x}
                  y={bounds.y}
                  width={bounds.width}
                  height={bounds.height}
                  fill={group.style.backgroundColor}
                  stroke={isSelected ? theme.palette.secondary.main : group.style.borderColor}
                  strokeWidth={isSelected ? group.style.borderWidth + 1 : group.style.borderWidth}
                  strokeDasharray={isSelected ? "4,2" : "none"}
                  rx={group.style.borderRadius}
                  ry={group.style.borderRadius}
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
                    onGroupDragStart?.(e, group);
                  }}
                />
                
                {/* Group label */}
                <text
                  x={bounds.x + 8}
                  y={bounds.y + 16}
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
                      cx={bounds.x + bounds.width - 16}
                      cy={bounds.y + 16}
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
                      x={bounds.x + bounds.width - 16}
                      y={bounds.y + 20}
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
                        cx={corner.x}
                        cy={corner.y}
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
    </div>
  );
};

export default GroupLayer;