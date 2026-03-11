"use client";
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkIcon from '@mui/icons-material/Link';
import LaunchIcon from '@mui/icons-material/Launch';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BoltIcon from '@mui/icons-material/Bolt';
import PushPinIcon from '@mui/icons-material/PushPin';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NavigationIcon from '@mui/icons-material/Navigation';
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

const isLikelyImageSource = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    /\.(png|jpe?g|gif|webp|bmp|avif|svg)(\?|#|$)/.test(trimmed)
  );
};

const detectContentType = (payload) => {
  if (payload === undefined || payload === null) return 'empty';
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.startsWith('<svg') && trimmed.includes('</svg>')) return 'svg';
    if (isLikelyImageSource(trimmed)) return 'image';
    if (trimmed.startsWith('<') && trimmed.includes('>')) return 'html';
    return 'markdown';
  }
  if (typeof payload === 'object') {
    if (typeof payload.canvas === 'object' && payload.canvas) return 'canvas';
    if (typeof payload.svg === 'string') return 'svg';
    if (typeof payload.image === 'string' || typeof payload.src === 'string') return 'image';
    if (typeof payload.html === 'string') return 'html';
    if (typeof payload.markdown === 'string') return 'markdown';
    if (typeof payload.text === 'string') return 'text';
  }
  return 'json';
};

const isFieldMultiline = (field) => {
  if (!field || typeof field !== 'object') return false;
  if (field.multiline === true) return true;
  const type = String(field.type || '').toLowerCase();
  return (
    type === 'markdown' ||
    type === 'textarea' ||
    type === 'multiline' ||
    type === 'json' ||
    type === 'html' ||
    type === 'xml'
  );
};

const normalizeFieldValueForCommit = (field, value) => {
  const type = String(field?.type || '').toLowerCase();
  if (type === 'number') {
    if (value === '' || value === null || value === undefined) return '';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  if (type === 'boolean' || type === 'checkbox' || type === 'toggle') {
    return Boolean(value);
  }
  return value;
};

const drawCanvasSpec = (ctx, spec = {}, width, height) => {
  ctx.clearRect(0, 0, width, height);
  if (spec.background) {
    ctx.fillStyle = spec.background;
    ctx.fillRect(0, 0, width, height);
  }
  const shapes = Array.isArray(spec.shapes) ? spec.shapes : [];
  shapes.forEach((shape) => {
    const type = String(shape?.type || '').toLowerCase();
    if (type === 'rect') {
      const x = Number(shape.x) || 0;
      const y = Number(shape.y) || 0;
      const w = Number(shape.width) || 0;
      const h = Number(shape.height) || 0;
      if (shape.fill) {
        ctx.fillStyle = shape.fill;
        ctx.fillRect(x, y, w, h);
      }
      if (shape.stroke) {
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = Number(shape.lineWidth) || 1;
        ctx.strokeRect(x, y, w, h);
      }
      return;
    }
    if (type === 'circle') {
      const x = Number(shape.x) || 0;
      const y = Number(shape.y) || 0;
      const radius = Number(shape.radius) || 0;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (shape.fill) {
        ctx.fillStyle = shape.fill;
        ctx.fill();
      }
      if (shape.stroke) {
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = Number(shape.lineWidth) || 1;
        ctx.stroke();
      }
      return;
    }
    if (type === 'line') {
      ctx.beginPath();
      ctx.moveTo(Number(shape.x1) || 0, Number(shape.y1) || 0);
      ctx.lineTo(Number(shape.x2) || 0, Number(shape.y2) || 0);
      ctx.strokeStyle = shape.stroke || '#000';
      ctx.lineWidth = Number(shape.lineWidth) || 1;
      ctx.stroke();
      return;
    }
    if (type === 'text') {
      ctx.fillStyle = shape.color || '#000';
      const size = Number(shape.fontSize) || 14;
      const family = shape.fontFamily || 'sans-serif';
      ctx.font = `${size}px ${family}`;
      ctx.textAlign = shape.align || 'left';
      ctx.textBaseline = shape.baseline || 'top';
      ctx.fillText(String(shape.text || ''), Number(shape.x) || 0, Number(shape.y) || 0);
    }
  });
};

const CanvasRuntimeView = ({ payload }) => {
  const canvasRef = useRef(null);
  const spec = payload?.canvas || payload || {};

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = Math.max(1, parent.clientWidth || Number(spec.width) || 320);
    const height = Math.max(1, parent.clientHeight || Number(spec.height) || 180);
    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawCanvasSpec(ctx, spec, width, height);
  }, [spec]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', background: 'transparent' }}
    />
  );
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

