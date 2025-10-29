"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  Paper, TextField, IconButton, Divider, FormControl, InputLabel, 
  Select, MenuItem, FormControlLabel, Switch, Slider, Typography, 
  Box, ToggleButton, ToggleButtonGroup, Accordion, AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Close as CloseIcon, Lock as LockIcon, LockOpen as LockOpenIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

export default function EdgePropertiesPanel({ 
  selectedEdge, 
  edgeTypes = {},
  onUpdateEdge, 
  onClose, 
  theme,
  defaultEdgeColor = '#666666',
  lockedEdges = new Set(),
  onToggleEdgeLock
}) {
  const [pos, setPos] = useState({ x: window.innerWidth - 380, y: 88 });
  const [edgeType, setEdgeType] = useState('');
  const [label, setLabel] = useState('');
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
  
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const edgeId = typeof selectedEdge === 'string' ? selectedEdge : selectedEdge?.id;
  const isLocked = lockedEdges.has(selectedEdge?.id);

  // Predefined dash patterns
  const dashPatterns = {
    solid: [],
    dashed: [8, 4],
    dotted: [2, 4],
    dashDot: [8, 4, 2, 4],
    longDash: [16, 8]
  };

  useEffect(() => {
    if (selectedEdge) {
      const edge = typeof selectedEdge === 'string' ? selectedEdge : selectedEdge;
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
      
      // Determine dash pattern
      const dash = edge.style?.dash ?? styleDef.dash ?? [];
      const patternName = Object.keys(dashPatterns).find(
        key => JSON.stringify(dashPatterns[key]) === JSON.stringify(dash)
      ) || 'solid';
      setDashPattern(patternName);
      
      // Gradient
      const hasGradient = edge.style?.gradient || styleDef.gradient;
      setGradientEnabled(!!hasGradient);
      if (hasGradient) {
        setGradientStart(hasGradient.start || '#2196f3');
        setGradientEnd(hasGradient.end || '#03a9f4');
      }
    }
  }, [edgeId, defaultEdgeColor, edgeTypes, selectedEdge]);

  const handleEdgeTypeChange = (e) => {
    if (!edgeId || isLocked) return;
    const newType = e.target.value;
    setEdgeType(newType);
    
    const typePreset = edgeTypes[newType];
    if (typePreset) {
      onUpdateEdge(edgeId, {
        type: newType,
        style: typePreset.style
      });
      // Update local state
      const styleDef = typePreset.style || {};
      setLineWidth(styleDef.width || 2);
      setCurved(styleDef.curved || false);
      setOpacity(styleDef.opacity ?? 1);
      setShowArrow(styleDef.showArrow ?? true);
      setArrowPosition(styleDef.arrowPosition || 'end');
      setArrowSize(styleDef.arrowSize || 8);
      setAnimation(styleDef.animation || 'none');
      setAnimationSpeed(styleDef.animationSpeed || 1);
      setCurveDirection(styleDef.curveDirection || 'auto');
    } else {
      onUpdateEdge(edgeId, { type: newType });
    }
  };

  const handleStyleUpdate = (updates) => {
    if (!edgeId || isLocked) return;
    const edge = typeof selectedEdge === 'string' ? {} : selectedEdge;
    const currentStyle = edge.style || {};
    onUpdateEdge(edgeId, {
      style: { ...currentStyle, ...updates }
    });
  };

  const handleDashPatternChange = (pattern) => {
    setDashPattern(pattern);
    handleStyleUpdate({ dash: dashPatterns[pattern] });
  };

  const handleGradientToggle = (enabled) => {
    setGradientEnabled(enabled);
    if (enabled) {
      handleStyleUpdate({ 
        gradient: { start: gradientStart, end: gradientEnd },
        color: null 
      });
    } else {
      handleStyleUpdate({ gradient: null });
    }
  };

  const sourceNode = selectedEdge?.sourceNode || { label: selectedEdge?.source };
  const targetNode = selectedEdge?.targetNode || { label: selectedEdge?.target };

  const onMouseDown = e => {
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = e => {
    if (!dragging.current) return;
    setPos({
      x: Math.max(0, Math.min(e.clientX - offset.current.x, window.innerWidth - 380)),
      y: Math.max(0, Math.min(e.clientY - offset.current.y, window.innerHeight - 56)),
    });
  };

  const onMouseUp = () => {
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 380,
        maxHeight: 'calc(100vh - 104px)',
        background: `linear-gradient(135deg, ${theme?.palette?.primary?.light} 0%, ${theme?.palette?.primary?.dark} 100%)`,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: theme?.palette?.primary?.main || '#1976d2',
        color: theme?.palette?.primary?.contrastText || '#fff',
        cursor: dragging.current ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={onMouseDown}
      >
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
          Edge Properties
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={() => onToggleEdgeLock(selectedEdge.id)}
            title={isLocked ? "Unlock Edge" : "Lock Edge"}
            size="small"
            sx={{ color: 'inherit' }}
          >
            {isLocked ? <LockIcon /> : <LockOpenIcon />}
          </IconButton>
          <IconButton 
            size="small" 
            onClick={onClose}
            sx={{ color: 'inherit' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* Content */}
      <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1 }}>
        {/* Edge ID */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          ID: {edgeId}
        </Typography>

        {/* Connection Info */}
        <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Connection
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
            {sourceNode.label || selectedEdge?.source}
            <br />
            → {targetNode.label || selectedEdge?.target}
          </Typography>
        </Box>

        {/* Edge Type */}
        <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
          <InputLabel>Edge Type</InputLabel>
          <Select
            value={edgeType}
            onChange={handleEdgeTypeChange}
            label="Edge Type"
          >
            {Object.entries(edgeTypes).map(([type, config]) => (
              <MenuItem key={type} value={type}>
                <Box>
                  <Typography variant="body2">{config.label || type}</Typography>
                  {config.description && (
                    <Typography variant="caption" color="text.secondary">
                      {config.description}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Label */}
        <TextField
          fullWidth
          label="Label"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (!isLocked) onUpdateEdge(edgeId, { label: e.target.value });
          }}
          variant="outlined"
          size="small"
          disabled={isLocked}
          sx={{ mb: 2 }}
        />

        {/* Basic Style Accordion */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Basic Style</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Line Width */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Line Width: {lineWidth}px
              </Typography>
              <Slider
                value={lineWidth}
                onChange={(e, val) => {
                  setLineWidth(val);
                  handleStyleUpdate({ width: val });
                }}
                min={1}
                max={10}
                step={0.5}
                disabled={isLocked}
                valueLabelDisplay="auto"
              />
            </Box>

            {/* Opacity */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Opacity: {Math.round(opacity * 100)}%
              </Typography>
              <Slider
                value={opacity}
                onChange={(e, val) => {
                  setOpacity(val);
                  handleStyleUpdate({ opacity: val });
                }}
                min={0}
                max={1}
                step={0.1}
                disabled={isLocked}
                valueLabelDisplay="auto"
                valueLabelFormat={(val) => `${Math.round(val * 100)}%`}
              />
            </Box>

            {/* Dash Pattern */}
            <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
              <InputLabel>Line Style</InputLabel>
              <Select
                value={dashPattern}
                onChange={(e) => handleDashPatternChange(e.target.value)}
                label="Line Style"
              >
                <MenuItem value="solid">Solid</MenuItem>
                <MenuItem value="dashed">Dashed</MenuItem>
                <MenuItem value="dotted">Dotted</MenuItem>
                <MenuItem value="dashDot">Dash-Dot</MenuItem>
                <MenuItem value="longDash">Long Dash</MenuItem>
              </Select>
            </FormControl>

            {/* Curved Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={curved}
                  onChange={(e) => {
                    setCurved(e.target.checked);
                    handleStyleUpdate({ curved: e.target.checked });
                  }}
                  disabled={isLocked}
                />
              }
              label="Curved"
              sx={{ mb: 1 }}
            />

            {/* Curve Direction */}
            {curved && (
              <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
                <InputLabel>Curve Direction</InputLabel>
                <Select
                  value={curveDirection}
                  onChange={(e) => {
                    setCurveDirection(e.target.value);
                    handleStyleUpdate({ curveDirection: e.target.value });
                  }}
                  label="Curve Direction"
                >
                  <MenuItem value="auto">Auto</MenuItem>
                  <MenuItem value="horizontal">Horizontal</MenuItem>
                  <MenuItem value="vertical">Vertical</MenuItem>
                </Select>
              </FormControl>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Color Accordion */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Color & Gradient</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={gradientEnabled}
                  onChange={(e) => handleGradientToggle(e.target.checked)}
                  disabled={isLocked}
                />
              }
              label="Use Gradient"
              sx={{ mb: 2 }}
            />

            {gradientEnabled ? (
              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Gradient Start
                </Typography>
                <TextField
                  fullWidth
                  type="color"
                  value={gradientStart}
                  onChange={(e) => {
                    setGradientStart(e.target.value);
                    handleStyleUpdate({ 
                      gradient: { start: e.target.value, end: gradientEnd } 
                    });
                  }}
                  disabled={isLocked}
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Gradient End
                </Typography>
                <TextField
                  fullWidth
                  type="color"
                  value={gradientEnd}
                  onChange={(e) => {
                    setGradientEnd(e.target.value);
                    handleStyleUpdate({ 
                      gradient: { start: gradientStart, end: e.target.value } 
                    });
                  }}
                  disabled={isLocked}
                  size="small"
                />
              </Box>
            ) : (
              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Edge Color
                </Typography>
                <TextField
                  fullWidth
                  type="color"
                  value={edgeColor}
                  onChange={(e) => {
                    setEdgeColor(e.target.value);
                    if (!isLocked) onUpdateEdge(edgeId, { color: e.target.value });
                  }}
                  disabled={isLocked}
                  size="small"
                />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Arrow Accordion */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Arrows</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={showArrow}
                  onChange={(e) => {
                    setShowArrow(e.target.checked);
                    handleStyleUpdate({ showArrow: e.target.checked });
                  }}
                  disabled={isLocked}
                />
              }
              label="Show Arrows"
              sx={{ mb: 2 }}
            />

            {showArrow && (
              <>
                <FormControl fullWidth size="small" disabled={isLocked} sx={{ mb: 2 }}>
                  <InputLabel>Arrow Position</InputLabel>
                  <Select
                    value={arrowPosition}
                    onChange={(e) => {
                      setArrowPosition(e.target.value);
                      handleStyleUpdate({ arrowPosition: e.target.value });
                    }}
                    label="Arrow Position"
                  >
                    <MenuItem value="start">Start</MenuItem>
                    <MenuItem value="end">End</MenuItem>
                    <MenuItem value="both">Both</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Arrow Size: {arrowSize}px
                  </Typography>
                  <Slider
                    value={arrowSize}
                    onChange={(e, val) => {
                      setArrowSize(val);
                      handleStyleUpdate({ arrowSize: val });
                    }}
                    min={4}
                    max={16}
                    step={1}
                    disabled={isLocked}
                    valueLabelDisplay="auto"
                  />
                </Box>
              </>
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
                value={animation || 'none'}
                onChange={(e) => {
                  setAnimation(e.target.value === 'none' ? null : e.target.value);
                  handleStyleUpdate({ 
                    animation: e.target.value === 'none' ? null : e.target.value 
                  });
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
                    handleStyleUpdate({ animationSpeed: val });
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
      </Box>
    </Paper>
  );
}