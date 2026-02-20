// GroupLayer.js - Renders group backgrounds and labels
import React, { forwardRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import SelectAllIcon from '@mui/icons-material/SelectAll';

const withAlpha = (color, alpha) => {
  if (!color || typeof color !== 'string') return `rgba(25, 118, 210, ${alpha})`;
  const trimmed = color.trim();
  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((ch) => ch + ch).join('');
    }
    const int = parseInt(hex, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return `rgba(25, 118, 210, ${alpha})`;
};

const GroupLayer = forwardRef(({ 
  groups = [],
  nodes = [],
  pan = { x: 0, y: 0 },
  zoom = 1,
  selectedGroupIds = [],
  onGroupClick,
  onGroupDoubleClick,
  onGroupDragStart,
  onBackgroundClick,
  theme: customTheme
}, ref) => {
  const muiTheme = useTheme();
  const theme = customTheme || muiTheme;
  const [hoveredGroupId, setHoveredGroupId] = useState(null);

  if (!groups || groups.length === 0) return null;

  const getLiveBounds = (group) => {
    if (!group.nodeIds || group.nodeIds.length === 0) return group.bounds || { x: 0, y: 0, width: 0, height: 0 };
    const groupNodes = nodes.filter(n => group.nodeIds.includes(n.id));
    if (groupNodes.length === 0) return group.bounds || { x: 0, y: 0, width: 0, height: 0 };

    const padding = 20;
    const positions = groupNodes.map(n => ({
      x: n.position?.x || n.x || 0,
      y: n.position?.y || n.y || 0,
      width: n.width || 60,
      height: n.height || 60
    }));

    // Positions are top-left; compute bounds directly
    const minX = Math.min(...positions.map(p => p.x)) - padding;
    const maxX = Math.max(...positions.map(p => p.x + p.width)) + padding;
    const minY = Math.min(...positions.map(p => p.y)) - padding;
    const maxY = Math.max(...positions.map(p => p.y + p.height)) + padding;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {groups.map(group => {
        if (group.visible === false) return null;

        const isSelected = selectedGroupIds.includes(group.id);
        const bounds = getLiveBounds(group);
        const style = group.style || {};
        const baseBackgroundColor = style.backgroundColor || 'rgba(25, 118, 210, 0.12)';
        const borderColor = style.borderColor || '#1976d2';
        const selectedBackgroundColor =
          style.selectedBackgroundColor ||
          withAlpha(borderColor, theme.palette.mode === 'dark' ? 0.24 : 0.20);
        const backgroundColor = isSelected ? selectedBackgroundColor : baseBackgroundColor;

        // Collapsed: show only the title box positioned above group's bounds
        if (group.collapsed) {
          const titleWidth = 220;
          const titleHeight = 28;
          const left = bounds.x * zoom + pan.x;
          const top = bounds.y * zoom + pan.y - (titleHeight + 8);

          return (
            <div key={group.id} style={{ position: 'absolute', left, top, width: titleWidth * zoom, height: titleHeight * zoom, pointerEvents: 'auto', zIndex: 40 }}>
              <div
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (isSelected && onGroupDragStart) onGroupDragStart(e, group); }}
                onClick={(e) => { e.stopPropagation(); if (onGroupClick) onGroupClick(group.id, e, 'toggle-collapse'); }}
                onDoubleClick={(e) => { e.stopPropagation(); if (onGroupDoubleClick) onGroupDoubleClick(group.id, e); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: borderColor, color: theme.palette.getContrastText(borderColor), padding: '4px 8px', borderRadius: 6, cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ flex: 1 }}>{group.label} ({group.nodeIds?.length || 0})</div>
                <div
                  onClick={(e) => { e.stopPropagation(); if (onGroupClick) onGroupClick(group.id, e, 'select-members'); }}
                  style={{ width: 28, height: 28, borderRadius: 14, background: theme.palette.primary.main, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.primary.contrastText }}
                >
                  +
                </div>
              </div>
            </div>
          );
        }

        // Expanded: show group rectangle (non-interactive unless selected) and interactive title
        const left = bounds.x * zoom + pan.x;
        const top = bounds.y * zoom + pan.y;
        const width = Math.max(40, bounds.width) * zoom;
        const height = Math.max(24, bounds.height) * zoom;

        return (
          <div
            key={group.id}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              border: `2px solid ${borderColor}`,
              borderRadius: 8,
              backgroundColor,
              pointerEvents: isSelected ? 'auto' : 'none',
              zIndex: isSelected ? 30 : 10,
              transition: 'background-color 120ms ease'
            }}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (isSelected && onGroupDragStart) onGroupDragStart(e, group); }}
          >
            <div
              className="group-label"
              onMouseEnter={() => setHoveredGroupId(group.id)}
              onMouseLeave={() => setHoveredGroupId(null)}
              style={{ position: 'absolute', top: -34, left: 6, padding: '6px 10px', backgroundColor: borderColor, color: theme.palette.getContrastText(borderColor), borderRadius: 6, fontSize: 12, fontWeight: 700, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={(e) => { e.stopPropagation(); if (onGroupClick) onGroupClick(group.id, e, 'toggle-collapse'); }}
              onDoubleClick={(e) => { e.stopPropagation(); if (onGroupDoubleClick) onGroupDoubleClick(group.id, e); }}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (isSelected && onGroupDragStart) onGroupDragStart(e, group); }}
            >
              <div style={{ flex: 1, userSelect: 'none' }}>{group.label || `Group ${group.id}`}</div>
              {hoveredGroupId === group.id && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); if (onGroupClick) onGroupClick(group.id, e, 'select-members'); }} aria-label="Select group members" style={{ color: theme.palette.primary.contrastText, background: 'rgba(255,255,255,0.08)' }}>
                  <SelectAllIcon fontSize="small" />
                </IconButton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default GroupLayer;
