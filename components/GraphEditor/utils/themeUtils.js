/**
 * Converts a MUI theme object to a serializable theme config
 * Used when creating new documents to capture the current browser theme
 */
export function themeConfigFromMuiTheme(theme) {
  if (!theme || !theme.palette) return null;
  
  const p = theme.palette;
  return {
    mode: p.mode || 'light',
    primary: {
      main: p.primary?.main || '#1976d2',
      light: p.primary?.light || '#42a5f5',
      dark: p.primary?.dark || '#1565c0',
      contrastText: p.primary?.contrastText || '#ffffff',
    },
    secondary: {
      main: p.secondary?.main || '#dc004e',
      light: p.secondary?.light || '#f50057',
      dark: p.secondary?.dark || '#c51162',
      contrastText: p.secondary?.contrastText || '#ffffff',
    },
    background: {
      default: p.background?.default || '#f5f5f5',
      paper: p.background?.paper || '#ffffff',
    },
    text: {
      primary: p.text?.primary || '#000000',
      secondary: p.text?.secondary || '#666666',
    },
    divider: p.divider || '#e0e0e0',
  };
}

/**
 * Creates a MUI theme from a theme config object
 */
export function createThemeFromConfig(themeConfig) {
  if (!themeConfig) return null;
  
  const { createTheme } = require('@mui/material/styles');
  
  return createTheme({
    palette: {
      mode: themeConfig.mode,
      primary: themeConfig.primary,
      secondary: themeConfig.secondary,
      background: themeConfig.background,
      text: themeConfig.text,
      divider: themeConfig.divider,
    },
  });
}
