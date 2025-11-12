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
import useMediaQuery from '@mui/material/useMediaQuery';

export default function DocumentPropertiesDialog({ open, onClose, backgroundUrl = '', setBackgroundUrl }) {
  const [settings, setSettings] = useState(loadSettings());
  const [activeTab, setActiveTab] = useState('document');
  const currentTheme = useTheme();
  const isMobile = useMediaQuery(currentTheme.breakpoints.down('sm'));

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

    // Close the dialog
    if (onClose) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      PaperProps={isMobile ? { sx: { m: 0 } } : undefined}
    >
      <DialogTitle>Document Properties</DialogTitle>
      <DialogContent sx={isMobile ? { p: 0, flex: '1 1 auto', overflowY: 'auto' } : undefined}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, px: isMobile ? 2 : 0, pt: isMobile ? 2 : 0 }}>
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

        {activeTab === 'theme' && (
          <Box sx={isMobile ? { px: 2, pb: 2 } : undefined}>
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
          </Box>
        )}

        {activeTab === 'document' && (
          <Box sx={isMobile ? { px: 2, pb: 2 } : undefined}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Document Settings
            </Typography>
            <BackgroundControls backgroundUrl={backgroundUrl} backgroundInteractive={false} />
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 3, pb: 3 } : undefined}
      >
        <Button onClick={handleReset} color="secondary" fullWidth={isMobile}>
          Reset to Defaults
        </Button>
        <Button onClick={onClose} color="primary" fullWidth={isMobile}>
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" fullWidth={isMobile}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
