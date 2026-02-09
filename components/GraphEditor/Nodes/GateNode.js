import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import useNodePortSchema from '../hooks/useNodePortSchema';

// --- New schema ports ---
const GATE_INPUTS = [
  { key: 'a', label: 'A', type: 'value' },
  { key: 'b', label: 'B', type: 'value' }
];
const GATE_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

export default function GateNode({
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
  const node = useNodePortSchema(origNode, GATE_INPUTS, GATE_OUTPUTS);

  const width = (node?.width || 200) * zoom;
  const height = (node?.height || 300) * zoom;

  // Local editable state derived from node.data
  const initialInputs = node?.data?.inputs || { a: false, b: false };
  const [inputs, setInputs] = useState({ a: !!initialInputs.a, b: !!initialInputs.b });
  const [operator, setOperator] = useState(node?.data?.operator || 'and');

  // Register ref for external operations
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  // Compute gate output
  const computeOutput = (op, inp) => {
    const a = !!inp.a;
    const b = !!inp.b;
    switch ((op || '').toLowerCase()) {
      case 'and':
        return a && b;
      case 'or':
        return a || b;
      case 'not':
        return !a; // only A used for NOT
      case 'xor':
        return !!(a ^ b);
      case 'nand':
        return !(a && b);
      case 'nor':
        return !(a || b);
      default:
        return a && b;
    }
  };

  const output = computeOutput(operator, inputs);

  // Persist state into node data and emit output whenever things change
  useEffect(() => {
    // update stored node data via eventBus so GraphEditor will pick up the change
    try {
      eventBus.emit('nodeUpdate', {
        id: node.id,
        updates: {
          data: {
            ...node.data,
            inputs: { ...inputs },
            operator,
            output
          }
        }
      });
    } catch (err) {
      // ignore
    }

    // emit logical output on channel for connected consumers
    try {
      eventBus.emit('nodeOutput', {
        nodeId: node.id,
        outputName: 'value',
        value: output
      });
    } catch (err) {}
  }, [inputs, operator, output, node.id]);

  // Ensure handle schema reflects operator (NOT only needs A)
  useEffect(() => {
    const desiredInputs = operator === 'not' ? [GATE_INPUTS[0]] : GATE_INPUTS;
    const current = Array.isArray(node.inputs) ? node.inputs : [];
    const matches = current.length === desiredInputs.length &&
      current.every((handle, idx) => handle.key === desiredInputs[idx]?.key);
    if (!matches) {
      eventBus.emit('nodeUpdate', {
        id: node.id,
        updates: {
          inputs: desiredInputs,
          outputs: GATE_OUTPUTS
        }
      });
    }
  }, [operator, node.id, node.inputs]);

  // Handle external input events (so edges/other nodes can push inputs to this gate)
  useEffect(() => {
    const handler = ({ targetNodeId, inputName, value } = {}) => {
      if (targetNodeId !== node.id) return;
      if (!inputName) return;
      setInputs(prev => {
        const next = { ...prev, [inputName]: !!value };
        return next;
      });
    };

    eventBus.on('nodeInput', handler);
    return () => eventBus.off('nodeInput', handler);
  }, [node.id]);

  const toggleInput = (name) => (e) => {
    e.stopPropagation();
    setInputs(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleOperatorChange = (e) => {
    e.stopPropagation();
    setOperator(e.target.value);
  };

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y;

  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  // Ports are rendered via HandleLayer
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
        <div style={{ fontWeight: 700 }}>{node?.label || 'Gate'}</div>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, opacity: 0.85 }}>
          Mode
          <select
            value={operator}
            onChange={handleOperatorChange}
            style={{
              marginTop: 4,
              background: 'rgba(0,0,0,0.2)',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '4px 8px',
              borderRadius: 6
            }}
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
            <option value="not">NOT</option>
            <option value="xor">XOR</option>
            <option value="nand">NAND</option>
            <option value="nor">NOR</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 11, opacity: 0.85 }}>A</div>
          <button onClick={toggleInput('a')} title="Toggle A" style={{ width: 48, height: 28, borderRadius: 8, border: 'none', background: inputs.a ? theme.palette.success.main : 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer' }}>{inputs.a ? '1' : '0'}</button>
        </div>
        {/* For NOT operator we hide or disable B */}
        <div style={{ display: operator === 'not' ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 11, opacity: 0.85 }}>B</div>
          <button onClick={toggleInput('b')} title="Toggle B" style={{ width: 48, height: 28, borderRadius: 8, border: 'none', background: inputs.b ? theme.palette.success.main : 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer' }}>{inputs.b ? '1' : '0'}</button>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '8px 0', borderRadius: 6, background: 'rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 10, opacity: 0.8 }}>Output</div>
        <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace' }}>{output ? '1' : '0'}</div>
      </div>
    </div>
  );
}
