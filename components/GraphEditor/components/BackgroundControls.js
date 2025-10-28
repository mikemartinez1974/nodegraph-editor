import React, { useState } from 'react';
import { Box, TextField, Button, Checkbox, FormControlLabel } from '@mui/material';
import eventBus from '../../NodeGraph/eventBus';

export default function BackgroundControls({ initialUrl = '', initialInteractive = false }) {
  const [url, setUrl] = useState(initialUrl);
  const [interactive, setInteractive] = useState(initialInteractive);

  const apply = () => {
    eventBus.emit('setBackgroundUrl', { url });
    eventBus.emit('setBackgroundInteractive', { interactive });
  };

  const clear = () => {
    setUrl('');
    setInteractive(false);
    eventBus.emit('clearBackgroundUrl');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: 360, p: 1 }}>
      <TextField size="small" label="Document URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth />
      <FormControlLabel control={<Checkbox checked={interactive} onChange={(e) => setInteractive(e.target.checked)} />} label="Make interactive (captures pointer)" />
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
