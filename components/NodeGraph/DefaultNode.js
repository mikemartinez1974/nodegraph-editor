import React from 'react';
// import { emit } from './eventBus';

export default function DefaultNode({ node, pan, theme, zoom = 1, isSelected = false }) {
  const width = node.width || 60;
  const height = node.height || 60;
  const fontSize = 16 * zoom;
  return (
    <div
      style={{
        position: 'absolute',
        left: node.position.x + pan.x - width / 2,
        top: node.position.y + pan.y - height / 2,
        width,
        height,
        borderRadius: '50%',
        background: theme.palette.background.paper,
        color: theme.palette.text.secondary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize,
        boxShadow: isSelected ? '0 0 0 4px #2196f3' : '0 2px 8px rgba(0,0,0,0.1)',
        pointerEvents: 'auto',
        userSelect: 'none',
        cursor: 'grab',
        border: isSelected ? '2px solid #2196f3' : 'none',
        zIndex: 10
      }}
      // ...event handlers if needed...
      tabIndex={0}
    >
      {node.label || node.id}
      {/* ...handle div if needed... */}
    </div>
  );
}
