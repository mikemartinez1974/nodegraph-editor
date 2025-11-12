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
  Alert,
  ListItemIcon,
  ListItemText
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
  BookmarkBorder as BookmarkBorderIcon,
  Map as MapIcon,  // NEW: Import minimap icon
  GridOn as GridOnIcon,  // NEW: Import grid icon
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignRight as FormatAlignRightIcon,
  VerticalAlignTop as VerticalAlignTopIcon,
  VerticalAlignCenter as VerticalAlignCenterIcon,
  VerticalAlignBottom as VerticalAlignBottomIcon,
  SwapHoriz as SwapHorizIcon,
  SwapVert as SwapVertIcon
} from '@mui/icons-material';
import CreateIcon from '@mui/icons-material/Create';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import DrawIcon from '@mui/icons-material/Draw';
import PostAddIcon from '@mui/icons-material/PostAdd';  
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import ShapeLineIcon from '@mui/icons-material/ShapeLine';
import eventBus from '../../NodeGraph/eventBus';
import DocumentPropertiesDialog from './DocumentPropertiesDialog';
import { pasteFromClipboardUnified } from '../handlers/pasteHandler';
import AddNodeMenu from './AddNodeMenu';
import PlumbingIcon from '@mui/icons-material/Plumbing';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import NoteAddIcon from '@mui/icons-material/NoteAdd';

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
  onAlignSelection = () => false,
  onDistributeSelection = () => false,
  onShowMessage,
  pan,
  zoom,
  setNodes,
  setEdges,
  setGroups,
  nodesRef,
  edgesRef,
  saveToHistory,
  graphCRUD,
  currentTheme = 'light',
  backgroundImage = null,
  backgroundUrl = '',  // Document URL
  setBackgroundUrl,  // Function to set document URL
  defaultNodeColor = '#1976d2',
  defaultEdgeColor = '#666666',
  isFreeUser = false,
  showMinimap = true,  // NEW: Add prop
  onToggleMinimap,  // NEW: Add prop
  snapToGrid = false,  // NEW: Add prop
  onToggleSnapToGrid,  // NEW: Add prop
  gridSize = 20,  // Grid size from document settings
  documentTheme = null  // Document theme (not browser theme)
}) => {
  const theme = useTheme();  // Browser theme for UI
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
  const [gridMenuAnchor, setGridMenuAnchor] = useState(null);
  const [alignMenuAnchor, setAlignMenuAnchor] = useState(null);
  const selectionCount = Array.isArray(selectedNodeIds) ? selectedNodeIds.length : 0;
  const canAlign = selectionCount > 1;
  const canDistribute = selectionCount > 2;

  const handleAlignmentAction = (mode, successMessage) => {
    if (typeof onAlignSelection === 'function') {
      const didAlign = onAlignSelection(mode);
      if (didAlign && typeof onShowMessage === 'function') {
        onShowMessage(successMessage, 'success');
      }
    }
    setAlignMenuAnchor(null);
  };

  const handleDistributionAction = (axis, successMessage) => {
    if (typeof onDistributeSelection === 'function') {
      const didDistribute = onDistributeSelection(axis);
      if (didDistribute && typeof onShowMessage === 'function') {
        onShowMessage(successMessage, 'success');
      }
    }
    setAlignMenuAnchor(null);
  };

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

  const handleNewFile = () => {
    const confirmed = window.confirm('Create a new file? Any unsaved changes will be lost.');
    if (confirmed) {
      // Clear via CRUD API if available for immediate ref sync
      let cleared = false;
      if (graphCRUDRef?.current && typeof graphCRUDRef.current.clearGraph === 'function') {
        try {
          graphCRUDRef.current.clearGraph();
          cleared = true;
        } catch (err) {
          console.warn('clearGraph via graphCRUDRef failed:', err);
        }
      }
      if (!cleared && typeof onClearGraph === 'function') {
        try {
          onClearGraph();
          cleared = true;
        } catch (err) {
          console.warn('onClearGraph callback failed:', err);
        }
      }
      if (!cleared) {
        // Fallback: broadcast an event for any listeners to handle clearing
        try { eventBus.emit('clearGraph'); } catch {}
      }

      // Update address bar to show local file
      requestAnimationFrame(() => {
        eventBus.emit('setAddress', 'local://untitled.node');
        if (onShowMessage) onShowMessage('New file created', 'success');
      });
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

          // Update address bar with loaded filename
          eventBus.emit('setAddress', `local://${file.name}`);

          try {
            eventBus.emit('loadSaveFile', { 
              settings: jsonData.settings || {}, 
              viewport: jsonData.viewport || {}, 
              scripts: jsonData.scripts || null,
              filename: file.name
            });
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

  const handleSaveToFile = async () => {
    const now = new Date().toISOString();
    
    // Save document theme (not browser theme)
    const themeToSave = documentTheme || null;
    console.log('[Toolbar] Saving document theme:', themeToSave);

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
        theme: themeToSave,
        backgroundImage: backgroundImage || null,
        defaultNodeColor: defaultNodeColor,
        defaultEdgeColor: defaultEdgeColor,
        snapToGrid: snapToGrid,
        gridSize: gridSize,
        autoSave: false
      },
      viewport: {
        pan: pan || { x: 0, y: 0 },
        zoom: zoom || 1
      },
      // NEW: include document/top-level document URL from localStorage if present
      document: (typeof window !== 'undefined') ? (localStorage.getItem('document') ? { url: localStorage.getItem('document') } : null) : null,
      // NEW: include user scripts stored in localStorage
      scripts: (function(){ try { if (typeof window === 'undefined') return []; const raw = localStorage.getItem('scripts'); return raw ? JSON.parse(raw) : []; } catch { return []; } })(),
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
        style: edge.style || {},
        data: edge.data || {}
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
    
    // Get filename from address bar (remove "local://" prefix)
    let filename = currentUrl.startsWith('local://') 
      ? currentUrl.slice('local://'.length) 
      : currentUrl || 'untitled.node';
    
    // Ensure .node extension
    if (!filename.endsWith('.node')) {
      filename = filename + '.node';
    }
    
    // Fallback to timestamp if empty
    if (!filename || filename === '.node') {
      filename = `graph_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.node`;
    }

    // Try File System Access API first (Chrome, Edge, Brave, Opera)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Node Graph Files',
            accept: { 'application/node': ['.node'] }
          }]
        });

        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();

        // We now KNOW the actual filename!
        const actualFilename = fileHandle.name;
        eventBus.emit('setAddress', `local://${actualFilename}`);

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (onShowMessage) onShowMessage(`Saved as ${actualFilename}`, 'success');
        return;
      } catch (err) {
        // User cancelled or error occurred, fall through to legacy method
        if (err.name === 'AbortError') {
          return; // User cancelled, don't show error
        }
        console.warn('File System Access API failed, falling back to download:', err);
      }
    }

    // Fallback: Legacy download method (Firefox, Safari, or if user denies permission)
    const blob = new Blob([jsonString], { type: 'application/node' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Update address bar assuming user kept the suggested filename
    eventBus.emit('setAddress', `local://${filename}`);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (onShowMessage) onShowMessage(`Saved as ${filename}. If you renamed it, reload to sync.`, 'info');
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

  const graphCRUDRef = useRef(graphCRUD);
  useEffect(() => {
    graphCRUDRef.current = graphCRUD;
  }, [graphCRUD]);

  const handlePasteUniversal = async () => {
    // Delegate to shared paste handler for consistent behavior
    await pasteFromClipboardUnified({ 
      handlers: null, 
      state: { setNodes, nodesRef, setEdges, edgesRef, setGroups, pan, zoom }, 
      historyHook: { saveToHistory }, 
      onShowMessage,
      graphCRUD: graphCRUDRef.current
    });
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
            <ModelTrainingIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            onClick={handlePasteUniversal}
            title="Paste (JSON or Text)"
            aria-label="Paste graph JSON or create node from text"
            size="small"
          >
            <DrawIcon fontSize="small" />
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
            onClick={(e) => setAddNodeMenuAnchor(e.currentTarget)}
            title="Add Node (Ctrl+N)"
            size="small"
          >
            <PostAddIcon fontSize="small"   />
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
            onClick={() => eventBus.emit('togglePropertiesPanel')}
            title="Toggle Properties Panel"
            aria-label="Toggle properties panel"
            size="small"
            color="primary"
          >
            <PlumbingIcon fontSize="small" />
          </IconButton>

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
            onClick={() => eventBus.emit('toggleScriptPanel')}
            title="Toggle Script Panel"
            aria-label="Toggle script panel"
            size="small"
            color="primary"
          >
            <DeveloperModeIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleNewFile}
            title="New File"
            size="small"
            disabled={isFreeUser}
          >
            <NoteAddIcon fontSize="small" />
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

          {/* NEW: Minimap toggle button */}
          <IconButton
            onClick={onToggleMinimap}
            color={showMinimap ? "primary" : "default"}
            title="Toggle Minimap"
            aria-label="Toggle minimap visibility"
            size="small"
          disabled={isFreeUser}
        >
          <MapIcon fontSize="small" />
        </IconButton>

          <IconButton
            onClick={(e) => setAlignMenuAnchor(e.currentTarget)}
            title="Alignment Tools"
            aria-label="Alignment tools menu"
            size="small"
            disabled={isFreeUser || selectionCount < 2}
          >
            <FormatAlignCenterIcon fontSize="small" />
          </IconButton>

          {/* NEW: Grid options button with menu */}
          <IconButton
            onClick={(e) => setGridMenuAnchor(e.currentTarget)}
            color={snapToGrid ? "primary" : "default"}
            title="Grid Options"
            aria-label="Grid options menu"
            size="small"
            disabled={isFreeUser}
          >
            <GridOnIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={() => setPreferencesOpen(true)}
            title="Preferences"
            aria-label="Open Preferences"
            size="small"
            disabled={isFreeUser}
          >
            <HistoryEduIcon fontSize="small" />
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

        {/* Alignment Tools Menu */}
        <Menu
          anchorEl={alignMenuAnchor}
          open={Boolean(alignMenuAnchor)}
          onClose={() => setAlignMenuAnchor(null)}
        >
          <MenuItem disabled={!canAlign} onClick={() => handleAlignmentAction('left', 'Aligned nodes to left edge')}>
            <ListItemIcon>
              <FormatAlignLeftIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Align Left" />
          </MenuItem>
          <MenuItem disabled={!canAlign} onClick={() => handleAlignmentAction('center-horizontal', 'Aligned nodes to horizontal center')}>
            <ListItemIcon>
              <FormatAlignCenterIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Align Horizontal Center" />
          </MenuItem>
          <MenuItem disabled={!canAlign} onClick={() => handleAlignmentAction('right', 'Aligned nodes to right edge')}>
            <ListItemIcon>
              <FormatAlignRightIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Align Right" />
          </MenuItem>
          <MenuItem disabled={!canAlign} onClick={() => handleAlignmentAction('top', 'Aligned nodes to top edge')}>
            <ListItemIcon>
              <VerticalAlignTopIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Align Top" />
          </MenuItem>
          <MenuItem disabled={!canAlign} onClick={() => handleAlignmentAction('center-vertical', 'Aligned nodes to vertical center')}>
            <ListItemIcon>
              <VerticalAlignCenterIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Align Vertical Center" />
          </MenuItem>
          <MenuItem disabled={!canAlign} onClick={() => handleAlignmentAction('bottom', 'Aligned nodes to bottom edge')}>
            <ListItemIcon>
              <VerticalAlignBottomIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Align Bottom" />
          </MenuItem>
          <Divider />
          <MenuItem disabled={!canDistribute} onClick={() => handleDistributionAction('horizontal', 'Distributed nodes horizontally')}>
            <ListItemIcon>
              <SwapHorizIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Distribute Horizontally" />
          </MenuItem>
          <MenuItem disabled={!canDistribute} onClick={() => handleDistributionAction('vertical', 'Distributed nodes vertically')}>
            <ListItemIcon>
              <SwapVertIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Distribute Vertically" />
          </MenuItem>
        </Menu>

        {/* Grid Options Menu */}
        <Menu
          anchorEl={gridMenuAnchor}
          open={Boolean(gridMenuAnchor)}
          onClose={() => setGridMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              eventBus.emit('toggleShowGrid');
              setGridMenuAnchor(null);
            }}
          >
            <Typography variant="body2">Show Grid</Typography>
          </MenuItem>
          <MenuItem
            onClick={() => {
              eventBus.emit('alignToGrid');
              setGridMenuAnchor(null);
              if (onShowMessage) onShowMessage('Nodes aligned to grid', 'success');
            }}
          >
            <Typography variant="body2">Align to Grid</Typography>
          </MenuItem>
          <MenuItem
            onClick={() => {
              onToggleSnapToGrid();
              setGridMenuAnchor(null);
            }}
          >
            <Typography variant="body2">Snap to Grid: {snapToGrid ? 'ON' : 'OFF'}</Typography>
          </MenuItem>
        </Menu>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.node"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <DocumentPropertiesDialog  
          open={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
          backgroundUrl={backgroundUrl}
          setBackgroundUrl={setBackgroundUrl}
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

        {/* Viewport Indicator (compact stacked) */}
        <Box
          sx={{
            ml: 1,
            px: 0.5,
            py: 0.250,
            borderRadius: 1,
            bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
            color: theme.palette.text.secondary,
            fontSize: 10,
            minWidth: 0,
            textAlign: 'center',
            border: `1px solid ${theme.palette.divider}`,
            display: 'inline-block',
            lineHeight: 1.1,
            userSelect: 'text',
            whiteSpace: 'nowrap'
          }}
          title={`Viewport: x=${Math.round(pan?.x || 0)}, y=${Math.round(pan?.y || 0)}, zoom=${zoom?.toFixed(2) || 1}`}
        >
          <span>
            x:{Math.round(pan?.x || 0)}<br />
            y:{Math.round(pan?.y || 0)}<br />
            z:{zoom?.toFixed(2) || 1}
          </span>
        </Box>
      </Box>
    </Paper>
  );
};

export default Toolbar;
