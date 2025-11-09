import { useState, useEffect } from 'react';
import Drawer from '@mui/material/Drawer';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import themeMap, { themeNames } from './themes';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import eventBus from '../NodeGraph/eventBus';
import BackgroundControls from '../GraphEditor/components/BackgroundControls';
import ThemeBuilder from '../GraphEditor/components/ThemeBuilder';

const fallbackTheme = themeMap.default;

// List your background images here (JPG, PNG, etc.)
const backgroundImages = [
  '1.png',
  '2.png',
  '3.png',
  '4.png',
  '5.png',
  '6.png',
  '7.png',
  '8.png',
  '9.png',
  '10.png',
  'greenfelt.png',
  'background1.jpg',
  'background2.jpg',
  'background3.jpg',
  'background4.jpg',
  'background5.jpg',
  'background6.jpg',
  'background7.jpg',
  'background8.jpg',
  'background9.jpg',
  'background10.jpg',
  'background11.jpg',
  'background12.jpg',
  'background13.jpg',
];

export default function ThemeDrawer(props) {
  //console.log('ThemeDrawer props:', props);
  const { open, onClose, themeName, setThemeName, theme, setBackgroundImage, applyBrowserTheme } = props;
  //console.log('ThemeDrawer setBackgroundImage:', setBackgroundImage);
  const safeSetBackgroundImage = typeof setBackgroundImage === 'function' 
    ? (file) => { 
      //console.log('ThemeDrawer safeSetBackgroundImage called with:', file); 
      setBackgroundImage(file); }
    : null;
  const activeTheme = theme || fallbackTheme;
  const [cooldown, setCooldown] = useState(false);
  // Preview theme on hover by setting themeName
  const handleMouseEnter = (name) => {
    if (!cooldown) {
      setThemeName(name);
    }
  };
  // On click, set theme and close drawer
  const handleClick = (name) => {
    setThemeName(name);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);
    onClose();
  };

  const getBgOption = (key, def) => {
    const val = localStorage.getItem(key);
    return val === null ? def : val === 'true';
  };
  const [tiled, setTiled] = useState(getBgOption('backgroundTiled', false));
  const [stretched, setStretched] = useState(getBgOption('backgroundStretched', false));
  const [centered, setCentered] = useState(getBgOption('backgroundCentered', true));

  const updateBackgroundStyle = () => {
    const bgDiv = document.getElementById('graph-editor-background');
    if (!bgDiv) return;
    let size = 'auto';
    let repeat = 'no-repeat';
    let position = 'center';
    if (tiled) {
      size = 'auto';
      repeat = 'repeat';
      position = 'top left';
    } else if (stretched) {
      size = '100% 100%';
      repeat = 'no-repeat';
      position = 'center';
    } else if (centered) {
      size = 'auto';
      repeat = 'no-repeat';
      position = 'center';
    }
    bgDiv.style.backgroundSize = size;
    bgDiv.style.backgroundRepeat = repeat;
    bgDiv.style.backgroundPosition = position;
  };

  useEffect(() => {
    // Only run once on mount to set initial checkbox states from localStorage
    setTiled(getBgOption('backgroundTiled', false));
    setStretched(getBgOption('backgroundStretched', false));
    setCentered(getBgOption('backgroundCentered', true));
    updateBackgroundStyle();
    // listen to external background changes so the preview UI stays in sync
    const handler = ({ backgroundImage }) => {
      // no-op for now; style controls remain independent
      updateBackgroundStyle();
    };
    eventBus.on('backgroundChanged', handler);
    return () => eventBus.off('backgroundChanged', handler);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    // Only update background style when checkboxes change
    updateBackgroundStyle();
  }, [tiled, stretched, centered]);

  const applyBackgroundSelection = (file) => {
    try {
      // For selections from this drawer, store and emit the full public path
      const path = file ? `/background art/${file}` : null;
      if (safeSetBackgroundImage) safeSetBackgroundImage(path);
      if (path) {
        localStorage.setItem('backgroundImage', path);
        eventBus.emit('backgroundChanged', { backgroundImage: path });
      } else {
        localStorage.removeItem('backgroundImage');
        eventBus.emit('backgroundChanged', { backgroundImage: null });
      }
    } catch (err) {
      console.warn('Failed to apply background selection:', err);
    }
  };

  // Safe toggle for script panel to avoid silent failures and stop event propagation
  const safeToggleScriptPanel = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      try { e.stopPropagation(); } catch (err) { /* ignore */ }
    }

    console.log('ThemeDrawer: safeToggleScriptPanel invoked');

    try {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('toggleScriptPanel');
        console.log('ThemeDrawer: emitted toggleScriptPanel via eventBus');
      } else {
        console.warn('eventBus.emit not available');
      }
    } catch (err) {
      console.warn('Failed to emit toggleScriptPanel via eventBus:', err);
    }

    // Also dispatch a window-level CustomEvent as a fallback for listeners
    try {
      const ev = new CustomEvent('toggleScriptPanel');
      window.dispatchEvent(ev);
      console.log('ThemeDrawer: dispatched window CustomEvent toggleScriptPanel');
    } catch (err) {
      console.warn('Failed to dispatch window CustomEvent toggleScriptPanel:', err);
    }

    // Always post a window message as a last-resort broadcast
    try {
      window.postMessage({ type: 'toggleScriptPanel' }, '*');
      console.log('ThemeDrawer: posted window message toggleScriptPanel');
    } catch (err) {
      console.warn('Failed to postMessage toggleScriptPanel:', err);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} ModalProps={{ BackdropProps: { invisible: true } }}
      sx={{ zIndex: 1500 }} // Ensure it is drawn on top of everything else
    >
      <Box sx={{ width: 350, p: 2, background: activeTheme.palette.background.paper, color: activeTheme.palette.text?.primary }}>
        <Accordion sx={{ width: '100%' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" sx={{ color: activeTheme.palette.text?.primary }}>Theme Options</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ width: '100%', overflowX: 'hidden', p: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%', maxWidth: '100%', color: activeTheme.palette.text?.primary, fontSize: '1rem' }}>
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
                    marginBottom: 1,
                    maxWidth: '100%'
                  }}
                >
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </Button>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
        {/* Theme Builder Accordion */}
        <Accordion sx={{ width: '100%' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" sx={{ color: activeTheme.palette.text?.primary }}>Theme Builder</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ width: '100%', overflowX: 'hidden', p: 2 }}>
            <ThemeBuilder
              initialTheme={activeTheme?.palette ? {
                mode: activeTheme.palette.mode || 'light',
                primary: {
                  main: activeTheme.palette.primary?.main || '#1976d2',
                  light: activeTheme.palette.primary?.light || '#42a5f5',
                  dark: activeTheme.palette.primary?.dark || '#1565c0',
                  contrastText: activeTheme.palette.primary?.contrastText || '#ffffff',
                },
                secondary: {
                  main: activeTheme.palette.secondary?.main || '#dc004e',
                  light: activeTheme.palette.secondary?.light || '#f50057',
                  dark: activeTheme.palette.secondary?.dark || '#c51162',
                  contrastText: activeTheme.palette.secondary?.contrastText || '#ffffff',
                },
                background: {
                  default: activeTheme.palette.background?.default || '#f5f5f5',
                  paper: activeTheme.palette.background?.paper || '#ffffff',
                },
                text: {
                  primary: activeTheme.palette.text?.primary || '#000000',
                  secondary: activeTheme.palette.text?.secondary || '#666666',
                },
                divider: activeTheme.palette.divider || '#e0e0e0',
              } : null}
              onThemeChange={(newThemeConfig) => {
                // Apply to browser theme only (not document)
                if (applyBrowserTheme) {
                  applyBrowserTheme(newThemeConfig);
                }
                onClose();
              }}
            />
          </AccordionDetails>
        </Accordion>
        {/* Background Art Accordion */}
        <Accordion sx={{ width: '100%' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" sx={{ color: activeTheme.palette.text?.primary }}>Background Art</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ width: '100%', overflowX: 'hidden', p: 0 }}>
            <Box sx={{ width: '100%' }}>
              <FormControlLabel
                control={<Checkbox checked={tiled} onChange={e => {
                  setTiled(e.target.checked);
                  localStorage.setItem('backgroundTiled', e.target.checked);
                  updateBackgroundStyle();
                }} />}
                label="Tiled"
              />
              <FormControlLabel
                control={<Checkbox checked={stretched} onChange={e => {
                  setStretched(e.target.checked);
                  localStorage.setItem('backgroundStretched', e.target.checked);
                  updateBackgroundStyle();
                }} />}
                label="Stretched"
              />
              <FormControlLabel
                control={<Checkbox checked={centered} onChange={e => {
                  setCentered(e.target.checked);
                  localStorage.setItem('backgroundCentered', e.target.checked);
                  updateBackgroundStyle();
                }} />}
                label="Centered"
              />
              <ImageList cols={3} gap={8} sx={{ width: '100%' }}>
                <ImageListItem key="none" onClick={() => applyBackgroundSelection(null)}>
                  <Box sx={{
                    width: '100%',
                    height: 80,
                    borderRadius: 8,
                    bgcolor: 'background.paper',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '1px dashed',
                    color: 'text.secondary',
                    fontSize: 16
                  }}>
                    No Background
                  </Box>
                </ImageListItem>
                {backgroundImages.map((file) => {
                  const imgSrc = `/background art/${file}`;
                  return (
                    <ImageListItem key={file} onClick={() => applyBackgroundSelection(file)}>
                      <img src={imgSrc} alt={file} style={{ width: '100%', borderRadius: 8, cursor: 'pointer' }} />
                    </ImageListItem>
                  );
                })}
              </ImageList>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Drawer>
  );
}