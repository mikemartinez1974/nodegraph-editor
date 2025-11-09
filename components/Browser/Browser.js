"use client";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ThemeDrawer from './ThemeDrawer';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import themeMap from './themes';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import eventBus from '../NodeGraph/eventBus';
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
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Icon from '@mui/material/Icon';

export default function Browser({ themeName, setThemeName, setTempTheme, theme, applyBrowserTheme }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Use refs as the authoritative source for history and index to avoid stale closures
  const historyIndexRef = useRef(-1);
  const browserHistoryRef = useRef([]);
  const [browserHistory, setBrowserHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null); // bookmark menu anchor
  const [isBookmarked, setIsBookmarked] = useState(false);
  const navigatingToUrlRef = useRef(null);  // Track URL we're navigating to via back/forward
  const setAddressCountRef = useRef(0);  // Count how many setAddress events we've received
  
  let muiTheme = useTheme();
  if (!muiTheme || !('palette' in muiTheme)) {
    muiTheme = themeMap.default;
  }
  // Dark mode = dark logo, Light mode = light logo
  const logoSrc = muiTheme?.palette?.mode === 'dark' ? '/logo_dark.png' : '/logo_light.png';
  const [imgError, setImgError] = useState(false);
  const currentUrl = browserHistory[historyIndex] || '';

  // Home URL management
  const DEFAULT_HOME = 'https://cpwith.me/data/IntroGraph.node';
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

  // One-time startup: navigate to home URL if no graph is loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Check if there's already content loaded (via localStorage or other means)
        const hasInitialContent = localStorage.getItem('lastLoadedUrl');
        
        // Only navigate to home if there's no initial content
        if (!hasInitialContent && homeUrl) {
          const fetchable = convertTlzToFetchUrl(homeUrl);
          eventBus.emit('fetchUrl', { url: fetchable });
        }
      } catch (err) {
        console.warn('Startup home navigation failed:', err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [homeUrl]);

  // Load persisted bookmarks on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bookmarks');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setBookmarks(parsed);
      }
    } catch (err) {
      console.warn('Failed to load bookmarks:', err);
    }
  }, []);

  // Persist bookmarks whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    } catch (err) {
      console.warn('Failed to save bookmarks:', err);
    }
  }, [bookmarks]);

  useEffect(() => {
    setIsBookmarked(bookmarks.includes(currentUrl));
  }, [bookmarks, currentUrl]);

  // Helper to convert tlz to https fetchable URL
  const convertTlzToFetchUrl = (url) => {
    try {
      if (typeof url !== 'string') return url;
      if (!url.startsWith('tlz://')) return url;
      const rest = url.slice('tlz://'.length);
      const firstSlash = rest.indexOf('/');
      let host = '';
      let path = '';
      if (firstSlash !== -1) {
        host = rest.slice(0, firstSlash);
        path = rest.slice(firstSlash);
      } else {
        path = '/' + rest;
      }
      const origin = (window.location.protocol === 'https:' ? 'https://' : window.location.protocol + '//') + host;
      return origin + path;
    } catch (err) {
      return url;
    }
  };

  // Push a canonical url into the history (keeps refs and state in sync)
  const pushHistory = (url) => {
    if (!url) return;
    const idx = historyIndexRef.current;
    const truncated = browserHistoryRef.current.slice(0, Math.max(0, idx + 1));
    // Avoid duplicate consecutive entries
    if (truncated[truncated.length - 1] === url) {
      historyIndexRef.current = truncated.length - 1;
      setHistoryIndex(historyIndexRef.current);
      browserHistoryRef.current = truncated;
      setBrowserHistory([...browserHistoryRef.current]);
      return;
    }
    browserHistoryRef.current = [...truncated, url];
    historyIndexRef.current = browserHistoryRef.current.length - 1;
    setBrowserHistory([...browserHistoryRef.current]);
    setHistoryIndex(historyIndexRef.current);
  };

  useEffect(() => {
    // Handle setAddress events: accept string or object { url }
    const handleSetAddress = (data) => {
      const url = typeof data === 'string' ? data : data?.url;
      if (!url) return;

      // Skip history updates if this is the URL we're navigating to via back/forward
      if (navigatingToUrlRef.current === url) {
        // Update address bar but do not push history
        setAddress(url);
        // Increment counter for duplicate navigation signals
        setAddressCountRef.current++;
        // Clear the flag after we've seen it twice (GraphEditor emits start/end)
        if (setAddressCountRef.current >= 2) {
          navigatingToUrlRef.current = null;
          setAddressCountRef.current = 0;
        }
        return;
      }

      // Show canonical url in address bar (no tlz)
      setAddress(url);
      // Push into our ref-backed history
      pushHistory(url);
    };
    eventBus.on('setAddress', handleSetAddress);
    return () => eventBus.off('setAddress', handleSetAddress);
  }, []);

  const handleBrowserBack = () => {
    console.log('⬅️ BACK clicked');
    console.log('   Before: historyIndexRef.current =', historyIndexRef.current);
    console.log('   History:', browserHistoryRef.current);
    if (historyIndexRef.current > 0) {
      historyIndexRef.current = historyIndexRef.current - 1;
      setHistoryIndex(historyIndexRef.current);
      const url = browserHistoryRef.current[historyIndexRef.current];
      console.log('   After: historyIndexRef.current =', historyIndexRef.current);
      console.log('   Navigating to:', url);
      if (url) {
        navigatingToUrlRef.current = url;  // Mark this URL as a navigation target
        setAddressCountRef.current = 0;  // Reset counter
        setAddress(url);
        const fetchable = convertTlzToFetchUrl(url);
        eventBus.emit('fetchUrl', { url: fetchable });
      }
    }
  };

  const handleBrowserForward = () => {
    console.log('➡️ FORWARD clicked');
    console.log('   Before: historyIndexRef.current =', historyIndexRef.current);
    console.log('   History length:', browserHistoryRef.current.length);
    console.log('   History:', browserHistoryRef.current);
    if (historyIndexRef.current < browserHistoryRef.current.length - 1) {
      historyIndexRef.current = historyIndexRef.current + 1;
      setHistoryIndex(historyIndexRef.current);
      const url = browserHistoryRef.current[historyIndexRef.current];
      console.log('   After: historyIndexRef.current =', historyIndexRef.current);
      console.log('   Navigating to:', url);
      if (url) {
        navigatingToUrlRef.current = url;  // Mark this URL as a navigation target
        setAddressCountRef.current = 0;  // Reset counter
        setAddress(url);
        const fetchable = convertTlzToFetchUrl(url);
        eventBus.emit('fetchUrl', { url: fetchable });
      }
    }
  };

  const handleRefresh = () => {
    const url = currentUrl || address;
    if (url) {
      const fetchable = convertTlzToFetchUrl(url);
      eventBus.emit('fetchUrl', { url: fetchable });
    }
  };

  const handleHome = () => {
    // Navigate to the configured home URL (display canonical URL)
    if (!homeUrl) {
      alert('Home URL not set');
      return;
    }
    setAddress(homeUrl);
    // Do not push history here; GraphEditor will emit setAddress when it starts fetching
    const fetchable = convertTlzToFetchUrl(homeUrl);
    eventBus.emit('fetchUrl', { url: fetchable });
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
      const fetchable = convertTlzToFetchUrl(candidate);
      localStorage.setItem('homeUrl', fetchable);
      setHomeUrl(fetchable);
      alert('Home set to: ' + fetchable);
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

  // Bookmark actions
  const handleToggleBookmark = () => {
    if (!currentUrl) return;
    if (bookmarks.includes(currentUrl)) {
      const next = bookmarks.filter((url) => url !== currentUrl);
      setBookmarks(next);
    } else {
      const next = [...bookmarks, currentUrl];
      setBookmarks(next);
    }
  };

  const handleOpenBookmarksMenu = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleCloseBookmarksMenu = () => {
    setAnchorEl(null);
  };

  const handleOpenBookmark = (url) => {
    if (!url) return;
    setAddress(url);
    handleCloseBookmarksMenu();
    eventBus.emit('fetchUrl', { url });
  };

  const handleRemoveBookmark = (url) => {
    const next = bookmarks.filter(u => u !== url);
    setBookmarks(next);
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
                const fetchUrl = (function(input) {
                  const trimmed = (input || '').trim();
                  if (!trimmed) return '';
                  if (trimmed.startsWith('tlz://')) return convertTlzToFetchUrl(trimmed);
                  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
                  if (/[.]/.test(trimmed.split('/')[0])) return 'https://' + trimmed;
                  return trimmed;
                })(address);
                if (fetchUrl) {
                  // Do not push history here; GraphEditor will emit setAddress when it starts fetching
                  eventBus.emit('fetchUrl', { url: fetchUrl });
                } else {
                  eventBus.emit('fetchUrl', { url: address });
                }
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
              onClick={handleOpenBookmarksMenu}
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

      {/* Bookmarks menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseBookmarksMenu}>
        {bookmarks.length === 0 ? (
          <MenuItem disabled>No bookmarks</MenuItem>
        ) : (
          bookmarks.map((url) => (
            <MenuItem key={url} onClick={() => handleOpenBookmark(url)} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <OpenInNewIcon fontSize="small" />
                <Typography variant="body2" sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</Typography>
              </Box>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveBookmark(url); }} aria-label="Remove bookmark">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </MenuItem>
          ))
        )}
      </Menu>

      <Menu anchorEl={homeMenuAnchor} open={Boolean(homeMenuAnchor)} onClose={handleCloseHomeMenu}>
        <MenuItem onClick={handleSetCurrentAsHome}>Set current document as Home</MenuItem>
        <MenuItem onClick={handleResetHome}>Reset Home to default</MenuItem>
      </Menu>

      <ThemeDrawer 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        themeName={themeName} 
        setThemeName={setThemeName} 
        theme={theme}
        applyBrowserTheme={applyBrowserTheme}
      />
    </div>
  );
}