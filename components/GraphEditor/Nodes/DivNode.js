"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import FixedNode from './FixedNode';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { TlzLink } from '../components/TlzLink';
import useNodePortSchema from '../hooks/useNodePortSchema';

// Unified handle schema for display nodes
const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];
const NON_PASSIVE_LISTENER = { passive: false };
const HANDLE_SIZE = 10;
const HANDLE_OFFSET = -4;
const RESIZE_HANDLES = [
  { key: 'nw', cursor: 'nwse-resize', x: HANDLE_OFFSET, y: HANDLE_OFFSET },
  { key: 'n', cursor: 'ns-resize', x: '50%', y: HANDLE_OFFSET, transform: 'translate(-50%, 0)' },
  { key: 'ne', cursor: 'nesw-resize', x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: HANDLE_OFFSET },
  { key: 'e', cursor: 'ew-resize', x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: '50%', transform: 'translate(0, -50%)' },
  { key: 'se', cursor: 'nwse-resize', x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)` },
  { key: 's', cursor: 'ns-resize', x: '50%', y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, transform: 'translate(-50%, 0)' },
  { key: 'sw', cursor: 'nesw-resize', x: HANDLE_OFFSET, y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)` },
  { key: 'w', cursor: 'ew-resize', x: HANDLE_OFFSET, y: '50%', transform: 'translate(0, -50%)' }
];

