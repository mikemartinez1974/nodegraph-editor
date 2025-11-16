import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const INPUTS = [{ key: 'value', label: 'Value', type: 'value' }];
const OUTPUTS = [{ key: 'trigger', label: 'Trigger', type: 'trigger' }];

const MODE_OPTIONS = [
  { value: 'rising', label: 'Rising edge (false → true)' },
  { value: 'falling', label: 'Falling edge (true → false)' },
  { value: 'change', label: 'Any change' },
  { value: 'truthy', label: 'Whenever truthy' },
  { value: 'falsy', label: 'Whenever falsy' }
];

const stringifyValue = (val) => {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch (err) {
    return '[unserializable]';
  }
};

const valuesEqual = (a, b) => {
  if (a === b) return true;
  const aType = typeof a;
  const bType = typeof b;
  if ((aType === 'object' && a !== null) || (bType === 'object' && b !== null)) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (err) {
      return false;
    }
  }
  return false;
};

export default function ValueTriggerNode({
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
  const node = useNodeHandleSchema(origNode, INPUTS, OUTPUTS);

  const width = (node?.width || 250) * zoom;
  const height = (node?.height || 300) * zoom;

  const [mode, setMode] = useState(node?.data?.mode || 'rising');
  const [lastValue, setLastValue] = useState(
    Object.prototype.hasOwnProperty.call(node?.data || {}, 'lastValue')
      ? node.data.lastValue
      : null
  );
  const [lastTriggeredAt, setLastTriggeredAt] = useState(node?.data?.lastTriggeredAt || null);
  const [triggerCount, setTriggerCount] = useState(node?.data?.triggerCount || 0);
  const lastValueRef = useRef(lastValue);

  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  useEffect(() => {
    eventBus.emit('nodeUpdate', {
      id: node.id,
      updates: {
        data: {
          ...node.data,
          mode,
          lastValue,
          lastTriggeredAt,
          triggerCount
        }
      }
    });
  }, [mode, lastValue, lastTriggeredAt, triggerCount, node.id, node.data]);

  const emitTrigger = useCallback(
    (payload = {}) => {
      const firedAt = Date.now();
      setLastTriggeredAt(firedAt);
      setTriggerCount(count => count + 1);
      try {
        eventBus.emit('nodeOutput', {
          nodeId: node.id,
          outputName: 'trigger',
          value: {
            value: lastValueRef.current,
            previous: payload.previous,
            mode,
            firedAt
          }
        });
      } catch (err) {
        console.error('ValueTriggerNode emit error', err);
      }
    },
    [node.id, mode]
  );

  const evaluateIncoming = useCallback(
    (incoming) => {
      const previous = lastValueRef.current;
      const incomingBool = !!incoming;
      const previousBool = !!previous;
      let shouldFire = false;
      switch (mode) {
        case 'rising':
          shouldFire = !previousBool && incomingBool;
          break;
        case 'falling':
          shouldFire = previousBool && !incomingBool;
          break;
        case 'change':
          shouldFire = !valuesEqual(previous, incoming);
          break;
        case 'truthy':
          shouldFire = incomingBool;
          break;
        case 'falsy':
          shouldFire = !incomingBool;
          break;
        default:
          shouldFire = incomingBool;
          break;
      }
      lastValueRef.current = incoming;
      setLastValue(incoming);
      if (shouldFire) {
        emitTrigger({ previous });
      }
    },
    [mode, emitTrigger]
  );

  useEffect(() => {
    const handler = ({ targetNodeId, inputName, value } = {}) => {
      if (targetNodeId !== node.id) return;
      if (inputName && inputName !== 'value') return;
      evaluateIncoming(value);
    };
    eventBus.on('nodeInput', handler);
    return () => eventBus.off('nodeInput', handler);
  }, [node.id, evaluateIncoming]);

  const handleManualTrigger = (e) => {
    e.stopPropagation();
    emitTrigger({ previous: lastValueRef.current });
  };

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x - width / 2;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y - height / 2;
  const selectedGradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselectedGradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

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
        background: isSelected ? selectedGradient : unselectedGradient,
        borderRadius: 8,
        boxSizing: 'border-box',
        padding: 12,
        color: theme.palette.primary.contrastText,
        transition: 'border 0.2s ease',
        zIndex: 100,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
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
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{node?.label || 'Value → Trigger'}</strong>
        <span style={{ fontSize: 12, opacity: 0.8 }}>Fired: {triggerCount}</span>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gap: 4 }}>
        Mode
        <select
          value={mode}
          onChange={e => {
            e.stopPropagation();
            setMode(e.target.value);
          }}
          style={{
            background: 'rgba(0,0,0,0.2)',
            color: 'inherit',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            padding: '4px 6px'
          }}
        >
          {MODE_OPTIONS.map(opt => (
            <option value={opt.value} key={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div
        style={{
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 6,
          padding: 8,
          fontSize: 12,
          lineHeight: 1.4,
          minHeight: 56
        }}
      >
        <div style={{ opacity: 0.8 }}>Last value</div>
        <div style={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {stringifyValue(lastValue)}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>Last fired</span>
        <span>{lastTriggeredAt ? new Date(lastTriggeredAt).toLocaleTimeString() : '—'}</span>
      </div>
      <button
        type="button"
        onClick={handleManualTrigger}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: 'none',
          background: theme.palette.secondary.main,
          color: theme.palette.secondary.contrastText,
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        Fire trigger
      </button>
    </div>
  );
}
