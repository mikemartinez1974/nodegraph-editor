import React, { useEffect, useState, useRef } from 'react';
import { Paper, Box, Button, TextField, Select, MenuItem, Typography } from '@mui/material';

export default function ScriptPanel() {
  const [scripts, setScripts] = useState(() => {
    try { const raw = localStorage.getItem('scripts'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [selectedId, setSelectedId] = useState(scripts[0]?.id || '');
  const [source, setSource] = useState('');
  const [result, setResult] = useState(null);

  // Resizable panel state
  const defaultSize = { width: 480, height: 360 };
  const [size, setSize] = useState(() => {
    try {
      const raw = localStorage.getItem('scriptPanelSize');
      return raw ? JSON.parse(raw) : defaultSize;
    } catch { return defaultSize; }
  });
  const resizingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, w: size.width, h: size.height });

  useEffect(() => {
    if (!selectedId && scripts.length) setSelectedId(scripts[0].id);
  }, [scripts, selectedId]);

  useEffect(() => {
    if (!selectedId) return setSource('');
    const s = scripts.find(x => x.id === selectedId);
    setSource(s?.source || '');
  }, [selectedId, scripts]);

  useEffect(() => {
    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const clientX = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
      const clientY = ev.clientY ?? (ev.touches && ev.touches[0]?.clientY);
      const dx = clientX - startRef.current.x;
      const dy = clientY - startRef.current.y;
      const nextW = Math.max(320, Math.round(startRef.current.w + dx));
      const nextH = Math.max(200, Math.round(startRef.current.h + dy));
      setSize({ width: nextW, height: nextH });
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      try { localStorage.setItem('scriptPanelSize', JSON.stringify(size)); } catch {}
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [size]);

  const persist = (next) => { setScripts(next); try { localStorage.setItem('scripts', JSON.stringify(next)); } catch {} };

  const handleNew = () => {
    const id = `script_${Date.now()}`;
    const s = { id, name: 'New Script', source: '// async (api) => {\n// use api.getNodes(), api.createNode(...), etc.\n}' };
    const next = [s, ...scripts];
    persist(next);
    setSelectedId(id);
  };

  const handleSave = () => {
    if (!selectedId) return;
    const next = scripts.map(s => s.id === selectedId ? { ...s, source, name: s.name || 'Script' } : s);
    persist(next);
    setResult({ success: true, message: 'Saved' });
  };

  const handleRun = async (dry = false) => {
    if (typeof window === 'undefined' || !window.__scriptRunner) {
      setResult({ success: false, error: 'Runner not available' });
      return;
    }

    try {
      const res = await window.__scriptRunner.run(source);
      setResult(res);
    } catch (err) {
      setResult({ success: false, error: String(err) });
    }
  };

  const onResizerDown = (ev) => {
    ev.preventDefault();
    const clientX = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    const clientY = ev.clientY ?? (ev.touches && ev.touches[0]?.clientY);
    resizingRef.current = true;
    startRef.current = { x: clientX, y: clientY, w: size.width, h: size.height };
    document.addEventListener('mousemove', onDocumentMove);
    document.addEventListener('mouseup', onDocumentUp);
    document.addEventListener('touchmove', onDocumentMove, { passive: false });
    document.addEventListener('touchend', onDocumentUp);
  };

  const onDocumentMove = (ev) => {
    if (!resizingRef.current) return;
    ev.preventDefault();
    const clientX = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    const clientY = ev.clientY ?? (ev.touches && ev.touches[0]?.clientY);
    const dx = clientX - startRef.current.x;
    const dy = clientY - startRef.current.y;
    const nextW = Math.max(320, Math.round(startRef.current.w + dx));
    const nextH = Math.max(200, Math.round(startRef.current.h + dy));
    setSize({ width: nextW, height: nextH });
  };

  const onDocumentUp = () => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    try { localStorage.setItem('scriptPanelSize', JSON.stringify(size)); } catch {}
    document.removeEventListener('mousemove', onDocumentMove);
    document.removeEventListener('mouseup', onDocumentUp);
    document.removeEventListener('touchmove', onDocumentMove);
    document.removeEventListener('touchend', onDocumentUp);
  };

  return (
    <Paper elevation={6} sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1400, p: 1, overflow: 'hidden' }} style={{ width: size.width, height: size.height }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <Select size="small" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 160 }}>
          {scripts.map(s => (<MenuItem key={s.id} value={s.id}>{s.name || s.id}</MenuItem>))}
        </Select>
        <Button size="small" onClick={handleNew}>New</Button>
        <Button size="small" onClick={handleSave} disabled={!selectedId}>Save</Button>
        <Button size="small" onClick={() => handleRun(false)} disabled={!selectedId}>Run</Button>
        <Button size="small" onClick={() => handleRun(true)} disabled={!selectedId}>Dry</Button>
      </Box>

      <TextField
        value={source}
        onChange={(e) => setSource(e.target.value)}
        multiline
        minRows={6}
        fullWidth
        size="small"
        variant="outlined"
        sx={{ height: `calc(100% - 150px)`, boxSizing: 'border-box' }}
      />

      <Box sx={{ mt: 1 }}>
        <Typography variant="caption">Result:</Typography>
        <pre style={{ maxHeight: 120, overflow: 'auto', background: '#0b1220', color: '#dbeafe', padding: 8, borderRadius: 6 }}>
          {result ? JSON.stringify(result, null, 2) : '—'}
        </pre>
      </Box>

      <div
        onMouseDown={onResizerDown}
        onTouchStart={onResizerDown}
        style={{ position: 'absolute', right: 4, bottom: 4, width: 16, height: 16, cursor: 'nwse-resize', background: 'transparent' }}
        aria-hidden="true"
      />
    </Paper>
  );
}
