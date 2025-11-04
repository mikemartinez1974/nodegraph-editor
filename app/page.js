"use client";
import { useState, useEffect } from 'react';
import Header from '../components/Header/Header';
import { ThemeProvider } from '@mui/material/styles';
import themeMap from '@/components/Header/themes';
import GraphEditor from "@/components/GraphEditor/GraphEditor";

export default function Home() {
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
    }
    return 'default';
  };

  const [themeName, setThemeName] = useState('default');
  const [themeReady, setThemeReady] = useState(false);
  const [muiTheme, setMuiTheme] = useState(() => themeMap['default']);
  
  // Handler to apply theme to browser (not document)
  const applyBrowserTheme = (themeConfigOrName) => {
    if (!themeConfigOrName) return;
    
    if (typeof themeConfigOrName === 'string') {
      // Named theme from themeMap
      const mapped = themeMap[themeConfigOrName] || themeMap.default;
      setMuiTheme(mapped);
      setThemeName(themeConfigOrName);
      if (typeof window !== 'undefined') {
        localStorage.setItem('themeName', themeConfigOrName);
        localStorage.removeItem('browserThemeObject');
      }
    } else {
      // Custom theme config object
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
      // Load persisted browser theme
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
    // Keep muiTheme in sync when themeName changes (for named themes)
    if (themeName && themeName !== 'custom') {
      setMuiTheme(themeMap[themeName] || themeMap.default);
    }
  }, [themeName]);

  if (!themeReady) return null;

  return (
    <ThemeProvider theme={muiTheme}>
      <div style={{ userSelect: "none", cursor: "default" }}>
        <Header 
          themeName={themeName} 
          setThemeName={setThemeName} 
          theme={muiTheme}
          applyBrowserTheme={applyBrowserTheme}
        />
        <div>
          <GraphEditor />
        </div>
      </div>
    </ThemeProvider>
  );
}