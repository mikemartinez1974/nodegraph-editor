"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  Paper, TextField, IconButton, Divider, FormControl, InputLabel, 
  Select, MenuItem, FormControlLabel, Switch, Slider, Typography, 
  Box, ToggleButton, ToggleButtonGroup, Accordion, AccordionSummary,
  AccordionDetails, List, ListItem, ListItemText, ListItemSecondaryAction,
  Button, Tooltip, Chip
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
import nodeTypeRegistry from '../nodeTypeRegistry'; // Adjust path as needed
import edgeTypesMap from '../edgeTypes'; // Correct import syntax

export default function ConsolidatedPropertiesPanel({ 
  selectedNode,
  selectedEdge,
  selectedGroup,
  nodes = [],
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
  isMobile = false
}) {
  const [currentAnchor, setCurrentAnchor] = useState(anchor);
  const [width, setWidth] = useState(400);
  const [isOpen, setIsOpen] = useState(true);
  
  // Shared states
  const [label, setLabel] = useState('');
  
  // Node-specific states
  const [memo, setMemo] = useState('');
  const [memoView, setMemoView] = useState('edit');
  const [nodeColor, setNodeColor] = useState(defaultNodeColor);
  const [nodeGradientEnabled, setNodeGradientEnabled] = useState(false);
  const [nodeGradientStart, setNodeGradientStart] = useState('#2196f3');
  const [nodeGradientEnd, setNodeGradientEnd] = useState('#1976d2');
  const [nodeGradientDirection, setNodeGradientDirection] = useState('135deg');
  const [nodeType, setNodeType] = useState('');
  const [nodePosition, setNodePosition] = useState({ x: 0, y: 0 });
  const [nodeSize, setNodeSize] = useState({ width: 200, height: 120 });
  
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
  
  // Group-specific states
  const [backgroundColor, setBackgroundColor] = useState('rgba(25, 118, 210, 0.1)');
  const [borderColor, setBorderColor] = useState('#1976d2');
  const [borderWidth, setBorderWidth] = useState(2);
  const [visible, setVisible] = useState(true);
  
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const memoInputRef = useRef();
  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const DEBOUNCE_MS = 400;

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

  useEffect(() => {
    setCurrentAnchor(anchor);
  }, [anchor]);

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
    if (selectedNode) {
      setLabel(selectedNode.label || '');
      setMemo(selectedNode.data?.memo || '');
      
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
    } else if (selectedGroup) {
      setLabel(selectedGroup.label || '');
      setBackgroundColor(selectedGroup.style?.backgroundColor || 'rgba(25, 118, 210, 0.1)');
      setBorderColor(selectedGroup.style?.borderColor || '#1976d2');
      setBorderWidth(selectedGroup.style?.borderWidth || 2);
      setVisible(selectedGroup.visible !== false);
    }
  }, [entityId, entityType, defaultNodeColor, defaultEdgeColor]);

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
    setMemo(newMemo);
    if (onUpdateNode) onUpdateNode(entityId, { data: { memo: newMemo } });
  };

  const handleNodeColorChange = (color) => {
    setNodeColor(color);
    if (onUpdateNode) onUpdateNode(entityId, { color });
  };

  const handleEdgeStyleUpdate = (updates) => {
    if (!entityId || isLocked) return;
    const currentStyle = selectedEdge?.style || {};
    onUpdateEdge(entityId, {
      style: { ...currentStyle, ...updates }
    });
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
      <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
        {panelTitle}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {!isMobile && (
          <IconButton onClick={toggleAnchor} size="small" sx={{ color: 'inherit' }}>
            {currentAnchor === 'right' ? <ArrowBackIcon /> : <ArrowForwardIcon />}
          </IconButton>
        )}
        <IconButton
          onClick={handleToggleLock}
          title={isLocked ? `Unlock ${entityType}` : `Lock ${entityType}`}
          size="small"
          sx={{ color: 'inherit' }}
        >
          {isLocked ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
        <IconButton 
          size="small" 
          onClick={handlePanelClose}
          sx={{ color: 'inherit' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  );

  const panelContent = (
      <Box sx={{ p: 2, pt: isMobile ? 1 : 2, overflowY: 'auto', flexGrow: 1, maxHeight: isMobile ? '65vh' : 'auto' }}>
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
                value={Object.keys(nodeTypeRegistry).includes(nodeType) ? nodeType : ''}
                onChange={(e) => {
                  setNodeType(e.target.value);
                  if (onUpdateNode) onUpdateNode(entityId, { type: e.target.value });
                }}
                label="Node Type"
              >
                {Object.entries(nodeTypeRegistry).map(([key, meta]) => (
                  <MenuItem key={key} value={key}>
                    <Tooltip title={meta.description || ''}>
                      <span>{meta.label || key}</span>
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Memo */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Memo (Markdown)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                  <ToggleButtonGroup
                    value={memoView}
                    exclusive
                    onChange={(e, newView) => newView && setMemoView(newView)}
                    size="small"
                  >
                    <ToggleButton value="edit">
                      <EditIcon sx={{ fontSize: 16 }} />
                    </ToggleButton>
                    <ToggleButton value="preview">
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                {memoView === 'edit' ? (
                  <TextField
                    inputRef={memoInputRef}
                    multiline
                    rows={8}
                    value={memo}
                    onChange={handleMemoChange}
                    fullWidth
                    variant="filled"
                    disabled={isLocked}
                    sx={{ backgroundColor: theme?.palette?.background?.paper }}
                  />
                ) : (
                  <Box sx={{ 
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
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
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
          }
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
