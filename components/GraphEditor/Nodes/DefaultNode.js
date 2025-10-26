"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { TlzLink } from '../components/TlzLink';

// Helper to check if a color is a gradient
const isGradientColor = (color) => {
  return color && (color.includes('gradient') || color.includes('linear-') || color.includes('radial-'));
};

const DefaultNode = ({ 
  node, 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  style = {}, 
  isSelected, 
  onMouseDown, 
  onClick, 
  onDoubleClick, 
  children, 
  draggingHandle,
  nodeRefs 
}) => {
  const theme = useTheme();
  const width = (node?.width || 60) * zoom;
  const height = (node?.height || 60) * zoom;
  const nodeRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  // Register node in nodeRefs
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => {
        nodeRefs.current.delete(node.id);
      };
    }
  }, [node.id, nodeRefs]);

  // Prevent default wheel behavior
  useEffect(() => {
    const nodeDiv = nodeRef.current;
    if (!nodeDiv) return;
    function handleWheel(e) {
      e.preventDefault();
    }
    nodeDiv.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      nodeDiv.removeEventListener('wheel', handleWheel, { passive: false });
    };
  }, []);

  const hasMemo = node?.data?.memo && node.data.memo.trim().length > 0;
  const hasLink = node?.data?.link && node.data.link.trim().length > 0;

  const nodeColor = (node?.color && node.color.trim()) ? node.color : null;
  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = nodeColor ? nodeColor : `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  // Base position for non-dragging state
  const baseLeft = (typeof node?.position?.x === 'number' ? node.position.x : 0) * zoom + pan.x - width / 2;
  const baseTop = (typeof node?.position?.y === 'number' ? node.position.y : 0) * zoom + pan.y - height / 2;

  // Resize handlers
  const handleResizeStart = (e) => {
    e.stopPropagation();
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

  // Use node.color if available and non-empty, otherwise use theme colors
  const backgroundColor = nodeColor ? nodeColor : theme.palette.background.paper;
  const borderColor = nodeColor ? nodeColor : theme.palette.primary.main;
  
  // Get text color that contrasts with background
  const textColor = theme.palette.getContrastText(
    typeof backgroundColor === 'string' && backgroundColor.startsWith('linear-gradient')
      ? theme.palette.primary.main // Fallback for gradients
      : backgroundColor
  );

  // Extend sanitize schema to allow 'tlz' protocol
  const sanitizeSchema = {
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href || []), 'tlz']
    }
  };

  return (
    <div
      ref={nodeRef}
      className="node-or-handle"
      style={{
        position: 'absolute',
        left: baseLeft,
        top: baseTop,
        width,
        height,
        cursor: draggingHandle ? 'grabbing' : 'grab',
        border: isSelected ? `2px solid ${theme.palette.secondary.main}` : `1px solid ${theme.palette.primary.main}`,
        background: isSelected ? selected_gradient : unselected_gradient,
        borderRadius: 6,
        boxSizing: 'border-box',
        padding: 8,
        color: textColor,
        transition: 'border 0.2s ease',
        zIndex: 100,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
      tabIndex={0}
      onMouseDown={e => {
        e.stopPropagation();
        if (onMouseDown) onMouseDown(e);
        eventBus.emit('nodeMouseDown', { id: node.id, event: e });
      }}
      onClick={e => {
        e.stopPropagation();
        if (typeof onClick === 'function') onClick(e);
        eventBus.emit('nodeClick', { id: node.id, event: e });
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (typeof onDoubleClick === 'function') onDoubleClick(e);
      }}
      onMouseEnter={e => {
        eventBus.emit('nodeMouseEnter', { id: node.id, event: e });
      }}
      onMouseLeave={e => {
        eventBus.emit('nodeMouseLeave', { id: node.id, event: e });
      }}
    >
      {/* Render node label if present */}
      {node?.label && (
        <div style={{ 
          textAlign: 'center', 
          fontWeight: 500, 
          fontSize: Math.max(12, 14 * zoom), 
          marginTop: 4,
          padding: '0 8px',
          overflow: 'auto',
          maxWidth: '100%',
          maxHeight: '80%',
          '& p': { margin: 0 },
          '& code': { 
            backgroundColor: 'rgba(0,0,0,0.1)', 
            padding: '2px 4px', 
            borderRadius: 2,
            fontSize: '0.9em'
          }
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} urlTransform={(url) => url} components={{ a: TlzLink }}>
            {node.label}
          </ReactMarkdown>
        </div>
      )}
      {/* Data indicators */}
      {(hasMemo || hasLink) && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          display: 'flex',
          gap: 4,
          opacity: 0.9
        }}>
          {hasMemo && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              <NoteIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
            </div>
          )}
          {hasLink && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              <LinkIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
            </div>
          )}
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
          '&:hover': {
            opacity: 1
          }
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
      
      {children}  
    </div>
  );
};

export default DefaultNode;