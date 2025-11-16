"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import FixedNode from './FixedNode';

const NON_PASSIVE_LISTENER = { passive: false };

const DEFAULT_INPUTS = [
  { key: 'in', label: 'In', type: 'trigger' }
];
const DEFAULT_OUTPUTS = [
  { key: 'out', label: 'Out', type: 'trigger' }
];

const DefaultNode = (props) => {
  const { node, zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  // --- Ensure handles always exist ---
  const nodeWithHandles = {
    ...node,
    inputs: (node.inputs && node.inputs.length > 0) ? node.inputs : DEFAULT_INPUTS,
    outputs: (node.outputs && node.outputs.length > 0) ? node.outputs : DEFAULT_OUTPUTS
  };

  // Resize handlers
  const getPointerPosition = (event) => {
    if (!event) return null;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x: event.clientX, y: event.clientY };
    }
    return null;
  };

  const handleResizeStart = (event) => {
    const point = getPointerPosition(event);
    if (!point) return;
    if (event.stopPropagation) event.stopPropagation();
    if (event.cancelable && event.preventDefault) event.preventDefault();
    setIsResizing(true);
    resizeStartPos.current = { x: point.x, y: point.y };
    resizeStartSize.current = { width: node.width || 200, height: node.height || 50 };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (event) => {
      const point = getPointerPosition(event);
      if (!point) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const dx = (point.x - resizeStartPos.current.x) / zoom;
      const dy = (point.y - resizeStartPos.current.y) / zoom;
      const newWidth = Math.max(60, resizeStartSize.current.width + dx);
      const newHeight = Math.max(40, resizeStartSize.current.height + dy);
      
      eventBus.emit('nodeResize', { id: node.id, width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      eventBus.emit('nodeResizeEnd', { id: node.id });
    };

    document.addEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);
    };
  }, [isResizing, node.id, zoom]);

  // Render FixedNode with a resize handle overlay
  return (
    <FixedNode {...props} node={nodeWithHandles}>
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        onTouchStart={(e) => handleResizeStart(e.nativeEvent || e)}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          opacity: isSelected ? 0.7 : 0.3,
          transition: 'opacity 0.2s ease',
          zIndex: 1
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = isSelected ? '0.7' : '0.3';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M 16,0 L 16,16 L 0,16"
            fill="none"
            stroke={theme.palette.text.secondary}
            strokeWidth="2"
          />
        </svg>
      </div>
    </FixedNode>
  );
};

export default DefaultNode;
