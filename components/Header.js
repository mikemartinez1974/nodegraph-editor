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
import ButtonGroup from '@mui/material/ButtonGroup';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import Box from '@mui/material/Box';

export default function Header({ themeName, setThemeName, setTempTheme, theme }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
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

  useEffect(() => {
    const handleSetAddress = ({ url }) => {
      setAddress(url);
    };
    eventBus.on('setAddress', handleSetAddress);
    return () => eventBus.off('setAddress', handleSetAddress);
  }, []);

  useEffect(() => {
    setIsBookmarked(bookmarks.includes(currentUrl));
  }, [bookmarks, currentUrl]);

  const handleBrowserBack = () => {
    window.history.back();
  };

  const handleBrowserForward = () => {
    window.history.forward();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleHome = () => {
    eventBus.emit('clearGraph');
    setAddress('');
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
                disabled={!currentUrl || isLoading}
                title="Refresh"
                aria-label="Refresh current URL"
                size="small"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleHome}
                title="Home (Clear Graph)"
                aria-label="Return to home"
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
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <ThemeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} themeName={themeName} setThemeName={setThemeName} theme={theme} />
    </div>
  );
}
