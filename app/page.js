"use client";
import { useState } from 'react';
import Header from '../components/Header';
import { ThemeProvider } from '@mui/material/styles';
import themeMap from '@/components/Header/themes';
import GraphEditor from "@/components/GraphEditor";

export default function Home() {
  const [themeName, setThemeName] = useState('default');
  const theme = themeMap[themeName];

  return (
    <ThemeProvider theme={theme}>
      <div>
        <Header themeName={themeName} setThemeName={setThemeName} theme={theme} />
        <div>
          <GraphEditor />
        </div>
      </div>
    </ThemeProvider>
  );
}