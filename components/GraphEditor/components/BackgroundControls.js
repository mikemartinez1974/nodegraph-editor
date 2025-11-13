import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Checkbox, FormControlLabel } from '@mui/material';
import eventBus, { useEventBusListener } from '../../NodeGraph/eventBus';

export default function BackgroundControls({ backgroundUrl = '', backgroundInteractive = false }) {
  // Local state only for temporary editing before blur
  const [tempUrl, setTempUrl] = useState(backgroundUrl);
  const [tempInteractive, setTempInteractive] = useState(backgroundInteractive);
  const [tempGridSize, setTempGridSize] = useState(20);
  const [tempBackgroundImage, setTempBackgroundImage] = useState('');

  // Request current gridSize and backgroundImage when component mounts
  useEffect(() => {
    eventBus.emit('requestGridSize');
    eventBus.emit('requestBackgroundImage');
  }, []);

  useEventBusListener('currentGridSize', ({ gridSize }) => {
    if (gridSize) {
      setTempGridSize(gridSize);
    }
  });

  useEventBusListener('currentBackgroundImage', ({ backgroundImage }) => {
    if (backgroundImage !== undefined) {
      setTempBackgroundImage(backgroundImage);
    }
  });

  // Sync temp state when props change
  useEffect(() => {
    setTempUrl(backgroundUrl);
    setTempInteractive(backgroundInteractive);
  }, [backgroundUrl, backgroundInteractive]);

  const apply = () => {
    eventBus.emit('setBackgroundUrl', { url: tempUrl });
    eventBus.emit('setBackgroundInteractive', { interactive: tempInteractive });
  };

  const clear = () => {
    eventBus.emit('clearBackgroundUrl');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: 360, p: 1 }}>
      <TextField 
        size="small" 
        label="Document URL" 
        value={tempUrl} 
        onChange={(e) => setTempUrl(e.target.value)} 
        onBlur={() => {
          eventBus.emit('setBackgroundUrl', { url: tempUrl });
        }} 
        fullWidth 
      />
      <FormControlLabel 
        control={<Checkbox checked={tempInteractive} onChange={(e) => setTempInteractive(e.target.checked)} />} 
        label="Make interactive (captures pointer)" 
      />
      <TextField 
        size="small" 
        label="Grid Size" 
        type="number"
        value={tempGridSize} 
        onChange={(e) => {
          const value = Math.max(5, Math.min(100, parseInt(e.target.value) || 20));
          setTempGridSize(value);
        }}
        onBlur={() => {
          eventBus.emit('setGridSize', { gridSize: tempGridSize });
        }}
        inputProps={{ min: 5, max: 100, step: 5 }}
        helperText="Grid spacing (5-100px)"
        fullWidth 
      />
      <TextField 
        size="small" 
        label="Background Image URL" 
        type="url"
        value={tempBackgroundImage} 
        onChange={(e) => setTempBackgroundImage(e.target.value)} 
        onBlur={() => {
          eventBus.emit('setBackgroundImage', { backgroundImage: tempBackgroundImage });
        }} 
        helperText="Background image for the editor canvas"
        fullWidth 
      />

    </Box>
  );
}
