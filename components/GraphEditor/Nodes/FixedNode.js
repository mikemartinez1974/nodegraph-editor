"use client";
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { TlzLink } from '../components/TlzLink';
import eventBus from '../../NodeGraph/eventBus';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';
import { alpha } from '@mui/material';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

// Helper to check if a color is a gradient
const isGradientColor = (color) => {
  return color && (color.includes('gradient') || color.includes('linear-') || color.includes('radial-'));
};

const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const FixedNode = ({
  node: rawNode,
  pan = { x: 0, y: 0 },
  zoom = 1,
  style = {},
  isSelected,
  onMouseDown,
  onTouchStart,
  onClick,
  onDoubleClick,
  onContextMenu,
  children,
  draggingHandle,
  nodeRefs,
  hideDefaultContent = false,
  disableChrome = false // Allow callers to completely opt out of gradients/borders
}) => {
  const node = useNodeHandleSchema(rawNode, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const theme = useTheme();
  const width = (node?.width || 200) * zoom;
  const height = (node?.height || 50) * zoom;
  const nodeRef = useRef(null);
  const [isRotating, setIsRotating] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const rotationStartRef = useRef({ angle: 0, mouseAngle: 0 });
  
  // Get current rotation from node data or default to 0
  const rotation = node?.data?.rotation || 0;

  // Track when node is being dragged to disable transitions
  useEffect(() => {
    const handleDragStart = ({ node: dragNode }) => {
      if (dragNode?.id === node.id) {
        setIsDragging(true);
      }
    };

    const handleDragEnd = ({ nodeIds }) => {
      if (nodeIds?.includes(node.id)) {
        setIsDragging(false);
      }
    };

    eventBus.on('nodeDragStart', handleDragStart);
    eventBus.on('nodeDragEnd', handleDragEnd);

    return () => {
      eventBus.off('nodeDragStart', handleDragStart);
      eventBus.off('nodeDragEnd', handleDragEnd);
    };
  }, [node.id]);

  // Register node in nodeRefs
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => {
        nodeRefs.current.delete(node.id);
      };
    }
  }, [node.id, nodeRefs]);

  // Rotation handlers
  const startRotation = (e) => {
    e.stopPropagation();
    setIsRotating(true);
    
    const rect = nodeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    rotationStartRef.current = { angle: rotation, mouseAngle };
  };

  const handleRotation = (e) => {
    if (!isRotating) return;
    
    const rect = nodeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const currentMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    const deltaAngle = currentMouseAngle - rotationStartRef.current.mouseAngle;
    let newRotation = rotationStartRef.current.angle + deltaAngle;
    
    // Normalize to 0-360 range
    newRotation = ((newRotation % 360) + 360) % 360;
    
    // Snap to 15 degree increments if shift is held
    if (e.shiftKey) {
      newRotation = Math.round(newRotation / 15) * 15;
    }
    
    // Apply rotation immediately to DOM for instant visual feedback
    if (nodeRef.current) {
      nodeRef.current.style.transform = `rotate(${newRotation}deg)`;
    }
    
    // Also update the node data for persistence
    eventBus.emit('nodeUpdate', { 
      id: node.id, 
      updates: { 
        data: { ...node.data, rotation: newRotation } 
      } 
    });
  };

  const stopRotation = () => {
    setIsRotating(false);
  };

  // Add rotation event listeners
  useEffect(() => {
    if (!isRotating) return;
    
    window.addEventListener('mousemove', handleRotation);
    window.addEventListener('mouseup', stopRotation);
    
    return () => {
      window.removeEventListener('mousemove', handleRotation);
      window.removeEventListener('mouseup', stopRotation);
    };
  }, [isRotating, rotation, node.id, node.data]);

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
  const nodeColor = (node?.color && node.color.trim()) ? node.color : null;
  const unselected_gradient = nodeColor ? nodeColor : `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  // Base position for non-dragging state (position is treated as top-left)
  const baseLeft = (typeof node?.position?.x === 'number' ? node.position.x : 0) * zoom + pan.x;
  const baseTop = (typeof node?.position?.y === 'number' ? node.position.y : 0) * zoom + pan.y;

  // Use custom color if provided, otherwise use theme
  const backgroundColor = nodeColor 
    ? nodeColor
    : theme.palette.background.paper;
  const borderColor = nodeColor
    ? nodeColor
    : theme.palette.primary.main;

  // Extend sanitize schema to allow 'tlz' protocol
  const sanitizeSchema = {
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href || []), 'tlz']
    }
  };
  
  const styleOverrides = node?.style || {};
  const computedStyle = {
    position: 'absolute',
    left: baseLeft,
    top: baseTop,
    width,
    height,
    cursor: isRotating ? 'grabbing' : (draggingHandle ? 'grabbing' : 'grab'),
    border: disableChrome
      ? 'none'
      : isSelected
      ? `2px solid ${theme.palette.secondary.main}`
      : `1px solid ${theme.palette.primary.main}`,
    background: disableChrome
      ? 'transparent'
      : isSelected
      ? selected_gradient
      : unselected_gradient,
    borderRadius: disableChrome ? 0 : 8,
    boxShadow: disableChrome
      ? 'none'
      : isSelected
      ? `0 0 8px ${theme.palette.primary.main}`
      : '0 1px 4px #aaa',
    color: disableChrome
      ? theme.palette.text.primary
      : isSelected
      ? `${theme.textColors?.dark || '#000'}`
      : `${theme.textColors?.light || '#fff'}`,
    zIndex: 100,
    pointerEvents: 'auto',
    display: hideDefaultContent ? 'block' : 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: (isRotating || isDragging || draggingHandle) ? 'none' : 'transform 0.1s ease-out',
    ...styleOverrides
  };

  return (
    <div
      ref={nodeRef}
      data-node-draggable="true"
      className="node-or-handle"
      style={computedStyle}
      tabIndex={0}
      onMouseDown={e => {
        // Allow embedded HTML or links to handle the event without triggering node drag/selection
        if (
          e.target.classList?.contains('html-content') ||
          e.target.closest?.('.html-content') ||
          e.target.closest?.('a')
        ) {
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        // Check if Alt key is held for rotation
        if (e.altKey) {
          startRotation(e);
          return;
        }
        if (onMouseDown) onMouseDown(e);
        eventBus.emit('nodeMouseDown', { id: node.id, event: e });
      }}
      onTouchStart={e => {
        if (e.touches && e.touches.length > 1) return;
        if (
          e.target.classList?.contains('html-content') ||
          e.target.closest?.('.html-content') ||
          e.target.closest?.('a')
        ) {
          e.stopPropagation();
          return;
        }
        if (onTouchStart) onTouchStart(e);
        eventBus.emit('nodeMouseDown', { id: node.id, event: e });
      }}
      onClick={e => {
        // Don't stop propagation if clicking inside child elements (like html-content)
        if (e.target.classList.contains('html-content') || e.target.closest('.html-content')) {
          console.log('[FixedNode] Click on html-content, not stopping propagation');
          return; // Let the child handle it
        }
        e.stopPropagation();
        // Prevent nodeClick if clicking a link
        if (e.target && (e.target.tagName === 'A' || e.target.closest('a'))) return;
        if (typeof onClick === 'function') onClick(e);
        // Note: NodeLayer will emit nodeClick, so we don't duplicate it here
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (typeof onDoubleClick === 'function') onDoubleClick(e);
      }}
      onContextMenu={e => {
        if (typeof onContextMenu === 'function') onContextMenu(e);
      }}
      onMouseEnter={e => {
        eventBus.emit('nodeMouseEnter', { id: node.id, event: e });
      }}
      onMouseLeave={e => {
        eventBus.emit('nodeMouseLeave', { id: node.id, event: e });
      }}
    >
      {/* Render node label/markdown if present (unless hideDefaultContent is true) */}
      {!hideDefaultContent && node?.label && (
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
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                urlTransform={(url) => url}
                components={{
                  p: ({node, ...props}) => <span style={{ margin: 0 }} {...props} />,
                  strong: ({node, ...props}) => <strong {...props} />,
                  em: ({node, ...props}) => <em {...props} />,
                  a: TlzLink
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
      {!hideDefaultContent && (hasMemo || hasLink) && (
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
      
      {/* Render children if provided (allows override of default content) */}
      {children}
    </div>
  );
};

export default FixedNode;
