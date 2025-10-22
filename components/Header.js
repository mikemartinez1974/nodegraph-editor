"use client";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ThemeDrawer from './Header/ThemeDrawer';
import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import themeMap from './Header/themes';

export default function Header({ themeName, setThemeName, setTempTheme, theme }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  let muiTheme = useTheme();
  if (!muiTheme || !('palette' in muiTheme)) {
    muiTheme = themeMap.default;
  }
  // Dark mode = dark logo, Light mode = light logo
  const logoSrc = muiTheme?.palette?.mode === 'dark' ? '/logo_dark.png' : '/logo_light.png';
  const [imgError, setImgError] = useState(false);

  return (
    <div>
      <AppBar position="fixed" color="primary" sx={{
        background: `linear-gradient(135deg, ${muiTheme.palette.primary.light} 0%, ${muiTheme.palette.primary.dark} 100%)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
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
