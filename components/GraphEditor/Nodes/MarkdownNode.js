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

const MarkdownNode = (props) => {
  const { node, zoom = 1, isSelected } = props;
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

  const markdownContent = node?.data?.memo || node?.label || 'No content';

  // Resize handlers (same as DefaultNode)
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: node.width || 60, height: node.height || 60 };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e) => {
      const dx = (e.clientX - resizeStartPos.current.x) / zoom;
      const dy = (e.clientY - resizeStartPos.current.y) / zoom;
      const newWidth = Math.max(60, resizeStartSize.current.width + dx);
      const newHeight = Math.max(40, resizeStartSize.current.height + dy);
      
      eventBus.emit('nodeResize', { id: node.id, width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      eventBus.emit('nodeResizeEnd', { id: node.id });
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, node.id, zoom]);
  
  // Render FixedNode with markdown content and resize handle
  return (
    <FixedNode {...props} hideDefaultContent={true}>
      {/* Markdown content */}
      <div className="markdown-content" style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        right: '8px',
        bottom: '24px',
        fontSize: Math.max(10, 12 * zoom),
        lineHeight: 1.6,
        userSelect: 'text',
        cursor: 'text',
        overflow: 'auto',
        padding: '8px',
        boxSizing: 'border-box',
        zIndex: 1,
        pointerEvents: 'auto',
        backgroundColor: 'transparent',
        color: '#000'
      }}
      onClick={(e) => {
        // Prevent clicks on markdown content from triggering node drag
        if (e.target.tagName === 'A' || e.target.closest('a')) return;
        e.stopPropagation();
      }}
      >
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
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
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
