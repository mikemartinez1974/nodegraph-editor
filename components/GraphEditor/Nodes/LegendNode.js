"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import FixedNode from './FixedNode';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const NON_PASSIVE_LISTENER = { passive: false };

const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const LegendNode = (props) => {
  const node = useNodeHandleSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const { zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  const entries = Array.isArray(node?.data?.entries) ? node.data.entries : [];
  const markdown = typeof node?.data?.markdown === 'string' ? node.data.markdown : '';

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
    resizeStartSize.current = { width: node.width || 200, height: node.height || 120 };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (event) => {
      const point = getPointerPosition(event);
      if (!point) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const dx = (point.x - resizeStartPos.current.x) / zoom;
      const dy = (point.y - resizeStartPos.current.y) / zoom;
      const newWidth = Math.max(200, resizeStartSize.current.width + dx);
      const newHeight = Math.max(140, resizeStartSize.current.height + dy);

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

  const surfaceFill = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.72)
    : alpha(theme.palette.background.paper, 0.9);
  const cardFill = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.85)
    : alpha(theme.palette.background.paper, 0.98);

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        className="legend-content"
        data-allow-touch-scroll="true"
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          bottom: '24px',
          fontSize: Math.max(10, 12 * zoom),
          lineHeight: 1.4,
          userSelect: 'text',
          cursor: 'text',
          overflow: 'hidden',
          padding: '8px',
          boxSizing: 'border-box',
          zIndex: 1,
          pointerEvents: 'auto',
          backgroundColor: surfaceFill,
          color: theme.palette.text.primary,
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            {node?.label || 'Legend'}
          </div>
          <div style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: 2 }}>
            Reading guide + mappings
          </div>
          <hr style={{ width: '100%', opacity: 0.3, margin: '8px 0' }} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
          {markdown ? (
            <div style={{ marginBottom: 10, whiteSpace: 'pre-wrap', opacity: 0.8 }}>
              {markdown}
            </div>
          ) : null}

          <div style={{ fontWeight: 600, marginBottom: 6 }}>Legend Entries</div>
          {entries.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entries.map((entry, index) => (
                <div
                  key={entry?.key || `${node.id}-legend-${index}`}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1px solid ${theme.palette.divider}`,
                    background: cardFill
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {entry?.key || `entry-${index + 1}`}
                  </div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>
                    {entry?.intent || 'intent'} • {entry?.implementation || 'implementation'}
                  </div>
                  {entry?.dictionaryKey ? (
                    <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                      dictionary: {entry.dictionaryKey}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
              No legend entries defined.
            </div>
          )}
        </div>
      </div>

      <div
        onMouseDown={handleResizeStart}
        onTouchStart={(event) => handleResizeStart(event.nativeEvent || event)}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          opacity: isSelected ? 0.7 : 0.3,
          transition: 'opacity 0.2s ease',
          zIndex: 2
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.opacity = isSelected ? '0.7' : '0.3';
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

export default LegendNode;
