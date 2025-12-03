import { useState, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { themeConfigFromMuiTheme } from '../utils/themeUtils';

const DEFAULT_GRID_SIZE = 20;

const createInitialDocumentSettings = (theme) => ({
  url: '',
  backgroundImage: '',
  gridSize: DEFAULT_GRID_SIZE,
  theme: themeConfigFromMuiTheme(theme)
});

export default function useDocumentMetadata() {
  const theme = useTheme();
  const [documentSettings, setDocumentSettings] = useState(() =>
    createInitialDocumentSettings(theme)
  );

  const setDocumentUrl = useCallback((url) => {
    setDocumentSettings((prev) => ({ ...prev, url }));
  }, []);

  const setDocumentBackgroundImage = useCallback((backgroundImage) => {
    setDocumentSettings((prev) => ({ ...prev, backgroundImage }));
  }, []);

  const setDocumentTheme = useCallback((themeConfig) => {
    setDocumentSettings((prev) => ({ ...prev, theme: themeConfig }));
  }, []);

  const setDocumentGridSize = useCallback((gridSize) => {
    setDocumentSettings((prev) => ({ ...prev, gridSize }));
  }, []);

  return useMemo(
    () => ({
      documentSettings,
      documentUrl: documentSettings.url,
      documentBackgroundImage: documentSettings.backgroundImage,
      documentTheme: documentSettings.theme,
      setDocumentSettings,
      setDocumentUrl,
      setDocumentBackgroundImage,
      setDocumentTheme,
      setDocumentGridSize
    }),
    [
      documentSettings,
      setDocumentSettings,
      setDocumentUrl,
      setDocumentBackgroundImage,
      setDocumentTheme,
      setDocumentGridSize
    ]
  );
}
