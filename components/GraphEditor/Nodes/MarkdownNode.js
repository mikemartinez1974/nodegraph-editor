"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { TlzLink } from '../components/TlzLink';
import FixedNode from './FixedNode';
import eventBus from '../../NodeGraph/eventBus';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

// Unified handle schema for display nodes
const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const NON_PASSIVE_LISTENER = { passive: false };

const MarkdownNode = (props) => {
  // Ensure node has inputs/outputs for handle system
  const node = useNodeHandleSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const { zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  const sanitizeSchema = {
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href || []), 'tlz']
    }
  };

  const nodeLabel = node?.label || 'Markdown';
  const markdownContent = (() => {
    const primary = typeof node?.data?.markdown === 'string' ? node.data.markdown : '';
    if (primary.trim().length > 0) {
      return primary;
    }
    return node?.data?.memo || '';
  })();

  // Resize handlers (same as DefaultNode)
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
    resizeStartSize.current = { width: node.width || 60, height: node.height || 60 };
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
  
  // Render FixedNode with markdown content and resize handle
  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      {/* Markdown content */}
      <div className="markdown-content" data-allow-touch-scroll="true" style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        right: '8px',
        bottom: '24px',
        fontSize: Math.max(10, 12 * zoom),
        lineHeight: 1.6,
        userSelect: 'text',
        cursor: 'text',
        overflow: 'hidden',
        padding: '8px',
        boxSizing: 'border-box',
        zIndex: 1,
        pointerEvents: 'auto',
        backgroundColor: 'transparent',
        color: '#000',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={(e) => {
        // Prevent clicks on markdown content from triggering node drag
        if (e.target.tagName === 'A' || e.target.closest('a')) return;
        e.stopPropagation();
      }}
      >
        <div style={{ flexShrink: 0 }}>
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
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {markdownContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
              urlTransform={(url) => url}
              components={{
                a: TlzLink,
                p: ({node, ...props}) => <p style={{ margin: '0.5em 0' }} {...props} />,
                h1: ({node, ...props}) => <h1 style={{ margin: '0.5em 0', fontSize: '1.5em' }} {...props} />,
                h2: ({node, ...props}) => <h2 style={{ margin: '0.5em 0', fontSize: '1.3em' }} {...props} />,
                h3: ({node, ...props}) => <h3 style={{ margin: '0.5em 0', fontSize: '1.1em' }} {...props} />,
                ul: ({node, ...props}) => <ul style={{ margin: '0.5em 0', paddingLeft: '1.5em' }} {...props} />,
                ol: ({node, ...props}) => <ol style={{ margin: '0.5em 0', paddingLeft: '1.5em' }} {...props} />,
                code: ({node, inline, ...props}) => (
                  inline 
                    ? <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: 2 }} {...props} />
                    : <code style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: 4, overflowX: 'auto' }} {...props} />
                )
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          ) : (
            <div style={{ opacity: 0.6, fontStyle: 'italic' }}>No content</div>
          )}
        </div>
      </div>

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
          zIndex: 2
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

export default MarkdownNode;
