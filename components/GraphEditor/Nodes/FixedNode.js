"use client";
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import eventBus from '../../NodeGraph/eventBus';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';
import { alpha } from '@mui/material';

// Helper to check if a color is a gradient
const isGradientColor = (color) => {
  return color && (color.includes('gradient') || color.includes('linear-') || color.includes('radial-'));
};

const FixedNode = ({ 
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

  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  // Base position for non-dragging state
  const baseLeft = (typeof node?.position?.x === 'number' ? node.position.x : 0) * zoom + pan.x - width / 2;
  const baseTop = (typeof node?.position?.y === 'number' ? node.position.y : 0) * zoom + pan.y - height / 2;

  // Use node.color if available and non-empty, otherwise use theme colors
  const nodeColor = (node?.color && node.color.trim()) ? node.color : null;
  const isGradient = nodeColor && isGradientColor(nodeColor);
  
  // Use custom color if provided, otherwise use theme
  const backgroundColor = nodeColor 
    ? nodeColor
    : theme.palette.background.paper;
  const borderColor = nodeColor
    ? nodeColor
    : theme.palette.primary.main;

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
      {/* Render node label/markdown if present */}
      {node?.label && (
        <div style={{ 
          textAlign: 'center', 
          fontWeight: 500, 
          fontSize: Math.max(12, 14 * zoom), 
          marginTop: 4,
          padding: '0 4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%'
        }}>
          {node.label.includes('**') || node.label.includes('*') || node.label.includes('#') ? (
            <div style={{
              fontSize: 'inherit',
              '& p': { margin: 0 },
              '& strong': { fontWeight: 'bold' },
              '& em': { fontStyle: 'italic' }
            }}>
              <ReactMarkdown
                components={{
                  p: ({node, ...props}) => <span style={{ margin: 0 }} {...props} />,
                  strong: ({node, ...props}) => <strong {...props} />,
                  em: ({node, ...props}) => <em {...props} />
                }}
              >
                {node.label}
              </ReactMarkdown>
            </div>
          ) : (
            node.label
          )}
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
      {children}  
    </div>
  );
};

export default FixedNode;