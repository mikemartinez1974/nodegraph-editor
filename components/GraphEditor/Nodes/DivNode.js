"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import FixedNode from './FixedNode';

const DivNode = (props) => {
  const { node, zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const iframeRef = useRef(null);

  const content = node?.data?.memo || node?.label || '';
  
  // Detect if content looks like HTML
  const isHTML = content.trim().startsWith('<') && content.trim().includes('>');
  
  // Extract video embed URL from iframe (YouTube, Vimeo, etc.) - handle escaped quotes
  const embedMatch = content.match(/src=\\?["']([^"']*(?:youtube\.com\/embed|vimeo\.com\/video|player\.vimeo\.com)[^"']*)\\?["']/);
  const embedUrl = embedMatch ? embedMatch[1] : null;
  
  console.log('[DivNode] Content:', content.substring(0, 200));
  console.log('[DivNode] Embed URL extracted:', embedUrl);

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
    <FixedNode {...props} hideDefaultContent={true}>
      {embedUrl ? (
        /* Direct embed iframe - no sandbox for compatibility */
        <iframe
          ref={iframeRef}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
            bottom: '24px',
            border: 'none',
            width: 'calc(100% - 16px)',
            height: 'calc(100% - 32px)',
            backgroundColor: '#000',
            zIndex: 1
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
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
            bottom: '24px',
            border: 'none',
            width: 'calc(100% - 16px)',
            height: 'calc(100% - 32px)',
            backgroundColor: '#fff',
            zIndex: 1
          }}
          title={`Content for node ${node.id}`}
        />
      ) : (
        /* Plain text content */
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
            bottom: '24px',
            fontSize: Math.max(10, 12 * zoom),
            lineHeight: 1.6,
            userSelect: 'text',
            cursor: 'auto',
            overflow: 'auto',
            padding: '8px',
            boxSizing: 'border-box',
            zIndex: 1,
            pointerEvents: 'auto',
            backgroundColor: 'transparent',
            color: theme.palette.text.primary,
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace'
          }}
        >
          {content}
        </div>
      )}

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
