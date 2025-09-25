import { useState } from 'react';
import Drawer from '@mui/material/Drawer';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import themeMap, { themeNames } from './themes';
const fallbackTheme = themeMap.default;

export default function ThemeDrawer({ open, onClose, themeName, setThemeName, theme }) {
  const activeTheme = theme || fallbackTheme;
  // Preview theme on hover by setting themeName
  const handleMouseEnter = (name) => {
    setThemeName(name);
  };
  // On click, set theme and close drawer
  const handleClick = (name) => {
    setThemeName(name);
    onClose();
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} ModalProps={{ BackdropProps: { invisible: true } }}>
      <Box sx={{ width: 350, p: 2, background: activeTheme.palette.background.paper, color: activeTheme.palette.text?.primary }}>
        <Typography variant="h6" sx={{ mb: 2, color: activeTheme.palette.text?.primary }}>
          Select Theme
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {themeNames.map((name) => (
            <Button
              key={name}
              onClick={() => handleClick(name)}
              onMouseEnter={() => handleMouseEnter(name)}
              sx={{
                flex: '1 1 80px',
                background: themeMap[name].palette.primary.main,
                color: themeMap[name].palette.mode === 'dark' ? '#fff' : '#222',
                border: themeName === name ? '2px solid #fff' : undefined,
                minWidth: 80,
                height: 40,
                marginBottom: 1
              }}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </Button>
          ))}
        </Box>
      </Box>
    </Drawer>
  );
}
