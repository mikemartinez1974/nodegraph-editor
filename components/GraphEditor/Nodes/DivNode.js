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

const DivNode = (props) => {
  // Ensure node has inputs/outputs for handle system
  const node = useNodePortSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const { zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const iframeRef = useRef(null);

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

  // Resize handlers (same as MarkdownNode)
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

  // Render FixedNode with HTML content or plain text
  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          bottom: '24px',
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

export default DivNode;
