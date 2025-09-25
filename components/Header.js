"use client";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ThemeDrawer from './Header/ThemeDrawer';
import { useState } from 'react';

export default function Header({ themeName, setThemeName, setTempTheme }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div>
      <AppBar position="fixed" color="primary">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            NodeGraph
          </Typography>
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <ThemeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} themeName={themeName} setThemeName={setThemeName} setTempTheme={setTempTheme} />
    </div>
  );
}
