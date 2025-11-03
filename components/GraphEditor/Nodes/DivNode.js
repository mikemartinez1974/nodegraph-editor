"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import FixedNode from './FixedNode';
import DOMPurify from 'isomorphic-dompurify';

const DivNode = (props) => {
  const { node, zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const contentRef = useRef(null);

  const htmlContent = node?.data?.memo || node?.label || '<p>No content</p>';

  // Sanitize HTML using DOMPurify with tlz:// protocol support
  const sanitizedHtml = useMemo(() => {
    if (typeof window === 'undefined' || !DOMPurify) return htmlContent;
    
    return DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'code', 'pre', 'blockquote'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      // Allow tlz:// protocol in addition to standard protocols
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|tlz):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    });
  }, [htmlContent]);

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

  // Handle all link clicks after render
  useEffect(() => {
    if (!contentRef.current) return;

    const handleLinkClick = (e) => {
      const target = e.target.closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;

      console.log('[DivNode] Link clicked:', href);

      // Handle tlz:// links
      if (href.startsWith('tlz://')) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('[DivNode] Handling tlz:// link:', href);
        const rest = href.slice('tlz://'.length);
        const firstSlash = rest.indexOf('/');
        let host = '';
        let path = '';

        if (firstSlash !== -1) {
          host = rest.slice(0, firstSlash);
          path = rest.slice(firstSlash);
        } else {
          path = '/' + rest;
        }

        const fullUrl = host ? `${window.location.protocol}//${host}${path}` : window.location.origin + path;
        console.log('[DivNode] Emitting fetchUrl for:', fullUrl);
        eventBus.emit('fetchUrl', { url: fullUrl });
        return;
      }

      // Handle regular links - open in new tab
      if (href.startsWith('http://') || href.startsWith('https://')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[DivNode] Opening regular link in new tab:', href);
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }

      console.log('[DivNode] Link not handled:', href);
    };

    const content = contentRef.current;
    content.addEventListener('click', handleLinkClick, true); // Use capture phase
    
    return () => {
      content.removeEventListener('click', handleLinkClick, true);
    };
  }, []);
  
  // Render FixedNode with HTML content and resize handle
  return (
    <FixedNode {...props} hideDefaultContent={true}>
      {/* HTML content */}
      <div 
        ref={contentRef}
        className="html-content" 
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
          color: '#000'
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        onMouseDown={(e) => {
          console.log('[DivNode] MouseDown on content, target:', e.target.tagName);
          const link = e.target.tagName === 'A' ? e.target : e.target.closest('a');
          
          if (link) {
            const href = link.getAttribute('href');
            console.log('[DivNode] MouseDown on link, href:', href);
            
            // Stop propagation to prevent node drag
            e.stopPropagation();
            e.preventDefault();
            
            // Handle the link click directly here since click event may not fire
            if (!href) return;
            
            // Handle tlz:// links
            if (href.startsWith('tlz://')) {
              const rest = href.slice('tlz://'.length);
              const firstSlash = rest.indexOf('/');
              let host = '';
              let path = '';

              if (firstSlash !== -1) {
                host = rest.slice(0, firstSlash);
                path = rest.slice(firstSlash);
              } else {
                path = '/' + rest;
              }

              const fullUrl = host ? `${window.location.protocol}//${host}${path}` : window.location.origin + path;
              console.log('[DivNode] Emitting fetchUrl for:', fullUrl);
              eventBus.emit('fetchUrl', { url: fullUrl });
              return;
            }

            // Handle regular links - open in new tab
            if (href.startsWith('http://') || href.startsWith('https://')) {
              console.log('[DivNode] Opening regular link in new tab:', href);
              window.open(href, '_blank', 'noopener,noreferrer');
              return;
            }
            
            return;
          }
          
          // Stop propagation for non-link mousedowns to prevent node drag
          e.stopPropagation();
        }}
        onClick={(e) => {
          console.log('[DivNode] onClick fired, target:', e.target.tagName, e.target);
          const link = e.target.tagName === 'A' ? e.target : e.target.closest('a');
          if (link) {
            console.log('[DivNode] Click on link detected, stopping propagation');
            e.stopPropagation();
            e.preventDefault();
            return;
          }
          // Stop propagation for non-link clicks to prevent node selection
          e.stopPropagation();
        }}
      />

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
