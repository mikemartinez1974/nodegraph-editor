"use client";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ThemeDrawer from './Header/ThemeDrawer';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import themeMap from './Header/themes';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import eventBus from './NodeGraph/eventBus';
import ButtonGroup from '@mui/material/ButtonGroup';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

export default function Header({ themeName, setThemeName, setTempTheme, theme }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(historyIndex);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  const [browserHistory, setBrowserHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  let muiTheme = useTheme();
  if (!muiTheme || !('palette' in muiTheme)) {
    muiTheme = themeMap.default;
  }
  // Dark mode = dark logo, Light mode = light logo
  const logoSrc = muiTheme?.palette?.mode === 'dark' ? '/logo_dark.png' : '/logo_light.png';
  const [imgError, setImgError] = useState(false);
  const currentUrl = browserHistory[historyIndex] || '';

  // Home URL management
  const DEFAULT_HOME = 'https://cpwith.me/tlz/IntroGraph.json';
  const [homeUrl, setHomeUrl] = useState(DEFAULT_HOME);
  const [homeMenuAnchor, setHomeMenuAnchor] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('homeUrl');
      if (stored) setHomeUrl(stored); else setHomeUrl(DEFAULT_HOME);
    } catch (err) {
      setHomeUrl(DEFAULT_HOME);
    }
  }, []);

  useEffect(() => {
    const handleSetAddress = (data) => {
      // Accept either a string or an object { url }
      const url = typeof data === 'string' ? data : data?.url;
      if (!url) return;
      setAddress(url);

      setBrowserHistory(prev => {
        // Use the ref to get the current index (handles updates outside this closure)
        const idx = historyIndexRef.current;
        const truncated = prev.slice(0, Math.max(0, idx + 1));
        // Avoid duplicate consecutive entries
        if (truncated[truncated.length - 1] === url) {
          const newIndex = truncated.length - 1;
          setHistoryIndex(newIndex);
          return truncated;
        }
        const next = [...truncated, url];
        setHistoryIndex(next.length - 1);
        return next;
      });
    };
    eventBus.on('setAddress', handleSetAddress);
    return () => eventBus.off('setAddress', handleSetAddress);
  }, []);

  useEffect(() => {
    setIsBookmarked(bookmarks.includes(currentUrl));
  }, [bookmarks, currentUrl]);

  const handleBrowserBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const url = browserHistory[newIndex];
      if (url) {
        setAddress(url);
        eventBus.emit('fetchUrl', { url });
      }
    }
  };

  const handleBrowserForward = () => {
    if (historyIndex < browserHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const url = browserHistory[newIndex];
      if (url) {
        setAddress(url);
        eventBus.emit('fetchUrl', { url });
      }
    }
  };

  const handleRefresh = () => {
    const url = currentUrl || address;
    if (url) {
      eventBus.emit('fetchUrl', { url });
    }
  };

  const handleHome = () => {
    // Navigate to the configured home URL
    if (!homeUrl) {
      alert('Home URL not set');
      return;
    }
    setAddress(homeUrl);
    eventBus.emit('fetchUrl', { url: homeUrl });
  };

  const handleHomeContext = (e) => {
    e.preventDefault();
    setHomeMenuAnchor(e.currentTarget);
  };

  const handleCloseHomeMenu = () => setHomeMenuAnchor(null);

  const handleSetCurrentAsHome = () => {
    const candidate = currentUrl || address;
    if (!candidate) {
      alert('No current document to set as home. Navigate to a document first.');
      setHomeMenuAnchor(null);
      return;
    }
    try {
      localStorage.setItem('homeUrl', candidate);
      setHomeUrl(candidate);
      alert('Home set to: ' + candidate);
    } catch (err) {
      console.warn('Failed to set home URL:', err);
      alert('Failed to set home URL');
    }
    setHomeMenuAnchor(null);
  };

  const handleResetHome = () => {
    try {
      localStorage.removeItem('homeUrl');
      setHomeUrl(DEFAULT_HOME);
      alert('Home reset to default');
    } catch (err) {
      console.warn('Failed to reset home URL:', err);
      alert('Failed to reset home URL');
    }
    setHomeMenuAnchor(null);
  };

  const handleToggleBookmark = () => {
    if (isBookmarked) {
      setBookmarks(bookmarks.filter((url) => url !== currentUrl));
    } else {
      setBookmarks([...bookmarks, currentUrl]);
    }
  };

  return (
    <div>
      <AppBar position="fixed" color="primary" sx={{
        background: `linear-gradient(135deg, ${muiTheme.palette.primary.light} 0%, ${muiTheme.palette.primary.dark} 100%)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <Toolbar>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ButtonGroup variant="outlined" size="small" sx={{ borderColor: muiTheme.palette.divider }}>
              <IconButton
                onClick={handleBrowserBack}
                disabled={historyIndex <= 0}
                title="Back"
                aria-label="Navigate back"
                size="small"
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleBrowserForward}
                disabled={historyIndex >= browserHistory.length - 1}
                title="Forward"
                aria-label="Navigate forward"
                size="small"
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleRefresh}
                disabled={!currentUrl && !address}
                title="Refresh"
                aria-label="Refresh current URL"
                size="small"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleHome}
                onContextMenu={handleHomeContext}
                title="Home"
                aria-label="Home"
                size="small"
              >
                <HomeIcon fontSize="small" />
              </IconButton>
            </ButtonGroup>
          </Box>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Enter URL or search..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                // Emit fetch event - GraphEditor will handle loading and then emit setAddress back
                eventBus.emit('fetchUrl', { url: address });
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
            sx={{
              width: 525, // Increased width by 75%
              '& .MuiOutlinedInput-root': {
                backgroundColor: muiTheme.palette.background.paper,
                borderRadius: 1,
              },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={handleToggleBookmark}
              disabled={!currentUrl}
              title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              aria-label="Toggle bookmark"
              size="small"
              color={isBookmarked ? "primary" : "default"}
            >
              {isBookmarked ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
            </IconButton>
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              disabled={bookmarks.length === 0}
              title="View bookmarks"
              aria-label="Open bookmarks menu"
              size="small"
            >
              <BookmarkIcon fontSize="small" />
              {bookmarks.length > 0 && (
                <Typography variant="caption" sx={{ ml: 0.5, fontSize: '0.65rem' }}>
                  {bookmarks.length}
                </Typography>
              )}
            </IconButton>
          </Box>

          {/* Spacer to push drawer button to far right */}
          <Box sx={{ flexGrow: 1 }} />

          <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={homeMenuAnchor} open={Boolean(homeMenuAnchor)} onClose={handleCloseHomeMenu}>
        <MenuItem onClick={handleSetCurrentAsHome}>Set current document as Home</MenuItem>
        <MenuItem onClick={handleResetHome}>Reset Home to default</MenuItem>
      </Menu>

      <ThemeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} themeName={themeName} setThemeName={setThemeName} theme={theme} />
    </div>
  );
}
