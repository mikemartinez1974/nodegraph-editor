import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CancelIcon from '@mui/icons-material/Cancel';

export default function APINode({
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
  const controllerRef = useRef(null);

  const width = (node?.width || 220) * zoom;
  const height = (node?.height || 180) * zoom;

  const initial = node?.data || {};
  const [url, setUrl] = useState(initial.url || '');
  const [method, setMethod] = useState(initial.method || 'GET');
  const [headersText, setHeadersText] = useState(initial.headers ? JSON.stringify(initial.headers, null, 2) : '{}');
  const [bodyText, setBodyText] = useState(initial.body || '');
  const [loading, setLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState(initial.lastStatus || null);
  const [lastResponsePreview, setLastResponsePreview] = useState(initial.lastResponsePreview || '');
  const [errorMsg, setErrorMsg] = useState(null);

  // Register node ref
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  useEffect(() => {
    // persist settings when they change
    try {
      eventBus.emit('nodeUpdate', { id: node.id, updates: { data: { ...node.data, url, method, headers: tryParse(headersText), body: bodyText } } });
    } catch (err) {}
  }, [url, method, headersText, bodyText]);

  const tryParse = (text) => {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  };

  const cancelFetch = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setLoading(false);
    setErrorMsg('Cancelled');
  };

  const doFetch = async (triggerPayload = {}) => {
    if (!url) {
      setErrorMsg('No URL');
      return;
    }

    // cancel any existing
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }

    const headers = tryParse(headersText) || {};
    const body = bodyText;

    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    setLoading(true);
    setErrorMsg(null);

    try {
      const opts = {
        method: method || 'GET',
        headers: headers,
        signal: ctrl.signal
      };
      if (method !== 'GET' && method !== 'HEAD' && body) {
        opts.body = body;
      }

      const resp = await fetch(url, opts);
      const status = resp.status;
      let parsed = null;
      let text = '';
      const ct = resp.headers.get('content-type') || '';
      try {
        if (ct.includes('application/json')) {
          parsed = await resp.json();
          text = JSON.stringify(parsed, null, 2);
        } else {
          text = await resp.text();
        }
      } catch (err) {
        text = await resp.text().catch(() => '');
      }

      setLastStatus(status);
      setLastResponsePreview(text.slice(0, 1000));

      // persist lastResponsePreview and status
      try {
        eventBus.emit('nodeUpdate', { id: node.id, updates: { data: { ...node.data, lastStatus: status, lastResponsePreview: text.slice(0, 1000) } } });
      } catch (err) {}

      // emit output: both raw text and parsed if available
      try {
        eventBus.emit('nodeOutput', { nodeId: node.id, outputName: 'response', value: parsed !== null ? parsed : text });
      } catch (err) {}

      setLoading(false);
      controllerRef.current = null;
    } catch (err) {
      if (err.name === 'AbortError') {
        setErrorMsg('Aborted');
      } else {
        setErrorMsg(err.message || 'Fetch error');
      }
      setLoading(false);
      controllerRef.current = null;
      try {
        eventBus.emit('nodeUpdate', { id: node.id, updates: { data: { ...node.data, lastStatus: null, lastResponsePreview: null, lastError: err && err.message } } });
      } catch (e) {}
    }
  };

  // External trigger handler
  useEffect(() => {
    const handler = ({ targetNodeId, inputName, value } = {}) => {
      if (targetNodeId !== node.id) return;
      // optional: if value contains override for url or other fields
      if (value && typeof value === 'object') {
        if (value.url) setUrl(value.url);
        if (value.method) setMethod(value.method);
        if (value.headers) setHeadersText(JSON.stringify(value.headers, null, 2));
        if (value.body) setBodyText(value.body);
      }
      doFetch({ inputName, value });
    };

    eventBus.on('nodeInput', handler);
    return () => eventBus.off('nodeInput', handler);
  }, [url, method, headersText, bodyText]);

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
        <div style={{ fontWeight: 700 }}>{node?.label || 'API'}</div>
        <div style={{ fontSize: 11, opacity: 0.85 }}>{loading ? 'Loading…' : lastStatus ? `Status ${lastStatus}` : ''}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexDirection: 'column', marginBottom: 8 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/…" style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={method} onChange={e => setMethod(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'white' }}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
            <option>HEAD</option>
          </select>
          <button onClick={(e) => { e.stopPropagation(); doFetch(); }} title="Fetch" style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: theme.palette.primary.dark, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CloudDownloadIcon sx={{ fontSize: 18 }} />FETCH
          </button>
          <button onClick={(e) => { e.stopPropagation(); cancelFetch(); }} title="Cancel" style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CancelIcon sx={{ fontSize: 18 }} />CANCEL
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 8 }}>
        <textarea value={headersText} onChange={e => setHeadersText(e.target.value)} placeholder='{"Authorization":"Bearer …"}' style={{ flex: 1, minHeight: 40, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.04)', color: 'white', padding: 8 }} />
      </div>

      {method !== 'GET' && (
        <div style={{ marginBottom: 8 }}>
          <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder='Request body (raw)' style={{ width: '100%', minHeight: 40, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.04)', color: 'white', padding: 8 }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>Preview: {lastResponsePreview ? `${lastResponsePreview.slice(0, 60).replace(/\n/g, ' ')}${lastResponsePreview.length > 60 ? '…' : ''}` : '—'}</div>
        <div style={{ color: errorMsg ? theme.palette.error.main : 'inherit', fontSize: 11 }}>{errorMsg || ''}</div>
      </div>

    </div>
  );
}
