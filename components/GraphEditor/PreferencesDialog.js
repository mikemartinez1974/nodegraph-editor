import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Select,
  MenuItem,
} from '@mui/material';
import { loadSettings, saveSettings, resetSettings } from './settingsManager';

export default function PreferencesDialog({ open, onClose }) {
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    if (open) {
      setSettings(loadSettings());
    }
  }, [open]);

  const handleSave = () => {
    saveSettings(settings);
    onClose();
  };

  const handleReset = () => {
    const defaultSettings = resetSettings();
    setSettings(defaultSettings);
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Preferences</DialogTitle>
      <DialogContent>
        <TextField
          label="Default Node Color"
          type="color"
          value={settings.defaultNodeColor}
          onChange={(e) => handleChange('defaultNodeColor', e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Default Edge Color"
          type="color"
          value={settings.defaultEdgeColor}
          onChange={(e) => handleChange('defaultEdgeColor', e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Background Image URL"
          type="url"
          value={settings.backgroundImage || ''}
          onChange={(e) => handleChange('backgroundImage', e.target.value)}
          fullWidth
          margin="normal"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} color="secondary">
          Reset to Defaults
        </Button>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}