const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
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

const NON_PASSIVE_LISTENER = { passive: false };
const HANDLE_SIZE = 10;
const HANDLE_OFFSET = -4;
const RESIZE_HANDLES = [
  { key: 'nw', cursor: 'nwse-resize', x: HANDLE_OFFSET, y: HANDLE_OFFSET },
  { key: 'n', cursor: 'ns-resize', x: '50%', y: HANDLE_OFFSET, transform: 'translate(-50%, 0)' },
  { key: 'ne', cursor: 'nesw-resize', x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: HANDLE_OFFSET },
  { key: 'e', cursor: 'ew-resize', x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: '50%', transform: 'translate(0, -50%)' },
  { key: 'se', cursor: 'nwse-resize', x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)` },
  { key: 's', cursor: 'ns-resize', x: '50%', y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, transform: 'translate(-50%, 0)' },
  { key: 'sw', cursor: 'nesw-resize', x: HANDLE_OFFSET, y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)` },
  { key: 'w', cursor: 'ew-resize', x: HANDLE_OFFSET, y: '50%', transform: 'translate(0, -50%)' }
];
const CONTROL_ICONS = {
  edit: EditIcon,
  openinnew: OpenInNewIcon,
  open: OpenInNewIcon,
  link: LinkIcon,
  launch: LaunchIcon,
  play: PlayArrowIcon,
  run: PlayArrowIcon,
  bolt: BoltIcon,
  pin: PushPinIcon,
  settings: SettingsIcon,
  chevronright: ChevronRightIcon,
  navigate: NavigationIcon
};
const CONTROL_VARIANTS = new Set(['outlined', 'contained', 'text', 'soft']);
const CONTROL_PRIORITY_WORDS = {
  highest: 0,
  high: 25,
  normal: 100,
  medium: 100,
  low: 175,
  lowest: 250
};

const normalizeIconKey = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');
const resolveControlIcon = (icon) => CONTROL_ICONS[normalizeIconKey(icon)] || null;
const normalizeControlVariant = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return CONTROL_VARIANTS.has(normalized) ? normalized : 'outlined';
};
const normalizeControlPriority = (value, fallbackOrder = 100) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CONTROL_PRIORITY_WORDS, trimmed)) {
      return CONTROL_PRIORITY_WORDS[trimmed];
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallbackOrder;
};
const buildTransparentHtmlDoc = (html) => {
  const body = typeof html === 'string' ? html : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent !important;
        overflow: hidden;
      }
      #twilite-html-root {
        width: 100%;
        height: 100%;
        overflow: auto;
        background: transparent !important;
      }
      #twilite-html-root > *:first-child {
        width: 100%;
        min-height: 100%;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body><div id="twilite-html-root">${body}</div></body>
