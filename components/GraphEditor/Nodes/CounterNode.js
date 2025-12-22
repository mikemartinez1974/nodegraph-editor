import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PinIcon from '@mui/icons-material/Pin';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

// --- New schema handles ---
const COUNTER_INPUTS = [
  { key: 'increment', label: 'Increment', type: 'trigger' },
  { key: 'decrement', label: 'Decrement', type: 'trigger' },
  { key: 'reset', label: 'Reset', type: 'trigger' }
];
const COUNTER_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

export default function CounterNode({ 
  node: origNode, 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  style = {}, 
  isSelected, 
  onMouseDown, 
  onClick, 
  onDoubleClick,
  nodeRefs 
}) {
  const theme = useTheme();
  const nodeRef = useRef(null);
  const node = useNodeHandleSchema(origNode, COUNTER_INPUTS, COUNTER_OUTPUTS);
  
  const width = (node?.width || 200) * zoom;
  const height = (node?.height || 300) * zoom;
  
  // Counter state
  const count = node?.data?.count || 0;
  const step = node?.data?.step || 1;
  const min = node?.data?.min ?? null;
  const max = node?.data?.max ?? null;

  // Register node ref
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  // Emit value changes to connected nodes via eventBus
  useEffect(() => {
    eventBus.emit('nodeOutput', {
      nodeId: node.id,
      outputName: 'value',
      value: count
    });
  }, [count, node.id]);

  // Handle external input events (so edges/other nodes can trigger increment/decrement/reset)
  useEffect(() => {
    const handler = ({ targetNodeId, inputName } = {}) => {
      if (targetNodeId !== node.id) return;
      if (inputName === 'increment') handleIncrement({ stopPropagation: () => {} });
      else if (inputName === 'decrement') handleDecrement({ stopPropagation: () => {} });
      else if (inputName === 'reset') handleReset({ stopPropagation: () => {} });
    };
    eventBus.on('nodeInput', handler);
    return () => eventBus.off('nodeInput', handler);
  }, [count, step, min, max, node.id]);

  const handleIncrement = (e) => {
    e.stopPropagation();
    const newCount = count + step;
    if (max !== null && newCount > max) return;
    eventBus.emit('nodeUpdate', { 
      id: node.id, 
      updates: { 
        data: { 
          ...node.data, 
          count: newCount
        } 
      } 
    });
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    const newCount = count - step;
    if (min !== null && newCount < min) return;
    eventBus.emit('nodeUpdate', { 
      id: node.id, 
      updates: { 
        data: { 
          ...node.data, 
          count: newCount
        } 
      } 
    });
  };

  const handleReset = (e) => {
    e.stopPropagation();
    eventBus.emit('nodeUpdate', { 
      id: node.id, 
      updates: { 
        data: { 
          ...node.data, 
          count: 0
        } 
      } 
    });
  };

  const nodeColor = node?.color || theme.palette.primary.main;
  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y;

  // Check if at limits
  const atMax = max !== null && count >= max;
  const atMin = min !== null && count <= min;

  // Handles are rendered centrally via HandleLayer
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
        cursor: 'grab',
        border: isSelected 
          ? `2px solid ${theme.palette.secondary.main}` 
          : `1px solid ${theme.palette.primary.main}`,
        background: isSelected ? selected_gradient : unselected_gradient,
        borderRadius: 8,
        boxSizing: 'border-box',
        padding: 16,
        color: theme.palette.primary.contrastText,
        transition: 'border 0.2s ease',
        zIndex: 100,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        if (onClick) onClick(e);
        eventBus.emit('nodeClick', { id: node.id, event: e });
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick(e);
      }}
      onMouseEnter={e => eventBus.emit('nodeMouseEnter', { id: node.id, event: e })}
      onMouseLeave={e => eventBus.emit('nodeMouseLeave', { id: node.id, event: e })}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        marginBottom: 12
      }}>
        <PinIcon sx={{ fontSize: 20 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {node?.label || 'Counter'}
        </span>
      </div>

      {/* Count Display */}
      <div style={{
        fontSize: 48,
        fontWeight: 700,
        fontFamily: 'monospace',
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 16,
        textShadow: '0 2px 4px rgba(0,0,0,0.2)',
        minWidth: '100px'
      }}>
        {count}
      </div>

      {/* Increment/Decrement Controls */}
      <div style={{ 
        display: 'flex', 
        gap: 8,
        justifyContent: 'center',
        marginBottom: 12
      }}>
        <button
          onClick={handleDecrement}
          disabled={atMin}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: atMin 
              ? 'rgba(255,255,255,0.2)' 
              : theme.palette.info.main,
            color: 'white',
            cursor: atMin ? 'not-allowed' : 'pointer',
            opacity: atMin ? 0.5 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            fontSize: 20,
            fontWeight: 700
          }}
          title="Decrement"
        >
          <RemoveIcon sx={{ fontSize: 24 }} />
        </button>

        <button
          onClick={handleIncrement}
          disabled={atMax}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: atMax
              ? 'rgba(255,255,255,0.2)'
              : theme.palette.success.main,
            color: 'white',
            cursor: atMax ? 'not-allowed' : 'pointer',
            opacity: atMax ? 0.5 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            fontSize: 20,
            fontWeight: 700
          }}
          title="Increment"
        >
          <AddIcon sx={{ fontSize: 24 }} />
        </button>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        disabled={count === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 16,
          border: 'none',
          backgroundColor: count === 0
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(255,255,255,0.3)',
          color: 'white',
          cursor: count === 0 ? 'not-allowed' : 'pointer',
          opacity: count === 0 ? 0.5 : 1,
          transition: 'all 0.2s',
          fontSize: 12,
          fontWeight: 500,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        title="Reset to 0"
      >
        <RestartAltIcon sx={{ fontSize: 16 }} />
        RESET
      </button>

      {/* Range indicator if limits set */}
      {(min !== null || max !== null) && (
        <div style={{
          marginTop: 8,
          fontSize: 10,
          fontWeight: 500,
          opacity: 0.7,
          letterSpacing: 0.5
        }}>
          Range: {min ?? '−∞'} to {max ?? '+∞'}
        </div>
      )}
    </div>
  );
}
