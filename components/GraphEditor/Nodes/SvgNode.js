"use client";
import React, { useRef, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import useNodePortSchema from '../hooks/useNodePortSchema';

const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const SvgNode = ({ 
  node: rawNode, 
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
  const node = useNodePortSchema(rawNode, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const theme = useTheme();
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

  const width = (node?.width || 100) * zoom;
  const height = (node?.height || 100) * zoom;
  const baseLeft = (node?.position?.x || 0) * zoom + pan.x;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y;

  const borderColor = isSelected ? theme.palette.secondary.main : theme.palette.primary.main;

  return (
    <div
      ref={nodeRef}
      className="svg-node"
      style={{
        position: 'absolute',
        left: baseLeft,
        top: baseTop,
        width,
        height,
        //border: `2px solid ${borderColor}`,
        border: 'none',
        borderRadius: 8,
        backgroundColor: 'transparent',
        boxShadow: isSelected ? `0 0 8px ${theme.palette.primary.main}` : '0 1px 4px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: draggingHandle ? 'grabbing' : 'grab',
        pointerEvents: 'auto',
        ...style
      }}
      onMouseDown={e => {
        e.stopPropagation();
        if (onMouseDown) onMouseDown(e);
        eventBus.emit('nodeMouseDown', { id: node.id, event: e });
      }}
      onClick={e => {
        e.stopPropagation();
        if (onClick) onClick(e);
        eventBus.emit('nodeClick', { id: node.id, event: e });
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick(e);
      }}
    >
      {node?.data?.svg && (
        <div
          dangerouslySetInnerHTML={{ __html: node.data.svg }}
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: 'none' // Prevent interaction with the SVG
          }}
        />
      )}
      {children}
    </div>
  );
};

export default SvgNode;
