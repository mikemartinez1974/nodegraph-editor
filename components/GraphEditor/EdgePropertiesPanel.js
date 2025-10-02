"use client";
import React, { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';

export default function EdgePropertiesPanel({ 
  selectedEdge, 
  edgeTypes = {},
  onUpdateEdge, 
  onClose, 
  theme 
}) {
  const [edgeType, setEdgeType] = useState('');
  const [label, setLabel] = useState('');
  const [showLabel, setShowLabel] = useState(false);
  const [lineWidth, setLineWidth] = useState(2);
  const [curved, setCurved] = useState(false);

  // Update local state when selected edge changes
  useEffect(() => {
    if (selectedEdge) {
      setEdgeType(selectedEdge.type || 'child');
      setLabel(selectedEdge.label || '');
      setShowLabel(selectedEdge.showLabel || false);
      setLineWidth(selectedEdge.style?.width || 2);
      setCurved(selectedEdge.style?.curved || false);
    }
  }, [selectedEdge?.id]);

  if (!selectedEdge) return null;

  const handleEdgeTypeChange = (e) => {
    const newType = e.target.value;
    setEdgeType(newType);
    
    // Get the default style for this edge type
    const typePreset = edgeTypes[newType];
    if (typePreset) {
      onUpdateEdge(selectedEdge.id, {
        type: newType,
        style: typePreset.style
      });
      // Update local state to match preset
      setLineWidth(typePreset.style?.width || 2);
      setCurved(typePreset.style?.curved || false);
    } else {
      onUpdateEdge(selectedEdge.id, { type: newType });
    }
  };

  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    onUpdateEdge(selectedEdge.id, { label: newLabel });
  };

  const handleShowLabelChange = (e) => {
    const newShowLabel = e.target.checked;
    setShowLabel(newShowLabel);
    onUpdateEdge(selectedEdge.id, { showLabel: newShowLabel });
  };

  const handleLineWidthChange = (e, newValue) => {
    setLineWidth(newValue);
    onUpdateEdge(selectedEdge.id, {
      style: { ...selectedEdge.style, width: newValue }
    });
  };

  const handleCurvedChange = (e) => {
    const newCurved = e.target.checked;
    setCurved(newCurved);
    onUpdateEdge(selectedEdge.id, {
      style: { ...selectedEdge.style, curved: newCurved }
    });
  };

  const sourceNode = selectedEdge.sourceNode || { label: selectedEdge.source };
  const targetNode = selectedEdge.targetNode || { label: selectedEdge.target };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 16,
        top: 88,
        width: 320,
        maxHeight: 'calc(100vh - 104px)',
        backgroundColor: theme?.palette?.background?.paper || '#fff',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
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
          ID: {selectedEdge.id}
        </Typography>

        {/* Connection Info */}
        <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Connection
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
            {sourceNode.label || selectedEdge.source}
            <br />
            → {targetNode.label || selectedEdge.target}
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
          variant="outlined"
          size="small"
          sx={{ mb: 1 }}
        />

        {/* Show Label Toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={showLabel}
              onChange={handleShowLabelChange}
              size="small"
            />
          }
          label="Show label"
          sx={{ mb: 2 }}
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
          />
        </Box>

        {/* Curved Toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={curved}
              onChange={handleCurvedChange}
              size="small"
            />
          }
          label="Curved line"
        />
      </Box>
    </Paper>
  );
}