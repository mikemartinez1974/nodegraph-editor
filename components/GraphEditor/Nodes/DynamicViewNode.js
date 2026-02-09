"use client";
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import FixedNode from './FixedNode';
import useNodePortSchema from '../hooks/useNodePortSchema';
import eventBus from '../../NodeGraph/eventBus';

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

const setByPath = (source, path, value) => {
  if (!path) return source;
  const parts = String(path).split('.').filter(Boolean);
  if (!parts.length) return source;
  const root = source && typeof source === 'object' ? { ...source } : {};
  let current = root;
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i];
    if (i === parts.length - 1) {
      current[key] = value;
      break;
    }
    const next = current[key];
    current[key] = next && typeof next === 'object' ? { ...next } : {};
    current = current[key];
  }
  return root;
};

const isEmptyValue = (value) => value === undefined || value === null || value === '';

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

const DynamicViewNode = ({ viewDefinition, viewEntry, renderInPanel = false, showEditButton = false, editLocked = false, ...props }) => {
  const theme = useTheme();
  const node = useNodePortSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const viewIntent = viewEntry?.intent || viewDefinition?.viewNode?.data?.view?.intent || '';
  const viewPayloadKey = viewDefinition?.viewNode?.data?.view?.payload || viewEntry?.payload || viewEntry?.view || '';
  const isEditorView = viewPayloadKey === 'editor.web' || viewIntent === 'editor';
  const isNodeWebView = viewPayloadKey === 'node.web';
  const useEditorUI = isEditorView && renderInPanel;
  const effectiveIntent = useEditorUI ? viewIntent : (isEditorView ? 'node' : viewIntent);
  const effectivePayloadKey = useEditorUI ? viewPayloadKey : (isEditorView ? 'node.web' : viewPayloadKey);
  const viewWantsEditButton = viewDefinition?.viewNode?.data?.view?.showEditButton
    ?? viewDefinition?.viewNode?.data?.node?.web?.showEditButton;
  const editorConfig = viewDefinition?.viewNode?.data?.editor?.web || null;
  const editorFields = Array.isArray(editorConfig?.fields) ? editorConfig.fields : [];
  const editorOverrides = node?.data?.editorOverrides || {};
  const editorFieldOverrides = editorOverrides?.fields || {};
  const effectiveEditorFields = editorFields
    .map((field) => {
      const key = field?.key || field?.path || '';
      const overrides = editorFieldOverrides?.[key] || editorFieldOverrides?.[field?.path] || {};
      return { ...field, ...overrides };
    })
    .filter((field) => !field?.hidden);

  const [editorValue, setEditorValue] = useState(() => {
    const initial = node?.data?.content;
    return typeof initial === 'string' ? initial : '';
  });
  const [editorFieldValues, setEditorFieldValues] = useState(() => {
    if (!effectiveEditorFields.length) return {};
    const initialValues = {};
    effectiveEditorFields.forEach((field) => {
      const path = field?.path || field?.key || '';
      const current = path ? getByPath(node, path) : undefined;
      initialValues[field.key || path] = current ?? '';
    });
    return initialValues;
  });
  const [dirtyFields, setDirtyFields] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (isEditingRef.current) return;
    const next = node?.data?.content;
    if (typeof next === 'string') {
      setEditorValue(next);
    } else if (next == null) {
      setEditorValue('');
    }
  }, [node?.id, node?.data?.content]);

  useEffect(() => {
    if (!effectiveEditorFields.length) return;
    if (isEditingRef.current) return;
    setEditorFieldValues((prev) => {
      const nextValues = { ...prev };
      effectiveEditorFields.forEach((field) => {
        const path = field?.path || field?.key || '';
        const current = path ? getByPath(node, path) : undefined;
        nextValues[field.key || path] = current ?? '';
      });
      return nextValues;
    });
  }, [effectiveEditorFields, node]);

  useEffect(() => {
    if (!effectiveEditorFields.length) {
      setFieldErrors({});
      return;
    }
    const nextErrors = {};
    effectiveEditorFields.forEach((field) => {
      const key = field.key || field.path;
      if (!key) return;
      const value = editorFieldValues[key];
      if (field.required && isEmptyValue(value)) {
        nextErrors[key] = 'Required';
        return;
      }
      if (field.type === 'number' && !isEmptyValue(value)) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          nextErrors[key] = 'Must be a number';
        }
      }
    });
    setFieldErrors(nextErrors);
  }, [effectiveEditorFields, editorFieldValues]);

  const emitDirtyState = (nodeId, dirty) => {
    try {
      eventBus.emit('nodeEditorDirtyChange', { nodeId, dirty });
    } catch (err) {
      // ignore telemetry errors
    }
  };

  useEffect(() => {
    if (!renderInPanel || !node?.id) return;
    const dirty = Object.values(dirtyFields).some(Boolean);
    emitDirtyState(node.id, dirty);
  }, [dirtyFields, node?.id, renderInPanel]);

  useEffect(() => {
    if (!renderInPanel || !node?.id) return;
    const handleReset = ({ nodeId } = {}) => {
      if (!nodeId || nodeId !== node.id) return;
      if (effectiveEditorFields.length) {
        const nextValues = {};
        effectiveEditorFields.forEach((field) => {
          const path = field?.path || field?.key || '';
          nextValues[field.key || path] = path ? getByPath(node, path) ?? '' : '';
        });
        setEditorFieldValues(nextValues);
        setDirtyFields({});
      } else {
        const next = node?.data?.content;
        setEditorValue(typeof next === 'string' ? next : '');
        setDirtyFields({});
      }
      emitDirtyState(node.id, false);
    };
    const handleCommit = ({ nodeId } = {}) => {
      if (!nodeId || nodeId !== node.id) return;
      const commitResult = commitAllFields();
      try {
        eventBus.emit('nodeEditorCommitResult', { nodeId: node.id, ...commitResult });
      } catch (err) {
        // ignore telemetry errors
      }
    };
    eventBus.on('nodeEditorReset', handleReset);
    eventBus.on('nodeEditorCommit', handleCommit);
    return () => {
      eventBus.off('nodeEditorReset', handleReset);
      eventBus.off('nodeEditorCommit', handleCommit);
    };
  }, [renderInPanel, node, effectiveEditorFields, editorFieldValues, fieldErrors]);

  const datatype = useMemo(() => {
    if (viewDefinition?.viewNode?.data?.view?.payload) {
      return `data.${viewDefinition.viewNode.data.view.payload}`;
    }
    if (viewDefinition?.viewNode?.data?.host?.datatype) {
      return viewDefinition.viewNode.data.host.datatype;
    }
    const payload = viewEntry?.payload || viewEntry?.view;
    if (payload) {
      return `data.${payload}`;
    }
    return '';
  }, [viewDefinition?.viewNode?.data?.host?.datatype, viewEntry?.payload, viewEntry?.view]);

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

  const commitAllFields = () => {
    if (!node?.id) return { success: false, error: 'Missing node id' };
    if (effectiveEditorFields.length) {
      const errorKeys = Object.keys(fieldErrors);
      if (errorKeys.length) {
        return { success: false, error: fieldErrors[errorKeys[0]] || 'Validation error' };
      }
      let nextNode = node;
      let hasChanges = false;
      effectiveEditorFields.forEach((field) => {
        const key = field.key || field.path || '';
        const path = field.path || field.key || '';
        if (!path) return;
        const nextValue = editorFieldValues[key];
        const currentValue = getByPath(node, path);
        if (nextValue !== currentValue) {
          nextNode = setByPath(nextNode, path, nextValue);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        const updates = {};
        if (nextNode.label !== node.label) updates.label = nextNode.label;
        if (nextNode.data !== node.data) updates.data = nextNode.data;
        if (Object.keys(updates).length) {
          eventBus.emit('nodeUpdate', {
            id: node.id,
            updates
          });
        }
      }
      setDirtyFields({});
      emitDirtyState(node.id, false);
      return { success: true };
    }
    if (editLocked) return { success: false, error: 'Editing disabled' };
    const next = editorValue;
    const current = typeof node?.data?.content === 'string' ? node.data.content : '';
    if (next !== current) {
      eventBus.emit('nodeUpdate', {
        id: node.id,
        updates: { data: { ...node.data, content: next } }
      });
    }
    emitDirtyState(node.id, false);
    return { success: true };
  };

  const renderContent = () => {
    if (viewDefinition?.status === 'loading') {
      return <div style={{ color: theme.palette.text.secondary }}>Loading view…</div>;
    }
    if (viewDefinition?.status === 'error') {
      return <div style={{ color: theme.palette.error.main }}>Failed to load view.</div>;
    }
    if (useEditorUI) {
      if (effectiveEditorFields.length) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {effectiveEditorFields.map((field, index) => {
              const key = field.key || field.path || `field-${index}`;
              const path = field.path || field.key || '';
              const value = editorFieldValues[key] ?? '';
              const label = field.label || key;
              const isMultiline = field.multiline || field.type === 'markdown' || field.type === 'text';
              const fieldReadOnly = editLocked || field.readOnly === true;
              const error = fieldErrors[key];
              const commonStyle = {
                width: '100%',
                border: `1px solid ${error ? theme.palette.error.main : theme.palette.divider}`,
                borderRadius: 6,
                padding: 8,
                fontFamily: 'inherit',
                fontSize: 14,
                lineHeight: 1.5,
                color: theme.palette.text.primary,
                background: 'transparent',
                boxSizing: 'border-box'
              };
              const handleCommit = () => {
                isEditingRef.current = false;
                if (fieldReadOnly) return;
                if (!node?.id || !path) return;
                if (fieldErrors[key]) return;
                const nextValue = editorFieldValues[key];
                const currentValue = getByPath(node, path);
                if (nextValue === currentValue) return;
                const nextNode = setByPath(node, path, nextValue);
                const updates = {};
                if (nextNode.label !== node.label) updates.label = nextNode.label;
                if (nextNode.data !== node.data) updates.data = nextNode.data;
                if (!Object.keys(updates).length) return;
                eventBus.emit('nodeUpdate', {
                  id: node.id,
                  updates
                });
                try {
                  eventBus.emit('nodeEditorSave', {
                    nodeId: node.id,
                    field: key,
                    length: typeof nextValue === 'string' ? nextValue.length : 0,
                    at: Date.now()
                  });
                } catch (err) {
                  // ignore telemetry errors
                }
                setDirtyFields((prev) => ({ ...prev, [key]: false }));
              };
              return (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, color: theme.palette.text.secondary }}>{label}</span>
                  {isMultiline ? (
                    <textarea
                      value={value}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setEditorFieldValues((prev) => ({ ...prev, [key]: nextValue }));
                        if (path) {
                          const currentValue = getByPath(node, path);
                          setDirtyFields((prev) => ({ ...prev, [key]: nextValue !== currentValue }));
                        }
                      }}
                      onFocus={() => {
                        isEditingRef.current = true;
                      }}
                      onBlur={handleCommit}
                      placeholder={field.placeholder || ''}
                      spellCheck={field.spellCheck ?? true}
                      readOnly={fieldReadOnly}
                      rows={field.rows || 6}
                      style={{ ...commonStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type={field.inputType || 'text'}
                      value={value}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setEditorFieldValues((prev) => ({ ...prev, [key]: nextValue }));
                        if (path) {
                          const currentValue = getByPath(node, path);
                          setDirtyFields((prev) => ({ ...prev, [key]: nextValue !== currentValue }));
                        }
                      }}
                      onFocus={() => {
                        isEditingRef.current = true;
                      }}
                      onBlur={handleCommit}
                      placeholder={field.placeholder || ''}
                      readOnly={fieldReadOnly}
                      style={commonStyle}
                    />
                  )}
                  <span style={{ minHeight: 16, fontSize: 11, color: error ? theme.palette.error.main : theme.palette.text.secondary }}>
                    {error || field.helperText || ' '}
                  </span>
                </label>
              );
            })}
          </div>
        );
      }
      return (
        <textarea
          value={editorValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setEditorValue(nextValue);
            const current = typeof node?.data?.content === 'string' ? node.data.content : '';
            setDirtyFields((prev) => ({ ...prev, content: nextValue !== current }));
          }}
          onFocus={() => {
            isEditingRef.current = true;
          }}
          onBlur={() => {
            isEditingRef.current = false;
            if (editLocked) return;
            const next = editorValue;
            const current = typeof node?.data?.content === 'string' ? node.data.content : '';
            if (next === current) return;
            if (!node?.id) return;
            eventBus.emit('nodeUpdate', {
              id: node.id,
              updates: { data: { ...node.data, content: next } }
            });
            try {
              eventBus.emit('nodeEditorSave', {
                nodeId: node.id,
                length: typeof next === 'string' ? next.length : 0,
                at: Date.now()
              });
            } catch (err) {
              // ignore telemetry errors
            }
            setDirtyFields((prev) => ({ ...prev, content: false }));
          }}
          placeholder="Enter content…"
          spellCheck={true}
          readOnly={editLocked}
          style={{
            width: '100%',
            height: '100%',
            resize: 'none',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 6,
            padding: 8,
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.5,
            color: theme.palette.text.primary,
            background: 'transparent',
            boxSizing: 'border-box'
          }}
        />
      );
    }
    if (isNodeWebView || (isEditorView && !renderInPanel)) {
      const markdown = typeof node?.data?.content === 'string' ? node.data.content : '';
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        >
          {markdown}
        </ReactMarkdown>
      );
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

  const content = (
    <div
      style={{
        position: renderInPanel ? 'relative' : 'absolute',
        inset: renderInPanel ? 'auto' : 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'auto',
        height: renderInPanel ? '100%' : 'auto'
      }}
    >
      <div style={{ fontSize: 12, color: theme.palette.text.secondary }}>
        {effectivePayloadKey
          ? `View: ${effectiveIntent || 'node'} / ${effectivePayloadKey}`
          : 'View'}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );

  if (renderInPanel) {
    return (
      <div style={{ height: '100%', padding: 16 }}>
        {content}
      </div>
    );
  }

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      {showEditButton && viewWantsEditButton !== false && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!node?.id) return;
            eventBus.emit('toggleNodeEditorPanel', { nodeId: node.id });
          }}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            color: theme.palette.text.primary,
            background: theme.palette.background.paper,
            cursor: 'pointer'
          }}
        >
          Edit
        </button>
      )}
      {content}
    </FixedNode>
  );
};

export default DynamicViewNode;