</html>`;
};

const DynamicViewNode = ({ viewDefinition, viewEntry, renderInPanel = false, showEditButton = false, editLocked = false, ...props }) => {
  const theme = useTheme();
  const node = useNodePortSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeStateRef = useRef({
    handle: 'se',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startPosX: 0,
    startPosY: 0
  });
  const rafRef = useRef(null);
  const pendingSizeRef = useRef(null);
  const pendingPosRef = useRef(null);
  const MIN_WIDTH = Math.max(1, Number(node?.data?.minWidth) || 1);
  const MIN_HEIGHT = Math.max(1, Number(node?.data?.minHeight) || 1);
  const viewIntent = viewEntry?.intent || viewDefinition?.viewNode?.data?.view?.intent || '';
  const viewPayloadKey = viewDefinition?.viewNode?.data?.view?.payload || viewEntry?.payload || viewEntry?.view || '';
  const isEditorView = viewPayloadKey === 'editor.web' || viewIntent === 'editor';
  const isNodeWebView = viewPayloadKey === 'node.web';
  const useEditorUI = isEditorView && renderInPanel;
  const effectiveIntent = useEditorUI ? viewIntent : (isEditorView ? 'node' : viewIntent);
  const effectivePayloadKey = useEditorUI ? viewPayloadKey : (isEditorView ? 'node.web' : viewPayloadKey);
  const viewWantsEditButton = viewDefinition?.viewNode?.data?.view?.showEditButton
    ?? viewDefinition?.viewNode?.data?.node?.web?.showEditButton;
  const nodeWebConfig = viewDefinition?.viewNode?.data?.node?.web || {};
  const rawControls = useMemo(() => {
    const viewControls = viewDefinition?.viewNode?.data?.view?.controls;
    if (Array.isArray(viewControls)) return viewControls;
    if (Array.isArray(nodeWebConfig?.controls)) return nodeWebConfig.controls;
    return [];
  }, [viewDefinition?.viewNode?.data?.view?.controls, nodeWebConfig?.controls]);
  const hasDeclaredControls = rawControls.length > 0;
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
  const [uiDensity, setUiDensity] = useState('comfortable');
  const isEditingRef = useRef(false);
  const editorFieldSnapshot = useMemo(() => {
    if (!effectiveEditorFields.length) return {};
    const nextValues = {};
    effectiveEditorFields.forEach((field) => {
      const path = field?.path || field?.key || '';
      const current = path ? getByPath(node, path) : undefined;
      nextValues[field.key || path] = current ?? '';
    });
    return nextValues;
  }, [effectiveEditorFields, node?.id, node?.data]);

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
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(editorFieldSnapshot);
      if (prevKeys.length === nextKeys.length) {
        const same = nextKeys.every((key) => prev[key] === editorFieldSnapshot[key]);
        if (same) return prev;
      }
      return editorFieldSnapshot;
    });
  }, [effectiveEditorFields.length, editorFieldSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const normalize = (value) => (
      value === 'dense' || value === 'compact' ? value : 'comfortable'
    );
    try {
      const stored = window.localStorage.getItem('twilite.uiDensity');
      if (stored) setUiDensity(normalize(stored));
    } catch {}
    const handleDensity = (payload = {}) => {
      setUiDensity(normalize(payload?.uiDensity));
    };
    eventBus.on('uiDensityChanged', handleDensity);
    return () => eventBus.off('uiDensityChanged', handleDensity);
  }, []);

  useEffect(() => {
    if (!effectiveEditorFields.length) {
      setFieldErrors((prev) => (Object.keys(prev).length ? {} : prev));
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
    setFieldErrors((prev) => (shallowEqual(prev, nextErrors) ? prev : nextErrors));
  }, [effectiveEditorFields, editorFieldValues]);

  const getPointerPosition = (event) => {
    if (!event) return null;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x: event.clientX, y: event.clientY };
    }
    return null;
  };

  const flushResize = () => {
    rafRef.current = null;
    if (!pendingSizeRef.current || !node?.id) return;
    const { width, height } = pendingSizeRef.current;
    eventBus.emit('nodeResize', { id: node.id, width, height });
    if (pendingPosRef.current) {
      eventBus.emit('nodeMove', { id: node.id, position: pendingPosRef.current });
    }
  };

  const handleResizeStart = (event, handle) => {
    const point = getPointerPosition(event);
    if (!point || renderInPanel) return;
    if (event.stopPropagation) event.stopPropagation();
    if (event.cancelable && event.preventDefault) event.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStateRef.current = {
      handle,
      startX: point.x,
      startY: point.y,
      startWidth: node.width || MIN_WIDTH,
      startHeight: node.height || MIN_HEIGHT,
      startPosX: node.position?.x ?? node.x ?? 0,
      startPosY: node.position?.y ?? node.y ?? 0
    };
    if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore pointer capture errors
      }
    }
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleResizeMove = (event) => {
      if (!isResizingRef.current) return;
      const point = getPointerPosition(event);
      if (!point) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const zoom = props.zoom || 1;
      const state = resizeStateRef.current;
      const dx = (point.x - state.startX) / zoom;
      const dy = (point.y - state.startY) / zoom;
      let newWidth = state.startWidth;
      let newHeight = state.startHeight;
      let newX = state.startPosX;
      let newY = state.startPosY;

      if (state.handle.includes('e')) {
        newWidth = Math.max(MIN_WIDTH, state.startWidth + dx);
      }
      if (state.handle.includes('s')) {
        newHeight = Math.max(MIN_HEIGHT, state.startHeight + dy);
      }
      if (state.handle.includes('w')) {
        newWidth = Math.max(MIN_WIDTH, state.startWidth - dx);
        newX = state.startPosX + (state.startWidth - newWidth);
      }
      if (state.handle.includes('n')) {
        newHeight = Math.max(MIN_HEIGHT, state.startHeight - dy);
        newY = state.startPosY + (state.startHeight - newHeight);
      }

      pendingSizeRef.current = { width: newWidth, height: newHeight };
      pendingPosRef.current = { x: newX, y: newY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushResize);
      }
    };

    const handleResizeEnd = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      flushResize();
      eventBus.emit('nodeResizeEnd', { id: node.id });
    };

    document.addEventListener('pointermove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('pointerup', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('pointercancel', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);
    return () => {
      document.removeEventListener('pointermove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('pointerup', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('pointercancel', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);
    };
  }, [isResizing, node.id, props.zoom, renderInPanel]);

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
  const isHtmlCanvasMode = contentType === 'html' && !renderInPanel;
  const isMarkdownCanvasMode = contentType === 'markdown' && !renderInPanel;
  const htmlChromePreference =
    viewDefinition?.viewNode?.data?.view?.html?.chrome ??
    viewDefinition?.viewNode?.data?.node?.web?.html?.chrome ??
    node?.data?.htmlChrome ??
    node?.data?.chrome;
  const showHtmlChrome = htmlChromePreference !== false;

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

  const controls = useMemo(() => {
    const normalized = rawControls
      .map((control, index) => {
        if (!control || typeof control !== 'object') return null;
        const id = String(control.id || `control-${index + 1}`);
        const type = String(control.type || 'button');
        const inferredAction = type === 'toggle' ? 'toggle' : undefined;
        const action = String(control.action || inferredAction || '').trim();
        const variant = normalizeControlVariant(control.variant);
        const priority = normalizeControlPriority(control.priority, 100 + index);
        return {
          ...control,
          id,
          type,
          action,
          variant,
          priority,
          _index: index
        };
      })
      .filter(Boolean);

    const hasOpenEditorControl = normalized.some((control) => control.action === 'openEditor');
    if (showEditButton && viewWantsEditButton !== false && !hasOpenEditorControl) {
      normalized.unshift({
        id: 'edit',
        type: 'button',
        label: 'Edit',
        action: 'openEditor',
        variant: 'outlined',
        priority: 0,
        icon: 'edit',
        _index: -1
      });
    }
    return normalized
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a._index - b._index;
      })
      .map(({ _index, ...rest }) => rest);
  }, [rawControls, showEditButton, viewWantsEditButton]);

  const executeControl = (control, event) => {
    if (!control) return;
    if (event?.stopPropagation) event.stopPropagation();
    if (!node?.id) return;

    const action = control.action || (control.type === 'toggle' ? 'toggle' : '');
    const bindPath = control.bind || control.path || '';
    const isMutatingAction = action === 'toggle' || action === 'setData';
    if (isMutatingAction && editLocked) return;

    if (action === 'openEditor') {
      eventBus.emit('toggleNodeEditorPanel', { nodeId: node.id });
      return;
    }

    if (action === 'navigate') {
      const rawUrl = control.href || control.url
        || (bindPath ? getByPath(node, bindPath) : '')
        || (control.hrefPath ? getByPath(node, control.hrefPath) : '');
      const url = typeof rawUrl === 'string' ? applyTemplate(rawUrl, node) : '';
      if (!url) return;
      eventBus.emit('fetchUrl', { url, source: 'dynamic-control' });
      return;
    }

    if (action === 'emit') {
      const eventName = typeof control.event === 'string' ? control.event.trim() : '';
      if (!eventName) return;
      let payload = control.payload;
      if (control.payloadPath) {
        payload = getByPath(node, control.payloadPath);
      }
      eventBus.emit(eventName, payload);
      return;
    }

    if (action === 'toggle') {
      if (!bindPath) return;
      const currentValue = Boolean(getByPath(node, bindPath));
      const nextNode = setByPath(node, bindPath, !currentValue);
      const updates = {};
      if (nextNode.label !== node.label) updates.label = nextNode.label;
      if (nextNode.data !== node.data) updates.data = nextNode.data;
      if (!Object.keys(updates).length) return;
      eventBus.emit('nodeUpdate', { id: node.id, updates });
      return;
    }

    if (action === 'setData') {
      if (!bindPath || !('value' in control)) return;
      const nextNode = setByPath(node, bindPath, control.value);
      const updates = {};
      if (nextNode.label !== node.label) updates.label = nextNode.label;
      if (nextNode.data !== node.data) updates.data = nextNode.data;
      if (!Object.keys(updates).length) return;
      eventBus.emit('nodeUpdate', { id: node.id, updates });
    }
  };

  const renderControlBar = () => {
    if (renderInPanel || !controls.length) return null;
    return (
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: '70%',
          justifyContent: 'flex-end'
        }}
      >
        {controls.map((control) => {
          const label = String(control.label || control.id || 'Action');
          const bindPath = control.bind || control.path || '';
          const isToggle = control.type === 'toggle' || control.action === 'toggle';
          const checked = isToggle ? Boolean(getByPath(node, bindPath)) : false;
          const mutating = control.action === 'toggle' || control.action === 'setData';
          const disabled = Boolean(control.disabled) || (mutating && editLocked);
          const variant = normalizeControlVariant(control.variant);
          const IconComponent = resolveControlIcon(control.icon);
          const baseBorder = `1px solid ${theme.palette.divider}`;
          const styleByVariant = (() => {
            if (variant === 'contained') {
              return {
                border: `1px solid ${theme.palette.primary.main}`,
                color: theme.palette.primary.contrastText,
                background: checked ? theme.palette.primary.dark : theme.palette.primary.main
              };
            }
            if (variant === 'text') {
              return {
                border: '1px solid transparent',
                color: checked ? theme.palette.primary.main : theme.palette.text.primary,
                background: checked ? alpha(theme.palette.primary.main, 0.12) : 'transparent'
              };
            }
            if (variant === 'soft') {
              return {
                border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                color: theme.palette.primary.main,
                background: checked
                  ? alpha(theme.palette.primary.main, 0.2)
                  : alpha(theme.palette.primary.main, 0.1)
              };
            }
            return {
              border: baseBorder,
              color: checked ? theme.palette.primary.main : theme.palette.text.primary,
              background: checked ? alpha(theme.palette.primary.main, 0.12) : theme.palette.background.paper
            };
          })();
          return (
            <button
              key={control.id}
              type="button"
              onClick={(event) => executeControl(control, event)}
              disabled={disabled}
              style={{
                ...styleByVariant,
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                lineHeight: 1.2,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
              title={control.title || ''}
            >
              {IconComponent ? <IconComponent style={{ fontSize: 14 }} /> : null}
              {isToggle ? `${label}: ${checked ? 'On' : 'Off'}` : label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    if (viewDefinition?.status === 'loading') {
      return <div style={{ color: theme.palette.text.secondary }}>Loading view…</div>;
    }
    if (viewDefinition?.status === 'error') {
      return <div style={{ color: theme.palette.error.main }}>Failed to load view.</div>;
    }
    if (useEditorUI) {
      const densityConfig = uiDensity === 'dense'
        ? { fieldGap: 6, labelSize: 11, inputSize: 12, inputPadding: 6, helperSize: 10, defaultRows: 3, panelPadding: 8 }
        : uiDensity === 'compact'
          ? { fieldGap: 8, labelSize: 11.5, inputSize: 13, inputPadding: 7, helperSize: 10.5, defaultRows: 4, panelPadding: 10 }
          : { fieldGap: 12, labelSize: 12, inputSize: 14, inputPadding: 8, helperSize: 11, defaultRows: 4, panelPadding: 16 };
      if (effectiveEditorFields.length) {
        return (
          <div
            style={{
              display: 'grid',
              gap: densityConfig.fieldGap,
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              alignItems: 'start'
            }}
          >
            {effectiveEditorFields.map((field, index) => {
              const key = field.key || field.path || `field-${index}`;
              const path = field.path || field.key || '';
              const value = editorFieldValues[key] ?? '';
              const label = field.label || key;
              const fieldType = String(field.type || '').toLowerCase();
              const isMultiline = isFieldMultiline(field);
              const isBooleanField = fieldType === 'boolean' || fieldType === 'checkbox' || fieldType === 'toggle';
              const optionEntries = Array.isArray(field.options) ? field.options : [];
              const isSelectField = fieldType === 'select' || optionEntries.length > 0;
              const fieldReadOnly = editLocked || field.readOnly === true;
              const error = fieldErrors[key];
              const commonStyle = {
                width: '100%',
                border: `1px solid ${error ? theme.palette.error.main : theme.palette.divider}`,
                borderRadius: 6,
                padding: densityConfig.inputPadding,
                fontFamily: 'inherit',
                fontSize: densityConfig.inputSize,
                lineHeight: 1.35,
                color: theme.palette.text.primary,
                background: 'transparent',
                boxSizing: 'border-box'
              };
              const onFieldChange = (nextValue) => {
                setEditorFieldValues((prev) => ({ ...prev, [key]: nextValue }));
                if (path) {
                  const currentValue = getByPath(node, path);
                  setDirtyFields((prev) => ({ ...prev, [key]: nextValue !== currentValue }));
                }
              };
              const handleCommit = () => {
                isEditingRef.current = false;
                if (fieldReadOnly) return;
                if (!node?.id || !path) return;
                if (fieldErrors[key]) return;
                const nextValue = normalizeFieldValueForCommit(field, editorFieldValues[key]);
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
                <label
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMultiline ? '1fr' : (isBooleanField ? '1fr' : '120px minmax(0, 1fr)'),
                    alignItems: isMultiline ? 'stretch' : 'center',
                    columnGap: 10,
                    rowGap: Math.max(4, densityConfig.fieldGap - 2),
                    padding: `${Math.max(4, densityConfig.inputPadding - 2)}px ${Math.max(6, densityConfig.inputPadding)}px`,
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 8,
                    gridColumn: isMultiline ? '1 / -1' : 'auto'
                  }}
                >
                  <span style={{ fontSize: densityConfig.labelSize, color: theme.palette.text.secondary, fontWeight: 600 }}>
                    {label}
                  </span>
                  {isMultiline ? (
                    <textarea
                      value={value}
                      onChange={(event) => onFieldChange(event.target.value)}
                      onFocus={() => {
                        isEditingRef.current = true;
                      }}
                      onBlur={handleCommit}
                      placeholder={field.placeholder || ''}
                      spellCheck={field.spellCheck ?? true}
                      readOnly={fieldReadOnly}
                      rows={field.rows || densityConfig.defaultRows}
                      style={{ ...commonStyle, resize: 'vertical' }}
                    />
                  ) : isBooleanField ? (
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => onFieldChange(Boolean(event.target.checked))}
                      onBlur={handleCommit}
                      disabled={fieldReadOnly}
                      style={{ width: 16, height: 16 }}
                    />
                  ) : isSelectField ? (
                    <select
                      value={value}
                      onChange={(event) => onFieldChange(event.target.value)}
                      onFocus={() => {
                        isEditingRef.current = true;
                      }}
                      onBlur={handleCommit}
                      disabled={fieldReadOnly}
                      style={commonStyle}
                    >
                      {!field.required && <option value="">Select…</option>}
                      {optionEntries.map((option, optionIndex) => {
                        if (typeof option === 'object') {
                          const optionValue = option?.value ?? '';
                          const optionLabel = option?.label ?? String(optionValue);
                          return (
                            <option key={`${key}-opt-${optionIndex}`} value={optionValue}>
                              {optionLabel}
                            </option>
                          );
                        }
                        return (
                          <option key={`${key}-opt-${optionIndex}`} value={option}>
                            {String(option)}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type={field.inputType || (fieldType === 'number' ? 'number' : 'text')}
                      value={value}
                      onChange={(event) => onFieldChange(event.target.value)}
                      onFocus={() => {
                        isEditingRef.current = true;
                      }}
                      onBlur={handleCommit}
                      placeholder={field.placeholder || ''}
                      readOnly={fieldReadOnly}
                      style={commonStyle}
                    />
                  )}
                  <span
                    style={{
                      minHeight: 14,
                      fontSize: densityConfig.helperSize,
                      color: error ? theme.palette.error.main : theme.palette.text.secondary,
                      gridColumn: (isMultiline || isBooleanField) ? '1 / -1' : '2 / 3'
                    }}
                  >
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
            padding: uiDensity === 'dense' ? 6 : uiDensity === 'compact' ? 7 : 8,
            fontFamily: 'inherit',
            fontSize: uiDensity === 'dense' ? 12 : uiDensity === 'compact' ? 13 : 14,
            lineHeight: 1.35,
            color: theme.palette.text.primary,
            background: 'transparent',
            boxSizing: 'border-box'
          }}
        />
      );
    }
    if (isNodeWebView || (isEditorView && !renderInPanel)) {
      const markdown = (() => {
        if (typeof payload === 'string') return payload;
        if (payload && typeof payload === 'object' && typeof payload.markdown === 'string') return payload.markdown;
        return typeof node?.data?.content === 'string' ? node.data.content : '';
      })();
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
          srcDoc={buildTransparentHtmlDoc(html)}
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            display: 'block',
            background: 'transparent',
            backgroundColor: 'transparent'
          }}
          title={`View for ${node?.type || 'node'}`}
        />
      );
    }
    if (contentType === 'svg') {
      const svg = typeof payload === 'string' ? payload : payload?.svg || '';
      if (!svg) {
        return <div style={{ color: theme.palette.text.secondary }}>No SVG payload found.</div>;
      }
      const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      return (
        <img
          src={encoded}
          alt={payload?.alt || node?.label || 'svg-view'}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: payload?.fit || 'contain',
            background: 'transparent'
          }}
        />
      );
    }
    if (contentType === 'image') {
      const src = typeof payload === 'string' ? payload : payload?.image || payload?.src || '';
      if (!src) {
        return <div style={{ color: theme.palette.text.secondary }}>No image source found.</div>;
      }
      return (
        <img
          src={src}
          alt={payload?.alt || node?.label || 'image-view'}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: payload?.fit || 'contain',
            background: 'transparent'
          }}
        />
      );
    }
    if (contentType === 'canvas') {
      return <CanvasRuntimeView payload={payload} />;
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
        inset: renderInPanel ? 'auto' : (isHtmlCanvasMode ? 0 : 8),
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: isHtmlCanvasMode ? 0 : 8,
        pointerEvents: 'auto',
        height: renderInPanel ? '100%' : (isHtmlCanvasMode ? '100%' : 'auto'),
        borderRadius: isHtmlCanvasMode && showHtmlChrome ? 8 : 0,
        border: isHtmlCanvasMode && showHtmlChrome
          ? `2px solid ${alpha(theme.palette.primary.main, 0.9)}`
          : 'none',
        boxSizing: 'border-box',
        boxShadow: isHtmlCanvasMode && showHtmlChrome
          ? `0 0 0 1px ${alpha(theme.palette.common.black, 0.18)}`
          : 'none',
        backgroundColor: 'transparent'
      }}
    >
      {!isHtmlCanvasMode && renderInPanel && (
        <div style={{ fontSize: 12, color: theme.palette.text.secondary }}>
          {effectivePayloadKey
            ? `View: ${effectiveIntent || 'node'} / ${effectivePayloadKey}`
            : 'View'}
        </div>
      )}
      <div style={{ flex: 1, overflow: isHtmlCanvasMode ? 'hidden' : 'auto', minHeight: 0 }}>
        {renderContent()}
      </div>
    </div>
  );

  if (renderInPanel) {
    const panelPadding = uiDensity === 'dense' ? 8 : uiDensity === 'compact' ? 12 : 16;
    return (
      <div style={{ height: '100%', padding: panelPadding }}>
        {content}
      </div>
    );
  }

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true} disableChrome={isHtmlCanvasMode}>
      {(isHtmlCanvasMode || isMarkdownCanvasMode) && (
        <div
          title="Drag node"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 18,
            zIndex: 4,
            cursor: 'grab',
            pointerEvents: 'auto',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0))'
          }}
        />
      )}
      {(controls.length > 0 || (!hasDeclaredControls && showEditButton && viewWantsEditButton !== false)) && renderControlBar()}
      {content}
      {!renderInPanel && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {RESIZE_HANDLES.map((handle) => (
            <div
              key={handle.key}
              onPointerDown={(event) => handleResizeStart(event, handle.key)}
              onMouseDown={(event) => handleResizeStart(event, handle.key)}
              onTouchStart={(event) => handleResizeStart(event.nativeEvent || event, handle.key)}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                background: theme.palette.background.paper,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                cursor: handle.cursor,
                opacity: isResizing ? 1 : 0,
                transition: 'opacity 0.2s ease',
                zIndex: 3,
                pointerEvents: 'auto',
                touchAction: 'none',
                userSelect: 'none',
                left: handle.x,
                top: handle.y,
                transform: handle.transform || 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = isResizing ? '1' : '0';
              }}
            />
          ))}
        </div>
      )}
    </FixedNode>
  );
};

export default DynamicViewNode;
