import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

// --- New schema handles ---
const TOGGLE_INPUTS = [
  { key: 'set', label: 'Set', type: 'trigger' }
];
const TOGGLE_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

export default function ToggleNode({ 
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
  const node = useNodeHandleSchema(origNode, TOGGLE_INPUTS, TOGGLE_OUTPUTS);
  
  const width = (node?.width || 250) * zoom;
  const height = (node?.height || 350) * zoom;
  
  // Toggle state
  const value = !!(node?.data?.value);
  const mode = node?.data?.mode || 'toggle';
  const isMomentary = mode === 'momentary';
  const onLabel = node?.data?.onLabel || 'ON';
  const offLabel = node?.data?.offLabel || 'OFF';

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
      value: value
    });
  }, [value, node.id]);

  const updateValue = (next) => {
    eventBus.emit('nodeUpdate', {
      id: node.id,
      updates: {
        data: {
          ...node.data,
          value: !!next
        }
      }
    });
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (isMomentary) return;
    updateValue(!value);
  };

  const handleMomentaryDown = (e) => {
    if (!isMomentary) return;
    e.stopPropagation();
    updateValue(true);
  };

  const handleMomentaryUp = (e) => {
    if (!isMomentary) return;
    e.stopPropagation();
    updateValue(false);
  };

  const handleModeChange = (e) => {
    e.stopPropagation();
    const nextMode = e.target.value;
    eventBus.emit('nodeUpdate', {
      id: node.id,
      updates: {
        data: {
          ...node.data,
          mode: nextMode,
          value: nextMode === 'momentary' ? false : value
        }
      }
    });
  };

  const nodeColor = node?.color || theme.palette.primary.main;
  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y;

  // Handles are rendered via the shared HandleLayer
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
        marginBottom: 16
      }}>
        {value ? (
          <ToggleOnIcon sx={{ fontSize: 24, color: theme.palette.success.light }} />
        ) : (
          <ToggleOffIcon sx={{ fontSize: 24, color: 'rgba(255,255,255,0.4)' }} />
        )}
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {node?.label || 'Toggle'}
        </span>
      </div>
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        onMouseDown={handleMomentaryDown}
        onMouseUp={handleMomentaryUp}
        onMouseLeave={handleMomentaryUp}
        onTouchStart={handleMomentaryDown}
        onTouchEnd={handleMomentaryUp}
        onTouchCancel={handleMomentaryUp}
        style={{
          width: '100%',
          height: 60,
          borderRadius: 30,
          border: 'none',
          backgroundColor: value 
            ? theme.palette.success.main
            : 'rgba(255,255,255,0.2)',
          color: 'white',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: value 
            ? '0 4px 12px rgba(76, 175, 80, 0.4)'
            : '0 2px 4px rgba(0,0,0,0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Sliding indicator */}
        <div style={{
          position: 'absolute',
          top: 4,
          left: value ? 'calc(100% - 56px)' : '4px',
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20
        }}>
          {value ? '✓' : '✕'}
        </div>
        {/* Label */}
        <div style={{
          position: 'absolute',
          left: value ? '16px' : 'auto',
          right: value ? 'auto' : '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }}>
          {value ? onLabel : offLabel}
        </div>
      </button>
      {/* State indicator */}
      <div style={{
        marginTop: 16,
        fontSize: 11,
        fontWeight: 500,
        opacity: 0.8,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: value ? theme.palette.success.light : 'rgba(255,255,255,0.6)'
      }}>
        {isMomentary ? (value ? 'Pressed' : 'Idle') : value ? 'Active' : 'Inactive'}
      </div>
      {/* Boolean value display */}
      <div style={{
        marginTop: 4,
        fontSize: 10,
        fontWeight: 400,
        opacity: 0.6,
        fontFamily: 'monospace'
      }}>
        {value ? 'true' : 'false'}
      </div>
      <label style={{ marginTop: 12, fontSize: 11, width: '100%', textAlign: 'left', opacity: 0.8 }}>
        Mode
        <select
          value={mode}
          onChange={handleModeChange}
          style={{
            width: '100%',
            marginTop: 4,
            borderRadius: 6,
            padding: '6px 8px',
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.2)',
            color: 'inherit'
          }}
        >
          <option value="toggle">Toggle (latching)</option>
          <option value="momentary">Momentary (spring)</option>
        </select>
      </label>
    </div>
  );
}
