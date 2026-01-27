import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

// --- New schema handles ---
const SCRIPT_INPUTS = [
  { key: 'trigger', label: 'Trigger', type: 'trigger' }
];
const SCRIPT_OUTPUTS = [
  { key: 'result', label: 'Result', type: 'value' }
];

const waitForScriptRunnerReady = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }
  if (window.__scriptRunner) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    let timeoutId = null;
    const handleReady = () => {
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      window.removeEventListener('scriptRunnerReady', handleReady);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    window.addEventListener('scriptRunnerReady', handleReady, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(Boolean(window.__scriptRunner));
    }, 3000);
  });
};

export default function ScriptNode({
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
  const runTokenRef = useRef(0);
  const node = useNodeHandleSchema(origNode, SCRIPT_INPUTS, SCRIPT_OUTPUTS);
  const isEmbedded = typeof window !== 'undefined' && window.__Twilite_EMBED__ === true;

  const width = (node?.width || 260) * zoom;
  const height = (node?.height || 160) * zoom;

  const [scriptLibrary, setScriptLibrary] = useState([]);
  const [selectedScriptId, setSelectedScriptId] = useState(node?.data?.scriptId || '');
  const [allowMutations, setAllowMutations] = useState(Boolean(node?.data?.allowMutations));
  const [dryRun, setDryRun] = useState(Boolean(node?.data?.dryRun));
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(node?.data?.lastResult || null);
  const [lastRunAt, setLastRunAt] = useState(node?.data?.lastRunAt || null);
  const [showResult, setShowResult] = useState(false);
  const autoRunTriggered = useRef(false);
  const autoRunTimerRef = useRef(null);
  const autoRunInFlightRef = useRef(false);
  const lastRunSignatureRef = useRef('');
  const lastRunSignatureTimeRef = useRef(0);
  const lastRunTimeRef = useRef(0);
  const pendingNodeIdsRef = useRef(new Set());
  const lastDragEndRef = useRef(new Map());
  const runQueuedRef = useRef(false);
  const scriptSource = useMemo(() => node?.data?.script || node?.data?.source || '', [node?.data]);

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
      eventBus.emit('nodeUpdate', {
        id: node.id,
        updates: {
          data: {
            ...node.data,
            scriptId: selectedScriptId,
            allowMutations,
            dryRun,
            lastResult,
            lastRunAt
          }
        },
        source: 'script-node'
      });
    } catch (err) {}
  }, [selectedScriptId, allowMutations, dryRun, lastResult, lastRunAt]);

  // helper to find script by id
  const getSelectedScript = () => {
    if (!selectedScriptId) return null;
    return scriptLibrary.find(s => s.id === selectedScriptId) || null;
  };

  // run the selected script
  const runScript = async (meta = {}) => {
    console.log('[ScriptNode] runScript invoked', node.id, meta);
    if (isEmbedded) {
      const result = { success: false, error: 'Script runner disabled in embedded mode' };
      setLastResult(result);
      return result;
    }
    const script = scriptSource ? { source: scriptSource, name: node?.data?.name || 'Script' } : getSelectedScript();
    if (!script) {
      const result = { success: false, error: 'No script selected' };
      setLastResult(result);
      return result;
    }

    if (typeof window === 'undefined') {
      const result = { success: false, error: 'Script runner not available' };
      setLastResult(result);
      return result;
    }

    if (!window.__scriptRunner) {
      const ready = await waitForScriptRunnerReady();
      if (!ready || !window.__scriptRunner) {
        const result = { success: false, error: 'Script runner not initialized' };
        setLastResult(result);
        return result;
      }
    }

    const token = ++runTokenRef.current;
    setRunning(true);
    setLastResult(null);
    const runner = window.__scriptRunner;

    try {
      const runMeta = { dry: dryRun || meta.dry, allowMutations: allowMutations || meta.allowMutations };
      const res = await runner.run(script.source || script, runMeta);
      console.log('[ScriptNode] runScript complete', node.id, res);

      // ignore stale runs
      if (token !== runTokenRef.current) return res;

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

      return res;
    } catch (err) {
      const errorResult = { success: false, error: String(err) };
      setLastResult(errorResult);
      try { eventBus.emit('nodeOutput', { nodeId: node.id, outputName: 'result', value: errorResult }); } catch (e) {}
      return errorResult;
    } finally {
      if (token === runTokenRef.current) setRunning(false);
    }
  };
  const runScriptRef = useRef(runScript);
  useEffect(() => {
    runScriptRef.current = runScript;
  }, [runScript]);

  // external trigger handler
  useEffect(() => {
    if (isEmbedded) return undefined;
    const handler = ({ targetNodeId, inputName, value } = {}) => {
      if (targetNodeId !== node.id) return;
      // allow passing meta via value
      const meta = (value && typeof value === 'object') ? value : {};
      runScriptRef.current?.(meta);
    };

    eventBus.on('nodeInput', handler);
    return () => eventBus.off('nodeInput', handler);
  }, [isEmbedded, selectedScriptId, scriptLibrary, allowMutations, dryRun, scriptSource, node.id]);

  useEffect(() => {
    if (isEmbedded) return undefined;
    const handleExecute = ({ nodeId, meta } = {}) => {
      if (nodeId !== node.id) return;
      runScriptRef.current?.(meta || {});
    };
    eventBus.on('executeNode', handleExecute);
    return () => eventBus.off('executeNode', handleExecute);
  }, [isEmbedded, node.id]);

  useEffect(() => {
    if (isEmbedded) return;
    if (node?.data?.autoRun && !autoRunTriggered.current && scriptSource) {
      console.log('[ScriptNode] initial autoRun trigger', node.id);
      autoRunTriggered.current = true;
      runScriptRef.current?.();
    }
  }, [isEmbedded, node?.data?.autoRun, scriptSource, node.id]);

  useEffect(() => {
    if (isEmbedded) return undefined;
    const shouldAutoRun =
      !!scriptSource &&
      !!node?.data?.autoRun &&
      node?.data?.scriptId === 'breadboard-autowire-runtime';
    if (!shouldAutoRun) return undefined;

    const scheduleRun = (eventName, payload = {}) => {
      if (payload?.source === 'script-node') return;

      // Merge pending node IDs so multiple dragEnd events coalesce into one run.
      const incomingIds = new Set();
      if (Array.isArray(payload.nodeIds)) {
        payload.nodeIds.forEach((id) => id && incomingIds.add(id));
      }
      if (Array.isArray(payload.nodes)) {
        payload.nodes.forEach((n) => n?.id && incomingIds.add(n.id));
      }
      incomingIds.forEach((id) => pendingNodeIdsRef.current.add(id));

      if (pendingNodeIdsRef.current.size === 0) return;

      // If a run is already queued or in flight, let it pick up the pending ids.
      if (autoRunInFlightRef.current || runQueuedRef.current) return;

      const runNow = () => {
        if (autoRunInFlightRef.current) return;
        autoRunInFlightRef.current = true;
        const pendingIds = Array.from(pendingNodeIdsRef.current);
        pendingNodeIdsRef.current.clear();
      // Keep this concise; main debug signal for autowire runs.
      console.info('[ScriptNode] auto-run', node.id, { from: eventName, count: pendingIds.length });
        Promise.resolve(runScriptRef.current?.())
          .catch(() => {})
          .finally(() => {
            autoRunInFlightRef.current = false;
            if (pendingNodeIdsRef.current.size > 0) {
              // schedule another run on the next tick
              if (!runQueuedRef.current) {
                runQueuedRef.current = true;
                setTimeout(() => {
                  runQueuedRef.current = false;
                  runNow();
                }, 0);
              }
            }
          });
      };

      // If nothing is pending, don't fire (prevents empty runs from mount or unrelated events).
      if (pendingNodeIdsRef.current.size === 0) return;

      // Queue a single run on the next tick to coalesce multiple rapid events.
      runQueuedRef.current = true;
      setTimeout(() => {
        runQueuedRef.current = false;
        runNow();
      }, 0);
    };

    const fetchGraphNodes = () => {
      if (typeof window === 'undefined') return [];
      const api = window.graphAPI;
      if (!api) return [];
      try {
        if (typeof api.getNodes === 'function') {
          const result = api.getNodes();
          if (Array.isArray(result?.data)) return result.data;
          if (Array.isArray(result)) return result;
        }
      } catch (err) {
        // ignore fetch errors
      }
      return [];
    };

    const isComponentNode = (entry) =>
      entry &&
      typeof entry.type === 'string' &&
      entry.type.startsWith('io.breadboard.components:');

    // Collect component ids from a list of nodes; do not gate on pendingPlacement so we always
    // wire freshly dropped components even if the flag is already false.
    const getComponentIdsFromNodes = (nodes = []) =>
      nodes
        .filter((node) => isComponentNode(node))
        .map((node) => node.id)
        .filter(Boolean);

    const filterDebouncedIds = (ids) => {
      const now = Date.now();
      const out = [];
      ids.forEach((id) => {
        const last = lastDragEndRef.current.get(id) || 0;
        if (now - last < 100) {
          return;
        }
        lastDragEndRef.current.set(id, now);
        out.push(id);
      });
      return out;
    };

    const readNodeById = (id) => {
      const api = typeof window !== 'undefined' ? window.graphAPI : null;
      if (!api) return null;
      try {
        if (typeof api.readNode === 'function') {
          const res = api.readNode(id);
          if (res && res.data) return res.data;
          if (res && res.id) return res;
        }
      } catch (err) {
        // ignore
      }
      return null;
    };

    const handleNodeDragEnd = (payload = {}) => {
      const eventNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      const idsFromEvent = getComponentIdsFromNodes(eventNodes);
      const filteredIdsFromEvent = filterDebouncedIds(idsFromEvent);
      if (filteredIdsFromEvent.length) {
        // If we have event nodes, prefer their positions but refresh other fields from readNode.
        const mergedNodes = filteredIdsFromEvent
          .map((id) => {
            const eventNode = eventNodes.find((n) => n.id === id);
            const fresh = readNodeById(id);
            if (fresh) {
              return { ...fresh, position: { ...(eventNode?.position || fresh.position || {}) } };
            }
            return eventNode;
          })
          .filter(Boolean);
        scheduleRun('nodeDragEnd', {
          ...payload,
          nodeIds: filteredIdsFromEvent,
          nodes: mergedNodes
        });
        return;
      }

      const ids = Array.isArray(payload.nodeIds) ? payload.nodeIds : [];
      const filteredIds = filterDebouncedIds(ids);
      if (!filteredIds.length) return;

      if (!ids.length) return;

      // Re-read each id to get the freshest state.
      const runIds = [];
      const nodesForRun = [];
      filteredIds.forEach((id) => {
        if (!id) return;
        const node = readNodeById(id);
        if (!node) return;
        if (!isComponentNode(node)) return;
        runIds.push(id);
        nodesForRun.push(node);
      });

      if (!runIds.length) return;
      scheduleRun('nodeDragEnd', {
        ...payload,
        nodeIds: runIds,
        nodes: nodesForRun
      });
    };

    const offDrag = eventBus.on('nodeDragEnd', handleNodeDragEnd);

    return () => {
      if (autoRunTimerRef.current) {
        clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = null;
      }
      if (typeof offDrag === 'function') offDrag();
    };
  }, [node?.data?.autoRun, node?.data?.scriptId, scriptSource, node.id]);

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y;

  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  // Handles are rendered via HandleLayer
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
        <button onClick={e => { e.stopPropagation(); setShowResult(v => !v); }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: 'none', background: showResult ? theme.palette.secondary.dark : theme.palette.primary.dark, color: 'white', cursor: 'pointer' }}>{showResult ? 'Hide Result' : 'Show Result'}</button>
      </div>

      {showResult && lastResult && (
        <pre style={{ marginTop: 8, fontSize: 12, background: 'rgba(0,0,0,0.18)', borderRadius: 6, padding: 8, maxHeight: 120, overflow: 'auto', color: lastResult.success === false ? theme.palette.error.main : 'inherit' }}>
          {typeof lastResult === 'object' ? JSON.stringify(lastResult, null, 2) : String(lastResult)}
        </pre>
      )}

      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>
        {lastResult ? (lastResult.success ? 'Last run: success' : `Last run error: ${String(lastResult.error || '')}`) : 'No runs yet'}
      </div>
    </div>
  );
}
