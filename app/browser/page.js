"use client";
import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import Browser from '@/components/Browser/Browser';
import themeMap from '@/components/Browser/themes';
import GraphEditor from "@/components/GraphEditor/GraphEditor";
import eventBus from '@/components/NodeGraph/eventBus';

export default function BrowserPage() {
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
    }
    return 'default';
  };

  const [themeName, setThemeName] = useState('default');
  const [themeReady, setThemeReady] = useState(false);
  const [muiTheme, setMuiTheme] = useState(() => themeMap['default']);
  const isEmbedded = typeof window !== 'undefined' && window.__Twilite_EMBED__ === true;

  const isMobile = useMediaQuery('(max-width:768px)');
  const isTablet = useMediaQuery('(min-width:769px) and (max-width:1024px)');
  const isSmallScreen = isMobile || isTablet;
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  const applyBrowserTheme = (themeConfigOrName) => {
    if (!themeConfigOrName) return;

    if (typeof themeConfigOrName === 'string') {
      const mapped = themeMap[themeConfigOrName] || themeMap.default;
      setMuiTheme(mapped);
      setThemeName(themeConfigOrName);
      if (typeof window !== 'undefined') {
        localStorage.setItem('themeName', themeConfigOrName);
        localStorage.removeItem('browserThemeObject');
      }
    } else {
      try {
        const customTheme = createTheme({ palette: themeConfigOrName });
        setMuiTheme(customTheme);
        setThemeName('custom');
        if (typeof window !== 'undefined') {
          localStorage.setItem('browserThemeObject', JSON.stringify(themeConfigOrName));
          localStorage.setItem('themeName', 'custom');
        }
      } catch (err) {
        console.warn('Invalid theme config', err);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isEmbedded) {
        const systemTheme = getSystemTheme();
        setThemeName(systemTheme);
        setMuiTheme(themeMap[systemTheme] || themeMap.default);
        setThemeReady(true);
        return;
      }

      const storedThemeObj = localStorage.getItem('browserThemeObject');
      const storedThemeName = localStorage.getItem('themeName');

      if (storedThemeObj) {
        try {
          const parsed = JSON.parse(storedThemeObj);
          const customTheme = createTheme({ palette: parsed });
          setMuiTheme(customTheme);
          setThemeName('custom');
        } catch (e) {
          console.warn('Failed to parse stored browser theme', e);
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

      setThemeReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isEmbedded) return;
    const params = new URLSearchParams(window.location.search);
    const doc = (params.get('doc') || '').trim();
    if (!doc) return;

    const resolveDocUrl = (value) => {
      if (value.startsWith('tlz://')) {
        const rest = value.slice('tlz://'.length);
        const firstSlash = rest.indexOf('/');
        if (firstSlash !== -1) {
          const host = rest.slice(0, firstSlash);
          const path = rest.slice(firstSlash);
          return `https://${host}${path.startsWith('/') ? path : `/${path}`}`;
        }
        return `/${rest}`;
      }
      if (value.startsWith('http://') || value.startsWith('https://')) return value;
      if (value.startsWith('/')) return value;
      if (value.includes('://')) return value;
      return `/${value}`;
    };

    const fetchUrl = resolveDocUrl(doc);
    eventBus.emit('setAddress', fetchUrl);
    const emitFetch = () => {
      eventBus.emit('fetchUrl', { url: fetchUrl, source: 'query-doc' });
    };
    emitFetch();
    const timers = [50, 200, 600].map((delay) =>
      setTimeout(emitFetch, delay)
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [isEmbedded]);

  useEffect(() => {
    if (themeName && themeName !== 'custom') {
      setMuiTheme(themeMap[themeName] || themeMap.default);
    }
  }, [themeName]);

  if (!themeReady) return null;

  return (
    <ThemeProvider theme={muiTheme}>
      <div style={{ userSelect: "none", cursor: "default" }}>
        {!isEmbedded && (
          <Browser
            themeName={themeName}
            setThemeName={setThemeName}
            theme={muiTheme}
            applyBrowserTheme={applyBrowserTheme}
            isMobile={isMobile}
            isSmallScreen={isSmallScreen}
            isPortrait={isPortrait}
            isLandscape={isLandscape}
          />
        )}
        <div>
          <GraphEditor
            isMobile={isMobile}
            isSmallScreen={isSmallScreen}
            isPortrait={isPortrait}
            isLandscape={isLandscape}
            addressBarHeight={isEmbedded ? 0 : undefined}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}
