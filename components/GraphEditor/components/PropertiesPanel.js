"use client";
import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import {
  Paper, TextField, IconButton, Divider, FormControl, InputLabel, 
  Select, MenuItem, FormControlLabel, Switch, Slider, Typography, 
  Box, ToggleButton, ToggleButtonGroup, Accordion, AccordionSummary,
  AccordionDetails, List, ListItem, ListItemText, ListItemSecondaryAction,
  Button, Tooltip, Chip, Stack
} from '@mui/material';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import {
  Close as CloseIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Note as NoteIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  InsertEmoticon as InsertEmoticonIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { getNodeTypeList } from '../nodeTypeRegistry';
import edgeTypesMap from '../edgeTypes'; // Correct import syntax
import { subscribe as subscribeToPluginRegistry, getPluginNodeDefinition } from '../plugins/pluginRegistry';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a)) {
    if (!isPlainObject(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
};

const buildUpdatesFromDiff = (original = {}, updated = {}) => {
  const updates = {};
  const keys = new Set([
    ...Object.keys(original || {}),
    ...Object.keys(updated || {})
  ]);

  keys.forEach((key) => {
    if (!(key in updated)) {
      updates[key] = undefined;
    } else if (!deepEqual(original?.[key], updated[key])) {
      updates[key] = updated[key];
    }
  });

  return Object.keys(updates).reduce((acc, key) => {
    acc[key] = updates[key];
    return acc;
  }, {});
};

const deriveHandlesFromNode = (node, kind) => {
  if (!node) return [];
  if (Array.isArray(node.handles) && node.handles.length > 0) {
    return node.handles
      .filter(Boolean)
      .filter(handle => {
        const direction = handle.direction || (handle.type === 'input' ? 'input' : 'output');
        if (kind === 'inputs') {
          return direction === 'input' || direction === 'bidirectional';
        }
        return direction === 'output' || direction === 'bidirectional' || !direction;
      })
      .map(handle => ({
        id: handle.id || handle.key || handle.name || `${kind === 'inputs' ? 'in' : 'out'}-0`,
        label: handle.label || handle.id || handle.key || '',
        direction: handle.direction || (kind === 'inputs' ? 'input' : 'output'),
        dataType: handle.dataType || handle.type || 'value',
        allowedEdgeTypes: Array.isArray(handle.allowedEdgeTypes) ? [...handle.allowedEdgeTypes] : undefined,
        position: handle.position ? { ...handle.position } : undefined,
        metadata: handle.metadata ? { ...handle.metadata } : undefined
      }));
  }

  const legacyList = Array.isArray(node[kind]) ? node[kind] : [];
  return legacyList.map((handle, index) => {
    if (!handle) return null;
    if (typeof handle === 'string') {
      return {
        id: handle,
        label: handle,
        direction: kind === 'inputs' ? 'input' : 'output',
        dataType: 'value'
      };
    }
    if (typeof handle !== 'object') return null;
    const id = handle.id || handle.key || `${kind === 'inputs' ? 'in' : 'out'}-${index}`;
    return {
      id,
      label: handle.label || id,
      direction: kind === 'inputs' ? 'input' : 'output',
      dataType: handle.dataType || handle.type || 'value'
    };
  }).filter(Boolean);
};

const DEFAULT_HANDLE = (direction = 'output') => ({
  id: `handle_${Date.now()}`,
  label: direction === 'input' ? 'Input' : 'Output',
  direction,
  dataType: 'value'
});

const extractPluginMetaFromNode = (node) => {
  if (!node) return null;
  if (node.extensions?.plugin) {
    return {
      pluginId: node.extensions.plugin.id,
      pluginNodeType: node.extensions.plugin.nodeType
    };
  }
  if (typeof node.type === 'string' && node.type.includes(':')) {
    const [pluginId, pluginNodeType] = node.type.split(':');
    return { pluginId, pluginNodeType };
  }
  return null;
};

export default function ConsolidatedPropertiesPanel({ 
  selectedNode,
  selectedEdge,
  selectedGroup,
  nodes = [],
  edges = [],
  edgeTypes = {},
  nodeTypes = {},
  onUpdateNode,
  onUpdateEdge,
  onUpdateGroup,
  onUngroupGroup,
  onAddNodes,
  onRemoveNodes,
  onClose, 
  theme,
  anchor = 'right',
  onAnchorChange,
  defaultNodeColor = '#1976d2',
  defaultEdgeColor = '#666666',
  lockedNodes = new Set(),
  lockedEdges = new Set(),
  lockedGroups = new Set(),
  onToggleNodeLock,
  onToggleEdgeLock,
  onToggleGroupLock,
  isMobile = false,
  memoAutoExpandToken = 0
}) {
  const [currentAnchor, setCurrentAnchor] = useState(anchor);
  const [width, setWidth] = useState(400);
  const [isOpen, setIsOpen] = useState(true);
  
  // Shared states
  const [label, setLabel] = useState('');
  
  // Node-specific states
  const [memo, setMemo] = useState('');
  const memoRef = useRef('');
  const [memoView, setMemoView] = useState('edit');
  const [memoExpanded, setMemoExpanded] = useState(false);
  const [memoDirty, setMemoDirty] = useState(false);
  const [nodeColor, setNodeColor] = useState(defaultNodeColor);
  const [nodeGradientEnabled, setNodeGradientEnabled] = useState(false);
  const [nodeGradientStart, setNodeGradientStart] = useState('#2196f3');
  const [nodeGradientEnd, setNodeGradientEnd] = useState('#1976d2');
  const [nodeGradientDirection, setNodeGradientDirection] = useState('135deg');
  const [nodeType, setNodeType] = useState('');
  const [nodePosition, setNodePosition] = useState({ x: 0, y: 0 });
  const [nodeSize, setNodeSize] = useState({ width: 200, height: 120 });
  const [nodeHandles, setNodeHandles] = useState([]);
  const [nodeStateFields, setNodeStateFields] = useState({ locked: false, collapsed: false, hidden: false });
  const [nodeTypeOptions, setNodeTypeOptions] = useState(() => getNodeTypeList());
  const [pluginDefinition, setPluginDefinition] = useState(null);
  const [pluginFormState, setPluginFormState] = useState({});
  const nodeTypeMap = useMemo(() => {
    const map = {};
    nodeTypeOptions.forEach(entry => {
      map[entry.type] = entry;
    });
    return map;
  }, [nodeTypeOptions]);
  const connectedEdges = useMemo(() => {
    if (!selectedNode || !Array.isArray(edges)) return [];
    return edges.filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id);
  }, [edges, selectedNode]);
  const isMarkdownNode = selectedNode?.type === 'markdown';
  
  // Edge-specific states
  const [edgeType, setEdgeType] = useState('');
  const [lineWidth, setLineWidth] = useState(2);
  const [curved, setCurved] = useState(false);
  const [edgeColor, setEdgeColor] = useState(defaultEdgeColor);
  const [opacity, setOpacity] = useState(1);
  const [dashPattern, setDashPattern] = useState('solid');
  const [showArrow, setShowArrow] = useState(true);
  const [arrowPosition, setArrowPosition] = useState('end');
  const [arrowSize, setArrowSize] = useState(8);
  const [animation, setAnimation] = useState('none');
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [gradientEnabled, setGradientEnabled] = useState(false);
  const [gradientStart, setGradientStart] = useState('#2196f3');
  const [gradientEnd, setGradientEnd] = useState('#03a9f4');
  const [curveDirection, setCurveDirection] = useState('auto');
  const [edgeStateFields, setEdgeStateFields] = useState({ enabled: true, locked: false });
  const [edgeLogicFields, setEdgeLogicFields] = useState({
    condition: '',
    transform: '',
    delayMs: '',
    throttleMs: ''
  });
  
  // Group-specific states
  const [backgroundColor, setBackgroundColor] = useState('rgba(25, 118, 210, 0.1)');
  const [borderColor, setBorderColor] = useState('#1976d2');
  const [borderWidth, setBorderWidth] = useState(2);
  const [visible, setVisible] = useState(true);

  // Advanced JSON editor state
  const [nodeJson, setNodeJson] = useState('');
  const [nodeJsonError, setNodeJsonError] = useState('');
  const [edgeJson, setEdgeJson] = useState('');
  const [edgeJsonError, setEdgeJsonError] = useState('');
  
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const memoInputRef = useRef();
  const memoPreviewRef = useRef(null);
  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const DEBOUNCE_MS = 400;
  const panelTitleId = useId();
  const descriptionId = useId();
  const headerRef = useRef(null);
  const prevEntityIdRef = useRef(null);

  const dashPatterns = {
    solid: [],
    dashed: [8, 4],
    dotted: [2, 4],
    dashDot: [8, 4, 2, 4],
    longDash: [16, 8]
  };

  // Determine what's selected
  const entityType = selectedNode ? 'node' : selectedEdge ? 'edge' : selectedGroup ? 'group' : null;
  const entityId = selectedNode?.id || selectedEdge?.id || selectedGroup?.id;
  const isLocked = entityType === 'node' ? lockedNodes.has(entityId) :
                   entityType === 'edge' ? lockedEdges.has(entityId) :
                   entityType === 'group' ? lockedGroups.has(entityId) : false;
  const selectedNodePluginMeta = useMemo(() => extractPluginMetaFromNode(selectedNode), [selectedNode]);
  const isPluginNode = Boolean(selectedNodePluginMeta?.pluginId && selectedNodePluginMeta?.pluginNodeType);

  useEffect(() => {
    if (!selectedNodePluginMeta?.pluginId || !selectedNodePluginMeta?.pluginNodeType) {
      setPluginDefinition(null);
      setPluginFormState({});
      return;
    }
    const nextDefinition = getPluginNodeDefinition(
      selectedNodePluginMeta.pluginId,
      selectedNodePluginMeta.pluginNodeType
    );
    setPluginDefinition(nextDefinition || null);
    if (!nextDefinition || !Array.isArray(nextDefinition.properties) || !selectedNode) {
      setPluginFormState({});
      return;
    }
    const nextState = nextDefinition.properties.reduce((acc, field) => {
      if (!field?.key) return acc;
      const currentValue = selectedNode.data?.[field.key];
      if (currentValue !== undefined) {
        acc[field.key] = currentValue;
      } else if (field.defaultValue !== undefined) {
        acc[field.key] = field.defaultValue;
      } else if (field.type === 'toggle') {
        acc[field.key] = false;
      } else if (field.type === 'number') {
        acc[field.key] = 0;
      } else {
        acc[field.key] = '';
      }
      return acc;
    }, {});
    setPluginFormState(nextState);
  }, [selectedNode, selectedNodePluginMeta]);

  useEffect(() => {
    const handleRegistryUpdate = () => {
      setNodeTypeOptions(getNodeTypeList());
      if (selectedNodePluginMeta?.pluginId && selectedNodePluginMeta?.pluginNodeType) {
        setPluginDefinition(
          getPluginNodeDefinition(selectedNodePluginMeta.pluginId, selectedNodePluginMeta.pluginNodeType)
        );
      }
    };
    const unsubscribe = subscribeToPluginRegistry(handleRegistryUpdate);
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [selectedNodePluginMeta]);

  useEffect(() => {
    setCurrentAnchor(anchor);
  }, [anchor]);

  useEffect(() => {
    if (memoAutoExpandToken > 0) {
      setMemoExpanded(true);
    }
  }, [memoAutoExpandToken]);

  useEffect(() => {
    if (memoExpanded && memoView === 'edit' && memoInputRef.current) {
      try {
        memoInputRef.current.focus();
        memoInputRef.current.scrollTop = 0;
      } catch (err) {
        /* ignore focus errors */
      }
    }
    if (memoExpanded && memoView === 'preview' && memoPreviewRef.current) {
      memoPreviewRef.current.scrollTop = 0;
    }
  }, [memoExpanded, memoView]);

  const toggleAnchor = () => {
    const newAnchor = currentAnchor === 'right' ? 'left' : 'right';
    setCurrentAnchor(newAnchor);
    if (typeof window !== 'undefined') {
      localStorage.setItem('propertiesPanelAnchor', newAnchor);
    }
    if (onAnchorChange) onAnchorChange(newAnchor);
  };

  // Update states based on selected entity
  useEffect(() => {
    const isNewSelection = entityId !== prevEntityIdRef.current;
    if (isNewSelection) {
      prevEntityIdRef.current = entityId;
      setMemoDirty(false);
    }
    if (selectedNode) {
      setLabel(selectedNode.label || '');
      const initialMemo = selectedNode.type === 'markdown'
        ? (selectedNode.data?.markdown ?? selectedNode.data?.memo ?? '')
        : (selectedNode.data?.memo || '');
      if ((isNewSelection || !memoDirty) && initialMemo !== memoRef.current) {
        setMemo(initialMemo);
        memoRef.current = initialMemo;
      }
      
      // Check if node color is a gradient
      const currentColor = selectedNode.color || defaultNodeColor;
      const isGradient = currentColor.includes('gradient');
      setNodeGradientEnabled(isGradient);
      
      if (isGradient) {
        // Parse gradient string to extract colors and direction
        // Format: linear-gradient(135deg, #2196f3, #1976d2)
        const dirMatch = currentColor.match(/linear-gradient\(([^,]+),/);
        const colorMatches = currentColor.match(/#[0-9a-fA-F]{6}/g);
        
        if (dirMatch) setNodeGradientDirection(dirMatch[1].trim());
        if (colorMatches && colorMatches.length >= 2) {
          setNodeGradientStart(colorMatches[0]);
          setNodeGradientEnd(colorMatches[1]);
        }
      } else {
        setNodeColor(currentColor);
      }
      
      setNodeType(selectedNode.type || 'default');
      setNodePosition(selectedNode.position || { x: 0, y: 0 });
      setNodeSize({ width: selectedNode.width || 200, height: selectedNode.height || 120 });
      const derivedInputHandles = deriveHandlesFromNode(selectedNode, 'inputs');
      const derivedOutputHandles = deriveHandlesFromNode(selectedNode, 'outputs');
      const unifiedHandles =
        Array.isArray(selectedNode.handles) && selectedNode.handles.length > 0
          ? selectedNode.handles
          : [...derivedInputHandles, ...derivedOutputHandles];
      setNodeHandles(unifiedHandles);
      setNodeStateFields({
        locked: selectedNode.state?.locked ?? false,
        collapsed: selectedNode.state?.collapsed ?? false,
        hidden: selectedNode.state?.hidden ?? false
      });
    } else if (selectedEdge) {
      const edge = selectedEdge;
      const typeDef = edgeTypes[edge.type] || {};
      const styleDef = typeDef.style || {};
      
      setEdgeType(edge.type || 'child');
      setLabel(edge.label || '');
      setLineWidth(edge.style?.width ?? styleDef.width ?? 2);
      setCurved(edge.style?.curved ?? styleDef.curved ?? false);
      setEdgeColor(edge.color || edge.style?.color || defaultEdgeColor);
      setOpacity(edge.style?.opacity ?? styleDef.opacity ?? 1);
      setShowArrow(edge.style?.showArrow ?? styleDef.showArrow ?? true);
      setArrowPosition(edge.style?.arrowPosition ?? styleDef.arrowPosition ?? 'end');
      setArrowSize(edge.style?.arrowSize ?? styleDef.arrowSize ?? 8);
      setAnimation(edge.style?.animation ?? styleDef.animation ?? 'none');
      setAnimationSpeed(edge.style?.animationSpeed ?? styleDef.animationSpeed ?? 1);
      setCurveDirection(edge.style?.curveDirection ?? styleDef.curveDirection ?? 'auto');
      
      const dash = edge.style?.dash ?? styleDef.dash ?? [];
      const patternName = Object.keys(dashPatterns).find(
        key => JSON.stringify(dashPatterns[key]) === JSON.stringify(dash)
      ) || 'solid';
      setDashPattern(patternName);
      
      const hasGradient = edge.style?.gradient || styleDef.gradient;
      setGradientEnabled(!!hasGradient);
      if (hasGradient) {
        setGradientStart(hasGradient.start || '#2196f3');
        setGradientEnd(hasGradient.end || '#03a9f4');
      }
      setEdgeStateFields({
        enabled: edge.state?.enabled !== false,
        locked: !!edge.state?.locked
      });
      setEdgeLogicFields({
        condition: edge.logic?.condition || '',
        transform: edge.logic?.transform || '',
        delayMs: typeof edge.logic?.delayMs === 'number' ? String(edge.logic.delayMs) : '',
        throttleMs: typeof edge.logic?.throttleMs === 'number' ? String(edge.logic.throttleMs) : ''
      });
    } else if (selectedGroup) {
      setLabel(selectedGroup.label || '');
      setBackgroundColor(selectedGroup.style?.backgroundColor || 'rgba(25, 118, 210, 0.1)');
      setBorderColor(selectedGroup.style?.borderColor || '#1976d2');
      setBorderWidth(selectedGroup.style?.borderWidth || 2);
      setVisible(selectedGroup.visible !== false);
    } else {
      setMemo('');
      memoRef.current = '';
      setMemoDirty(false);
      setNodeHandles([]);
      setNodeStateFields({ locked: false, collapsed: false, hidden: false });
      setEdgeStateFields({ enabled: true, locked: false });
      setEdgeLogicFields({ condition: '', transform: '', delayMs: '', throttleMs: '' });
    }
  }, [entityId, defaultNodeColor, defaultEdgeColor, selectedNode, selectedEdge, selectedGroup, memoDirty]);

  useEffect(() => {
    if (selectedNode) {
      try {
        setNodeJson(JSON.stringify(selectedNode, null, 2));
        setNodeJsonError('');
      } catch (error) {
        setNodeJson('');
        setNodeJsonError('Unable to serialize node');
      }
    } else {
      setNodeJson('');
      setNodeJsonError('');
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedEdge) {
      try {
        setEdgeJson(JSON.stringify(selectedEdge, null, 2));
        setEdgeJsonError('');
      } catch (error) {
        setEdgeJson('');
        setEdgeJsonError('Unable to serialize edge');
      }
    } else {
      setEdgeJson('');
      setEdgeJsonError('');
    }
  }, [selectedEdge]);

  // Handlers
  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    if (entityType === 'node' && onUpdateNode) {
      onUpdateNode(entityId, { label: newLabel }, true);
    } else if (entityType === 'edge' && onUpdateEdge) {
      onUpdateEdge(entityId, { label: newLabel });
    } else if (entityType === 'group' && onUpdateGroup) {
      scheduleGroupUpdate({ label: newLabel });
    }
  };

  const handleMemoChange = (e) => {
    const newMemo = e.target.value;
    memoRef.current = newMemo;
    if (!memoDirty) setMemoDirty(true);
  };

  const handleMemoBlur = () => {
    if (!onUpdateNode || !entityId || isLocked) return;
    const dataPayload = isMarkdownNode
      ? { markdown: memoRef.current }
      : { memo: memoRef.current };
    onUpdateNode(entityId, { data: dataPayload }, true);
    setMemo(memoRef.current);
    setMemoDirty(false);
  };

  const handleNodeColorChange = (color) => {
    setNodeColor(color);
    if (onUpdateNode) onUpdateNode(entityId, { color });
  };

  const handlePluginFieldChange = (field, nextValue) => {
    if (!selectedNode || !onUpdateNode || isLocked || !field?.key) return;
    setPluginFormState(prev => ({ ...prev, [field.key]: nextValue }));
    onUpdateNode(selectedNode.id, { data: { [field.key]: nextValue } }, true);
  };

  const handleEdgeStyleUpdate = (updates) => {
    if (!entityId || isLocked) return;
    const currentStyle = selectedEdge?.style || {};
    onUpdateEdge(entityId, {
      style: { ...currentStyle, ...updates }
    });
  };

  const handleHandlesChange = (nextHandles) => {
    setNodeHandles(nextHandles);
    if (onUpdateNode) {
      onUpdateNode(entityId, { handles: nextHandles });
    }
  };

  const renderPluginFieldControl = (field) => {
    if (!field?.key) return null;
    const currentValue = pluginFormState[field.key];
    const helperText = field.helperText || '';
    const placeholder = field.placeholder || '';
    const commonProps = {
      fullWidth: true,
      disabled: isLocked,
      label: field.label || field.key,
      required: Boolean(field.required),
      value:
        currentValue !== undefined
          ? currentValue
          : field.defaultValue !== undefined
          ? field.defaultValue
          : field.type === 'toggle'
          ? false
          : '',
      onChange: (event) => handlePluginFieldChange(field, event.target.value),
      helperText
    };

    if (field.type === 'textarea' || field.type === 'json') {
      return (
        <TextField
          key={field.key}
          {...commonProps}
          multiline
          minRows={field.type === 'json' ? 4 : 3}
          placeholder={placeholder}
        />
      );
    }

    if (field.type === 'number') {
      return (
        <TextField
          key={field.key}
          {...commonProps}
          type="number"
          placeholder={placeholder}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              handlePluginFieldChange(field, '');
              return;
            }
            const numericValue = Number(raw);
            handlePluginFieldChange(field, Number.isNaN(numericValue) ? '' : numericValue);
          }}
          inputProps={{
            min: field.min,
            max: field.max,
            step: field.step
          }}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <FormControl key={field.key} fullWidth size="small" disabled={isLocked}>
          <InputLabel>{field.label || field.key}</InputLabel>
          <Select
            value={currentValue ?? field.defaultValue ?? ''}
            label={field.label || field.key}
            onChange={(event) => handlePluginFieldChange(field, event.target.value)}
          >
            {(field.options || []).map((option) => (
              <MenuItem key={`${field.key}-${option.value}`} value={option.value}>
                {option.label || String(option.value)}
              </MenuItem>
            ))}
          </Select>
          {helperText && (
            <Typography variant="caption" color="text.secondary">
              {helperText}
            </Typography>
          )}
        </FormControl>
      );
    }

    if (field.type === 'toggle') {
      return (
        <Box key={field.key} sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(currentValue ?? field.defaultValue ?? false)}
                onChange={(event) => handlePluginFieldChange(field, event.target.checked)}
                disabled={isLocked}
              />
            }
            label={field.label || field.key}
          />
          {helperText && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              {helperText}
            </Typography>
          )}
        </Box>
      );
    }

    if (field.type === 'color') {
      return (
        <TextField
          key={field.key}
          {...commonProps}
          type="color"
          inputProps={{ style: { padding: 0, height: 36 } }}
        />
      );
    }

    return (
      <TextField
        key={field.key}
        {...commonProps}
        placeholder={placeholder}
      />
    );
  };

  const handleNodeStateChange = (field, value) => {
    const next = { ...nodeStateFields, [field]: value };
    setNodeStateFields(next);
    if (onUpdateNode) {
      onUpdateNode(entityId, { state: next });
    }
  };

  const handleEdgeStateChange = (field, value) => {
    const next = { ...edgeStateFields, [field]: value };
    setEdgeStateFields(next);
    if (onUpdateEdge) {
      onUpdateEdge(entityId, { state: next });
    }
  };

  const handleEdgeLogicChange = (field, value) => {
    const next = { ...edgeLogicFields, [field]: value };
    setEdgeLogicFields(next);
    if (onUpdateEdge) {
      const transformed = {
        ...next,
        delayMs: next.delayMs === '' ? undefined : Number(next.delayMs) || 0,
        throttleMs: next.throttleMs === '' ? undefined : Number(next.throttleMs) || 0
      };
      onUpdateEdge(entityId, { logic: transformed });
    }
  };

  const handleApplyNodeJson = () => {
    if (!selectedNode || !onUpdateNode || isLocked) return;
    try {
      const parsed = JSON.parse(nodeJson);
      if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
        throw new Error('Node JSON must be an object');
      }
      if (parsed.id && parsed.id !== selectedNode.id) {
        throw new Error('Node ID cannot be changed here');
      }
      const updates = buildUpdatesFromDiff(selectedNode, parsed);
      if (Object.keys(updates).length === 0) {
        setNodeJsonError('No changes detected');
        return;
      }
      onUpdateNode(selectedNode.id, updates);
      setNodeJsonError('');
    } catch (error) {
      setNodeJsonError(error.message);
    }
  };

  const handleApplyEdgeJson = () => {
    if (!selectedEdge || !onUpdateEdge || isLocked) return;
    try {
      const parsed = JSON.parse(edgeJson);
      if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
        throw new Error('Edge JSON must be an object');
      }
      if (parsed.id && parsed.id !== selectedEdge.id) {
        throw new Error('Edge ID cannot be changed here');
      }
      const updates = buildUpdatesFromDiff(selectedEdge, parsed);
      if (Object.keys(updates).length === 0) {
        setEdgeJsonError('No changes detected');
        return;
      }
      onUpdateEdge(selectedEdge.id, updates);
      setEdgeJsonError('');
    } catch (error) {
      setEdgeJsonError(error.message);
    }
  };

  const scheduleGroupUpdate = (fields) => {
    pendingRef.current = { ...pendingRef.current, ...fields };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload = { ...pendingRef.current };
      pendingRef.current = {};
      timerRef.current = null;
      if (selectedGroup) onUpdateGroup(selectedGroup.id, payload);
    }, DEBOUNCE_MS);
  };

  const handleToggleLock = () => {
    if (entityType === 'node' && onToggleNodeLock) onToggleNodeLock(entityId);
    else if (entityType === 'edge' && onToggleEdgeLock) onToggleEdgeLock(entityId);
    else if (entityType === 'group' && onToggleGroupLock) onToggleGroupLock(entityId);
  };

  // Resize handlers
  const onResizeMouseDown = (e) => {
    resizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', onResizeMouseUp);
  };

  const onResizeMouseMove = (e) => {
    if (!resizing.current) return;
    let delta = currentAnchor === 'right' ? startX.current - e.clientX : e.clientX - startX.current;
    let newWidth = Math.max(240, Math.min(startWidth.current + delta, 700));
    setWidth(newWidth);
  };

  const onResizeMouseUp = () => {
    resizing.current = false;
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', onResizeMouseUp);
  };

  useEffect(() => {
    if (entityType) setIsOpen(true);
    if (entityType && headerRef.current) {
      // Move focus to panel heading when newly opened for screen reader context
      headerRef.current.focus({ preventScroll: true });
    }
  }, [entityType]);

  const handlePanelClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!entityType) return null;

  const panelTitle = entityType === 'node' ? 'Node Properties' :
                     entityType === 'edge' ? 'Edge Properties' :
                     'Group Properties';

  const panelHeader = (
    <Box sx={{ 
      p: 2, 
      pb: isMobile ? 1.5 : 2,
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      backgroundColor: isMobile ? theme?.palette?.background?.paper : (theme?.palette?.primary?.main || '#1976d2'),
      color: isMobile ? theme?.palette?.text?.primary : (theme?.palette?.primary?.contrastText || '#fff'),
    }}>
      <Typography
        variant="h6"
        id={panelTitleId}
        sx={{ fontSize: 16, fontWeight: 600 }}
        tabIndex={-1}
        ref={headerRef}
      >
        {panelTitle}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {!isMobile && (
          <IconButton
            onClick={toggleAnchor}
            size="small"
            sx={{ color: 'inherit' }}
            aria-label={currentAnchor === 'right' ? 'Dock properties panel to left side' : 'Dock properties panel to right side'}
          >
            {currentAnchor === 'right' ? <ArrowBackIcon /> : <ArrowForwardIcon />}
          </IconButton>
        )}
        <IconButton
          onClick={handleToggleLock}
          title={isLocked ? `Unlock ${entityType}` : `Lock ${entityType}`}
          size="small"
          sx={{ color: 'inherit' }}
          aria-pressed={isLocked}
          aria-label={isLocked ? `Unlock selected ${entityType}` : `Lock selected ${entityType}`}
        >
          {isLocked ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
        <IconButton 
          size="small" 
          onClick={handlePanelClose}
          sx={{ color: 'inherit' }}
          aria-label="Close properties panel"
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  );

  const panelContent = (
      <Box sx={{ p: 2, pt: isMobile ? 1 : 2, overflowY: 'auto', flexGrow: 1, maxHeight: isMobile ? '65vh' : 'auto' }}>
        <Typography
          id={descriptionId}
          component="p"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Use tab or shift plus tab to move between properties. Escape closes the panel.
        </Typography>

        {/* Entity ID */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          ID: {entityId}
        </Typography>

        {/* Label (common to all) */}
        <TextField
          fullWidth
          label="Label"
          value={label}
          onChange={handleLabelChange}
          variant="filled"
          size="small"
          disabled={isLocked}
          sx={{ mb: 2, backgroundColor: theme?.palette?.background?.paper }}
        />

        {/* NODE-SPECIFIC CONTENT */}
        {entityType === 'node' && (
          <>
            {/* Node Type */}
            <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
              <InputLabel>Node Type</InputLabel>
              <Select
                value={nodeTypeMap[nodeType] ? nodeType : ''}
                onChange={(e) => {
                  setNodeType(e.target.value);
                  if (onUpdateNode) onUpdateNode(entityId, { type: e.target.value });
                }}
                label="Node Type"
              >
                {nodeTypeOptions.map(({ type, label: optionLabel, description }) => (
                  <MenuItem key={type} value={type}>
                    <Tooltip title={description || ''}>
                      <span>{optionLabel || type}</span>
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">
                  Connected Edges ({connectedEdges.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense sx={{ py: 0 }}>
                  {connectedEdges.length === 0 ? (
                    <ListItem dense>
                      <ListItemText primary="No connected edges" secondary="Drag parts to wire them up" />
                    </ListItem>
                  ) : (
                    connectedEdges.map(edge => (
                      <ListItem key={edge.id} dense>
                        <ListItemText
                          primary={`${edge.sourceHandle || 'out'} → ${edge.targetHandle || 'in'}`}
                          secondary={`${edge.id}: ${edge.source} → ${edge.target}`}
                        />
                        <Chip label={edge.type || 'edge'} size="small" variant="outlined" sx={{ ml: 1 }} />
                      </ListItem>
                    ))
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
            {/* Memo */}
            <Accordion
              expanded={memoExpanded}
              onChange={(_, expanded) => setMemoExpanded(expanded)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">
                  {isMarkdownNode ? 'Markdown Content' : 'Memo (Markdown)'}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                  <ToggleButtonGroup
                    value={memoView}
                    exclusive
                    onChange={(e, newView) => newView && setMemoView(newView)}
                    size="small"
                    >
                    <ToggleButton value="edit" aria-label="Edit memo content">
                      <EditIcon sx={{ fontSize: 16 }} />
                    </ToggleButton>
                    <ToggleButton value="preview" aria-label="Preview memo content">
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                {memoView === 'edit' ? (
                  <TextField
                    key={entityId || 'memo-input'}
                    inputRef={memoInputRef}
                    multiline
                    rows={8}
                    defaultValue={memo}
                    onChange={handleMemoChange}
                    onBlur={handleMemoBlur}
                    fullWidth
                    variant="filled"
                    disabled={isLocked}
                    sx={{ backgroundColor: theme?.palette?.background?.paper }}
                  />
                ) : (
                  <Box
                    ref={memoPreviewRef}
                    sx={{ 
                    p: 2, 
                    backgroundColor: theme?.palette?.background?.paper, 
                    borderRadius: 1,
                    minHeight: 200,
                    maxHeight: 400,
                    overflowY: 'auto'
                  }}>
                    {memo ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {memo}
                      </ReactMarkdown>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No content to preview
                      </Typography>
                    )}
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }} role="status">
                  {memo.length} characters
                </Typography>
              </AccordionDetails>
            </Accordion>
            
            {/* Color */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Color & Gradient</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={
                    <Switch
                      checked={nodeGradientEnabled}
                      onChange={(e) => {
                        setNodeGradientEnabled(e.target.checked);
                        if (e.target.checked) {
                          const gradientColor = `linear-gradient(${nodeGradientDirection}, ${nodeGradientStart}, ${nodeGradientEnd})`;
                          if (onUpdateNode) onUpdateNode(entityId, { color: gradientColor });
                        } else {
                          if (onUpdateNode) onUpdateNode(entityId, { color: nodeColor });
                        }
                      }}
                      disabled={isLocked}
                    />
                  }
                  label="Use Gradient"
                  sx={{ mb: 2 }}
                />

                {nodeGradientEnabled ? (
                  <Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Gradient Direction
                      </Typography>
                      <FormControl fullWidth size="small" disabled={isLocked}>
                        <Select
                          value={nodeGradientDirection}
                          onChange={(e) => {
                            setNodeGradientDirection(e.target.value);
                            const gradientColor = `linear-gradient(${e.target.value}, ${nodeGradientStart}, ${nodeGradientEnd})`;
                            if (onUpdateNode) onUpdateNode(entityId, { color: gradientColor });
                          }}
                        >
                          <MenuItem value="135deg">Diagonal ↘</MenuItem>
                          <MenuItem value="90deg">Vertical ↓</MenuItem>
                          <MenuItem value="180deg">Horizontal →</MenuItem>
                          <MenuItem value="45deg">Diagonal ↗</MenuItem>
                          <MenuItem value="225deg">Diagonal ↙</MenuItem>
                          <MenuItem value="315deg">Diagonal ↖</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Gradient Start
                      </Typography>
                      <TextField
                        fullWidth
                        type="color"
                        value={nodeGradientStart}
                        onChange={(e) => {
                          setNodeGradientStart(e.target.value);
                          const gradientColor = `linear-gradient(${nodeGradientDirection}, ${e.target.value}, ${nodeGradientEnd})`;
                          if (onUpdateNode) onUpdateNode(entityId, { color: gradientColor });
                        }}
                        disabled={isLocked}
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Gradient End
                      </Typography>
                      <TextField
                        fullWidth
                        type="color"
                        value={nodeGradientEnd}
                        onChange={(e) => {
                          setNodeGradientEnd(e.target.value);
                          const gradientColor = `linear-gradient(${nodeGradientDirection}, ${nodeGradientStart}, ${e.target.value})`;
                          if (onUpdateNode) onUpdateNode(entityId, { color: gradientColor });
                        }}
                        disabled={isLocked}
                        size="small"
                      />
                    </Box>
                  </Box>
                ) : (
                  <TextField
                    fullWidth
                    type="color"
                    value={nodeColor}
                    onChange={(e) => handleNodeColorChange(e.target.value)}
                    disabled={isLocked}
                    size="small"
                    label="Node Color"
                  />
                )}
                </AccordionDetails>
              </Accordion>

            {isPluginNode && pluginDefinition?.properties?.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Plugin Fields</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {pluginDefinition.properties.map((field) => (
                      <React.Fragment key={field.key}>{renderPluginFieldControl(field)}</React.Fragment>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Position */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Position & Size</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    label="X"
                    type="number"
                    value={nodePosition.x}
                    onChange={(e) => {
                      const newPos = { ...nodePosition, x: parseFloat(e.target.value) || 0 };
                      setNodePosition(newPos);
                      onUpdateNode(entityId, { position: newPos });
                    }}
                    size="small"
                    disabled={isLocked}
                    fullWidth
                  />
                  <TextField
                    label="Y"
                    type="number"
                    value={nodePosition.y}
                    onChange={(e) => {
                      const newPos = { ...nodePosition, y: parseFloat(e.target.value) || 0 };
                      setNodePosition(newPos);
                      onUpdateNode(entityId, { position: newPos });
                    }}
                    size="small"
                    disabled={isLocked}
                    fullWidth
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Width"
                    type="number"
                    value={nodeSize.width}
                    onChange={(e) => {
                      const newSize = { ...nodeSize, width: parseFloat(e.target.value) || 200 };
                      setNodeSize(newSize);
                      onUpdateNode(entityId, { width: newSize.width });
                    }}
                    size="small"
                    disabled={isLocked}
                    fullWidth
                  />
                  <TextField
                    label="Height"
                    type="number"
                    value={nodeSize.height}
                    onChange={(e) => {
                      const newSize = { ...nodeSize, height: parseFloat(e.target.value) || 120 };
                      setNodeSize(newSize);
                      onUpdateNode(entityId, { height: newSize.height });
                    }}
                    size="small"
                    disabled={isLocked}
                    fullWidth
                  />
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion defaultExpanded sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">All Node Properties (JSON)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Edit every field on this node via JSON. Invalid JSON will be rejected.
                </Typography>
                <TextField
                  multiline
                  minRows={10}
                  value={nodeJson}
                  onChange={(e) => {
                    setNodeJson(e.target.value);
                    setNodeJsonError('');
                  }}
                  fullWidth
                  size="small"
                  disabled={isLocked}
                  error={Boolean(nodeJsonError)}
                  helperText={nodeJsonError || 'Changes apply to the selected node.'}
                  sx={{ mb: 1.5, fontFamily: 'monospace', backgroundColor: theme?.palette?.background?.paper }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleApplyNodeJson}
                  disabled={isLocked || !nodeJson.trim()}
                >
                  Apply Node JSON
                </Button>
              </AccordionDetails>
            </Accordion>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Handles</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  {nodeHandles.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No handles defined for this node.
                    </Typography>
                  )}
                  {nodeHandles.map((handle, index) => (
                    <Box
                      key={handle.id || index}
                      sx={{
                        border: `1px solid ${theme?.palette?.divider}`,
                        borderRadius: 1,
                        p: 1.5
                      }}
                    >
                      <Stack spacing={1}>
                        <TextField
                          label="ID"
                          size="small"
                          value={handle.id}
                          disabled={isLocked}
                          onChange={(e) => {
                            const next = [...nodeHandles];
                            next[index] = { ...next[index], id: e.target.value };
                            handleHandlesChange(next);
                          }}
                        />
                        <TextField
                          label="Label"
                          size="small"
                          value={handle.label || ''}
                          disabled={isLocked}
                          onChange={(e) => {
                            const next = [...nodeHandles];
                            next[index] = { ...next[index], label: e.target.value };
                            handleHandlesChange(next);
                          }}
                        />
                        <FormControl fullWidth size="small" disabled={isLocked}>
                          <InputLabel>Direction</InputLabel>
                          <Select
                            label="Direction"
                            value={handle.direction || 'output'}
                            onChange={(e) => {
                              const next = [...nodeHandles];
                              next[index] = { ...next[index], direction: e.target.value };
                              handleHandlesChange(next);
                            }}
                          >
                            <MenuItem value="input">Input</MenuItem>
                            <MenuItem value="output">Output</MenuItem>
                            <MenuItem value="bidirectional">Bidirectional</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Data Type"
                          size="small"
                          value={handle.dataType || ''}
                          disabled={isLocked}
                          onChange={(e) => {
                            const next = [...nodeHandles];
                            next[index] = { ...next[index], dataType: e.target.value };
                            handleHandlesChange(next);
                          }}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              const next = nodeHandles.filter((_, i) => i !== index);
                              handleHandlesChange(next);
                            }}
                            disabled={isLocked}
                          >
                            Remove
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      disabled={isLocked}
                      onClick={() => handleHandlesChange([...nodeHandles, DEFAULT_HANDLE('input')])}
                    >
                      Add Input
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      disabled={isLocked}
                      onClick={() => handleHandlesChange([...nodeHandles, DEFAULT_HANDLE('output')])}
                    >
                      Add Output
                    </Button>
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">State</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={
                    <Switch
                      checked={nodeStateFields.locked}
                      disabled={isLocked}
                      onChange={(e) => handleNodeStateChange('locked', e.target.checked)}
                    />
                  }
                  label="Locked"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={nodeStateFields.collapsed}
                      disabled={isLocked}
                      onChange={(e) => handleNodeStateChange('collapsed', e.target.checked)}
                    />
                  }
                  label="Collapsed"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={nodeStateFields.hidden}
                      disabled={isLocked}
                      onChange={(e) => handleNodeStateChange('hidden', e.target.checked)}
                    />
                  }
                  label="Hidden"
                />
              </AccordionDetails>
            </Accordion>


          </>
        )}

        {/* EDGE-SPECIFIC CONTENT */}
        {entityType === 'edge' && (
          <>
            {/* Connection Info */}
            <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'action.hover', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Connection
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {selectedEdge?.sourceNode?.label || selectedEdge?.source}
                  <br />
                  → {selectedEdge?.targetNode?.label || selectedEdge?.target}
                </Typography>
              </div>
              <Tooltip title="Reverse source/target">
                <span>
                  <IconButton
                    size="small"
                    disabled={isLocked}
                    onClick={() => {
                      if (onUpdateEdge && selectedEdge) {
                        onUpdateEdge(selectedEdge.id, {
                          source: selectedEdge.target,
                          target: selectedEdge.source
                        });
                      }
                    }}
                    sx={{ ml: 1 }}
                    aria-label="Swap edge source and target"
                  >
                    <ArrowForwardIcon sx={{ transform: 'rotate(180deg)' }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {/* Edge Type */}
            <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
              <InputLabel>Edge Type</InputLabel>
              <Select
                value={Object.keys(edgeTypesMap).includes(edgeType) ? edgeType : ''}
                onChange={(e) => {
                  setEdgeType(e.target.value);
                  onUpdateEdge(entityId, { type: e.target.value });
                }}
                label="Edge Type"
              >
                <MenuItem value="">None</MenuItem>
                {Object.entries(edgeTypesMap).map(([key, typeDef]) => (
                  <MenuItem key={key} value={key}>
                    <Tooltip title={typeDef.description || ''}>
                      <span>{typeDef.label || key}</span>
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Basic Style */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Basic Style</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Line Width: {lineWidth}px
                  </Typography>
                  <Slider
                    value={lineWidth}
                    onChange={(e, val) => {
                      setLineWidth(val);
                      handleEdgeStyleUpdate({ width: val });
                    }}
                    min={1}
                    max={10}
                    step={0.5}
                    disabled={isLocked}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Opacity: {Math.round(opacity * 100)}%
                  </Typography>
                  <Slider
                    value={opacity}
                    onChange={(e, val) => {
                      setOpacity(val);
                      handleEdgeStyleUpdate({ opacity: val });
                    }}
                    min={0}
                    max={1}
                    step={0.1}
                    disabled={isLocked}
                  />
                </Box>

                <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
                  <InputLabel>Line Style</InputLabel>
                  <Select
                    value={dashPattern}
                    onChange={(e) => {
                      setDashPattern(e.target.value);
                      handleEdgeStyleUpdate({ dash: dashPatterns[e.target.value] });
                    }}
                    label="Line Style"
                  >
                    <MenuItem value="solid">Solid</MenuItem>
                    <MenuItem value="dashed">Dashed</MenuItem>
                    <MenuItem value="dotted">Dotted</MenuItem>
                    <MenuItem value="dashDot">Dash-Dot</MenuItem>
                    <MenuItem value="longDash">Long Dash</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={curved}
                      onChange={(e) => {
                        setCurved(e.target.checked);
                        handleEdgeStyleUpdate({ curved: e.target.checked });
                      }}
                      disabled={isLocked}
                    />
                  }
                  label="Curved"
                />
              </AccordionDetails>
            </Accordion>

            {/* Color & Gradient */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Color & Gradient</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={
                    <Switch
                      checked={gradientEnabled}
                      onChange={(e) => {
                        setGradientEnabled(e.target.checked);
                        if (e.target.checked) {
                          handleEdgeStyleUpdate({ 
                            gradient: { start: gradientStart, end: gradientEnd },
                            color: null 
                          });
                        } else {
                          handleEdgeStyleUpdate({ gradient: null, color: edgeColor });
                        }
                      }}
                      disabled={isLocked}
                    />
                  }
                  label="Use Gradient"
                  sx={{ mb: 2 }}
                />

                {gradientEnabled ? (
                  <Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Gradient Start
                      </Typography>
                      <TextField
                        fullWidth
                        type="color"
                        value={gradientStart}
                        onChange={(e) => {
                          setGradientStart(e.target.value);
                          handleEdgeStyleUpdate({ 
                            gradient: { start: e.target.value, end: gradientEnd }
                          });
                        }}
                        disabled={isLocked}
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Gradient End
                      </Typography>
                      <TextField
                        fullWidth
                        type="color"
                        value={gradientEnd}
                        onChange={(e) => {
                          setGradientEnd(e.target.value);
                          handleEdgeStyleUpdate({ 
                            gradient: { start: gradientStart, end: e.target.value }
                          });
                        }}
                        disabled={isLocked}
                        size="small"
                      />
                    </Box>
                  </Box>
                ) : (
                  <TextField
                    fullWidth
                    type="color"
                    value={edgeColor}
                    onChange={(e) => {
                      setEdgeColor(e.target.value);
                      if (!isLocked) onUpdateEdge(entityId, { color: e.target.value });
                    }}
                    disabled={isLocked}
                    size="small"
                    label="Edge Color"
                  />
                )}
              </AccordionDetails>
            </Accordion>

            {/* Animation Accordion */}
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2">Animation</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
                          <InputLabel>Animation Type</InputLabel>
                          <Select
                            value={animation ?? 'none'}
                            onChange={(e) => {
                              const val = e.target.value === 'none' ? 'none' : e.target.value;
                              setAnimation(val);
                              // store null to clear animation style when 'none' is selected
                              handleEdgeStyleUpdate({ animation: val === 'none' ? null : val });
                            }}
                            label="Animation Type"
                          >
                            <MenuItem value="none">None</MenuItem>
                            <MenuItem value="flow">Flow (particles)</MenuItem>
                            <MenuItem value="pulse">Pulse</MenuItem>
                            <MenuItem value="dash">Animated Dash</MenuItem>
                          </Select>
                        </FormControl>
            
                        {animation && animation !== 'none' && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" gutterBottom>
                              Animation Speed: {animationSpeed.toFixed(1)}x
                            </Typography>
                            <Slider
                              value={animationSpeed}
                              onChange={(e, val) => {
                                setAnimationSpeed(val);
                                handleEdgeStyleUpdate({ animationSpeed: val });
                              }}
                              min={0.1}
                              max={3}
                              step={0.1}
                              disabled={isLocked}
                              valueLabelDisplay="auto"
                            />
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>

            <Accordion defaultExpanded sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="edge-json-editor">
                <Typography variant="subtitle2">All Edge Properties (JSON)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Review or edit the full edge object. Invalid JSON will be rejected.
                </Typography>
                <TextField
                  multiline
                  minRows={8}
                  value={edgeJson}
                  onChange={(e) => {
                    setEdgeJson(e.target.value);
                    setEdgeJsonError('');
                  }}
                  fullWidth
                  size="small"
                  disabled={isLocked}
                  error={Boolean(edgeJsonError)}
                  helperText={edgeJsonError || 'Changes apply to the selected edge.'}
                  sx={{ mb: 1.5, fontFamily: 'monospace', backgroundColor: theme?.palette?.background?.paper }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleApplyEdgeJson}
                  disabled={isLocked || !edgeJson.trim()}
                >
                  Apply Edge JSON
                </Button>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">State & Logic</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={
                    <Switch
                      checked={edgeStateFields.enabled}
                      onChange={(e) => handleEdgeStateChange('enabled', e.target.checked)}
                      disabled={isLocked}
                    />
                  }
                  label="Enabled"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={edgeStateFields.locked}
                      onChange={(e) => handleEdgeStateChange('locked', e.target.checked)}
                      disabled={isLocked}
                    />
                  }
                  label="Locked"
                />
                <TextField
                  label="Condition"
                  value={edgeLogicFields.condition}
                  onChange={(e) => handleEdgeLogicChange('condition', e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mt: 2 }}
                  disabled={isLocked}
                />
                <TextField
                  label="Transform"
                  value={edgeLogicFields.transform}
                  onChange={(e) => handleEdgeLogicChange('transform', e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mt: 2 }}
                  helperText="Expression executed when edge fires"
                  disabled={isLocked}
                />
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    label="Delay (ms)"
                    type="number"
                    value={edgeLogicFields.delayMs}
                    onChange={(e) => handleEdgeLogicChange('delayMs', e.target.value)}
                    size="small"
                    disabled={isLocked}
                  />
                  <TextField
                    label="Throttle (ms)"
                    type="number"
                    value={edgeLogicFields.throttleMs}
                    onChange={(e) => handleEdgeLogicChange('throttleMs', e.target.value)}
                    size="small"
                    disabled={isLocked}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </>
        )}

        {/* GROUP-SPECIFIC CONTENT */}
        {entityType === 'group' && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Contains {selectedGroup.nodeIds?.length || 0} nodes
            </Typography>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Style</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Background Color
                  </Typography>
                  <TextField
                    fullWidth
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => {
                      setBackgroundColor(e.target.value);
                      scheduleGroupUpdate({ style: { backgroundColor: e.target.value } });
                    }}
                    size="small"
                    disabled={isLocked}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Border Color
                  </Typography>
                  <TextField
                    fullWidth
                    type="color"
                    value={borderColor}
                    onChange={(e) => {
                      setBorderColor(e.target.value);
                      scheduleGroupUpdate({ style: { borderColor: e.target.value } });
                    }}
                    size="small"
                    disabled={isLocked}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Border Width: {borderWidth}px
                  </Typography>
                  <Slider
                    value={borderWidth}
                    onChange={(e, val) => {
                      setBorderWidth(val);
                      scheduleGroupUpdate({ style: { borderWidth: val } });
                    }}
                    min={1}
                    max={10}
                    step={1}
                    disabled={isLocked}
                  />
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={visible}
                      onChange={(e) => {
                        setVisible(e.target.checked);
                        scheduleGroupUpdate({ visible: e.target.checked });
                      }}
                      disabled={isLocked}
                    />
                  }
                  label="Visible"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedGroup.collapsed === true}
                      onChange={(e) => {
                        scheduleGroupUpdate({ collapsed: e.target.checked });
                      }}
                      disabled={isLocked}
                    />
                  }
                  label="Collapsed"
                />
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Nodes in Group</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {(selectedGroup.nodeIds || []).map((nodeId) => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (!node) return null;
                    return (
                      <ListItem key={nodeId}>
                        <ListItemText
                          primary={node.label || `Node ${nodeId.slice(0, 8)}`}
                          secondary={`ID: ${nodeId.slice(0, 8)}...`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => onRemoveNodes(selectedGroup.id, [nodeId])}
                            disabled={isLocked}
                            aria-label={`Remove ${node.label || nodeId} from group`}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              </AccordionDetails>
            </Accordion>

                    

            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={() => {
                if (onUngroupGroup) onUngroupGroup(selectedGroup.id);
                handlePanelClose();
              }}
              disabled={isLocked}
              sx={{ mt: 2 }}
            >
              Ungroup
            </Button>
          </>
        )}
      </Box>
  );

  if (isMobile) {
    return createPortal(
      <SwipeableDrawer
        anchor="bottom"
        open={Boolean(isOpen && entityType)}
        onClose={(_, reason) => {
          if (reason !== 'keydown') handlePanelClose();
        }}
        onOpen={() => setIsOpen(true)}
        disableDiscovery
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme?.palette?.background?.default
          },
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': panelTitleId,
          'aria-describedby': descriptionId
        }}
      >
        <Box sx={{ px: 1.5, pt: 1, pb: `calc(12px + env(safe-area-inset-bottom, 16px))`, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 999, backgroundColor: theme?.palette?.divider, mx: 'auto', mb: 1.5 }} />
          {panelHeader}
          <Divider />
          {panelContent}
        </Box>
      </SwipeableDrawer>,
      document.body
    );
  }

  return createPortal(
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 64,
        [currentAnchor === 'right' ? 'right' : 'left']: isOpen ? 0 : -width - 50,
        width: width,
        height: 'calc(100vh - 64px)',
        background: `linear-gradient(135deg, ${theme?.palette?.primary?.light} 0%, ${theme?.palette?.primary?.dark} 100%)`,
        borderLeft: currentAnchor === 'right' ? `1px solid ${theme?.palette?.divider}` : 'none',
        borderRight: currentAnchor === 'left' ? `1px solid ${theme?.palette?.divider}` : 'none',
        boxShadow: currentAnchor === 'right' ? '-2px 0 8px rgba(0,0,0,0.1)' : '2px 0 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1200,
        transition: 'right 0.3s ease, left 0.3s ease',
        overflow: 'hidden',
      }}
      role="complementary"
      aria-labelledby={panelTitleId}
      aria-describedby={descriptionId}
    >
      {/* Resize handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          [currentAnchor === 'right' ? 'left' : 'right']: -6,
          width: 12,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 2000,
          background: 'transparent',
        }}
        onMouseDown={onResizeMouseDown}
      >
        <div style={{
          width: 6,
          height: 48,
          borderRadius: 3,
          background: theme?.palette?.divider,
          opacity: 0.7,
          margin: 'auto',
          marginTop: 24,
        }} />
      </div>

      {panelHeader}

      <Divider />

      {panelContent}
    </Paper>,
    document.body
  );
}
