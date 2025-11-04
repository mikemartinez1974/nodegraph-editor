"use client";
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as ResetIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const defaultThemeConfig = {
  mode: 'light',
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#dc004e',
    light: '#f50057',
    dark: '#c51162',
    contrastText: '#ffffff',
  },
  background: {
    default: '#f5f5f5',
    paper: '#ffffff',
  },
  text: {
    primary: '#000000',
    secondary: '#666666',
  },
  divider: '#e0e0e0',
};

export default function ThemeBuilder({ onThemeChange, initialTheme }) {
  const [themeConfig, setThemeConfig] = useState(initialTheme || defaultThemeConfig);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    try {
      const theme = createTheme({
        palette: {
          mode: themeConfig.mode,
          primary: themeConfig.primary,
          secondary: themeConfig.secondary,
          background: themeConfig.background,
          text: themeConfig.text,
          divider: themeConfig.divider,
        },
      });
      setPreviewTheme(theme);
    } catch (err) {
      console.warn('Invalid theme config:', err);
    }
  }, [themeConfig]);

  const handleColorChange = (category, key, value) => {
    setThemeConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setThemeConfig(prev => ({ ...prev, mode: newMode }));
    }
  };

  const handleReset = () => {
    setThemeConfig(defaultThemeConfig);
  };

  const handleCopyJSON = () => {
    const json = JSON.stringify(themeConfig, null, 2);
    navigator.clipboard.writeText(json);
  };

  const handleExport = () => {
    const json = JSON.stringify(themeConfig, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theme_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setThemeConfig(imported);
      } catch (err) {
        console.error('Failed to import theme:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (onThemeChange && previewTheme) {
      onThemeChange(themeConfig);
    }
  };

  const ColorPicker = ({ label, value, onChange, helperText }) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 60,
            height: 36,
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        />
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          size="small"
          fullWidth
          placeholder="#000000"
        />
      </Box>
      {helperText && (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Theme Builder</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Reset to defaults">
            <IconButton size="small" onClick={handleReset}>
              <ResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy JSON">
            <IconButton size="small" onClick={handleCopyJSON}>
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export theme">
            <IconButton size="small" onClick={handleExport}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Import theme">
            <IconButton size="small" component="label">
              <UploadIcon fontSize="small" />
              <input type="file" accept=".json" hidden onChange={handleImport} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle preview">
            <IconButton 
              size="small" 
              color={showPreview ? 'primary' : 'default'}
              onClick={() => setShowPreview(!showPreview)}
            >
              <PreviewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Mode Toggle */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Theme Mode
        </Typography>
        <ToggleButtonGroup
          value={themeConfig.mode}
          exclusive
          onChange={handleModeChange}
          size="small"
          fullWidth
        >
          <ToggleButton value="light">Light</ToggleButton>
          <ToggleButton value="dark">Dark</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Color Sections */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Primary Colors</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ColorPicker
            label="Main"
            value={themeConfig.primary.main}
            onChange={(val) => handleColorChange('primary', 'main', val)}
            helperText="Primary brand color"
          />
          <ColorPicker
            label="Light"
            value={themeConfig.primary.light}
            onChange={(val) => handleColorChange('primary', 'light', val)}
            helperText="Lighter variant"
          />
          <ColorPicker
            label="Dark"
            value={themeConfig.primary.dark}
            onChange={(val) => handleColorChange('primary', 'dark', val)}
            helperText="Darker variant"
          />
          <ColorPicker
            label="Contrast Text"
            value={themeConfig.primary.contrastText}
            onChange={(val) => handleColorChange('primary', 'contrastText', val)}
            helperText="Text color on primary backgrounds"
          />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Secondary Colors</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ColorPicker
            label="Main"
            value={themeConfig.secondary.main}
            onChange={(val) => handleColorChange('secondary', 'main', val)}
          />
          <ColorPicker
            label="Light"
            value={themeConfig.secondary.light}
            onChange={(val) => handleColorChange('secondary', 'light', val)}
          />
          <ColorPicker
            label="Dark"
            value={themeConfig.secondary.dark}
            onChange={(val) => handleColorChange('secondary', 'dark', val)}
          />
          <ColorPicker
            label="Contrast Text"
            value={themeConfig.secondary.contrastText}
            onChange={(val) => handleColorChange('secondary', 'contrastText', val)}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Background Colors</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ColorPicker
            label="Default"
            value={themeConfig.background.default}
            onChange={(val) => handleColorChange('background', 'default', val)}
            helperText="Main background color"
          />
          <ColorPicker
            label="Paper"
            value={themeConfig.background.paper}
            onChange={(val) => handleColorChange('background', 'paper', val)}
            helperText="Card/panel background"
          />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Text & Other</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ColorPicker
            label="Primary Text"
            value={themeConfig.text.primary}
            onChange={(val) => handleColorChange('text', 'primary', val)}
            helperText="Main text color"
          />
          <ColorPicker
            label="Secondary Text"
            value={themeConfig.text.secondary}
            onChange={(val) => handleColorChange('text', 'secondary', val)}
            helperText="Muted text color"
          />
          <ColorPicker
            label="Divider"
            value={themeConfig.divider}
            onChange={(val) => setThemeConfig(prev => ({ ...prev, divider: val }))}
            helperText="Border/divider color"
          />
        </AccordionDetails>
      </Accordion>

      {/* Preview Panel */}
      {showPreview && previewTheme && (
        <ThemeProvider theme={previewTheme}>
          <Paper sx={{ mt: 3, p: 2, bgcolor: 'background.default' }}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Preview
            </Typography>
            <Typography variant="body1" color="text.primary" paragraph>
              Primary text on default background
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Secondary text for less emphasis
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button variant="contained" color="primary" size="small">
                Primary
              </Button>
              <Button variant="contained" color="secondary" size="small">
                Secondary
              </Button>
              <Button variant="outlined" size="small">
                Outlined
              </Button>
            </Box>
            <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="body2" color="text.primary">
                Paper surface with divider
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary">
                This is how panels and cards will look
              </Typography>
            </Paper>
          </Paper>
        </ThemeProvider>
      )}

      {/* Apply Button */}
      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleApply}
        >
          Apply Theme
        </Button>
      </Box>
    </Box>
  );
}
