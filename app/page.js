"use client";
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { ThemeProvider } from '@mui/material/styles';
import themeMap from '@/components/Header/themes';
import GraphEditor from "@/components/GraphEditor";

export default function Home() {
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
    }
    return 'default';
  };

  const [themeName, setThemeName] = useState('default');
  const [themeReady, setThemeReady] = useState(false);
  const theme = themeMap[themeName];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('themeName');
      if (storedTheme) {
        setThemeName(storedTheme);
      } else {
        setThemeName(getSystemTheme());
      }
      setThemeReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeName', themeName);
    }
  }, [themeName]);

  if (!themeReady) return null;

  return (
    <ThemeProvider theme={theme}>
      <div style={{ userSelect: "none", cursor: "default" }}>
        <Header themeName={themeName} setThemeName={setThemeName} theme={theme} />
        <div>
          <GraphEditor />
        </div>
      </div>
    </ThemeProvider>
  );
}