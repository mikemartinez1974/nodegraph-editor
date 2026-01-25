"use client";
import React, { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import FixedNode from './FixedNode';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const getPayloadByDatatype = (data, datatype) => {
  if (!data || !datatype) return undefined;
  const path = String(datatype).split('.').filter(Boolean);
  const normalized = path[0] === 'data' ? path.slice(1) : path;
  let current = data;
  for (const key of normalized) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
};

const asString = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
};

const detectContentType = (payload) => {
  if (payload === undefined || payload === null) return 'empty';
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.startsWith('<') && trimmed.includes('>')) return 'html';
    return 'markdown';
  }
  if (typeof payload === 'object') {
    if (typeof payload.html === 'string') return 'html';
    if (typeof payload.markdown === 'string') return 'markdown';
    if (typeof payload.text === 'string') return 'text';
  }
  return 'json';
};

const getByPath = (source, path) => {
  if (!source || !path) return undefined;
  const parts = String(path).split('.').filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

const applyTemplate = (template, context) => {
  if (typeof template !== 'string') return template;
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => {
    const trimmed = String(expr || '').trim();
    if (!trimmed) return '';
    const raw = getByPath(context, trimmed.startsWith('node.') ? trimmed.slice(5) : trimmed);
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string') return raw;
    try {
      return JSON.stringify(raw);
    } catch (err) {
      return String(raw);
    }
  });
};

const DynamicViewNode = ({ viewDefinition, viewEntry, ...props }) => {
  const theme = useTheme();
  const node = useNodeHandleSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);

  const datatype = useMemo(() => {
    if (viewDefinition?.viewNode?.data?.host?.datatype) {
      return viewDefinition.viewNode.data.host.datatype;
    }
    if (viewEntry?.view) {
      return `data.${viewEntry.view}`;
    }
    return '';
  }, [viewDefinition?.viewNode?.data?.host?.datatype, viewEntry?.view]);

  const rawPayload = useMemo(
    () => getPayloadByDatatype(viewDefinition?.viewNode?.data || {}, datatype),
    [viewDefinition?.viewNode?.data, datatype]
  );
  const payload = useMemo(() => {
    if (!rawPayload) return rawPayload;
    const context = node || {};
    if (typeof rawPayload === 'string') {
      return applyTemplate(rawPayload, context);
    }
    if (typeof rawPayload === 'object') {
      const next = { ...rawPayload };
      if (typeof next.html === 'string') next.html = applyTemplate(next.html, context);
      if (typeof next.markdown === 'string') next.markdown = applyTemplate(next.markdown, context);
      if (typeof next.text === 'string') next.text = applyTemplate(next.text, context);
      return next;
    }
    return rawPayload;
  }, [rawPayload, node]);
  const contentType = useMemo(() => detectContentType(payload), [payload]);

  const sanitizeSchema = useMemo(() => ({
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href || []), 'tlz']
    }
  }), []);

  const renderContent = () => {
    if (viewDefinition?.status === 'loading') {
      return <div style={{ color: theme.palette.text.secondary }}>Loading view…</div>;
    }
    if (viewDefinition?.status === 'error') {
      return <div style={{ color: theme.palette.error.main }}>Failed to load view.</div>;
    }
    if (contentType === 'empty') {
      return <div style={{ color: theme.palette.text.secondary }}>No view payload found.</div>;
    }
    if (contentType === 'html') {
      const html = typeof payload === 'string' ? payload : payload?.html || '';
      return (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          style={{ border: 'none', width: '100%', height: '100%' }}
          title={`View for ${node?.type || 'node'}`}
        />
      );
    }
    if (contentType === 'markdown') {
      const markdown = typeof payload === 'string' ? payload : payload?.markdown || '';
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        >
          {markdown}
        </ReactMarkdown>
      );
    }
    if (contentType === 'text') {
      return <div style={{ whiteSpace: 'pre-wrap' }}>{payload?.text || ''}</div>;
    }
    return (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {asString(payload)}
      </pre>
    );
  };

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        style={{
          position: 'absolute',
          inset: 8,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'auto'
        }}
      >
        <div style={{ fontSize: 12, color: theme.palette.text.secondary }}>
          {viewEntry?.view ? `View: ${viewEntry.view}` : 'View'}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {renderContent()}
        </div>
      </div>
    </FixedNode>
  );
};

export default DynamicViewNode;
