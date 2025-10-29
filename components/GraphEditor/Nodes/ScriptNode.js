import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';

export default function ScriptNode({
  node,
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
  const runTokenRef = useRef(0);

  const width = (node?.width || 260) * zoom;
  const height = (node?.height || 160) * zoom;

  const [scriptLibrary, setScriptLibrary] = useState([]);
  const [selectedScriptId, setSelectedScriptId] = useState(node?.data?.scriptId || '');
  const [allowMutations, setAllowMutations] = useState(Boolean(node?.data?.allowMutations));
  const [dryRun, setDryRun] = useState(Boolean(node?.data?.dryRun));
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(node?.data?.lastResult || null);
  const [lastRunAt, setLastRunAt] = useState(node?.data?.lastRunAt || null);

  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  // load script library from session (localStorage 'scripts')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('scripts');
      const arr = raw ? JSON.parse(raw) : [];
      setScriptLibrary(Array.isArray(arr) ? arr : []);
    } catch (err) {
      setScriptLibrary([]);
    }
  }, []);

  // persist node settings when changed
  useEffect(() => {
    try {
      eventBus.emit('nodeUpdate', { id: node.id, updates: { data: { ...node.data, scriptId: selectedScriptId, allowMutations, dryRun, lastResult, lastRunAt } } });
    } catch (err) {}
  }, [selectedScriptId, allowMutations, dryRun, lastResult, lastRunAt]);

  // helper to find script by id
  const getSelectedScript = () => {
    if (!selectedScriptId) return null;
    return scriptLibrary.find(s => s.id === selectedScriptId) || null;
  };

  // run the selected script
  const runScript = async (meta = {}) => {
    const script = getSelectedScript();
    if (!script) {
      setLastResult({ success: false, error: 'No script selected' });
      return;
    }

    if (typeof window === 'undefined' || !window.__scriptRunner) {
      setLastResult({ success: false, error: 'Script runner not available' });
      return;
    }

    const token = ++runTokenRef.current;
    setRunning(true);
    setLastResult(null);

    try {
      const runMeta = { dry: dryRun || meta.dry, allowMutations: allowMutations || meta.allowMutations };
      const res = await window.__scriptRunner.run(script.source || script, runMeta);

      // ignore stale runs
      if (token !== runTokenRef.current) return;

      setLastResult(res);
      const now = Date.now();
      setLastRunAt(now);

      // emit output (result object or error)
      try {
        eventBus.emit('nodeOutput', { nodeId: node.id, outputName: 'result', value: res });
      } catch (err) {}

      // if proposals present and not applied, forward to application handler
      if (res && (res.proposals || res.proposed || res.proposedChanges)) {
        const proposals = res.proposals || res.proposed || res.proposedChanges;
        try { eventBus.emit('applyScriptProposals', { proposals: Array.isArray(proposals) ? proposals : [proposals], sourceId: selectedScriptId }); } catch (e) {}
      }

    } catch (err) {
      setLastResult({ success: false, error: String(err) });
      try { eventBus.emit('nodeOutput', { nodeId: node.id, outputName: 'result', value: { success: false, error: String(err) } }); } catch (e) {}
    } finally {
      if (token === runTokenRef.current) setRunning(false);
    }
  };

  // external trigger handler
  useEffect(() => {
    const handler = ({ targetNodeId, inputName, value } = {}) => {
      if (targetNodeId !== node.id) return;
      // allow passing meta via value
      const meta = (value && typeof value === 'object') ? value : {};
      runScript(meta);
    };

    eventBus.on('nodeInput', handler);
    return () => eventBus.off('nodeInput', handler);
  }, [selectedScriptId, scriptLibrary, allowMutations, dryRun]);

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x - width / 2;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y - height / 2;

  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

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
      onMouseDown={e => { e.stopPropagation(); if (onMouseDown) onMouseDown(e); eventBus.emit('nodeMouseDown', { id: node.id, event: e }); }}
      onClick={e => { e.stopPropagation(); if (onClick) onClick(e); eventBus.emit('nodeClick', { id: node.id, event: e }); }}
      onDoubleClick={e => { e.stopPropagation(); if (onDoubleClick) onDoubleClick(e); }}
      onMouseEnter={e => eventBus.emit('nodeMouseEnter', { id: node.id, event: e })}
      onMouseLeave={e => eventBus.emit('nodeMouseLeave', { id: node.id, event: e })}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>{node?.label || 'Script'}</div>
        <div style={{ fontSize: 11, opacity: 0.85 }}>{running ? 'Running…' : (lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : '')}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <select value={selectedScriptId} onChange={e => setSelectedScriptId(e.target.value)} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white' }}>
          <option value="">(select script)</option>
          {scriptLibrary.map(s => (
            <option key={s.id} value={s.id}>{s.name || s.id}</option>
          ))}
        </select>
        <button onClick={(e) => { e.stopPropagation(); runScript(); }} disabled={running || !selectedScriptId} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: theme.palette.primary.dark, color: 'white', cursor: 'pointer' }}>RUN</button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 11, opacity: 0.85 }}>
          <input type="checkbox" checked={allowMutations} onChange={e => setAllowMutations(e.target.checked)} /> Allow Mutations
        </label>
        <label style={{ fontSize: 11, opacity: 0.85 }}>
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} /> Dry Run
        </label>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>
        {lastResult ? (lastResult.success ? 'Last run: success' : `Last run error: ${String(lastResult.error || '')}`) : 'No runs yet'}
      </div>
    </div>
  );
}
