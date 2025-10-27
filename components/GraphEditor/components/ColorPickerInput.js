"use client";

import React, { useState } from 'react';
import { Box, TextField, Popover, ClickAwayListener, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

export default function ColorPickerInput({ value = '#1976d2', onChange, sx = {} }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleChange = (e) => {
    onChange(e.target.value);
  };
  
  // Color presets (solid colors)
  const solidPresets = [
    '#1976d2', // blue
    '#2e7d32', // green
    '#d32f2f', // red
    '#ed6c02', // orange
    '#9c27b0', // purple
    '#0288d1', // light blue
    '#00796b', // teal
    '#f44336', // bright red
    '#673ab7', // deep purple
    '#795548', // brown
  ];
  
  // Gradient presets
  const gradientPresets = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)',
  ];
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ...sx }}>
      <Box
        onClick={handleClick}
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          background: value,
          cursor: 'pointer',
          border: '2px solid',
          borderColor: 'divider',
          mr: 1,
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.1)',
            boxShadow: 1
          }
        }}
      />
      
      <TextField
        value={value}
        onChange={handleChange}
        size="small"
        fullWidth
        placeholder="Color or gradient"
      />
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <ClickAwayListener onClickAway={handleClose}>
          <Box sx={{ p: 2, width: 280 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Solid Colors</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 2 }}>
              {solidPresets.map(color => (
                <Box
                  key={color}
                  onClick={() => { onChange(color); handleClose(); }}
                  sx={{
                    width: 40,
                    height: 40,
                    m: 0.5,
                    borderRadius: 1,
                    backgroundColor: color,
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      boxShadow: 2
                    }
                  }}
                />
              ))}
            </Box>
            
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Gradients</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 2 }}>
              {gradientPresets.map((gradient, i) => (
                <Box
                  key={i}
                  onClick={() => { onChange(gradient); handleClose(); }}
                  sx={{
                    width: 55,
                    height: 40,
                    m: 0.5,
                    borderRadius: 1,
                    background: gradient,
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: 2
                    }
                  }}
                />
              ))}
            </Box>
            
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Custom</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <input
                type="color"
                value={value.startsWith('#') ? value : '#1976d2'}
                onChange={handleChange}
                style={{ width: '100%', height: 40, cursor: 'pointer' }}
              />
            </Box>
          </Box>
        </ClickAwayListener>
      </Popover>
    </Box>
  );
}