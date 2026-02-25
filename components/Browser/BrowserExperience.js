"use client";
import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMediaQuery, GlobalStyles } from '@mui/material';
import Browser from './Browser';
import themeMap from './themes';
import GraphEditor from '@/components/GraphEditor/GraphEditor';
import eventBus from '@/components/NodeGraph/eventBus';

const FALLBACK_DOC_URL = '/root.node';

export default function BrowserExperience({ addressBarHeight, defaultDocUrl = FALLBACK_DOC_URL }) {
  const safeStorageGet = (key) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeStorageSet = (key, value) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch {
      // ignore storage write failures
    }
  };

  const safeStorageRemove = (key) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage remove failures
    }
  };

  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
    }
    return 'default';
  };

  const [themeName, setThemeName] = useState('default');
  const [themeReady, setThemeReady] = useState(false);
  const [muiTheme, setMuiTheme] = useState(() => themeMap.default);
  const isEmbedded = typeof window !== 'undefined' && window.__TWILIGHT_EMBED__ === true;

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
      safeStorageSet('themeName', themeConfigOrName);
      safeStorageRemove('browserThemeObject');
    } else {
      try {
        const customTheme = createTheme({ palette: themeConfigOrName });
        setMuiTheme(customTheme);
        setThemeName('custom');
        safeStorageSet('browserThemeObject', JSON.stringify(themeConfigOrName));
        safeStorageSet('themeName', 'custom');
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

      const storedThemeObj = safeStorageGet('browserThemeObject');
      const storedThemeName = safeStorageGet('themeName');

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
  }, [isEmbedded]);

  useEffect(() => {
    if (!themeReady) return;
    if (typeof window === 'undefined') return;
    if (isEmbedded) return;

    const params = new URLSearchParams(window.location.search);
    const docParam = (params.get('doc') || '').trim();
    const doc = docParam || defaultDocUrl;
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
    window.__Twilite_PENDING_FETCH_URL__ = fetchUrl;
    eventBus.emit('setAddress', fetchUrl);
    const emitFetch = () => {
      eventBus.emit('fetchUrl', { url: fetchUrl, source: 'query-doc' });
    };
    emitFetch();
    const timers = [50, 200, 600, 1500, 3000].map((delay) =>
      setTimeout(emitFetch, delay)
    );
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      if (window.__Twilite_PENDING_FETCH_URL__ === fetchUrl) {
        delete window.__Twilite_PENDING_FETCH_URL__;
      }
    };
  }, [themeReady, isEmbedded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleApplyBrowserTheme = (payload = {}) => {
      if (typeof payload === 'string') {
        applyBrowserTheme(payload);
        return;
      }
      const { themeName: nextName, themeConfig } = payload;
      if (themeConfig) {
        applyBrowserTheme(themeConfig);
      } else if (nextName) {
        applyBrowserTheme(nextName);
      }
    };

    eventBus.on('applyBrowserTheme', handleApplyBrowserTheme);
    return () => eventBus.off('applyBrowserTheme', handleApplyBrowserTheme);
  }, []);

  useEffect(() => {
    if (themeName && themeName !== 'custom') {
      setMuiTheme(themeMap[themeName] || themeMap.default);
    }
  }, [themeName]);

  if (!themeReady) return null;

  return (
    <ThemeProvider theme={muiTheme}>
      <GlobalStyles
        styles={(theme) => ({
          '.MuiDrawer-paper': {
            backgroundColor: theme.palette.background.paper
          },
          '.MuiDialog-paper': {
            backgroundColor: theme.palette.background.paper
          }
        })}
      />
      <div style={{ userSelect: "none", cursor: "default" }}>
        {!isEmbedded && (
          <Browser
            themeName={themeName}
            setThemeName={setThemeName}
            setTempTheme={(themeConfig) => applyBrowserTheme(themeConfig)}
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
            addressBarHeight={typeof addressBarHeight === 'number' ? addressBarHeight : (isEmbedded ? 0 : undefined)}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}