const DivNode = (props) => {
  // Ensure node has inputs/outputs for handle system
  const node = useNodePortSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const { zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeStateRef = useRef({
    handle: 'se',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startPosX: 0,
    startPosY: 0
  });
  const rafRef = useRef(null);
  const pendingSizeRef = useRef(null);
  const pendingPosRef = useRef(null);
  const iframeRef = useRef(null);
  const MIN_WIDTH = Math.max(1, Number(node?.data?.minWidth) || 1);
  const MIN_HEIGHT = Math.max(1, Number(node?.data?.minHeight) || 1);

  const content = node?.data?.memo || node?.label || '';
  const nodeLabel = node?.label || 'Div';
  
  // Detect if content looks like HTML
  const isHTML = content.trim().startsWith('<') && content.trim().includes('>');
  
  // Extract video embed URL from iframe (YouTube, Vimeo, etc.) - handle escaped quotes
  const embedMatch = content.match(/src=\\?["']([^"']*(?:youtube\.com\/embed|vimeo\.com\/video|player\.vimeo\.com)[^"']*)\\?["']/);
  const embedUrl = embedMatch ? embedMatch[1] : null;
  
  console.log('[DivNode] Content:', content.substring(0, 200));
  console.log('[DivNode] Embed URL extracted:', embedUrl);

  const sanitizeSchema = useMemo(() => ({
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href || []), 'tlz']
    }
  }), []);

  const getPointerPosition = (event) => {
    if (!event) return null;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x: event.clientX, y: event.clientY };
    }
    return null;
  };

  const flushResize = () => {
    rafRef.current = null;
    if (!pendingSizeRef.current || !node?.id) return;
    const { width, height } = pendingSizeRef.current;
    eventBus.emit('nodeResize', { id: node.id, width, height });
    if (pendingPosRef.current) {
      eventBus.emit('nodeMove', { id: node.id, position: pendingPosRef.current });
    }
  };

  const handleResizeStart = (event, handle = 'se') => {
    const point = getPointerPosition(event);
    if (!point) return;
    if (event.stopPropagation) event.stopPropagation();
    if (event.cancelable && event.preventDefault) event.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStateRef.current = {
      handle,
      startX: point.x,
      startY: point.y,
      startWidth: node.width || MIN_WIDTH,
      startHeight: node.height || MIN_HEIGHT,
      startPosX: node.position?.x ?? node.x ?? 0,
      startPosY: node.position?.y ?? node.y ?? 0
    };
    if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore pointer capture errors
      }
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (event) => {
      if (!isResizingRef.current) return;
      const point = getPointerPosition(event);
      if (!point) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const z = zoom || 1;
      const state = resizeStateRef.current;
      const dx = (point.x - state.startX) / z;
      const dy = (point.y - state.startY) / z;
      let newWidth = state.startWidth;
      let newHeight = state.startHeight;
      let newX = state.startPosX;
      let newY = state.startPosY;

      if (state.handle.includes('e')) {
        newWidth = Math.max(MIN_WIDTH, state.startWidth + dx);
      }
      if (state.handle.includes('s')) {
        newHeight = Math.max(MIN_HEIGHT, state.startHeight + dy);
      }
      if (state.handle.includes('w')) {
        newWidth = Math.max(MIN_WIDTH, state.startWidth - dx);
        newX = state.startPosX + (state.startWidth - newWidth);
      }
      if (state.handle.includes('n')) {
        newHeight = Math.max(MIN_HEIGHT, state.startHeight - dy);
        newY = state.startPosY + (state.startHeight - newHeight);
      }

      pendingSizeRef.current = { width: newWidth, height: newHeight };
      pendingPosRef.current = { x: newX, y: newY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushResize);
      }
    };

    const handleResizeEnd = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      flushResize();
      eventBus.emit('nodeResizeEnd', { id: node.id });
    };

    document.addEventListener('pointermove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('pointerup', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('pointercancel', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);

    return () => {
      document.removeEventListener('pointermove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('pointerup', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('pointercancel', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);
    };
  }, [isResizing, node.id, zoom, MIN_WIDTH, MIN_HEIGHT]);

  // Render FixedNode with HTML content or plain text
  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        title="Drag node"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 18,
          zIndex: 3,
          cursor: 'grab',
          pointerEvents: 'auto',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0))'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '18px',
          left: '8px',
          right: '8px',
          bottom: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          padding: '8px',
          zIndex: 1,
          pointerEvents: 'auto',
          backgroundColor: 'transparent'
        }}
      >
        {nodeLabel ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
            urlTransform={(url) => url}
            components={{
              a: TlzLink,
              p: ({ node, ...props }) => <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }} {...props} />
            }}
          >
            {nodeLabel}
          </ReactMarkdown>
        ) : null}
        <hr style={{ width: '100%', opacity: 0.3, margin: '8px 0' }} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {embedUrl ? (
            /* Direct embed iframe - no sandbox for compatibility */
            <iframe
              ref={iframeRef}
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              style={{
                border: 'none',
                width: '100%',
                height: '100%',
                backgroundColor: '#000'
              }}
              title={`Video embed for node ${node.id}`}
            />
          ) : isHTML ? (
            /* Sandboxed iframe for other HTML content */
            <iframe
              ref={iframeRef}
              srcDoc={content}
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              style={{
                border: 'none',
                width: '100%',
                height: '100%',
                backgroundColor: '#fff'
              }}
              title={`Content for node ${node.id}`}
            />
          ) : (
            /* Plain text content */
            <div
              style={{
                fontSize: Math.max(10, 12 * zoom),
                lineHeight: 1.6,
                userSelect: 'text',
                cursor: 'auto',
                overflow: 'auto',
                width: '100%',
                height: '100%',
                color: theme.palette.text.primary,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
              }}
            >
              {content}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {RESIZE_HANDLES.map((handle) => (
          <div
            key={handle.key}
            onPointerDown={(event) => handleResizeStart(event, handle.key)}
            onMouseDown={(event) => handleResizeStart(event, handle.key)}
            onTouchStart={(event) => handleResizeStart(event.nativeEvent || event, handle.key)}
            style={{
              position: 'absolute',
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              borderRadius: 3,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.paper,
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              cursor: handle.cursor,
              opacity: isResizing ? 1 : 0,
              transition: 'opacity 0.2s ease',
              zIndex: 3,
              pointerEvents: 'auto',
              touchAction: 'none',
              userSelect: 'none',
              left: handle.x,
              top: handle.y,
              transform: handle.transform || 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isResizing ? '1' : '0';
            }}
          />
        ))}
      </div>
    </FixedNode>
  );
};

export default DivNode;
