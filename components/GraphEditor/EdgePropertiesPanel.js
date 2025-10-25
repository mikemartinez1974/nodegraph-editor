// In EdgePropertiesPanel.js, replace the entire component with this fixed version:

"use client";
import React, { useState, useEffect, useRef } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import ColorPickerInput from './ColorPickerInput';
import FormLabel from '@mui/material/FormLabel';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export default function EdgePropertiesPanel({ 
  selectedEdge, 
  edgeTypes = {},
  onUpdateEdge, 
  onClose, 
  theme,
  defaultEdgeColor = '#666666'
}) {
  const [pos, setPos] = useState({ x: window.innerWidth - 360, y: 88 });
  const [edgeType, setEdgeType] = useState('');
  const [label, setLabel] = useState('');
  const [lineWidth, setLineWidth] = useState(2);
  const [curved, setCurved] = useState(false);
  const [edgeColor, setEdgeColor] = useState(selectedEdge?.color || defaultEdgeColor);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // Get edge ID - handle both string and object cases
  const edgeId = typeof selectedEdge === 'string' ? selectedEdge : selectedEdge?.id;

  // Update local state when selected edge changes
  useEffect(() => {
    if (selectedEdge) {
      const edge = typeof selectedEdge === 'string' ? selectedEdge : selectedEdge;
      setEdgeType(edge.type || 'child');
      setLabel(edge.label || '');
      setLineWidth(edge.style?.width || 2);
      
      // Check curved from style first, then fall back to type preset
      let isCurved = false;
      if (edge.style?.curved !== undefined) {
        isCurved = edge.style.curved;
      } else if (edge.type && edgeTypes[edge.type]?.style?.curved !== undefined) {
        isCurved = edgeTypes[edge.type].style.curved;
      }
      setCurved(isCurved);
      
      setEdgeColor(edge.color || defaultEdgeColor);
    }
  }, [edgeId, defaultEdgeColor, edgeTypes]);

  const handleEdgeTypeChange = (e) => {
    if (!edgeId) return;
    const newType = e.target.value;
    setEdgeType(newType);
    
    // Get the default style for this edge type
    const typePreset = edgeTypes[newType];
    if (typePreset) {
      onUpdateEdge(edgeId, {
        type: newType,
        style: typePreset.style
      });
      // Update local state to match preset
      setLineWidth(typePreset.style?.width || 2);
      setCurved(typePreset.style?.curved || false);
    } else {
      onUpdateEdge(edgeId, { type: newType });
    }
  };

  const handleLabelChange = (e) => {
    if (!edgeId) return;
    const newLabel = e.target.value;
    setLabel(newLabel);
    onUpdateEdge(edgeId, { label: newLabel });
  };

  const handleLineWidthChange = (e, newValue) => {
    setLineWidth(newValue);
    if (!edgeId) return;
    const edge = typeof selectedEdge === 'string' ? {} : selectedEdge;
    const currentStyle = edge.style || {};
    onUpdateEdge(edgeId, {
      style: { 
        ...currentStyle, 
        width: newValue 
      }
    });
  };

  const handleCurvedChange = (e) => {
    if (!edgeId) return;
    const newCurved = e.target.checked;
    setCurved(newCurved);
    const edge = typeof selectedEdge === 'string' ? {} : selectedEdge;
    const currentStyle = edge.style || {};
    onUpdateEdge(edgeId, {
      style: { 
        ...currentStyle, 
        curved: newCurved 
      }
    });
  };

  const handleColorChange = (color) => {
    setEdgeColor(color);
    onUpdateEdge(selectedEdge.id, { color });
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
      x: Math.max(0, Math.min(e.clientX - offset.current.x, window.innerWidth - 320)),
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
        width: 320,
        maxHeight: 'calc(100vh - 104px)',
        background: `linear-gradient(135deg, ${theme?.palette?.primary?.light} 0%, ${theme?.palette?.primary?.dark} 100%)`,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: dragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: theme?.palette?.primary?.main || '#1976d2',
        color: theme?.palette?.primary?.contrastText || '#fff'
      }}>
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
          Edge Properties
        </Typography>
        <IconButton 
          size="small" 
          onClick={onClose}
          sx={{ color: 'inherit' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Content */}
      <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1 }}>
        {/* Edge ID (read-only) */}
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
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Edge Type</InputLabel>
          <Select
            value={edgeType}
            label="Edge Type"
            onChange={handleEdgeTypeChange}
          >
            {Object.keys(edgeTypes).map(type => (
              <MenuItem key={type} value={type}>
                {edgeTypes[type].label || type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Label */}
        <TextField
          fullWidth
          label="Label"
          value={label}
          onChange={handleLabelChange}
          variant="filled"
          size="small"
          sx={{ mb: 2, backgroundColor: theme.palette.background.paper }}
          helperText="Leave empty to hide label"
        />

        <Divider sx={{ my: 2 }} />

        {/* Style Section */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          Style
        </Typography>

        {/* Line Width */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Line Width: {lineWidth}px
          </Typography>
          <Slider
            value={lineWidth}
            onChange={handleLineWidthChange}
            min={1}
            max={10}
            step={1}
            marks
            valueLabelDisplay="auto"
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        </Box>

        {/* Curved Toggle - FIXED with white styling */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">Edge Shape</FormLabel>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Straight</Typography>
            <Switch
              checked={curved}
              onChange={handleCurvedChange}
              inputProps={{ 'aria-label': 'Edge shape switch' }}
              sx={{
                '& .MuiSwitch-switchBase': {
                  color: '#fff',
                  '&.Mui-checked': {
                    color: '#fff',
                  },
                  '&.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#4caf50',
                    opacity: 1,
                  },
                },
                '& .MuiSwitch-track': {
                  backgroundColor: '#999',
                  opacity: 1,
                },
              }}
            />
            <Typography variant="body2">Curved</Typography>
          </Box>
        </FormControl>

        {/* Color Picker Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Edge Color
          </Typography>
          <ColorPickerInput
            value={edgeColor}
            onChange={handleColorChange}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Supports hex colors and CSS gradients
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}