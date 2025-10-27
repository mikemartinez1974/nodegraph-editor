"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Paper,
  IconButton,
  Button,
  ButtonGroup,
  Typography,
  Box,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  MenuItem,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  List as ListIcon,
  Save as SaveIcon,
  Folder as LoadIcon,
  TouchApp as ManualIcon,
  Navigation as NavIcon,
  GridOn as AutoIcon,
  ExpandMore as ExpandMoreIcon,
  ContentPasteGo as ContentPasteGoIcon,
  ThumbDownOffAlt as ThumbDownOffAltIcon,
  FolderSpecial as GroupIcon,
  ContentPaste as ContentPasteIcon,
  ContentCopy as ContentCopyIcon,
  FileCopy as FileCopyIcon,
  MenuBook as MenuBookIcon,
  Settings as SettingsIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon
} from '@mui/icons-material';
import eventBus from '../../NodeGraph/eventBus';
import PreferencesDialog from './PreferencesDialog';
import { pasteFromClipboardUnified } from '../handlers/pasteHandler';
import AddNodeMenu from './AddNodeMenu';

const Toolbar = ({ 
  nodes = [], 
  edges = [], 
  groups = [],
  onLoadGraph, 
  onAddNode, 
  onDeleteSelected, 
  onClearGraph,
  onUndo,
  onRedo,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds = [],
  canUndo = false,
  canRedo = false,
  onToggleNodeList,
  showNodeList = true,
  onToggleGroupList,
  showGroupList = true,
  mode,
  autoLayoutType,
  onModeChange,
  onAutoLayoutChange,
  onApplyLayout,
  onShowMessage,
  pan,
  zoom,
  setNodes,
  nodesRef,
  saveToHistory,
  edgesRef,
  currentTheme = 'light',
  backgroundImage = null,
  defaultNodeColor = '#1976d2',
  defaultEdgeColor = '#666666',
  isFreeUser = false
}) => {
  const theme = useTheme();
  const [pos, setPos] = useState({ x: 0, y: 88 });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [selectedCopied, setSelectedCopied] = useState(false);
  const [onboardCopied, setOnboardCopied] = useState(false);
  const [autoLayoutMenuAnchor, setAutoLayoutMenuAnchor] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [addNodeMenuAnchor, setAddNodeMenuAnchor] = useState(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef(null);
  
  // Browser navigation state
  const [browserHistory, setBrowserHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('graphBrowserBookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [bookmarkMenuAnchor, setBookmarkMenuAnchor] = useState(null);
  const currentUrl = browserHistory[historyIndex] || '';

  // Snackbar state (replaces transient Chips)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPos({ x: window.innerWidth - 600, y: 88 });
    }
    
    // Listen for address changes to update history
    const handleAddressSet = (data) => {
      const url = typeof data === 'string' ? data : data?.url;
      if (url && url !== currentUrl) {
        setBrowserHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          return [...newHistory, url];
        });
        setHistoryIndex(prev => prev + 1);
      }
    };
    
    eventBus.on('setAddress', handleAddressSet);
    return () => eventBus.off('setAddress', handleAddressSet);
  }, [historyIndex, currentUrl]);

  // Watch transient flags and show snackbar when they become true
  useEffect(() => {
    if (copied) {
      setSnackbar({ open: true, message: 'JSON copied to clipboard', severity: 'success' });
    } else if (saved) {
      setSnackbar({ open: true, message: 'Graph saved to .node file', severity: 'success' });
    } else if (pasted) {
      setSnackbar({ open: true, message: 'Pasted content applied', severity: 'success' });
    } else if (selectedCopied) {
      setSnackbar({ open: true, message: 'Selected nodes copied', severity: 'success' });
    } else if (onboardCopied) {
      setSnackbar({ open: true, message: 'LLM onboarding guide copied', severity: 'success' });
    }
  }, [copied, saved, pasted, selectedCopied, onboardCopied]);

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const onMouseDown = e => {
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = e => {
    if (!dragging.current) return;
    setPos({
      x: Math.max(0, Math.min(e.clientX - offset.current.x, window.innerWidth - 240)),
      y: Math.max(0, Math.min(e.clientY - offset.current.y, window.innerHeight - 56)),
    });
  };

  const onMouseUp = () => {
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  const handleClear = () => {
    if (onClearGraph) {
      const confirmed = window.confirm('Are you sure you want to clear the entire graph? This cannot be undone.');
      if (confirmed) {
        onClearGraph();
      }
    }
  };

  const handleLoadFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        let nodesToLoad, edgesToLoad, groupsToLoad;
        
        if (jsonData.fileVersion && jsonData.nodes) {
          nodesToLoad = jsonData.nodes;
          edgesToLoad = jsonData.edges;
          groupsToLoad = jsonData.groups || [];
        } else if (jsonData.nodes && jsonData.edges) {
          nodesToLoad = jsonData.nodes;
          edgesToLoad = jsonData.edges;
          groupsToLoad = jsonData.groups || [];
        } else {
          if (onShowMessage) onShowMessage('Invalid graph file format. Missing nodes or edges.', 'error');
          return;
        }

        if (onLoadGraph) {
          onLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
          if (onShowMessage) onShowMessage('Graph loaded successfully!', 'success');

          try {
            eventBus.emit('loadSaveFile', { settings: jsonData.settings || {}, viewport: jsonData.viewport || {} });
          } catch (err) {
            console.warn('Failed to emit loadSaveFile event:', err);
          }
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        if (onShowMessage) onShowMessage('Error loading file. Please ensure it\'s valid JSON.', 'error');
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveToFile = () => {
    const now = new Date().toISOString();
    
    const themeObject = theme?.palette ? {
      primary: theme.palette.primary?.main || '#1976d2',
      primaryContrast: theme.palette.primary?.contrastText || '#ffffff',
      secondary: theme.palette.secondary?.main || '#dc004e',
      secondaryContrast: theme.palette.secondary?.contrastText || '#ffffff',
      background: theme.palette.background?.default || '#f5f5f5',
      paper: theme.palette.background?.paper || '#ffffff',
      textPrimary: theme.palette.text?.primary || '#000000',
      textSecondary: theme.palette.text?.secondary || '#666666',
      divider: theme.palette.divider || '#e0e0e0'
    } : null;

    const saveData = {
      fileVersion: "1.0",
      metadata: {
        title: "Untitled Graph",
        description: "",
        created: now,
        modified: now,
        author: "",
        tags: []
      },
      settings: {
        theme: themeObject,
        backgroundImage: backgroundImage || null,
        defaultNodeColor: defaultNodeColor || '#1976d2',
        defaultEdgeColor: defaultEdgeColor || '#666666',
        snapToGrid: false,
        gridSize: 20,
        autoSave: false
      },
      viewport: {
        pan: pan || { x: 0, y: 0 },
        zoom: zoom || 1
      },
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: node.position,
        width: node.width,
        height: node.height,
        color: node.color,
        visible: node.visible !== false,
        showLabel: node.showLabel !== false,
        data: node.data || {}
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edge.label || "",
        style: edge.style || {}
      })),
      groups: groups.map(group => ({
        id: group.id,
        label: group.label || "",
        nodeIds: group.nodeIds || [],
        bounds: group.bounds || { x: 0, y: 0, width: 0, height: 0 },
        visible: group.visible !== false,
        style: group.style || {}
      }))
    };

    const jsonString = JSON.stringify(saveData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/node' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.node`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (onShowMessage) onShowMessage('Graph saved to .node file!', 'success');
  };

  const handleCopyOnboard = async () => {
    try {
      const resp = await fetch('/data/OnboardLLM.md');
      let text;
      if (resp.ok) text = await resp.text(); else text = 'OnboardLLM.md not available.';
      await navigator.clipboard.writeText(text);
      setOnboardCopied(true);
      setTimeout(() => setOnboardCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy OnboardLLM.md:', err);
      if (onShowMessage) onShowMessage('Unable to copy onboard guide to clipboard.', 'error');
    }
  };

  const handleCopySelected = async () => {
    if (selectedNodeIds.length === 0) {
      if (onShowMessage) onShowMessage('No nodes selected. Please select nodes to copy.', 'warning');
      return;
    }

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(e => 
      selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    );

    const data = {
      nodes: selectedNodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: node.position,
        width: node.width,
        height: node.height,
        color: node.color,
        data: node.data
      })),
      edges: selectedEdges.map(edge => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        color: edge.color,
        style: edge.style
      }))
    };

    const jsonString = JSON.stringify(data, null, 2);

    try {
      await navigator.clipboard.writeText(jsonString);
      setSelectedCopied(true);
      setTimeout(() => setSelectedCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      if (onShowMessage) onShowMessage('Failed to copy to clipboard. Try using Ctrl+C.', 'error');
    }
  };

  const handlePasteSelected = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const jsonData = JSON.parse(clipboardText);

      if (!jsonData.nodes || !Array.isArray(jsonData.nodes)) {
        if (onShowMessage) onShowMessage('Invalid clipboard data. Must contain nodes array.', 'error');
        return;
      }

      if (typeof window !== 'undefined' && window.handlePasteGraphData) {
        window.handlePasteGraphData(jsonData);
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      } else {
        if (onShowMessage) onShowMessage('Paste handler not available.', 'error');
      }
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
      if (onShowMessage) onShowMessage('Error pasting. Ensure you have valid JSON copied.', 'error');
    }
  };

  const handleCopyUserManual = async () => {
    try {
      const res = await fetch('/data/UserManual.md');
      if (!res.ok) throw new Error('Manual not found');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      if (onShowMessage) onShowMessage('User manual copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy manual:', err);
      if (onShowMessage) onShowMessage('Failed to copy manual. Try again or check network.', 'error');
    }
  };

  const handlePasteUniversal = async () => {
    // Delegate to shared paste handler for consistent behavior
    await pasteFromClipboardUnified({ handlers: null, state: { setNodes, nodesRef, edgesRef, pan, zoom }, historyHook: { saveToHistory }, onShowMessage });
  };

  const handleCopyGraph = () => {
    const graphData = {
      nodes: nodes,
      edges: edges,
      groups: groups || []
    };
    
    const jsonString = JSON.stringify(graphData, null, 2);
    
    navigator.clipboard.writeText(jsonString)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (onShowMessage) onShowMessage('Graph copied to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        if (onShowMessage) onShowMessage('Failed to copy to clipboard.', 'error');
      });
  };

  const handleHome = () => {
    if (onClearGraph) {
      const confirmed = window.confirm('Navigate to home? This will clear the current graph.');
      if (confirmed) {
        onClearGraph();
        setBrowserHistory(['']);
        setHistoryIndex(0);
        eventBus.emit('setAddress', { url: '' });
      }
    }
  };

  const handleToggleBookmark = () => {
    if (!currentUrl) return;
    
    const existingIndex = bookmarks.findIndex(b => b.url === currentUrl);
    let newBookmarks;
    
    if (existingIndex >= 0) {
      newBookmarks = bookmarks.filter((_, i) => i !== existingIndex);
      if (onShowMessage) onShowMessage('Bookmark removed', 'success');
    } else {
      const title = currentUrl.length > 40 ? currentUrl.substring(0, 37) + '...' : currentUrl;
      newBookmarks = [...bookmarks, { url: currentUrl, title, date: new Date().toISOString() }];
      if (onShowMessage) onShowMessage('Bookmark added', 'success');
    }
    
    setBookmarks(newBookmarks);
    localStorage.setItem('graphBrowserBookmarks', JSON.stringify(newBookmarks));
  };

  const handleBookmarkClick = (url) => {
    eventBus.emit('fetchUrl', { url });
    setBookmarkMenuAnchor(null);
  };

  const isBookmarked = currentUrl && bookmarks.some(b => b.url === currentUrl);

  return (
    <Paper
      elevation={3}
      role="toolbar"
      aria-label="Graph editor toolbar"
      sx={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        zIndex: 1300,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        cursor: dragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        maxWidth: '90vw'
      }}
      onMouseDown={onMouseDown}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        p: 1,
        flexWrap: 'nowrap'
      }}>
        {/* Main Toolbar Controls */}
        <ButtonGroup variant="contained" size="small" sx={{ mr: 1 }}>
          <IconButton
            onClick={handleCopyOnboard}
            title="Onboard LLM"
            aria-label="Copy LLM onboarding guide to clipboard"
            size="small"
          >
            <ContentPasteGoIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            onClick={handlePasteUniversal}
            title="Paste (JSON or Text)"
            aria-label="Paste graph JSON or create node from text"
            size="small"
          >
            <ContentPasteIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleCopySelected}
            disabled={selectedNodeIds.length === 0}
            title="Copy Selected Nodes + Edges"
            aria-label={`Copy ${selectedNodeIds.length} selected nodes to clipboard`}
            size="small"
            color={selectedNodeIds.length > 0 ? "primary" : "default"}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleCopyGraph}
            title="Copy Entire Graph"
            aria-label="Copy entire graph JSON"
            size="small"
            disabled={!nodes || nodes.length === 0}
          >
            <FileCopyIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            onClick={handleCopyUserManual}
            title="Copy User Manual"
            aria-label="Copy the User Manual to clipboard"
            size="small"
          >
            <MenuBookIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            onClick={(e) => setAddNodeMenuAnchor(e.currentTarget)}
            title="Add Node (Ctrl+N)"
            size="small"
          >
            <AddIcon />
          </IconButton>

          <IconButton
            onClick={onDeleteSelected}
            disabled={!selectedNodeId && !selectedEdgeId}
            color={selectedNodeId || selectedEdgeId ? "error" : "inherit"}
            title="Delete Selected (Delete)"
            size="small"
          >
            <DeleteIcon />
          </IconButton>

          <IconButton
            onClick={handleClear}
            title="Clear Graph"
            size="small"
            color="error"
            disabled={isFreeUser}
          >
            <ThumbDownOffAltIcon fontSize="small" />
          </IconButton>

          <ButtonGroup size="small" sx={{ mr: 1 }}>
            <IconButton
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              size="small"
            >
              <UndoIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              size="small"
            >
              <RedoIcon fontSize="small" />
            </IconButton>
          </ButtonGroup>
          
          <IconButton
            onClick={onToggleNodeList}
            color={showNodeList ? "primary" : "default"}
            title="Toggle Node List"
            size="small"
            disabled={isFreeUser}
          >
            <ListIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={onToggleGroupList}
            color={showGroupList ? "primary" : "default"}
            title="Toggle Group List"
            size="small"
            disabled={isFreeUser}
          >
            <GroupIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleSaveToFile}
            title="Save Graph to File (.nodegraph)"
            size="small"
            disabled={isFreeUser}
          >
            <SaveIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleLoadFile}
            title="Load Graph from File"
            size="small"
            disabled={isFreeUser}
          >
            <LoadIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={() => setPreferencesOpen(true)}
            title="Preferences"
            aria-label="Open Preferences"
            size="small"
            disabled={isFreeUser}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </ButtonGroup>

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(event, newMode) => {
            if (newMode !== null) {
              onModeChange(newMode);
            }
          }}
          size="small"
          sx={{ mr: 1 }}
          disabled={isFreeUser}
        >
          <ToggleButton value="manual" title="Manual Mode">
            <ManualIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="nav" title="Navigation Mode">
            <NavIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="auto" title="Auto Layout Mode">
            <AutoIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        {mode === 'auto' && (
          <ButtonGroup size="small" sx={{ mr: 1 }}>
            <Button
              onClick={(event) => {
                setAutoLayoutMenuAnchor(event.currentTarget);
              }}
              endIcon={<ExpandMoreIcon fontSize="small" />}
              size="small"
              variant="outlined"
              disabled={isFreeUser}
            >
              {autoLayoutType}
            </Button>
            <Button
              onClick={onApplyLayout}
              size="small"
              variant="contained"
              startIcon={<AutoIcon fontSize="small" />}
              disabled={isFreeUser}
            >
              Apply
            </Button>
          </ButtonGroup>
        )}
        <Menu
          anchorEl={autoLayoutMenuAnchor}
          open={Boolean(autoLayoutMenuAnchor)}
          onClose={() => setAutoLayoutMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              onAutoLayoutChange('hierarchical');
              setAutoLayoutMenuAnchor(null);
            }}
            selected={autoLayoutType === 'hierarchical'}
          >
            Hierarchical
          </MenuItem>
          <MenuItem
            onClick={() => {
              onAutoLayoutChange('radial');
              setAutoLayoutMenuAnchor(null);
            }}
            selected={autoLayoutType === 'radial'}
          >
            Radial
          </MenuItem>
          <MenuItem
            onClick={() => {
              onAutoLayoutChange('grid');
              setAutoLayoutMenuAnchor(null);
            }}
            selected={autoLayoutType === 'grid'}
          >
            Grid
          </MenuItem>
        </Menu>

        <AddNodeMenu
          anchorEl={addNodeMenuAnchor}
          open={Boolean(addNodeMenuAnchor)}
          onClose={() => setAddNodeMenuAnchor(null)}
          onAddNode={onAddNode}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.node"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <PreferencesDialog  
          open={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
        />
        
        {/* Bookmarks Menu */}
        <Menu
          anchorEl={bookmarkMenuAnchor}
          open={Boolean(bookmarkMenuAnchor)}
          onClose={() => setBookmarkMenuAnchor(null)}
          PaperProps={{
            style: {
              maxHeight: 400,
              minWidth: 300,
            },
          }}
        >
          {bookmarks.length === 0 ? (
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                No bookmarks yet
              </Typography>
            </MenuItem>
          ) : (
            bookmarks.map((bookmark, index) => (
              <MenuItem
                key={index}
                onClick={() => handleBookmarkClick(bookmark.url)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  py: 1,
                  pr: 6
                }}
              >
                <Typography variant="body2" noWrap sx={{ maxWidth: 280, fontWeight: 500 }}>
                  {bookmark.title || bookmark.url}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>
                  {bookmark.url}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newBookmarks = bookmarks.filter((_, i) => i !== index);
                    setBookmarks(newBookmarks);
                    localStorage.setItem('graphBrowserBookmarks', JSON.stringify(newBookmarks));
                    if (onShowMessage) onShowMessage('Bookmark removed', 'success');
                  }}
                  sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </MenuItem>
            ))
          )}
        </Menu>

        {/* Snackbar for transient messages */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Paper>
  );
};

export default Toolbar;