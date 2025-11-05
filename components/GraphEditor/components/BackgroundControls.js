import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Checkbox, FormControlLabel } from '@mui/material';
import eventBus from '../../NodeGraph/eventBus';

export default function BackgroundControls({ backgroundUrl = '', backgroundInteractive = false }) {
  // Local state only for temporary editing before blur
  const [tempUrl, setTempUrl] = useState(backgroundUrl);
  const [tempInteractive, setTempInteractive] = useState(backgroundInteractive);
  const [tempGridSize, setTempGridSize] = useState(20);

  // Request current gridSize from documentSettings when component mounts
  useEffect(() => {
    const handleCurrentGridSize = ({ gridSize }) => {
      console.log('[BackgroundControls] Received currentGridSize event:', gridSize);
      if (gridSize) {
        setTempGridSize(gridSize);
      }
    };
    
    eventBus.on('currentGridSize', handleCurrentGridSize);
    console.log('[BackgroundControls] Requesting grid size...');
    eventBus.emit('requestGridSize'); // Ask GraphEditor for current value
    
    return () => eventBus.off('currentGridSize', handleCurrentGridSize);
  }, []);

  // Sync temp state when props change
  useEffect(() => {
    setTempUrl(backgroundUrl);
    setTempInteractive(backgroundInteractive);
  }, [backgroundUrl, backgroundInteractive]);

  const apply = () => {
    console.log('[BackgroundControls] Setting document background URL:', tempUrl);
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
          console.log('[BackgroundControls] Setting document background URL (onBlur):', tempUrl);
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
          console.log('[BackgroundControls] Setting grid size:', tempGridSize);
          eventBus.emit('setGridSize', { gridSize: tempGridSize });
        }}
        inputProps={{ min: 5, max: 100, step: 5 }}
        helperText="Grid spacing (5-100px)"
        fullWidth 
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" size="small" onClick={apply}>Apply</Button>
        <Button variant="outlined" size="small" onClick={clear}>Clear</Button>
      </Box>
      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>
        This URL will be saved as the "document" field in saved .node files. The target server must allow embedding (CORS / X-Frame-Options).
      </div>
    </Box>
  );
}
