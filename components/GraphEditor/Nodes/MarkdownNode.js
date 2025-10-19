"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import eventBus from '../../NodeGraph/eventBus';
import LinkIcon from '@mui/icons-material/Link';

const MarkdownNode = ({ 
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
  nodeRefs,
  onResize
}) => {
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const width = (node?.width || 200) * zoom;
  const height = (node?.height || 150) * zoom;
  const nodeRef = useRef(null);

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

  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const deltaX = (e.clientX - resizeStart.x) / zoom;
      const deltaY = (e.clientY - resizeStart.y) / zoom;
      
      const newWidth = Math.max(100, resizeStart.width + deltaX);
      const newHeight = Math.max(80, resizeStart.height + deltaY);
      
      // Emit resize event
      eventBus.emit('nodeResize', { 
        id: node.id, 
        width: newWidth, 
        height: newHeight 
      });
      
      if (onResize) {
        onResize(node.id, newWidth, newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save to history on resize end
      eventBus.emit('nodeResizeEnd', { id: node.id });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart, zoom, node.id, onResize]);

  const memo = node?.data?.memo || '';
  const hasLink = node?.data?.link && node.data.link.trim().length > 0;

  // Theme-sensitive board colors
  const isDark = theme.palette.mode === 'dark';
  const boardBackground = isDark 
    ? '#1a2b1a'  // Dark green blackboard
    : '#f8f9fa';  // Off-white whiteboard
  const textColor = isDark 
    ? '#c8e6c9'  // Chalk green
    : '#2c3e50';  // Dark gray/blue
  const borderColor = isDark
    ? '#4a6b4a'  // Wood frame for blackboard
    : '#8b7355';  // Wood frame for whiteboard

  // Base position for non-dragging state
  const baseLeft = (typeof node?.position?.x === 'number' ? node.position.x : 0) * zoom + pan.x - width / 2;
  const baseTop = (typeof node?.position?.y === 'number' ? node.position.y : 0) * zoom + pan.y - height / 2;

  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: node.width || 200,
      height: node.height || 150
    });
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
        cursor: isResizing ? 'nwse-resize' : (draggingHandle ? 'grabbing' : 'grab'),
        border: isSelected ? `4px solid ${borderColor}` : `3px solid ${borderColor}`,
        background: boardBackground,
        borderRadius: 4,
        boxShadow: isSelected 
          ? `0 0 12px ${theme.palette.secondary.main}, inset 0 2px 8px rgba(0,0,0,0.3)` 
          : 'inset 0 2px 8px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.3)',
        color: textColor,
        zIndex: 100,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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
      {/* Markdown content */}
      <div 
        style={{ 
          flex: 1,
          padding: '12px',
          overflow: 'auto',
          fontSize: Math.max(10, 12 * zoom),
          lineHeight: 1.5,
          fontFamily: isDark ? '"Courier New", Courier, monospace' : '"Comic Sans MS", "Trebuchet MS", sans-serif',
          cursor: 'pointer',
          pointerEvents: 'none'
        }}
      >
        <ReactMarkdown
          components={{
            // Style markdown elements to fit the board theme
            p: ({node, ...props}) => <p style={{ margin: '0 0 8px 0', color: textColor }} {...props} />,
            h1: ({node, ...props}) => <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5em', color: textColor, fontWeight: 'bold', borderBottom: isDark ? '2px solid #4a6b4a' : '2px solid #8b7355' }} {...props} />,
            h2: ({node, ...props}) => <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3em', color: textColor, fontWeight: 'bold' }} {...props} />,
            h3: ({node, ...props}) => <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15em', color: textColor, fontWeight: 'bold' }} {...props} />,
            ul: ({node, ...props}) => <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px', color: textColor }} {...props} />,
            ol: ({node, ...props}) => <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px', color: textColor }} {...props} />,
            li: ({node, ...props}) => <li style={{ margin: '3px 0', color: textColor }} {...props} />,
            code: ({node, inline, ...props}) => 
              inline 
                ? <code style={{ background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', padding: '2px 5px', borderRadius: 3, color: textColor, fontFamily: 'monospace' }} {...props} />
                : <code style={{ display: 'block', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', padding: '10px', borderRadius: 4, margin: '10px 0', overflow: 'auto', color: textColor, fontFamily: 'monospace', border: isDark ? '1px solid #4a6b4a' : '1px solid #d0d0d0' }} {...props} />,
            strong: ({node, ...props}) => <strong style={{ color: textColor, fontWeight: 'bold', textShadow: isDark ? '0 0 1px rgba(200, 230, 201, 0.5)' : 'none' }} {...props} />,
            em: ({node, ...props}) => <em style={{ color: textColor, fontStyle: 'italic' }} {...props} />,
            a: ({node, ...props}) => <a style={{ color: isDark ? '#81c784' : '#1976d2', textDecoration: 'underline', pointerEvents: 'auto' }} {...props} target="_blank" rel="noopener noreferrer" />
          }}
        >
          {memo}
        </ReactMarkdown>
      </div>
      
      {/* Link indicator */}
      {hasLink && (
        <div style={{
          position: 'absolute',
          bottom: 6,
          right: 28,
          backgroundColor: isDark ? 'rgba(200, 230, 201, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: '50%',
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.3)',
          border: isDark ? '1px solid #4a6b4a' : '1px solid #8b7355'
        }}>
          <LinkIcon sx={{ fontSize: 14, color: isDark ? '#1a2b1a' : '#8b7355' }} />
        </div>
      )}
      
      {/* Resize handle - bottom right corner */}
      {isSelected && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 24,
            height: 24,
            cursor: 'nwse-resize',
            background: borderColor,
            borderTopLeftRadius: 4,
            borderBottomRightRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
            zIndex: 102,
            pointerEvents: 'auto'
          }}
        >
          <div style={{
            width: 12,
            height: 12,
            borderRight: `2px solid ${textColor}`,
            borderBottom: `2px solid ${textColor}`,
            opacity: 0.8
          }} />
        </div>
      )}
      
      {children}  
    </div>
  );
};

export default MarkdownNode;
