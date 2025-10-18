"use client";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ThemeDrawer from './Header/ThemeDrawer';
import { useState } from 'react';
import { useTheme } from '@mui/material/styles';

export default function Header({ themeName, setThemeName, setTempTheme, theme }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const muiTheme = useTheme();
  // Dark mode = light logo (white on dark), Light mode = dark logo (dark on light)
  const logoSrc = muiTheme?.palette?.mode === 'dark' ? '/logo-light.png' : '/logo-dark.png';
  const [imgError, setImgError] = useState(false);
  
  // Debug: log the logo path and any errors
  console.log('Logo path:', logoSrc, 'Theme mode:', muiTheme?.palette?.mode);

  return (
    <div>
      <AppBar position="fixed" color="primary">
        <Toolbar>
          {/* Theme-aware logo with fallback */}
          {!imgError ? (
            <img
              src={logoSrc}
              alt="Copy/Paste w/Me logo"
              width={36}
              height={36}
              onError={() => setImgError(true)}
              style={{ marginRight: 12, display: 'inline-block', objectFit: 'contain' }}
            />
          ) : (
            <Typography variant="h6" component="div" sx={{ mr: 2, fontWeight: 700 }}>
              CPwM
            </Typography>
          )}

          <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            Copy/Paste w/ Me&nbsp;
            <span style={{ marginLeft: 50 }}>
              🎨 🖌️ 🖼️ 🧶 🧷
            </span>
          </Typography>

          <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <ThemeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} themeName={themeName} setThemeName={setThemeName} theme={theme} />
    </div>
  );
}
