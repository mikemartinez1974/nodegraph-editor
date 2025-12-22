import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

// --- New schema handles ---
const DELAY_INPUTS = [
  { key: 'trigger', label: 'Trigger', type: 'trigger' }
];
const DELAY_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'trigger' }
];

export default function DelayNode({
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
  const timersRef = useRef([]);
  const queueRef = useRef([]);
  const [, setTick] = useState(0); // force update for UI
  const node = useNodeHandleSchema(origNode, DELAY_INPUTS, DELAY_OUTPUTS);

  const width = (node?.width || 400) * zoom;
  const height = (node?.height || 200) * zoom;

  const defaultDelay = typeof node?.data?.delay === 'number' ? node.data.delay : 1000;
  const [delayMs, setDelayMs] = useState(defaultDelay);
  const [status, setStatus] = useState('idle'); // idle | scheduled | firing
  const [lastFired, setLastFired] = useState(node?.data?.lastFired || null);

  // Register ref
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  // Persist delay setting to node data when changed
  useEffect(() => {
    try {
      eventBus.emit('nodeUpdate', {
        id: node.id,
        updates: { data: { ...node.data, delay: delayMs } }
      });
    } catch (err) {}
  }, [delayMs, node.id]);

  // Helper: schedule next trigger from queue
  const scheduleNext = () => {
    if (queueRef.current.length === 0) {
      // Reset timers and status so new items will fire
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
      setStatus('idle');
      setTick(t => t + 1);
      return;
    }
    const payload = queueRef.current.shift();
    setStatus('scheduled');
    const t = setTimeout(() => {
      try {
        // emit output when fired
        const firedAt = Date.now();
        setLastFired(firedAt);
        try {
          eventBus.emit('nodeOutput', { nodeId: node.id, outputName: 'value', value: true });
        } catch (err) {}

        // persist lastFired
        try {
          eventBus.emit('nodeUpdate', { id: node.id, updates: { data: { ...node.data, lastFired: firedAt } } });
        } catch (err) {}

        setStatus('firing');
        // allow small visual transition then continue
        setTimeout(() => {
          // after firing, continue to next queued
          setStatus('idle');
          scheduleNext();
        }, 120);
      } catch (err) {
        console.error('DelayNode firing error', err);
        setStatus('idle');
      }
    }, delayMs);
    timersRef.current.push(t);
    // trigger UI update
    setTick(t => t + 1);
  };

  // External trigger handler via eventBus
  useEffect(() => {
    const handler = ({ targetNodeId, inputName, value } = {}) => {
      if (targetNodeId !== node.id) return;
      // any input triggers the delay; support optional inputName
      queueRef.current.push({ inputName, value, when: Date.now() });
      // if not currently scheduled, start schedule
      if (timersRef.current.length === 0 && status !== 'scheduled' && status !== 'firing') {
        scheduleNext();
      }
      setTick(t => t + 1);
    };

    eventBus.on('nodeInput', handler);
    return () => eventBus.off('nodeInput', handler);
  }, [node.id, delayMs, status]);

  const handleManualTrigger = (e) => {
    e.stopPropagation();
    queueRef.current.push({ manual: true, when: Date.now() });
    if (timersRef.current.length === 0 && status !== 'scheduled' && status !== 'firing') {
      scheduleNext();
    }
    setTick(t => t + 1);
  };

  const handleCancelAll = (e) => {
    e && e.stopPropagation();
    // clear timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    queueRef.current = [];
    setStatus('idle');
    setTick(t => t + 1);
  };

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y;

  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

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
        padding: 12,
        color: theme.palette.primary.contrastText,
        transition: 'border 0.2s ease',
        zIndex: 100,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>{node?.label || 'Delay'}</div>
        <div style={{ fontSize: 11, opacity: 0.85 }}>
          {status === 'idle' ? 'Idle' : status === 'scheduled' ? 'Scheduled' : 'Fired'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <input
          type="number"
          value={delayMs}
          min={0}
          onChange={e => setDelayMs(Math.max(0, Number(e.target.value || 0)))}
          style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white' }}
          title="Delay in milliseconds"
        />
        <button onClick={handleManualTrigger} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: theme.palette.primary.dark, color: 'white', cursor: 'pointer' }}>TRIGGER</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>Queued: {queueRef.current.length}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCancelAll} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer' }}>CANCEL</button>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.8, textAlign: 'center' }}>
        Last: {lastFired ? new Date(lastFired).toLocaleTimeString() : '—'}
      </div>
    </div>
  );
}
