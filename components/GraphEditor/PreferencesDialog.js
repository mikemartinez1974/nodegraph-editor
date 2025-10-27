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
import eventBus from '../NodeGraph/eventBus';

export default function PreferencesDialog({ open, onClose }) {
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    if (open) {
      setSettings(loadSettings());
    }
  }, [open]);

  const handleSave = () => {
    saveSettings(settings);
    try {
      if (typeof window !== 'undefined') {
        // Persist top-level backgroundImage key for compatibility with the editor loader
        if (settings.backgroundImage) {
          localStorage.setItem('backgroundImage', settings.backgroundImage);
        } else {
          localStorage.removeItem('backgroundImage');
        }
      }
      // Notify other components to update background immediately
      eventBus.emit('backgroundChanged', { backgroundImage: settings.backgroundImage || null });
    } catch (err) {
      console.warn('Failed to persist background image preference:', err);
    }
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