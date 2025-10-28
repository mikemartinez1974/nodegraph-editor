import React, { useEffect, useState, useRef } from 'react';
import { Paper, Box, Button, TextField, Select, MenuItem, Typography, FormControlLabel, Switch, Divider } from '@mui/material';
import eventBus from '../../NodeGraph/eventBus';

export default function ScriptPanel() {
  // Scripts
  const [scripts, setScripts] = useState(() => { try { const raw = localStorage.getItem('scripts'); return raw ? JSON.parse(raw) : []; } catch { return []; } });
  const [selectedId, setSelectedId] = useState(scripts[0]?.id || '');
  const [source, setSource] = useState('');
  const [result, setResult] = useState(null);

  // Size / position / visibility
  const defaultSize = { width: 480, height: 360 };
  const [size, setSize] = useState(() => { try { const raw = localStorage.getItem('scriptPanelSize'); return raw ? JSON.parse(raw) : defaultSize; } catch { return defaultSize; } });
  const [pos, setPos] = useState(() => { try { const raw = localStorage.getItem('scriptPanelPos'); if (raw) return JSON.parse(raw); if (typeof window !== 'undefined') return { left: Math.max(16, window.innerWidth - defaultSize.width - 16), top: Math.max(56, window.innerHeight - defaultSize.height - 56) }; return { left: 200, top: 120 }; } catch { return { left: 200, top: 120 }; } });
  const [visible, setVisible] = useState(() => { try { const raw = localStorage.getItem('scriptPanelVisible'); return raw === null ? true : raw === 'true'; } catch { return true; } });

  // Preferences
  const [allowMutations, setAllowMutations] = useState(() => { try { return localStorage.getItem('scriptAllowMutations') === 'true'; } catch { return false; } });
  const [dryRun, setDryRun] = useState(false);

  // Proposals
  const [proposals, setProposals] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // Refs for dragging/resizing
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: size.width, h: size.height });

  useEffect(() => { if (!selectedId && scripts.length) setSelectedId(scripts[0].id); }, [scripts, selectedId]);
  useEffect(() => { if (!selectedId) return setSource(''); const s = scripts.find(x => x.id === selectedId); setSource(s?.source || ''); }, [selectedId, scripts]);

  // Persist helpers
  useEffect(() => { try { localStorage.setItem('scriptPanelSize', JSON.stringify(size)); } catch {} }, [size]);
  useEffect(() => { try { localStorage.setItem('scriptPanelPos', JSON.stringify(pos)); } catch {} }, [pos]);
  useEffect(() => { try { localStorage.setItem('scriptPanelVisible', String(visible)); } catch {} }, [visible]);

  // External toggle
  useEffect(() => { const toggle = () => setVisible(v => { const next = !v; try { localStorage.setItem('scriptPanelVisible', String(next)); } catch {} return next; }); eventBus.on('toggleScriptPanel', toggle); return () => eventBus.off('toggleScriptPanel', toggle); }, []);

  // Drag handlers (header)
  const startDrag = (ev) => {
    ev.stopPropagation(); ev.preventDefault();
    const clientX = ev.clientX ?? ev.touches?.[0]?.clientX;
    const clientY = ev.clientY ?? ev.touches?.[0]?.clientY;
    draggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY, left: pos.left, top: pos.top };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragUp);
  };
  const onDragMove = (ev) => {
    if (!draggingRef.current) return;
    ev.preventDefault();
    const clientX = ev.clientX ?? ev.touches?.[0]?.clientX;
    const clientY = ev.clientY ?? ev.touches?.[0]?.clientY;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPos({ left: Math.max(8, Math.round(dragStartRef.current.left + dx)), top: Math.max(8, Math.round(dragStartRef.current.top + dy)) });
  };
  const onDragUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { localStorage.setItem('scriptPanelPos', JSON.stringify(pos)); } catch {}
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragUp);
  };

  // Resizer (bottom-right) - minimal, large hit area
  const onResizerDown = (ev) => {
    ev.stopPropagation(); ev.preventDefault();
    const clientX = ev.clientX ?? ev.touches?.[0]?.clientX;
    const clientY = ev.clientY ?? ev.touches?.[0]?.clientY;
    resizingRef.current = true;
    resizeStartRef.current = { x: clientX, y: clientY, w: size.width, h: size.height };
    document.addEventListener('mousemove', onResizerMove);
    document.addEventListener('mouseup', onResizerUp);
    document.addEventListener('touchmove', onResizerMove, { passive: false });
    document.addEventListener('touchend', onResizerUp);
  };
  const onResizerMove = (ev) => {
    if (!resizingRef.current) return;
    ev.preventDefault();
    const clientX = ev.clientX ?? ev.touches?.[0]?.clientX;
    const clientY = ev.clientY ?? ev.touches?.[0]?.clientY;
    const dx = clientX - resizeStartRef.current.x;
    const dy = clientY - resizeStartRef.current.y;
    const nextW = Math.max(320, Math.round(resizeStartRef.current.w + dx));
    const nextH = Math.max(200, Math.round(resizeStartRef.current.h + dy));
    setSize({ width: nextW, height: nextH });
  };
  const onResizerUp = () => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    try { localStorage.setItem('scriptPanelSize', JSON.stringify(size)); } catch {}
    document.removeEventListener('mousemove', onResizerMove);
    document.removeEventListener('mouseup', onResizerUp);
    document.removeEventListener('touchmove', onResizerMove);
    document.removeEventListener('touchend', onResizerUp);
  };

  // Keyboard support for resizer: arrow keys resize, shift+arrow for bigger steps
  const onResizerKeyDown = (ev) => {
    const step = ev.shiftKey ? 32 : 8;
    let w = size.width;
    let h = size.height;
    let handled = true;
    switch (ev.key) {
      case 'ArrowLeft': w = Math.max(320, Math.round(size.width - step)); break;
      case 'ArrowRight': w = Math.max(320, Math.round(size.width + step)); break;
      case 'ArrowUp': h = Math.max(200, Math.round(size.height - step)); break;
      case 'ArrowDown': h = Math.max(200, Math.round(size.height + step)); break;
      default: handled = false;
    }
    if (handled) {
      ev.preventDefault();
      setSize({ width: w, height: h });
      try { localStorage.setItem('scriptPanelSize', JSON.stringify({ width: w, height: h })); } catch {}
    }
  };

  // Scripts persistence helper
  const persist = (next) => { setScripts(next); try { localStorage.setItem('scripts', JSON.stringify(next)); } catch {} };

  const handleNew = () => { const id = `script_${Date.now()}`; const s = { id, name: 'New Script', source: '// async (api) => {\n// use api.getNodes(), api.createNode(...), etc.\n}' }; const next = [s, ...scripts]; persist(next); setSelectedId(id); };
  const handleSave = () => { if (!selectedId) return; const next = scripts.map(s => s.id === selectedId ? { ...s, source, name: s.name || 'Script' } : s); persist(next); setResult({ success: true, message: 'Saved' }); };

  const handleRun = async (dry = false) => {
    if (typeof window === 'undefined' || !window.__scriptRunner) { setResult({ success: false, error: 'Runner not available' }); return; }
    try {
      const meta = { dry: dry || dryRun, allowMutations: allowMutations };
      const res = await window.__scriptRunner.run(source, meta);
      setResult(res);
      const p = res?.proposals || res?.proposed || res?.proposedChanges || null;
      if (p && (!res.applied)) { setProposals(Array.isArray(p) ? p : [p]); setConfirming(true); } else { setProposals(null); setConfirming(false); }
    } catch (err) { setResult({ success: false, error: String(err) }); }
  };

  const handleToggleAllow = (ev) => { const next = ev.target.checked; setAllowMutations(next); try { localStorage.setItem('scriptAllowMutations', String(next)); } catch {} };
  const handleApplyProposals = () => { if (!proposals) return; eventBus.emit('applyScriptProposals', { proposals, sourceId: selectedId }); setConfirming(false); setProposals(null); setResult({ success: true, message: 'Applied proposals' }); };
  const handleCancelProposals = () => { setConfirming(false); setProposals(null); };

  if (!visible) return null;

  return (
    <Paper elevation={6} sx={{ position: 'fixed', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} style={{ left: pos.left, top: pos.top, width: size.width, height: size.height, zIndex: 1400 }}>

      {/* Header: draggable surface */}
      <Box onMouseDown={startDrag} onTouchStart={startDrag} sx={{ height: 40, display: 'flex', alignItems: 'center', px: 1, bgcolor: 'background.paper', cursor: 'grab', userSelect: 'none' }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>Scripts</Typography>
        <Button size="small" onClick={() => setVisible(false)}>Close</Button>
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: 1, py: 0.75, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <Select size="small" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 160 }}>
          {scripts.map(s => (<MenuItem key={s.id} value={s.id}>{s.name || s.id}</MenuItem>))}
        </Select>
        <Button size="small" onClick={handleNew}>New</Button>
        <Button size="small" onClick={handleSave} disabled={!selectedId}>Save</Button>
        <Button size="small" onClick={() => handleRun(false)} disabled={!selectedId}>Run</Button>
        <Button size="small" onClick={() => handleRun(true)} disabled={!selectedId}>Dry</Button>
        <FormControlLabel control={<Switch checked={allowMutations} onChange={handleToggleAllow} />} label="Allow Mutations" />
        <FormControlLabel control={<Switch checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />} label="Dry Run" />
      </Box>

      {/* Editor area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 1, gap: 1, minHeight: 0 }}>
        <TextField
          value={source}
          onChange={(e) => setSource(e.target.value)}
          multiline
          fullWidth
          variant="outlined"
          size="small"
          sx={{
            flex: 1,
            minHeight: 0,
            // Make the InputBase stretch to fill vertical space so the textarea grows with the panel
            '& .MuiInputBase-root': { height: '100%', alignItems: 'stretch' },
            // Ensure the actual textarea element fills the container and scrolls internally
            '& .MuiInputBase-input': { height: '100%', boxSizing: 'border-box', fontFamily: 'monospace', overflow: 'auto', resize: 'none' },
            '& .MuiInputBase-input.MuiInputBase-inputMultiline': { height: '100%' }
          }}
        />

        <Box>
          <Typography variant="caption">Result:</Typography>
          <pre style={{ maxHeight: 160, overflow: 'auto', background: '#0b1220', color: '#dbeafe', padding: 8, borderRadius: 6 }}>{result ? JSON.stringify(result, null, 2) : '—'}</pre>
        </Box>

        {confirming && proposals && (
          <Box sx={{ mt: 1, p: 1, background: '#fff', borderRadius: 1 }}>
            <Typography variant="subtitle2">Proposed Changes</Typography>
            <Divider sx={{ my: 1 }} />
            <pre style={{ maxHeight: 160, overflow: 'auto', padding: 8 }}>{JSON.stringify(proposals, null, 2)}</pre>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button size="small" variant="contained" color="primary" onClick={handleApplyProposals}>Apply Changes</Button>
              <Button size="small" onClick={handleCancelProposals}>Cancel</Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom-right resizer */}
      <div
        onMouseDown={onResizerDown}
        onTouchStart={onResizerDown}
        onKeyDown={onResizerKeyDown}
        role="separator"
        aria-label="Resize script panel"
        aria-orientation="both"
        tabIndex={0}
        title="Resize panel — drag or use arrow keys (shift for larger step)"
        style={{ position: 'absolute', right: 8, bottom: 8, width: 28, height: 28, cursor: 'nwse-resize', zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.6 }}>
          <path d="M0 12L12 0M6 12L12 6M12 12V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

    </Paper>
  );
}
