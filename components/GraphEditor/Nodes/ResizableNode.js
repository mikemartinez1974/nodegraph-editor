"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';

const ResizableNode = ({ 
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
  const width = (node?.width || 60) * zoom;
  const height = (node?.height || 60) * zoom;
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
      
      const newWidth = Math.max(40, resizeStart.width + deltaX);
      const newHeight = Math.max(40, resizeStart.height + deltaY);
      
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

  const hasMemo = node?.data?.memo && node.data.memo.trim().length > 0;
  const hasLink = node?.data?.link && node.data.link.trim().length > 0;

  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

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
      width: node.width || 60,
      height: node.height || 60
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
        border: isSelected ? `2px solid ${theme.palette.secondary.main}` : `1px solid ${theme.palette.primary.main}`,
        background: isSelected ? selected_gradient : unselected_gradient,
        borderRadius: 8,
        boxShadow: isSelected ? `0 0 8px ${theme.palette.primary.main}` : '0 1px 4px #aaa',
        color: isSelected ? `${theme.textColors.dark}` : `${theme.textColors.light}`,
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
          padding: '0 4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%'
        }}>
          {node.label}
        </div>
      )}
      
      {/* Data indicators */}
      {(hasMemo || hasLink) && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: hasMemo && hasLink ? 48 : 28,
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
      
      {/* Resize handle - bottom right corner */}
      {isSelected && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            background: theme.palette.secondary.main,
            borderTopLeftRadius: 4,
            borderBottomRightRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
            zIndex: 102,
            pointerEvents: 'auto'
          }}
        >
          <div style={{
            width: 10,
            height: 10,
            borderRight: `2px solid ${theme.palette.secondary.contrastText}`,
            borderBottom: `2px solid ${theme.palette.secondary.contrastText}`,
            opacity: 0.9
          }} />
        </div>
      )}
      
      {children}  
    </div>
  );
};

export default ResizableNode;