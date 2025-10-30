import React, { useRef } from 'react';
import { HANDLE_RADIUS } from './utils/handleUtils';
import eventBus from './eventBus';

const DRAG_THRESHOLD = 5; // pixels

export const Handle = React.memo(function Handle({ cx, cy, color, isDragging, handle }) {
  const dragStartPos = useRef(null);
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    e.stopPropagation();
    // Start tracking drag
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!dragStartPos.current) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      isDraggingRef.current = true;
    }
  };

  const handleMouseUp = (e) => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (!isDraggingRef.current) {
      e.stopPropagation();
      eventBus.emit('handleClick', {
        id: handle.id,
        nodeId: handle.nodeId,
        type: handle.type,
        position: handle.position,
        color: handle.color
      });
    }
    dragStartPos.current = null;
    isDraggingRef.current = false;
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: `${cx - HANDLE_RADIUS}px`,
        top: `${cy - HANDLE_RADIUS}px`,
        width: `${HANDLE_RADIUS * 2}px`,
        height: `${HANDLE_RADIUS * 2}px`,
        background: color,
        border: '2px solid #fff',
        borderRadius: '50%',
        cursor: 'crosshair',
        outline: 'none',
        boxShadow: isDragging ? '0 0 0 3px #1976d2' : undefined,
        pointerEvents: 'auto',
        zIndex: 10
      }}
      aria-label="Handle"
      tabIndex={0}
      role="button"
    />
  );
});