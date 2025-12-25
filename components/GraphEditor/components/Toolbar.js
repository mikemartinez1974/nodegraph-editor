"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import eventBus, { useEventBusListener } from '../../NodeGraph/eventBus';
import DocumentPropertiesDialog from './DocumentPropertiesDialog';
import { pasteFromClipboardUnified } from '../handlers/pasteHandler';
import AddNodeMenu from './AddNodeMenu';
import PlumbingIcon from '@mui/icons-material/Plumbing';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ExtensionIcon from '@mui/icons-material/Extension';
import PluginManagerPanel from './PluginManagerPanel';

// Import toolbar section components
import FileActions from './Toolbar/FileActions';
import HistoryActions from './Toolbar/HistoryActions';
import NodeActions from './Toolbar/NodeActions';
import ViewActions from './Toolbar/ViewActions';
import PanelActions from './Toolbar/PanelActions';

const Toolbar = ({ 
  nodes = [], 
  edges = [], 
  groups = [],
  onLoadGraph, 
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
  onToggleNodePalette,
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
  edgeRouting = 'auto', // Edge routing mode from document settings
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
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
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

  // Retractable drawer state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const retractTimerRef = useRef(null);

  // Auto-retract after delay when mouse leaves
  useEffect(() => {
    if (!isHovering && isExpanded) {
      retractTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 800); // 800ms delay before retracting
    } else {
      if (retractTimerRef.current) {
        clearTimeout(retractTimerRef.current);
        retractTimerRef.current = null;
      }
    }
    
    return () => {
      if (retractTimerRef.current) {
        clearTimeout(retractTimerRef.current);
      }
    };
  }, [isHovering, isExpanded]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

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
  const lastClipboardMessageRef = useRef('');
  const wasSnackbarOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPos({ x: window.innerWidth - 600, y: 88 });
    }
  }, []);

  useEffect(() => {
    const isOpen = Boolean(snackbar?.open);
    if (!isOpen) {
      wasSnackbarOpenRef.current = false;
      return;
    }
    if (!snackbar?.copyToClipboard) {
      wasSnackbarOpenRef.current = true;
      return;
    }
    const message = snackbar?.message ? String(snackbar.message) : '';
    const shouldCopy = !wasSnackbarOpenRef.current || message !== lastClipboardMessageRef.current;
    wasSnackbarOpenRef.current = true;
    if (!message || !shouldCopy) return;
    lastClipboardMessageRef.current = message;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(message).catch((err) => {
      console.warn('[Snackbar] Failed to copy message to clipboard', err);
    });
  }, [snackbar?.open, snackbar?.message, snackbar?.copyToClipboard]);

  const handleAddressSet = useCallback((data) => {
    const url = typeof data === 'string' ? data : data?.url;
    if (url && url !== currentUrl) {
      setBrowserHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        return [...newHistory, url];
      });
      setHistoryIndex(prev => prev + 1);
    }
  }, [currentUrl, historyIndex, setBrowserHistory, setHistoryIndex]);

  useEventBusListener('setAddress', handleAddressSet);

  // Watch transient flags and show snackbar when they become true
  useEffect(() => {
    if (copied) {
      setSnackbar({ open: true, message: 'JSON copied to clipboard', severity: 'success' });
    } else if (saved) {
      setSnackbar({ open: true, message: 'Graph saved to .node file', severity: 'success' });
    } else if (pasted) {
      setSnackbar({ open: true, message: 'Pasted content applied', severity: 'success', copyToClipboard: true });
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
    const notifySaved = () => {
      try {
        eventBus.emit('graphSaved', { reason: 'save' });
      } catch (err) {
        // ignore emit failures
      }
    };
    
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
        edgeRouting: edgeRouting,
        github: documentSettings?.github || null,
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
      edges: edges.map(edge => {
        const sourceNodeId = typeof edge.source === 'object' && edge.source
          ? (edge.source.nodeId ?? edge.source.id ?? '')
          : edge.source;
        const targetNodeId = typeof edge.target === 'object' && edge.target
          ? (edge.target.nodeId ?? edge.target.id ?? '')
          : edge.target;
        const sourceHandle = edge.sourceHandle || (typeof edge.source === 'object' && edge.source ? edge.source.handleKey : undefined);
        const targetHandle = edge.targetHandle || (typeof edge.target === 'object' && edge.target ? edge.target.handleKey : undefined);
        return {
          id: edge.id,
          type: edge.type,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          handleMeta: edge.handleMeta || undefined,
          label: edge.label || "",
          style: edge.style || {},
          data: edge.data || {}
        };
      }),
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
        notifySaved();
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
    notifySaved();
  };

  const handleCopyOnboard = async () => {
    try {
      const resp = await fetch('/documentation/OnboardLLM.md');
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
      const res = await fetch('/documentation/UserManual.md');
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
      onShowMessage: onShowMessage
        ? (message, severity) => onShowMessage(message, severity, { copyToClipboard: true })
        : null,
      graphCRUD: graphCRUDRef.current
    });
  };

  const handleCopyGraph = () => {
    const graphData = {
      nodes,
      edges,
      groups: groups || [],
      options: documentSettings || {},
      metadata: {},
      extensions: {}
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

  // Calculate address bar height (typically 64px for MUI AppBar)
  const addressBarHeight = 64;

  return (
    <>
      {/* Hover trigger area just below address bar */}
      <Box
        onMouseEnter={handleMouseEnter}
        sx={{
          position: 'fixed',
          top: addressBarHeight,
          left: 0,
          right: 0,
          height: 8,
          zIndex: 1299,
          pointerEvents: 'auto',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.03)'
          }
        }}
      />

      {/* Retractable toolbar */}
      <Paper
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        elevation={6}
        role="toolbar"
        aria-label="Graph editor toolbar"
        sx={{
          position: 'fixed',
          top: addressBarHeight,
          left: 0,
          right: 0,
          zIndex: 1000, // Behind address bar (which is typically 1100)
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          transform: isExpanded ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s ease-in-out',
          maxWidth: '100vw',
          overflow: 'auto'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          p: 1,
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {/* File Actions Section */}
        <ButtonGroup variant="contained" size="small">
          <FileActions 
            onSave={handleSaveToFile}
            onLoad={handleLoadFile}
            onNewFile={handleNewFile}
            isMobile={false}
            isFreeUser={isFreeUser}
          />
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* History Actions Section */}
        <ButtonGroup variant="contained" size="small">
          <HistoryActions 
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            isMobile={false}
          />
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Node Actions Section */}
        <ButtonGroup variant="contained" size="small">
          <NodeActions 
            onTogglePalette={onToggleNodePalette}
            onDeleteSelected={onDeleteSelected}
            onCopySelected={handleCopySelected}
            onPaste={handlePasteUniversal}
            onCopyGraph={handleCopyGraph}
            selectedNodeIds={selectedNodeIds}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            isMobile={false}
          />
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* View Actions Section */}
        <ButtonGroup variant="contained" size="small">
          <ViewActions 
            onToggleMinimap={onToggleMinimap}
            onToggleGrid={() => eventBus.emit('toggleShowGrid')}
            onAutoLayout={onApplyLayout}
            onAlignNodes={(mode) => {
              const didAlign = onAlignSelection(mode);
              if (didAlign && onShowMessage) {
                onShowMessage(`Aligned nodes to ${mode}`, 'success');
              }
            }}
            onDistributeNodes={(axis) => {
              const didDistribute = onDistributeSelection(axis);
              if (didDistribute && onShowMessage) {
                onShowMessage(`Distributed nodes ${axis}`, 'success');
              }
            }}
            showMinimap={showMinimap}
            snapToGrid={snapToGrid}
            selectionCount={selectionCount}
            isMobile={false}
            isFreeUser={isFreeUser}
          />
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Panel Actions Section */}
        <ButtonGroup variant="contained" size="small">
          <PanelActions 
            onToggleNodeList={onToggleNodeList}
            onToggleGroupList={onToggleGroupList}
            onToggleScriptPanel={() => eventBus.emit('toggleScriptPanel')}
            onToggleProperties={() => eventBus.emit('togglePropertiesPanel')}
            showNodeList={showNodeList}
            showGroupList={showGroupList}
            isMobile={false}
            isFreeUser={isFreeUser}
          />
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Utility Actions */}
        <ButtonGroup variant="contained" size="small">
          <IconButton
            onClick={handleCopyOnboard}
            title="Onboard LLM"
            aria-label="Copy LLM onboarding guide to clipboard"
            size="small"
          >
            <ModelTrainingIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={() => setPluginManagerOpen(true)}
            title="Plugin Manager"
            aria-label="Open Plugin Manager"
            size="small"
          >
            <ExtensionIcon fontSize="small" />
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

        {/* Mode Toggle */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(event, newMode) => {
            if (newMode !== null) {
              onModeChange(newMode);
            }
          }}
          size="small"
          sx={{ ml: 1 }}
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
          <ButtonGroup size="small" sx={{ ml: 1 }}>
            <Button
              onClick={(event) => setAutoLayoutMenuAnchor(event.currentTarget)}
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

        {/* Viewport Indicator */}
        <Box
          sx={{
            ml: 1,
            px: 0.5,
            py: 0.25,
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

      {/* Menus and Dialogs */}
      <Menu
        anchorEl={autoLayoutMenuAnchor}
        open={Boolean(autoLayoutMenuAnchor)}
        onClose={() => setAutoLayoutMenuAnchor(null)}
      >
        <MenuItem onClick={() => { onAutoLayoutChange('hierarchical'); setAutoLayoutMenuAnchor(null); }} selected={autoLayoutType === 'hierarchical'}>
          Hierarchical
        </MenuItem>
        <MenuItem onClick={() => { onAutoLayoutChange('radial'); setAutoLayoutMenuAnchor(null); }} selected={autoLayoutType === 'radial'}>
          Radial
        </MenuItem>
        <MenuItem onClick={() => { onAutoLayoutChange('grid'); setAutoLayoutMenuAnchor(null); }} selected={autoLayoutType === 'grid'}>
          Grid
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
      <PluginManagerPanel
        open={pluginManagerOpen}
        onClose={() => setPluginManagerOpen(false)}
      />

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
    </Paper>
    </>
  );
};

export default Toolbar;
