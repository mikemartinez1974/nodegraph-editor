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
        <FormControlLabel
          control={
            <Switch
              checked={settings.showNodeList}
              onChange={(e) => handleChange('showNodeList', e.target.checked)}
            />
          }
          label="Show Node List"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.showGroupList}
              onChange={(e) => handleChange('showGroupList', e.target.checked)}
            />
          }
          label="Show Group List"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.showGroupProperties}
              onChange={(e) => handleChange('showGroupProperties', e.target.checked)}
            />
          }
          label="Show Group Properties"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.showNodeProperties}
              onChange={(e) => handleChange('showNodeProperties', e.target.checked)}
            />
          }
          label="Show Node Properties"
        />
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
        <Select
          value={settings.autoLayoutType}
          onChange={(e) => handleChange('autoLayoutType', e.target.value)}
          fullWidth
          margin="normal"
        >
          <MenuItem value="grid">Grid</MenuItem>
          <MenuItem value="hierarchical">Hierarchical</MenuItem>
          <MenuItem value="radial">Radial</MenuItem>
        </Select>
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