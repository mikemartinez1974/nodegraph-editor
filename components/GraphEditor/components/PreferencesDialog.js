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
  Typography,
  Divider,
  Box,
} from '@mui/material';
import { loadSettings, saveSettings, resetSettings } from '../settingsManager';
import eventBus from '../../NodeGraph/eventBus';
import BackgroundControls from './BackgroundControls';
import ThemeBuilder from './ThemeBuilder';
import { useTheme } from '@mui/material/styles';

export default function PreferencesDialog({ open, onClose }) {
  const [settings, setSettings] = useState(loadSettings());
  const [activeTab, setActiveTab] = useState('appearance');
  const currentTheme = useTheme();

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

  const handleToggleScriptPanel = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      try { e.stopPropagation(); } catch (err) { /* ignore */ }
    }

    try {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('toggleScriptPanel');
      }
    } catch (err) {
      console.warn('Failed to emit toggleScriptPanel via eventBus:', err);
    }

    try {
      const ev = new CustomEvent('toggleScriptPanel');
      window.dispatchEvent(ev);
    } catch (err) {
      console.warn('Failed to dispatch window CustomEvent toggleScriptPanel:', err);
    }

    try {
      window.postMessage({ type: 'toggleScriptPanel' }, '*');
    } catch (err) {
      console.warn('Failed to postMessage toggleScriptPanel:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Document Properties</DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Button
            onClick={() => setActiveTab('appearance')}
            variant={activeTab === 'appearance' ? 'contained' : 'text'}
            size="small"
            sx={{ mr: 1 }}
          >
            Appearance
          </Button>
          <Button
            onClick={() => setActiveTab('theme')}
            variant={activeTab === 'theme' ? 'contained' : 'text'}
            size="small"
            sx={{ mr: 1 }}
          >
            Theme Builder
          </Button>
          <Button
            onClick={() => setActiveTab('document')}
            variant={activeTab === 'document' ? 'contained' : 'text'}
            size="small"
          >
            Document
          </Button>
        </Box>

        {activeTab === 'appearance' && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Quick Settings
            </Typography>
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
          </Box>
        )}

        {activeTab === 'theme' && (
          <ThemeBuilder
            initialTheme={settings.theme || (currentTheme?.palette ? {
              mode: currentTheme.palette.mode || 'light',
              primary: {
                main: currentTheme.palette.primary?.main || '#1976d2',
                light: currentTheme.palette.primary?.light || '#42a5f5',
                dark: currentTheme.palette.primary?.dark || '#1565c0',
                contrastText: currentTheme.palette.primary?.contrastText || '#ffffff',
              },
              secondary: {
                main: currentTheme.palette.secondary?.main || '#dc004e',
                light: currentTheme.palette.secondary?.light || '#f50057',
                dark: currentTheme.palette.secondary?.dark || '#c51162',
                contrastText: currentTheme.palette.secondary?.contrastText || '#ffffff',
              },
              background: {
                default: currentTheme.palette.background?.default || '#f5f5f5',
                paper: currentTheme.palette.background?.paper || '#ffffff',
              },
              text: {
                primary: currentTheme.palette.text?.primary || '#000000',
                secondary: currentTheme.palette.text?.secondary || '#666666',
              },
              divider: currentTheme.palette.divider || '#e0e0e0',
            } : null)}
            onThemeChange={(newTheme) => {
              handleChange('theme', newTheme);
              // Update document theme (not browser theme)
              eventBus.emit('updateDocumentTheme', newTheme);
            }}
          />
        )}

        {activeTab === 'document' && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Document Settings
            </Typography>
            <BackgroundControls />
            <Box sx={{ mt: 2 }}>
              <Button 
                size="small" 
                variant="outlined"
                onClick={handleToggleScriptPanel}
                fullWidth
              >
                Toggle Script Panel
              </Button>
            </Box>
          </Box>
        )}
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