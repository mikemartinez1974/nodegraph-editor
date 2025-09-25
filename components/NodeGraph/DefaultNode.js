import React from 'react';
import { emit } from './eventBus';

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
        background: theme.palette.primary.main,
        color: theme.palette.text.primary,
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
      onMouseDown={e => emit('nodeMouseDown', { id: node.id, event: e })}
      onMouseUp={e => emit('nodeMouseUp', { id: node.id, event: e })}
      onDoubleClick={e => emit('nodeDoubleClick', { id: node.id, event: e })}
      onContextMenu={e => emit('nodeContextMenu', { id: node.id, event: e })}
      onFocus={e => emit('nodeFocus', { id: node.id, event: e })}
      onBlur={e => emit('nodeBlur', { id: node.id, event: e })}
      onMouseEnter={e => emit('nodeMouseEnter', { id: node.id, event: e })}
      onMouseLeave={e => emit('nodeMouseLeave', { id: node.id, event: e })}
      onClick={e => emit('nodeClick', { id: node.id, event: e })}
      tabIndex={0}
    >
      {node.label || node.id}
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          background: theme.palette.secondary.main,
          borderRadius: 4,
          cursor: 'nwse-resize',
          pointerEvents: 'auto',
          zIndex: 2,
          display: node.resizable ? 'block' : 'none'
        }}
        onMouseDown={e => emit('handleMouseDown', { nodeId: node.id, event: e })}
        onMouseUp={e => emit('handleMouseUp', { nodeId: node.id, event: e })}
        onDoubleClick={e => emit('handleDoubleClick', { nodeId: node.id, event: e })}
        onContextMenu={e => emit('handleContextMenu', { nodeId: node.id, event: e })}
        onFocus={e => emit('handleFocus', { nodeId: node.id, event: e })}
        onBlur={e => emit('handleBlur', { nodeId: node.id, event: e })}
        onMouseEnter={e => emit('handleMouseEnter', { nodeId: node.id, event: e })}
        onMouseLeave={e => emit('handleMouseLeave', { nodeId: node.id, event: e })}
        tabIndex={0}
      />
    </div>
  );
}
