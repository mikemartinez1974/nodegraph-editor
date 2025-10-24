"use client";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ThemeDrawer from './Header/ThemeDrawer';
import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import themeMap from './Header/themes';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import eventBus from './NodeGraph/eventBus';

export default function Header({ themeName, setThemeName, setTempTheme, theme }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [address, setAddress] = useState('');
  let muiTheme = useTheme();
  if (!muiTheme || !('palette' in muiTheme)) {
    muiTheme = themeMap.default;
  }
  // Dark mode = dark logo, Light mode = light logo
  const logoSrc = muiTheme?.palette?.mode === 'dark' ? '/logo_dark.png' : '/logo_light.png';
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handleSetAddress = ({ url }) => {
      setAddress(url);
    };
    eventBus.on('setAddress', handleSetAddress);
    return () => eventBus.off('setAddress', handleSetAddress);
  }, []);

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

          <TextField
            variant="outlined"
            size="small"
            placeholder="Enter URL or search..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                eventBus.emit('fetchUrl', { url: address });
                // Removed setAddress(''); to keep the URL in the bar
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 300,
              mr: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: muiTheme.palette.background.paper,
                borderRadius: 1,
              },
            }}
          />

          <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <ThemeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} themeName={themeName} setThemeName={setThemeName} theme={theme} />
    </div>
  );
}
