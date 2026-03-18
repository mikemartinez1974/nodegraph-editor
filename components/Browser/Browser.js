"use client";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { useState, useEffect, useRef } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
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
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import LinkIcon from '@mui/icons-material/Link';
import TemplateGallery from './TemplateGallery';

const DENSITY_OPTIONS = ['comfortable', 'compact', 'dense'];
const normalizeUiDensity = (value) => (DENSITY_OPTIONS.includes(value) ? value : 'comfortable');

export default function Browser({ themeName, setThemeName, setTempTheme, theme, applyBrowserTheme, isMobile, isSmallScreen, isPortrait, isLandscape }) {
  const [address, setAddress] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Use refs as the authoritative source for history and index to avoid stale closures
  const historyIndexRef = useRef(-1);
  const browserHistoryRef = useRef([]);
  const [browserHistory, setBrowserHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null); // bookmark menu anchor
  const [addressMenuPos, setAddressMenuPos] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [uiDensity, setUiDensity] = useState('comfortable');
  const [viewportInfo, setViewportInfo] = useState({ x: 0, y: 0, z: 1 });
  const navigatingToUrlRef = useRef(null);  // Track URL we're navigating to via back/forward
  const setAddressCountRef = useRef(0);  // Reset helper for back/forward navigation bookkeeping
  const previewAddressRef = useRef('');
  
  let muiTheme = useTheme();
  if (!muiTheme || !('palette' in muiTheme)) {
    muiTheme = themeMap.default;
  }
  // Dark mode = dark logo, Light mode = light logo
  const logoSrc = muiTheme?.palette?.mode === 'dark' ? '/logo_dark.png' : '/logo_light.png';
  const [imgError, setImgError] = useState(false);
  const currentUrl = browserHistory[historyIndex] || '';

  // Home URL management
  const DEFAULT_HOME = 'https://twilite.zone/data/IntroGraph.node';
  const LEGACY_DEFAULT_HOME = 'https://cpwith.me/data/IntroGraph.node';
  const [homeUrl, setHomeUrl] = useState(DEFAULT_HOME);
  const [homeMenuAnchor, setHomeMenuAnchor] = useState(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('twilite.uiDensity');
        if (stored) setUiDensity(normalizeUiDensity(stored));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleDensity = (payload = {}) => {
      const incoming = normalizeUiDensity(payload?.uiDensity);
      setUiDensity(incoming);
    };
    const handleSettings = ({ settings } = {}) => {
      const incoming = normalizeUiDensity(settings?.uiDensity);
      setUiDensity(incoming);
    };
    eventBus.on('uiDensityChanged', handleDensity);
    eventBus.on('documentSettingsUpdated', handleSettings);
    return () => {
      eventBus.off('uiDensityChanged', handleDensity);
      eventBus.off('documentSettingsUpdated', handleSettings);
    };
  }, []);

  useEffect(() => {
    const handleViewportInfoChanged = (payload = {}) => {
      setViewportInfo({
        x: Number.isFinite(payload?.pan?.x) ? payload.pan.x : 0,
        y: Number.isFinite(payload?.pan?.y) ? payload.pan.y : 0,
        z: Number.isFinite(payload?.zoom) ? payload.zoom : 1
      });
    };
    eventBus.on('viewportInfoChanged', handleViewportInfoChanged);
    return () => eventBus.off('viewportInfoChanged', handleViewportInfoChanged);
  }, []);

  const densityConfig = (() => {
    if (uiDensity === 'dense') {
      return {
        toolbarMinHeight: isMobile ? 38 : 42,
        toolbarPaddingX: isMobile ? 0.25 : 0.5,
        toolbarGap: 0.25,
        iconButtonPadding: 0.35
      };
    }
    if (uiDensity === 'compact') {
      return {
        toolbarMinHeight: isMobile ? 40 : 46,
        toolbarPaddingX: isMobile ? 0.5 : 0.75,
        toolbarGap: 0.35,
        iconButtonPadding: 0.45
      };
    }
    return {
      toolbarMinHeight: isMobile ? 42 : 50,
      toolbarPaddingX: isMobile ? 0.5 : 1,
      toolbarGap: 0.5,
      iconButtonPadding: 0.6
    };
  })();


  useEffect(() => {
    try {
      const stored = localStorage.getItem('homeUrl');
      if (stored) {
        if (stored === LEGACY_DEFAULT_HOME) {
          localStorage.removeItem('homeUrl');
          setHomeUrl(DEFAULT_HOME);
        } else {
          setHomeUrl(stored);
        }
      } else {
        setHomeUrl(DEFAULT_HOME);
      }
    } catch (err) {
      setHomeUrl(DEFAULT_HOME);
    }
  }, []);

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
      
      const localhostNames = ['localhost', '127.0.0.1', '[::1]'];
      if (!host || localhostNames.includes(host)) {
        const origin = (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null')
          ? window.location.origin
          : 'http://localhost:3000';
        return origin + path;
      }
      
      return `https://${host}${path}`;
    } catch (err) {
      return url;
    }
  };

  const appendRootNodeIfDirectoryLike = (pathname = '') => {
    if (!pathname || pathname === '/') return '/root.node';
    if (pathname.endsWith('/')) return `${pathname}root.node`;
    const lastSegment = pathname.split('/').pop() || '';
    if (!lastSegment || !lastSegment.includes('.')) return `${pathname}/root.node`;
    return pathname;
  };

  // If an address points to a folder-like path, load root.node from that path.
  const resolveFolderToRootNode = (url) => {
    if (typeof url !== 'string') return url;
    const trimmed = url.trim();
    if (!trimmed) return trimmed;

    // Absolute http(s) URLs
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        parsed.pathname = appendRootNodeIfDirectoryLike(parsed.pathname || '/');
        return parsed.toString();
      } catch {
        return trimmed;
      }
    }

    // Local/relative paths
    const hashIndex = trimmed.indexOf('#');
    const queryIndex = trimmed.indexOf('?');
    const splitIndex = [hashIndex, queryIndex].filter(index => index >= 0).sort((a, b) => a - b)[0];
    const base = splitIndex === undefined ? trimmed : trimmed.slice(0, splitIndex);
    const suffix = splitIndex === undefined ? '' : trimmed.slice(splitIndex);
    return `${appendRootNodeIfDirectoryLike(base)}${suffix}`;
  };

  const toFetchableUrl = (url) => {
    if (typeof url === 'string' && url.startsWith('local://')) {
      const localPath = url.slice('local://'.length).trim();
      if (!localPath) return null;
      const normalizedPath = localPath.startsWith('/') ? localPath : `/${localPath}`;
      const isVsCodeHost = typeof window !== 'undefined' && window.__Twilite_HOST__ === 'vscode';
      return isVsCodeHost ? normalizedPath : null;
    }
    const converted = convertTlzToFetchUrl(url);
    return resolveFolderToRootNode(converted);
  };

  const emitFetchUrl = (rawUrl) => {
    const fetchable = toFetchableUrl(rawUrl);
    if (!fetchable) return;
    eventBus.emit('fetchUrl', { url: fetchable });
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
      previewAddressRef.current = '';

      // Skip history updates if this is the URL we're navigating to via back/forward
      if (navigatingToUrlRef.current === url) {
        // Update address bar but do not push history
        setAddress(url);
        navigatingToUrlRef.current = null;
        setAddressCountRef.current = 0;
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

  useEffect(() => {
    const handleSetAddressPreview = (data) => {
      const url = typeof data === 'string' ? data : data?.url;
      if (!url) return;
      previewAddressRef.current = url;
      setAddress(url);
    };

    const handleClearAddressPreview = () => {
      if (!previewAddressRef.current) return;
      previewAddressRef.current = '';
      setAddress(browserHistoryRef.current[historyIndexRef.current] || '');
    };

    eventBus.on('setAddressPreview', handleSetAddressPreview);
    eventBus.on('clearAddressPreview', handleClearAddressPreview);
    return () => {
      eventBus.off('setAddressPreview', handleSetAddressPreview);
      eventBus.off('clearAddressPreview', handleClearAddressPreview);
    };
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
        emitFetchUrl(url);
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
        emitFetchUrl(url);
      }
    }
  };

  const handleRefresh = () => {
    const hostUrl = currentUrl || address;
    try {
      eventBus.emit('refreshCurrentGraphContext', {
        hostUrl,
        displayedUrl: address || hostUrl || ''
      });
    } catch (err) {
      if (hostUrl) {
        emitFetchUrl(hostUrl);
      }
    }
  };

  const handleHome = () => {
    if (!homeUrl) {
      eventBus.emit('clearBackgroundUrl');
      eventBus.emit('setAddress', 'local://untitled.node');
      return;
    }
    setAddress(homeUrl);
    emitFetchUrl(homeUrl);
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
      const fetchable = toFetchableUrl(candidate);
      if (!fetchable) {
        alert('This URL is not fetchable in this environment.');
        setHomeMenuAnchor(null);
        return;
      }
      localStorage.setItem('homeUrl', fetchable);
      setHomeUrl(fetchable);
      alert('Home set to: ' + fetchable);
    } catch (err) {
      console.warn('Failed to set home URL:', err);
      alert('Failed to set home URL');
    }
    setHomeMenuAnchor(null);
  };

  const handleClearHome = () => {
    try {
      localStorage.removeItem('homeUrl');
      setHomeUrl('');
      alert('Home page cleared. New tab will appear next time.');
    } catch (err) {
      console.warn('Failed to clear home URL:', err);
      alert('Failed to clear home URL');
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
    emitFetchUrl(url);
  };

  const handleRemoveBookmark = (url) => {
    const next = bookmarks.filter(u => u !== url);
    setBookmarks(next);
  };

  const handleOpenGallery = () => setGalleryOpen(true);
  const handleCloseGallery = () => setGalleryOpen(false);
  const handleTemplateSelect = (template) => {
    if (!template || !template.resolvedUrl) return;
    setGalleryOpen(false);
    setAddress(template.resolvedUrl);
    emitFetchUrl(template.resolvedUrl);
  };

  const writeClipboardText = async (value) => {
    const text = typeof value === 'string' ? value : '';
    if (!text) return;
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
  };

  const readClipboardText = async () => {
    if (navigator?.clipboard?.readText) return navigator.clipboard.readText();
    return '';
  };

  const handleAddressContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setAddressMenuPos({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6
    });
  };

  const handleCloseAddressMenu = () => setAddressMenuPos(null);

  const handleCopyAddress = async () => {
    try {
      await writeClipboardText((address || '').trim());
    } catch (err) {
      console.warn('Failed to copy address:', err);
    }
    handleCloseAddressMenu();
  };

  const handlePasteAndGoAddress = async () => {
    try {
      const text = await readClipboardText();
      if (typeof text === 'string') {
        const next = text.trim();
        if (next) {
          setAddress(next);
          emitFetchUrl(next);
        }
      }
    } catch (err) {
      console.warn('Failed to paste & go address:', err);
    }
    handleCloseAddressMenu();
  };

  const handleCopyWebFriendlyUrl = async () => {
    const doc = (address || currentUrl || '').trim();
    if (!doc) {
      handleCloseAddressMenu();
      return;
    }
    const launchUrl = `https://twilite.zone/?doc=${encodeURIComponent(doc)}`;
    try {
      await writeClipboardText(launchUrl);
    } catch (err) {
      console.warn('Failed to copy web-friendly URL:', err);
    }
    handleCloseAddressMenu();
  };

  useEffect(() => {
    const handleToggleTemplateGallery = ({ open } = {}) => {
      if (typeof open === 'boolean') {
        setGalleryOpen(open);
      } else {
        setGalleryOpen(prev => !prev);
      }
    };

    eventBus.on('toggleTemplateGallery', handleToggleTemplateGallery);
    return () => eventBus.off('toggleTemplateGallery', handleToggleTemplateGallery);
  }, []);

  return (
    <div>
      <AppBar position="fixed" color="primary" sx={{
        background: `linear-gradient(135deg, ${muiTheme.palette.primary.light} 0%, ${muiTheme.palette.primary.dark} 100%)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <Toolbar
          variant={isMobile ? "dense" : "regular"}
          sx={{
            minHeight: densityConfig.toolbarMinHeight,
            px: densityConfig.toolbarPaddingX,
            gap: densityConfig.toolbarGap
          }}
        >

          {/* Navigation buttons - hide on mobile portrait, show on landscape */}
          {(!isMobile || (isMobile && isLandscape)) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ButtonGroup
                variant="outlined"
                size="small"
                sx={{
                  borderColor: muiTheme.palette.divider,
                  '& .MuiIconButton-root': { p: densityConfig.iconButtonPadding }
                }}
              >
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
                <IconButton
                  onClick={handleOpenGallery}
                  title="Template gallery"
                  aria-label="Open template gallery"
                  size="small"
                >
                  <DashboardCustomizeIcon fontSize="small" />
                </IconButton>
              </ButtonGroup>
            </Box>
          )}

          {(!isMobile || isLandscape) && (
            <Box
              sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: alpha(muiTheme.palette.common.black, muiTheme.palette.mode === 'dark' ? 0.2 : 0.08),
                border: `1px solid ${alpha(muiTheme.palette.common.white, muiTheme.palette.mode === 'dark' ? 0.12 : 0.35)}`,
                color: muiTheme.palette.getContrastText(muiTheme.palette.primary.dark),
                fontSize: densityConfig.iconSize * 0.7,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                userSelect: 'text'
              }}
              title={`Viewport: x=${viewportInfo.x}, y=${viewportInfo.y}, zoom=${viewportInfo.z.toFixed(2)}`}
            >
              x:{viewportInfo.x} y:{viewportInfo.y} z:{viewportInfo.z.toFixed(2)}
            </Box>
          )}
          
          <Box
            sx={{
              flex: 1,
              minWidth: isMobile && isPortrait ? 0 :
                isMobile && isLandscape ? 220 :
                isSmallScreen ? 240 : 300
            }}
          >
            <TextField
              variant="outlined"
              size="small"
              fullWidth
              placeholder={isMobile && isPortrait ? "URL..." : "Enter URL or search..."}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onContextMenu={handleAddressContextMenu}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const fetchUrl = (function(input) {
                    const trimmed = (input || '').trim();
                    if (!trimmed) return '';
                    
                    // Already handled protocol?
                    if (trimmed.startsWith('tlz://')) return toFetchableUrl(trimmed);
                    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return toFetchableUrl(trimmed);
                    if (trimmed.includes('://')) return trimmed;
                    
                    // Local paths (explicit)
                    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return toFetchableUrl(trimmed);
                    
                    // If it's a bare .node filename, assume local first
                    if (trimmed.endsWith('.node')) return '/' + trimmed;
                    
                    // If it looks like a domain (e.g. google.com), prepend https://
                    // But exclude common filenames or single words without dots
                    const firstPart = trimmed.split('/')[0];
                    if (firstPart.includes('.') && 
                        !firstPart.endsWith('.node') && 
                        !firstPart.endsWith('.json')) {
                      return toFetchableUrl('https://' + trimmed);
                    }
                    
                    // Default to local path if it doesn't look like anything else
                    return toFetchableUrl('/' + trimmed);
                  })(address);
                  if (fetchUrl) emitFetchUrl(fetchUrl);
                  else emitFetchUrl(address);
                }
              }}
              InputProps={{
                startAdornment: (!isMobile || isLandscape) && (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: muiTheme.palette.background.paper,
                  borderRadius: 1,
                },
              }}
            />
          </Box>
          
          {/* Bookmark buttons - show in landscape, hide in portrait on mobile */}
          {(!isMobile || (isMobile && isLandscape)) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
          )}

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
        <MenuItem onClick={() => { handleCloseHomeMenu(); handleOpenGallery(); }}>Browse Template Gallery</MenuItem>
        <MenuItem onClick={handleSetCurrentAsHome}>Set current document as Home</MenuItem>
        <MenuItem onClick={handleClearHome}>Clear Home page</MenuItem>
      </Menu>

      <Menu
        open={Boolean(addressMenuPos)}
        onClose={handleCloseAddressMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          addressMenuPos
            ? { top: addressMenuPos.mouseY, left: addressMenuPos.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleCopyAddress}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Copy
        </MenuItem>
        <MenuItem onClick={handlePasteAndGoAddress}>
          <ContentPasteIcon fontSize="small" sx={{ mr: 1 }} />
          Paste & Go
        </MenuItem>
        <MenuItem onClick={handleCopyWebFriendlyUrl}>
          <LinkIcon fontSize="small" sx={{ mr: 1 }} />
          Copy Web-Friendly URL
        </MenuItem>
      </Menu>

      <TemplateGallery open={galleryOpen} onClose={handleCloseGallery} onSelect={handleTemplateSelect} />
    </div>
  );
}
