import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CancelIcon from '@mui/icons-material/Cancel';
import useNodePortSchema from '../hooks/useNodePortSchema';

// --- Unified handle schema ---
const API_INPUTS = [
  { key: 'trigger', label: 'Trigger', type: 'trigger' }
];
const API_OUTPUTS = [
  { key: 'response', label: 'Response', type: 'value' }
];

export default function APINode({
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
  const node = useNodePortSchema(origNode, API_INPUTS, API_OUTPUTS);
  const theme = useTheme();
  const nodeRef = useRef(null);
  const controllerRef = useRef(null);

  const width = (node?.width || 400) * zoom;
  const height = (node?.height || 400) * zoom;

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

  useEffect(() => {
    const handleExecute = ({ nodeId } = {}) => {
      if (nodeId !== node.id) return;
      doFetch({ source: 'executeNode' });
    };
    eventBus.on('executeNode', handleExecute);
    return () => eventBus.off('executeNode', handleExecute);
  }, [node.id, url, method, headersText, bodyText]);

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y;

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
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flexGrow: 1, marginRight: 8 }}>
          <input
            type="text"
            placeholder="Enter URL"
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              fontSize: 14,
            }}
          />
        </div>
        <div>
          <button
            onClick={() => doFetch()}
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <CloudDownloadIcon style={{ marginRight: 4 }} />
            Fetch
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flexGrow: 1, marginRight: 8 }}>
          <select
            value={method}
            onChange={e => setMethod(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              fontSize: 14,
            }}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="OPTIONS">OPTIONS</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>
        <div>
          <button
            onClick={cancelFetch}
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: theme.palette.error.main,
              color: theme.palette.error.contrastText,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <CancelIcon style={{ marginRight: 4 }} />
            Cancel
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flexGrow: 1, marginRight: 8 }}>
          <textarea
            placeholder="Enter headers as JSON"
            value={headersText}
            onChange={e => setHeadersText(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              fontSize: 14,
              minHeight: 80,
              resize: 'vertical',
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flexGrow: 1, marginRight: 8 }}>
          <textarea
            placeholder="Enter body text"
            value={bodyText}
            onChange={e => setBodyText(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              fontSize: 14,
              minHeight: 80,
              resize: 'vertical',
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: theme.palette.text.secondary }}>
        {loading && <div>Loading...</div>}
        {errorMsg && <div style={{ color: theme.palette.error.main }}>{errorMsg}</div>}
        {!loading && lastStatus !== null && (
          <div>
            Last Status: <strong>{lastStatus}</strong>
          </div>
        )}
        {!loading && lastResponsePreview && (
          <div>
            Last Response Preview:
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '8px 0' }}>
              {lastResponsePreview}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
