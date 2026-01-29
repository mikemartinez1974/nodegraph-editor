"use client";
import { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import themeMap from '@/components/Browser/themes';
import GraphEditor from '@/components/GraphEditor/GraphEditor';
import eventBus from '../../components/NodeGraph/eventBus';

export default function EditorPage() {
  const isEmbedded = typeof window !== 'undefined' && window.location?.search?.includes('embed=1');
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
    }
    return 'default';
  };

  const [themeName, setThemeName] = useState('default');
  const [themeReady, setThemeReady] = useState(false);
  const [muiTheme, setMuiTheme] = useState(() => themeMap.default);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isEmbedded) {
      window.__Twilite_EMBED__ = true;
    }
  }, [isEmbedded]);

  useEffect(() => {
    if (!isEmbedded || typeof window === 'undefined') return;
    const handleReady = () => {
      try {
        window.parent?.postMessage({ type: 'rendererReady' }, '*');
      } catch (err) {
        // ignore postMessage failures
      }
    };
    window.addEventListener('Twilite-ready', handleReady);
    return () => window.removeEventListener('Twilite-ready', handleReady);
  }, [isEmbedded]);

  const isMobile = useMediaQuery('(max-width:768px)');
  const isTablet = useMediaQuery('(min-width:769px) and (max-width:1024px)');
  const isSmallScreen = isMobile || isTablet;
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isEmbedded) {
      const systemTheme = getSystemTheme();
      setThemeName(systemTheme);
      setMuiTheme(themeMap[systemTheme] || themeMap.default);
      setThemeReady(true);
      return;
    }

    try {
      const storedThemeObj = localStorage.getItem('browserThemeObject');
      const storedThemeName = localStorage.getItem('themeName');

      if (storedThemeObj) {
        try {
          const parsed = JSON.parse(storedThemeObj);
          const customTheme = createTheme({ palette: parsed });
          setMuiTheme(customTheme);
          setThemeName('custom');
        } catch (e) {
          const fallbackName = storedThemeName || getSystemTheme();
          setThemeName(fallbackName);
          setMuiTheme(themeMap[fallbackName] || themeMap.default);
        }
      } else if (storedThemeName) {
        setThemeName(storedThemeName);
        setMuiTheme(themeMap[storedThemeName] || themeMap.default);
      } else {
        const systemTheme = getSystemTheme();
        setThemeName(systemTheme);
        setMuiTheme(themeMap[systemTheme] || themeMap.default);
      }
    } catch (e) {
      const fallback = getSystemTheme();
      setThemeName(fallback);
      setMuiTheme(themeMap[fallback] || themeMap.default);
    } finally {
      setThemeReady(true);
    }
  }, []);

  useEffect(() => {
    if (themeName && themeName !== 'custom') {
      setMuiTheme(themeMap[themeName] || themeMap.default);
    }
  }, [themeName]);

  // GraphEditor already listens for "loadGraph" messages in the embedded frame.

  if (!themeReady) return null;

  return (
    <ThemeProvider theme={muiTheme}>
      <div style={{ userSelect: "none", cursor: "default" }}>
        <GraphEditor
          isMobile={isMobile}
          isSmallScreen={isSmallScreen}
          isPortrait={isPortrait}
          isLandscape={isLandscape}
          addressBarHeight={0}
        />
      </div>
    </ThemeProvider>
  );
}
