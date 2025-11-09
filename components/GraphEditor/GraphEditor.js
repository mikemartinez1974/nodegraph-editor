// ============================================
// 5. GraphEditor.js (MAIN - significantly reduced)
// ============================================
"use client";
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import NodeGraph from '../NodeGraph';
import Toolbar from './components/Toolbar';
import { getNodeTypes } from './nodeTypeRegistry';
import EdgeTypes from './edgeTypes';
import NodeListPanel from './components/NodeListPanel';
import GroupListPanel from './components/GroupListPanel';
import GroupPropertiesPanel from './components/GroupPropertiesPanel';
import { useTheme } from '@mui/material/styles';
import edgeTypes from './edgeTypes';
import { Snackbar, Alert, Backdrop, CircularProgress } from '@mui/material';
import eventBus from '../NodeGraph/eventBus';
import ScriptRunner from './Scripting/ScriptRunner';
import ScriptPanel from './Scripting/ScriptPanel';
import { useHandleClickHandler } from '../NodeGraph/eventHandlers';
import { v4 as uuidv4 } from 'uuid';
import { generateUUID } from './utils/idUtils';
import { useGraphEditorState } from './hooks/useGraphEditorState';
import { createGraphEditorHandlers, handleUpdateNodeData } from './handlers/graphEditorHandlers';
import { useGraphEditorSetup } from './hooks/useGraphEditorSetup';
import useSelection from './hooks/useSelection';
import useGraphHistory from './hooks/useGraphHistory';
import useGraphShortcuts from './hooks/useGraphShortcuts';
import useGroupManager from './hooks/useGroupManager';
import useGraphModes from './hooks/useGraphModes';
import PropertiesPanel from './components/PropertiesPanel';
import GraphCRUD from './GraphCrud';
import { pasteFromClipboardUnified } from './handlers/pasteHandler';
import { themeConfigFromMuiTheme, createThemeFromConfig } from './utils/themeUtils';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import DocumentPropertiesDialog from './components/DocumentPropertiesDialog';
import { nodeTypeMetadata } from './nodeTypeRegistry';

const nodeTypes = getNodeTypes();

export default function GraphEditor({ backgroundImage }) {
  const theme = useTheme(); // Browser theme
  const [showEdgePanel, setShowEdgePanel] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [lockedNodes, setLockedNodes] = useState(new Set());
  const [lockedEdges, setLockedEdges] = useState(new Set());
  const [showAllEdgeLabels, setShowAllEdgeLabels] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [graphRenderKey, setGraphRenderKey] = useState(0);

  // Document settings state (not localStorage) - consolidated into one object
  const [documentSettings, setDocumentSettings] = useState(() => {
    // Initialize with browser theme on mount (new document)
    const initial = themeConfigFromMuiTheme(theme);
    
    return {
      url: '',
      backgroundImage: '',
      gridSize: 20, // Default grid size
      theme: initial
    };
  });
  
  // Convenience accessors
  const documentUrl = documentSettings.url;
  const setDocumentUrl = (url) => setDocumentSettings(prev => ({ ...prev, url }));
  const documentBackgroundImage = documentSettings.backgroundImage;
  const setDocumentBackgroundImage = (backgroundImage) => setDocumentSettings(prev => ({ ...prev, backgroundImage }));
  const documentTheme = documentSettings.theme;
  const setDocumentTheme = (theme) => setDocumentSettings(prev => ({ ...prev, theme }));
  
  const state = useGraphEditorState();

  // Destructure editor state immediately so variables like `pan` are available for subsequent effects
  const {
    nodes, setNodes, nodesRef,
    edges, setEdges, edgesRef,
    groups, setGroups,
    pan, setPan, zoom, setZoom,
    selectedNodeIds, setSelectedNodeIds,
    selectedEdgeIds, setSelectedEdgeIds,
    selectedGroupIds, setSelectedGroupIds,
    hoveredEdgeId, setHoveredEdgeId,
    hoveredNodeId, setHoveredNodeId,
    hoveredEdgeSource, hoveredEdgeTarget,
    showNodeList, setShowNodeList,
    showGroupList, setShowGroupList,
    showGroupProperties, setShowGroupProperties,
    snackbar, setSnackbar,
    loading,
    nodePanelAnchor, setNodePanelAnchor,
    nodeListAnchor, setNodeListAnchor,
    defaultNodeColor, defaultEdgeColor,
    groupManager
  } = state || {};

  // NEW: document (background page) state (no localStorage)
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [backgroundInteractive, setBackgroundInteractive] = useState(false);
  const [showDocumentPropertiesDialog, setShowDocumentPropertiesDialog] = useState(false);

  useEffect(() => {
    if (backgroundUrl) {
      let frame = 0;
      const animate = () => {
        if (frame < 3) {
          setPan(prev => ({ x: prev.x, y: prev.y })); // Force update with new reference
          frame++;
          requestAnimationFrame(animate);
        }
      };
      
      const timer = setTimeout(() => {
        requestAnimationFrame(animate);
      }, 200);
  
      return () => clearTimeout(timer);
    }
  }, [backgroundUrl, setPan]);

  useEffect(() => {
    if (backgroundUrl) {
      // Wait for iframe to load and render, then force redraw
      const timers = [100, 300, 500].map(delay => 
        setTimeout(() => {
          eventBus.emit('forceRedraw');
        }, delay)
      );
      
      return () => timers.forEach(clearTimeout);
    }
  }, [backgroundUrl]);

  useEffect(() => {
    if (backgroundUrl) {
      const timer = setTimeout(() => {
        // Make an imperceptible change to pan to force all layers to redraw
        setPan(prev => ({ 
          x: prev.x + 0.001, 
          y: prev.y + 0.001 
        }));
        
        // Reset after next frame
        requestAnimationFrame(() => {
          setPan(prev => ({ 
            x: prev.x - 0.001, 
            y: prev.y - 0.001 
          }));
        });
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [backgroundUrl, setPan]);
  
  // Respond to events emitted from NodeGraph (iframe error) or BackgroundControls
  useEffect(() => {
    const handleBackgroundLoadFailed = ({ url } = {}) => {
      setSnackbar({ open: true, message: `Document failed to load: ${url || ''}`, severity: 'warning' });
    };

    const handleClearBackground = () => {
      setBackgroundUrl('');
      setBackgroundInteractive(false);
      setSnackbar({ open: true, message: 'Document cleared', severity: 'info' });
    };

    const handleSetBackgroundUrl = ({ url }) => {
      setBackgroundUrl(url || '');
    };

    const handleSetBackgroundInteractive = ({ interactive }) => {
      setBackgroundInteractive(Boolean(interactive));
    };

    const handleSetBackgroundImage = ({ backgroundImage }) => {
      setDocumentBackgroundImage(backgroundImage || '');
    };

    const handleExportGraph = async () => {
      try {
        const data = {
          nodes: nodesRef.current || nodes,
          edges: edgesRef.current || edges,
          groups: groups || [],
          // include settings with document
          settings: {
            defaultNodeColor,
            defaultEdgeColor,
            gridSize: documentSettings.gridSize,
            document: backgroundUrl ? { url: backgroundUrl } : null,
            theme: null
          },
          // save scripts at top-level
          scripts: (function(){ try { const raw = localStorage.getItem('scripts'); return raw ? JSON.parse(raw) : []; } catch { return []; } })(),
          viewport: { pan, zoom }
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `graph_${Date.now()}.node`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setSnackbar({ open: true, message: 'Graph exported', severity: 'success' });
      } catch (err) {
        console.error('Failed to export graph', err);
        setSnackbar({ open: true, message: 'Failed to export graph', severity: 'error' });
      }
    };

    eventBus.on('backgroundLoadFailed', handleBackgroundLoadFailed);
    eventBus.on('clearBackgroundUrl', handleClearBackground);
    eventBus.on('setBackgroundUrl', handleSetBackgroundUrl);
    eventBus.on('setBackgroundInteractive', handleSetBackgroundInteractive);
    eventBus.on('setBackgroundImage', handleSetBackgroundImage);
    eventBus.on('exportGraph', handleExportGraph);

    return () => {
      eventBus.off('backgroundLoadFailed', handleBackgroundLoadFailed);
      eventBus.off('clearBackgroundUrl', handleClearBackground);
      eventBus.off('setBackgroundUrl', handleSetBackgroundUrl);
      eventBus.off('setBackgroundInteractive', handleSetBackgroundInteractive);
      eventBus.off('setBackgroundImage', handleSetBackgroundImage);
      eventBus.off('exportGraph', handleExportGraph);
    };
  }, [pan, zoom, nodes, edges, groups, defaultNodeColor, defaultEdgeColor, setSnackbar]);

  // Determine if user is free (replace with real logic)
  const isFreeUser = localStorage.getItem('isFreeUser') === 'true';

  // Initialize address bar to local file on mount
  useEffect(() => {
    eventBus.emit('setAddress', 'local://untitled.node');
  }, []);

  // Load saved document from settings when loading a file
  useEffect(() => {
    function handleLoadSaveFile(payload = {}) {
      const { settings = {}, viewport = {}, scripts: topLevelScripts } = payload || {};
      try {
        if (viewport.pan) setPan(viewport.pan);
        if (typeof viewport.zoom === 'number') setZoom(viewport.zoom);
        if (settings.defaultNodeColor) state.defaultNodeColor = settings.defaultNodeColor;
        if (settings.document && settings.document.url) {
          setDocumentUrl(settings.document.url);
          setBackgroundUrl(settings.document.url); // Also set backgroundUrl to display iframe
        } else {
          setDocumentUrl(''); // Clear if not present
          setBackgroundUrl(''); // Also clear backgroundUrl
        }
        if (settings.backgroundImage) {
          setDocumentBackgroundImage(settings.backgroundImage);
        } else {
          setDocumentBackgroundImage(''); // Clear if not present
        }
        // Load gridSize if present
        if (settings.gridSize && settings.gridSize >= 5 && settings.gridSize <= 100) {
          setDocumentSettings(prev => ({ ...prev, gridSize: settings.gridSize }));
        }
        // Prefer top-level scripts, fallback to settings.scripts
        try {
          const scriptsToLoad = Array.isArray(topLevelScripts) ? topLevelScripts : (Array.isArray(settings.scripts) ? settings.scripts : null);
          if (scriptsToLoad) {
            localStorage.setItem('scripts', JSON.stringify(scriptsToLoad));
          }
        } catch (err) { }
        // Load document theme if present (don't apply to browser)
        if (settings.theme) {
          setDocumentTheme(settings.theme);
        }
      } catch (err) {
        console.warn('Failed to apply loaded save settings:', err);
      }
    }

    eventBus.on('loadSaveFile', handleLoadSaveFile);
    return () => eventBus.off('loadSaveFile', handleLoadSaveFile);
  }, [setPan, setZoom, state]);
  
  const selectionHook = useSelection({
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedGroupIds
  });
  
  const historyHook = useGraphHistory(nodes, edges, groups, setNodes, setEdges, setGroups);
  
  const modesHook = useGraphModes({
    nodes,
    setNodes,
    selectedNodeIds,
    edges
  });
  
  const groupManagerHook = useGroupManager({
    groups, setGroups,
    nodes, setNodes,
    edges, setEdges,
    setSelectedNodeIds,
    setSelectedGroupIds,
    selectedNodeIds,
    selectedGroupIds,
    groupManager,
    saveToHistory: historyHook.saveToHistory
  });
  
  const handlers = createGraphEditorHandlers({
    graphAPI: null, // Will be set by setup
    state,
    historyHook,
    groupManagerHook,
    selectionHook,
    modesHook
  });
  
  const graphAPI = useGraphEditorSetup(state, handlers, historyHook);

  const handleLoadGraph = useCallback((...args) => {
    try {
      handlers.handleLoadGraph?.(...args);
    } finally {
      setGraphRenderKey(prev => prev + 1);
    }
  }, [handlers]);

  // Listen for undo/redo events from keyboard shortcuts (placed after historyHook is created)
  useEffect(() => {
    const handleUndo = () => {
      if (historyHook && typeof historyHook.handleUndo === 'function') {
        historyHook.handleUndo();
      }
    };

    const handleRedo = () => {
      if (historyHook && typeof historyHook.handleRedo === 'function') {
        historyHook.handleRedo();
      }
    };

    eventBus.on('undo', handleUndo);
    eventBus.on('redo', handleRedo);

    return () => {
      eventBus.off('undo', handleUndo);
      eventBus.off('redo', handleRedo);
    };
  }, [historyHook]);

  // Update handlers with graphAPI reference
  handlers.graphAPI = graphAPI;

  // Create GraphCRUD instance (stable - don't recreate on every render)
  const graphCRUD = useMemo(() => {
    return new GraphCRUD(
      () => nodesRef.current || [],
      setNodes,
      () => edgesRef.current || [],
      setEdges,
      historyHook.saveToHistory,
      nodesRef,
      edgesRef,
      // provide group handlers so GraphCRUD.createGroups is available
      () => groups || [],
      setGroups,
      // groupsRef may not exist in older state implementations; pass undefined if not present
      undefined
    );
  }, [setNodes, setEdges, setGroups, historyHook.saveToHistory, groups]);

  // Wire up paste event listener
  useEffect(() => {
    const handlePaste = async (e) => {
      // Check if the active element is a form control
      const activeElement = document.activeElement;
      const isFormControl = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        activeElement.closest('[contenteditable="true"]') ||
        activeElement.closest('input') ||
        activeElement.closest('textarea')
      );

      // If a form control has focus, allow default paste behavior
      if (isFormControl) {
        return;
      }

      // Otherwise, handle graph paste
      e.preventDefault();
      e.stopPropagation();
      try {
        const result = await pasteFromClipboardUnified({
          handlers,
          state: {
            setNodes,
            nodesRef,
            setEdges,
            edgesRef,
            setGroups,
            pan,
            zoom
          },
          historyHook,
          onShowMessage: (message, severity) => setSnackbar({ open: true, message, severity }),
          graphCRUD
        });
        
        if (result && (result.nodes > 0 || result.edges > 0 || result.groups > 0)) {
          console.log('[GraphEditor] Successfully pasted:', result);
        }
      } catch (err) {
        console.error('[GraphEditor] Paste handler error:', err);
        setSnackbar({ open: true, message: 'Paste failed', severity: 'error' });
      }
    };

    // console.log('[GraphEditor] Registering paste listener with graphCRUD:', graphCRUD);
    window.addEventListener('paste', handlePaste, { capture: true });
    return () => {
      // console.log('[GraphEditor] Removing paste listener');
      window.removeEventListener('paste', handlePaste, { capture: true });
    };
  }, [graphCRUD, handlers, setNodes, nodesRef, setEdges, edgesRef, setGroups, pan, zoom, historyHook, setSnackbar]);
  
  useGraphShortcuts({
    setNodes,
    setEdges,
    selectedNodeIds,
    selectedEdgeIds,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    handleDeleteSelected: handlers.handleDeleteSelected,
    clearSelection: selectionHook.clearSelection,
    handleCreateGroup: handlers.handleCreateGroupWrapper,
    handleUngroupSelected: handlers.handleUngroupSelectedWrapper,
    saveToHistory: historyHook.saveToHistory,
    edgesRef,
    nodesRef,
    setShowAllEdgeLabels,
    graphCRUD,
    setGroups,
    pan,
    zoom,
    onShowMessage: (message, severity) => setSnackbar({ open: true, message, severity })
  });

  // Panel anchor synchronization
  useEffect(() => {
    const handlePropertiesOpen = () => {
      const oppositeAnchor = nodePanelAnchor === 'right' ? 'left' : 'right';
      setNodeListAnchor(oppositeAnchor);
    };
    
    eventBus.on('openNodeProperties', handlePropertiesOpen);
    
    if (showNodeList) {
      const oppositeAnchor = nodePanelAnchor === 'right' ? 'left' : 'right';
      setNodeListAnchor(oppositeAnchor);
    }
    
    return () => {
      eventBus.off('openNodeProperties', handlePropertiesOpen);
    };
  }, [showNodeList, nodePanelAnchor, setNodeListAnchor]);
  
  // After GraphCRUD instance is created (assume variable is graphAPI)
  useEffect(() => {
    if (graphAPI && graphAPI.current) {
      window.graphAPI = graphAPI.current;
    }
  }, [graphAPI]);
  
  // Listen for 'fetchUrl' event from address bar
  useEffect(() => {
    const handleFetchUrl = async ({ url }) => {
      try {
        if (!url) return;
        let fullUrl = url;

        // Normalize tlz:// to fetchable https://
        if (fullUrl.startsWith('tlz://')) {
          const rest = fullUrl.slice('tlz://'.length);
          const firstSlash = rest.indexOf('/');
          let host = '';
          let path = '';

          if (firstSlash !== -1) {
            host = rest.slice(0, firstSlash);
            path = rest.slice(firstSlash); // includes leading '/'
          } else {
            path = '/' + rest;
          }

          fullUrl = (window.location.protocol === 'https:' ? 'https://' : window.location.protocol + '//') + host + path;
        }

        // Prepend https if missing
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
          fullUrl = 'https://' + fullUrl;
        }

        // Always use https for fetch URLs
        if (fullUrl.startsWith('http://')) {
          fullUrl = 'https://' + fullUrl.slice('http://'.length);
        }

        // Log the final URL and fetch options
        // console.log('[GraphEditor] Fetching URL:', fullUrl);
        const fetchOptions = { method: 'GET', mode: 'cors', credentials: 'omit' };
        // console.log('[GraphEditor] Fetch options:', fetchOptions);

        // Update address/history immediately so header/back works
        try { eventBus.emit('setAddress', fullUrl); } catch (err) { /* ignore */ }

        const triedUrls = [];

        const tryFetch = async (u) => {
          triedUrls.push(u);
          // console.log('[GraphEditor] Attempting fetch:', u);
          const resp = await fetch(u, fetchOptions);
          // console.log('[GraphEditor] Fetch response status:', resp.status);
          // console.log('[GraphEditor] Fetch response headers:', Array.from(resp.headers.entries()));
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp;
        };

        let response = null;

        try {
          response = await tryFetch(fullUrl);
        } catch (err) {
          // generate alternates to try
          const alternates = [];
          if (fullUrl.match(/\.json($|[?#])/)) {
            alternates.push(fullUrl.replace(/\.json($|[?#])/, '.node$1'));
          }
          if (!fullUrl.endsWith('.node')) {
            alternates.push(fullUrl + '.node');
          }
          if (fullUrl.endsWith('/')) {
            alternates.push(fullUrl + 'index.node');
          }

          for (const alt of alternates) {
            if (triedUrls.includes(alt)) continue;
            try {
              response = await tryFetch(alt);
              fullUrl = alt; // switch canonical to the working one
              try { eventBus.emit('setAddress', fullUrl); } catch (err) { /* ignore */ }
              break;
            } catch (e) {
              // continue to next
            }
          }
        }

        if (!response) {
          const errorMsg = 'Failed to fetch from any URL';
          console.error('[GraphEditor] Error fetching URL:', errorMsg, triedUrls);
          setSnackbar({ open: true, message: `Failed to fetch URL: ${errorMsg}`, severity: 'error' });
          return;
        }

        const text = await response.text();

        // Try to parse as JSON (graph data)
        try {
          const jsonData = JSON.parse(text);
          if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
            const nodesToLoad = jsonData.nodes;
            const edgesToLoadFromJson = jsonData.edges || [];
            const groupsToLoadFromJson = jsonData.groups || [];
            handleLoadGraph(nodesToLoad, edgesToLoadFromJson, groupsToLoadFromJson);
            try { eventBus.emit('forceRedraw'); } catch (e) { /* ignore */ }
            setSnackbar({ open: true, message: 'Graph loaded from URL', severity: 'success' });
            eventBus.emit('setAddress', fullUrl); // ensure address reflects final URL
            return;
          }
        } catch (e) {
          // Not JSON, fall through to create text node
        }

        // Create text node
        const lines = text.trim().split('\n');
        const label = lines[0] ? lines[0].substring(0, 50) : 'Fetched Text';
        const memo = text.trim();

        const width = Math.max(200, Math.min(600, (label.length || 10) * 8 + 100));
        const height = Math.max(100, Math.min(400, lines.length * 20 + 50));

        const centerX = (window.innerWidth / 2 - pan.x) / zoom;
        const centerY = (window.innerHeight / 2 - pan.y) / zoom;

        const newNode = {
          id: `node_${Date.now()}`,
          label: label,
          type: 'default',
          position: { x: centerX, y: centerY },
          width: width,
          height: height,
          resizable: true,
          data: { memo: memo }
        };

        setNodes(prev => {
          const next = [...prev, newNode];
          nodesRef.current = next;
          return next;
        });

        historyHook.saveToHistory(nodesRef.current, edgesRef.current);
        setSnackbar({ open: true, message: 'Fetched and created node from URL', severity: 'success' });
        eventBus.emit('setAddress', fullUrl);
      } catch (error) {
        console.error('[GraphEditor] Error fetching URL:', error);
        // Provide clearer snackbar with attempted info
        const msg = error && error.message ? error.message : 'Unknown error';
        setSnackbar({ open: true, message: `Failed to fetch URL: ${msg}`, severity: 'error' });
      }
    };

    eventBus.on('fetchUrl', handleFetchUrl);
    return () => eventBus.off('fetchUrl', handleFetchUrl);
  }, [pan, zoom, setNodes, nodesRef, historyHook, setSnackbar, handlers]);
  
  // Suppress specific error message about asynchronous responses
  useEffect(() => {
    const handleError = (event) => {
      if (event.message && event.message.includes("A listener indicated an asynchronous response")) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleError);

    // Also handle unhandled promise rejections that contain the same message
    const handleUnhandledRejection = (event) => {
      const reason = event && (event.reason || event.detail);
      const message = typeof reason === 'string' ? reason : (reason && reason.message) ? reason.message : '';
      if (message && message.includes("A listener indicated an asynchronous response")) {
        // prevent the default logging of unhandledrejection
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Close NodePropertiesPanel if selection is not exactly one node
  useEffect(() => {
    if (selectedNodeIds.length !== 1 && showNodeList) {
      setNodePanelAnchor(null);
    }
  }, [selectedNodeIds, showNodeList]);
  
  // Handle pasted graph data emitted by paste handler fallback
  useEffect(() => {
    const handlePastedData = (data) => {
      if (!data) return;
      try {
        // If full graph data present, use existing load handler
        if (data.nodes && Array.isArray(data.nodes)) {
          const nodesToLoad = data.nodes;
          const edgesToLoad = data.edges || [];
          const groupsToLoad = data.groups || [];
          if (handlers && typeof handlers.handleLoadGraph === 'function') {
            handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
            try { eventBus.emit('forceRedraw'); } catch (e) { }
          } else {
            // Fallback: merge into current state
            setNodes(prev => {
              const next = [...prev, ...nodesToLoad];
              nodesRef.current = next;
              return next;
            });
            setEdges(prev => {
              const next = [...prev, ...(data.edges || [])];
              edgesRef.current = next;
              return next;
            });
            if (groupsToLoad && groupsToLoad.length && setGroups) {
              setGroups(prev => {
                const next = [...prev, ...groupsToLoad];
                return next;
              });
            }
          }
          setSnackbar({ open: true, message: 'Pasted graph data', severity: 'success' });
          return;
        }

        // If only groups present
        if (data.groups && Array.isArray(data.groups) && setGroups) {
          setGroups(prev => {
            const next = [...prev, ...data.groups];
            return next;
          });
          setSnackbar({ open: true, message: 'Pasted groups', severity: 'success' });
        }
      } catch (err) {
        console.warn('Failed to apply pasted data:', err);
      }
    };

    eventBus.on('pasteGraphData', handlePastedData);
    return () => eventBus.off('pasteGraphData', handlePastedData);
  }, [handlers, setNodes, setEdges, setGroups, nodesRef, edgesRef]);
  
  // Keyboard shortcut: toggle background interactivity (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && backgroundUrl) {
        e.preventDefault();
        setBackgroundInteractive(prev => {
          const next = !prev;
          if (setSnackbar) {
            setSnackbar({ open: true, message: `Background ${next ? 'interactive' : 'locked'}`, severity: 'info' });
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [backgroundUrl, backgroundInteractive, setSnackbar]);
  
  // Host RPC handler used by ScriptRunner iframe
  const handleScriptRequest = async (method, args = [], meta = {}) => {
    try {
      const isDry = meta && meta.dry === true;
      const allowMutations = meta && meta.allowMutations === true;

      switch (method) {
        case 'getNodes':
          return nodesRef.current || nodes;
        case 'getNode': {
          const [id] = args;
          return (nodesRef.current || nodes).find(n => n.id === id) || null;
        }
        case 'getEdges':
          return edgesRef.current || edges;
        case 'createNode': {
          const [nodeData] = args || [{}];
          const newNode = { id: nodeData.id || `node_${Date.now()}`, type: nodeData.type || 'default', label: nodeData.label || 'New Node', position: nodeData.position || { x: 0, y: 0 }, width: nodeData.width || 200, height: nodeData.height || 120, data: nodeData.data || {} };

          if (!allowMutations || isDry) {
            // Return proposed mutation instead of applying
            return { proposed: { action: 'createNode', node: newNode }, applied: false };
          }

          // emit event for existing handlers to pick up
          try { eventBus.emit('nodeAdded', { node: newNode }); } catch (err) {}
          // optimistic local update
          setNodes(prev => { const next = [...prev, newNode]; nodesRef.current = next; return next; });
          return { applied: true, node: newNode };
        }
        case 'updateNode': {
          const [id, patch] = args;
          if (!allowMutations || isDry) {
            return { proposed: { action: 'updateNode', id, patch }, applied: false };
          }
          try { eventBus.emit('nodeUpdated', { id, patch, source: 'script' }); } catch (err) {}
          setNodes(prev => { const next = prev.map(n => n.id === id ? { ...n, ...patch, data: patch && patch.data ? { ...n.data, ...patch.data } : n.data } : n); nodesRef.current = next; return next; });
          return { applied: true, id, patch };
        }
        case 'deleteNode': {
          const [id] = args;
          if (!allowMutations || isDry) {
            return { proposed: { action: 'deleteNode', id }, applied: false };
          }
          try { eventBus.emit('nodeDeleted', { id, source: 'script' }); } catch (err) {}
          setNodes(prev => { const next = prev.filter(n => n.id !== id); nodesRef.current = next; return next; });
          return { applied: true, id };
        }
        case 'createEdge': {
          const [edgeData] = args || [{}];
          if (!allowMutations || isDry) {
            return { proposed: { action: 'createEdge', edge: edgeData }, applied: false };
          }
          try { eventBus.emit('edgeAdded', { edge: edgeData }); } catch (err) {}
          setEdges(prev => { const next = [...prev, edgeData]; edgesRef.current = next; return next; });
          return { applied: true, edge: edgeData };
        }
        case 'deleteEdge': {
          const [id] = args;
          if (!allowMutations || isDry) {
            return { proposed: { action: 'deleteEdge', id }, applied: false };
          }
          try { eventBus.emit('edgeDeleted', { id, source: 'script' }); } catch (err) {}
          setEdges(prev => { const next = prev.filter(e => e.id !== id); edgesRef.current = next; return next; });
          return { applied: true, id };
        }
        case 'log': {
          const [level, message] = args;
          console.log('[script]', level || 'info', message);
          return true;
        }
        default:
          throw new Error('Unknown method: ' + method);
    }
    } catch (err) {
      console.error('Script RPC error', method, err);
      throw err;
    }
  };

  // Listen for external apply proposals from ScriptPanel
  useEffect(() => {
    const handleApplyProposals = ({ proposals = [], sourceId } = {}) => {
      if (!proposals || !proposals.length) return;
      try {
        // Apply proposals sequentially
        proposals.forEach(p => {
          try {
            const action = p.action || (p.proposal && p.proposal.action) || (p.type) || null;
            if (!action) return;
            switch (action) {
              case 'createNode': {
                const node = p.node || p.payload || p.proposal?.node;
                if (!node) break;
                setNodes(prev => { const next = [...prev, node]; nodesRef.current = next; return next; });
                try { eventBus.emit('nodeAdded', { node }); } catch (e) {}
                break;
              }
              case 'updateNode': {
                const id = p.id || p.nodeId || p.proposal?.id;
                const patch = p.patch || p.changes || p.proposal?.patch;
                if (!id || !patch) break;
                setNodes(prev => { const next = prev.map(n => n.id === id ? { ...n, ...patch, data: patch && patch.data ? { ...n.data, ...patch.data } : n.data } : n); nodesRef.current = next; return next; });
                try { eventBus.emit('nodeUpdated', { id, patch, source: 'script-apply' }); } catch (e) {}
                break;
              }
              case 'deleteNode': {
                const id = p.id || p.nodeId || p.proposal?.id;
                if (!id) break;
                setNodes(prev => { const next = prev.filter(n => n.id !== id); nodesRef.current = next; return next; });
                try { eventBus.emit('nodeDeleted', { id, source: 'script-apply' }); } catch (e) {}
                break;
              }
              case 'createEdge': {
                const edge = p.edge || p.payload || p.proposal?.edge;
                if (!edge) break;
                setEdges(prev => { const next = [...prev, edge]; edgesRef.current = next; return next; });
                try { eventBus.emit('edgeAdded', { edge }); } catch (e) {}
                break;
              }
              case 'deleteEdge': {
                const id = p.id || p.edgeId || p.proposal?.id;
                if (!id) break;
                setEdges(prev => { const next = prev.filter(e => e.id !== id); edgesRef.current = next; return next; });
                try { eventBus.emit('edgeDeleted', { id, source: 'script-apply' }); } catch (e) {}
                break;
              }
              default:
                console.warn('Unknown proposal action:', action);
            }
          } catch (err) {
            console.warn('Failed to apply proposal item', err);
          }
        });

        // Save history after applying all proposals
        try { historyHook.saveToHistory(nodesRef.current, edgesRef.current); } catch (e) {}
        setSnackbar({ open: true, message: 'Script changes applied', severity: 'success' });
      } catch (err) {
        console.error('Failed to apply script proposals', err);
        setSnackbar({ open: true, message: 'Failed to apply script proposals', severity: 'error' });
      }
    };

    eventBus.on('applyScriptProposals', handleApplyProposals);
    return () => eventBus.off('applyScriptProposals', handleApplyProposals);
  }, [historyHook, setSnackbar]);

  // Add this useEffect to your GraphEditor.js file
  // Place it with the other event listener useEffects
  // Import EdgeTypes at the top: import EdgeTypes from './edgeTypes';
  
  useEffect(() => {
    const handleHandleDrop = ({ graph, sourceNode, targetNode, edgeType, direction }) => {
      try {
        // If dropped on a node, create an edge
        if (targetNode) {
          const newEdge = {
            id: `edge_${Date.now()}`,
            source: direction === 'source' ? sourceNode : targetNode,
            target: direction === 'source' ? targetNode : sourceNode,
            type: edgeType,
            style: EdgeTypes[edgeType]?.style || {}
          };
          
          setEdges(prev => {
            const next = [...prev, newEdge];
            edgesRef.current = next;
            historyHook.saveToHistory(nodesRef.current, next);
            return next;
          });
          
          setSnackbar({ 
            open: true, 
            message: 'Edge created', 
            severity: 'success' 
          });
        } 
        // If dropped in empty space, create a new node and edge
        else {
          // Only create one node with UUID and correct type
          const parentNode = nodes.find(n => n.id === sourceNode);
          const newNodeId = uuidv4();
          const newNode = {
            id: newNodeId,
            label: 'New Node',
            type: parentNode?.type || 'default',
            position: { x: graph.x, y: graph.y },
            width: parentNode?.width || 200,
            height: parentNode?.height || 120,
            data: {}
          };
          const newEdge = {
            id: `edge_${Date.now()}`,
            source: direction === 'source' ? sourceNode : newNodeId,
            target: direction === 'source' ? newNodeId : sourceNode,
            type: edgeType,
            style: EdgeTypes[edgeType]?.style || {}
          };
          setNodes(prev => {
            const next = [...prev, newNode];
            nodesRef.current = next;
            return next;
          });
          setEdges(prev => {
            const next = [...prev, newEdge];
            edgesRef.current = next;
            historyHook.saveToHistory(nodesRef.current, next);
            return next;
          });
          setSnackbar({ 
            open: true, 
            message: 'Node and edge created', 
            severity: 'success' 
          });
        }
      } catch (error) {
        console.error('Error in handleDrop:', error);
        setSnackbar({ 
          open: true, 
          message: 'Failed to create connection', 
          severity: 'error' 
        });
      }
    };
  
    eventBus.on('handleDrop', handleHandleDrop);
    return () => eventBus.off('handleDrop', handleHandleDrop);
  }, [setNodes, setEdges, nodes, nodesRef, edgesRef, historyHook, setSnackbar]);

  // NEW: Listen for toggleMinimap event to sync minimap visibility with toolbar button
  useEffect(() => {
    const handleToggleMinimap = () => {
      setShowMinimap(prev => !prev);
    };
    eventBus.on('toggleMinimap', handleToggleMinimap);
    return () => eventBus.off('toggleMinimap', handleToggleMinimap);
  }, []);

  // Listen for grid-related events
  useEffect(() => {
    const handleToggleShowGrid = () => {
      setShowGrid(prev => !prev);
    };

    const handleAlignToGrid = () => {
      setDocumentSettings(prevSettings => {
        const currentGridSize = prevSettings.gridSize;
        setNodes(prev => {
          const next = prev.map(node => ({
            ...node,
            position: {
              x: Math.round(node.position.x / currentGridSize) * currentGridSize,
              y: Math.round(node.position.y / currentGridSize) * currentGridSize
            }
          }));
          nodesRef.current = next;
          historyHook.saveToHistory(next, edgesRef.current);
          return next;
        });
        return prevSettings; // Don't modify settings
      });
    };

    const handleSetGridSize = ({ gridSize: newGridSize }) => {
      if (newGridSize && newGridSize >= 5 && newGridSize <= 100) {
        setDocumentSettings(prev => {
          const updated = { ...prev, gridSize: newGridSize };
          // Immediately respond with the new value
          setTimeout(() => eventBus.emit('currentGridSize', { gridSize: newGridSize }), 0);
          return updated;
        });
      }
    };

    const handleRequestGridSize = () => {
      eventBus.emit('currentGridSize', { gridSize: documentSettings.gridSize });
    };

    const handleRequestBackgroundImage = () => {
      eventBus.emit('currentBackgroundImage', { backgroundImage: documentBackgroundImage });
    };

    eventBus.on('toggleShowGrid', handleToggleShowGrid);
    eventBus.on('alignToGrid', handleAlignToGrid);
    eventBus.on('setGridSize', handleSetGridSize);
    eventBus.on('requestGridSize', handleRequestGridSize);
    eventBus.on('requestBackgroundImage', handleRequestBackgroundImage);

    return () => {
      eventBus.off('toggleShowGrid', handleToggleShowGrid);
      eventBus.off('alignToGrid', handleAlignToGrid);
      eventBus.off('setGridSize', handleSetGridSize);
      eventBus.off('requestGridSize', handleRequestGridSize);
      eventBus.off('requestBackgroundImage', handleRequestBackgroundImage);
    };
  }, [setNodes, nodesRef, edgesRef, historyHook]);

  // Listen for node update events from custom components
  useEffect(() => {
    const handleNodeUpdate = ({ id, updates }) => {
      // Use the existing update function
      const node = nodes.find(n => n.id === id);
      if (node) {
        setNodes(prev => prev.map(n => 
          n.id === id ? { ...n, ...updates, data: { ...n.data, ...updates.data } } : n
        ));
      }
    };

    eventBus.on('nodeUpdate', handleNodeUpdate);
    return () => eventBus.off('nodeUpdate', handleNodeUpdate);
  }, [nodes, setNodes]);

  // Listen for node move events
  useEffect(() => {
    const handleNodeMove = ({ id, position }) => {
      setNodes(prev => prev.map(node => 
        node.id === id ? { ...node, position } : node
      ));
    };

    eventBus.on('nodeMove', handleNodeMove);
    return () => eventBus.off('nodeMove', handleNodeMove);
  }, [setNodes]);

  // Listen for edge click events
  useEffect(() => {
    const handleEdgeClick = ({ id, event }) => {
      const isMultiSelect = event?.ctrlKey || event?.metaKey;
      const edgeId = id;

      if (isMultiSelect) {
        // Handle multi-select
        setSelectedEdgeIds(prev => {
          if (prev.includes(edgeId)) {
            return prev.filter(eid => eid !== edgeId);
          } else {
            return [...prev, edgeId];
          }
        });
        return;
      }

      // Handle single selection
      setSelectedEdgeIds(prev => {
        const already = prev.includes(edgeId);
        if (already) {
          // Toggle the edge panel when clicking the already-selected edge
          setShowEdgePanel(s => !s);
          return prev; // keep selection
        } else {
          // Select the new edge and open the panel
          setShowEdgePanel(true);
          return [edgeId];
        }
      });
      setSelectedNodeIds([]); // Clear node selection
    };

    eventBus.on('edgeClick', handleEdgeClick);
    return () => eventBus.off('edgeClick', handleEdgeClick);
  }, [setSelectedEdgeIds, setSelectedNodeIds, setShowEdgePanel, selectionHook]);

  // Listen for edge hover events
  useEffect(() => {
    const handleEdgeHover = ({ edgeId }) => {
      setHoveredEdgeId(edgeId);
    };

    eventBus.on('edgeHover', handleEdgeHover);
    return () => eventBus.off('edgeHover', handleEdgeHover);
  }, [setHoveredEdgeId]);

  // Listen for node hover events
  useEffect(() => {
    const handleNodeHover = ({ id }) => {
      setHoveredNodeId(id);
    };

    eventBus.on('nodeHover', handleNodeHover);
    return () => eventBus.off('nodeHover', handleNodeHover);
  }, [setHoveredNodeId]);

  // Listen for document theme updates from PreferencesDialog
  useEffect(() => {
    const handleUpdateDocumentTheme = (themeConfig) => {
      if (themeConfig) {
        setDocumentTheme(themeConfig);
      }
    };

    eventBus.on('updateDocumentTheme', handleUpdateDocumentTheme);
    return () => eventBus.off('updateDocumentTheme', handleUpdateDocumentTheme);
  }, []);

  // Listen for node drag end events
  useEffect(() => {
    const handleNodeDragEnd = ({ nodeIds }) => {
      // Handle node drag end - could trigger any post-drag logic
      // console.log('Node drag ended for nodes:', nodeIds);
    };

    eventBus.on('nodeDragEnd', handleNodeDragEnd);
    return () => eventBus.off('nodeDragEnd', handleNodeDragEnd);
  }, []);

  // Memoized values for nodes, edges, and groups
  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const memoizedEdges = useMemo(() => edges, [edges]);
  const memoizedGroups = useMemo(() => groups, [groups]);
  const memoizedSelectedNodeIds = useMemo(() => selectedNodeIds, [selectedNodeIds]);
  const memoizedSelectedEdgeIds = useMemo(() => selectedEdgeIds, [selectedEdgeIds]);
  const memoizedSelectedGroupIds = useMemo(() => selectedGroupIds, [selectedGroupIds]);

  const memoizedSetNodes = useCallback(setNodes, []);
  const memoizedSetEdges = useCallback(setEdges, []);
  const memoizedSetGroups = useCallback(setGroups, []);
  const memoizedSetSelectedNodeIds = useCallback(setSelectedNodeIds, []);
  const memoizedSetSelectedEdgeIds = useCallback(setSelectedEdgeIds, []);
  const memoizedSetPan = useCallback(setPan, []);
  const memoizedSetZoom = useCallback(setZoom, []);

  // Create MUI theme from document theme config
  const documentMuiTheme = useMemo(() => {
    if (documentTheme) {
      const theme = createThemeFromConfig(documentTheme);
      return theme;
    }
    return null;
  }, [documentTheme]);

  // Register single handleClick event handler
  const handleClickHandlerId = Math.random().toString(36).substr(2, 8);
  useHandleClickHandler((payload) => {
    // console.log(`[GraphEditor.js] handleClick event received (handlerId: ${handleClickHandlerId})`, payload);
    // Your handleClick logic here
    // Example: console.log('Single handleClick event:', payload);
  });

  // Toggle properties panel via event
  useEffect(() => {
    const handleTogglePropertiesPanel = () => {
      setShowPropertiesPanel(prev => !prev);
    };
    eventBus.on('togglePropertiesPanel', handleTogglePropertiesPanel);
    return () => eventBus.off('togglePropertiesPanel', handleTogglePropertiesPanel);
  }, []);

  // Toggle document properties dialog via event
  useEffect(() => {
    const handleToggleDocumentProperties = () => {
      setShowDocumentPropertiesDialog(prev => !prev);
    };
    eventBus.on('toggleDocumentProperties', handleToggleDocumentProperties);
    return () => eventBus.off('toggleDocumentProperties', handleToggleDocumentProperties);
  }, []);

  // Listen for node click events and select the node
  useEffect(() => {
    const handleNodeClick = ({ id }) => {
      setSelectedNodeIds([id]);
      setSelectedEdgeIds([]);
      // Removed any pan/zoom reset logic here
    };
    eventBus.on('nodeClick', handleNodeClick);
    return () => eventBus.off('nodeClick', handleNodeClick);
  }, [setSelectedNodeIds, setSelectedEdgeIds]);

  // Consolidated background/document repaint & redraw effect
  useEffect(() => {
    if (!backgroundUrl) return;

    const doRepaint = () => {
      try {
        // Only emit forceRedraw, don't modify pan
        try { eventBus.emit('forceRedraw'); } catch (e) { }

        // Dispatch a resize event as a fallback
        window.dispatchEvent(new Event('resize'));
      } catch (err) {
        console.warn('Repaint attempt failed:', err);
      }
    };

    // Emit forceRedraw a few times spaced out to cover async iframe renders
    const timers = [100, 300, 600].map(delay => setTimeout(() => {
      doRepaint();
    }, delay));

    // Initial immediate attempt
    doRepaint();

    return () => timers.forEach(clearTimeout);
  }, [backgroundUrl]);

  // Force redraw when nodes or edges change (fixes frame lag after delete)
  useEffect(() => {
    eventBus.emit('forceRedraw');
  }, [nodes, edges]);

  // Listen for addNode events from toolbar
  useEffect(() => {
    // console.log('[GraphEditor] Registering addNode event listener');
    const handleAddNodeEvent = ({ type }) => {
      // console.log('[GraphEditor] Received addNode event for type:', type);
      const meta = nodeTypeMetadata.find(m => m.type === type);
      const width = meta?.defaultWidth || 200;
      const height = meta?.defaultHeight || 120;
      // console.log('[GraphEditor] addNode event - type:', type, 'width:', width, 'height:', height, 'meta:', meta);
      if (handlers && handlers.handleAddNode) {
        handlers.handleAddNode(type, { width, height });
      } else {
        console.error('[GraphEditor] handlers.handleAddNode is not available');
      }
    };
    
    eventBus.on('addNode', handleAddNodeEvent);
    return () => {
      // console.log('[GraphEditor] Unregistering addNode event listener');
      eventBus.off('addNode', handleAddNodeEvent);
    };
  }, [handlers]);

  return (
    <div 
      id="graph-editor-background" 
      role="application"
      aria-label="Node graph editor"
      style={{
        minHeight: '100vh',
        minWidth: '100vw',
        backgroundColor: theme.palette.background.default,
        backgroundImage: backgroundImage ? `url('/background art/${backgroundImage}')` : undefined,
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Toolbar 
        onToggleNodeList={() => setShowNodeList(!showNodeList)}
        showNodeList={showNodeList}
        onToggleGroupList={() => setShowGroupList(!showGroupList)}
        showGroupList={showGroupList}
        nodes={nodes} 
        edges={edges} 
        groups={groups}
        onLoadGraph={handlers.handleLoadGraph}
        onDeleteSelected={handlers.handleDeleteSelected}
        onClearGraph={handlers.handleClearGraph}
        onUndo={historyHook.handleUndo}
        onRedo={historyHook.handleRedo}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeId={selectedEdgeIds[0] || null}
        canUndo={historyHook.canUndo}
        canRedo={historyHook.canRedo}
        mode={modesHook.mode}
        autoLayoutType={modesHook.autoLayoutType}
        onModeChange={modesHook.handleModeChange}
        onAutoLayoutChange={modesHook.setAutoLayoutType}
        onApplyLayout={modesHook.applyAutoLayout}
        onShowMessage={(message, severity = 'info') => setSnackbar({ open: true, message, severity })}
        pan={pan}
        zoom={zoom}
        setNodes={setNodes}
        setEdges={setEdges}
        setGroups={setGroups}
        nodesRef={nodesRef}
        edgesRef={edgesRef}
        saveToHistory={historyHook.saveToHistory}
        graphCRUD={graphCRUD}
        currentTheme={theme.palette.mode}
        backgroundImage={backgroundImage}
        backgroundUrl={backgroundUrl}
        setBackgroundUrl={setBackgroundUrl}
        defaultNodeColor={defaultNodeColor}
        defaultEdgeColor={defaultEdgeColor}
        isFreeUser={isFreeUser}
        showMinimap={showMinimap}
        onToggleMinimap={() => eventBus.emit('toggleMinimap')}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={() => setSnapToGrid(prev => !prev)}
        gridSize={documentSettings.gridSize}
        documentTheme={documentTheme}
      />
      
      {showPropertiesPanel && (
        <PropertiesPanel
          selectedNode={selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : null}
          selectedEdge={selectedEdgeIds.length === 1 ? edges.find(e => e.id === selectedEdgeIds[0]) : null}
          selectedGroup={selectedGroupIds.length === 1 ? groups.find(g => g.id === selectedGroupIds[0]) : null}
          onUpdateNode={(id, updates, options) => {
            setNodes(prev => {
              const next = prev.map(n => n.id === id ? { ...n, ...updates, data: updates && updates.data ? { ...n.data, ...updates.data } : n.data } : n);
              nodesRef.current = next;
              try { historyHook.saveToHistory(next, edgesRef.current); } catch (err) {}
              return next;
            });
            try { if (handlers && typeof handlers.handleUpdateNodeData === 'function') { handlers.handleUpdateNodeData(id, updates, options); } } catch (err) {}
          }}
          onUpdateEdge={(id, updates) => {
            setEdges(prev => {
              const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
              edgesRef.current = next;
              try { historyHook.saveToHistory(nodesRef.current, next); } catch (err) {}
              return next;
            });
          }}
          onUpdateGroup={(id, updates) => {
            setGroups(prev => {
              const next = prev.map(g => g.id === id ? { ...g, ...updates } : g);
              return next;
            });
          }}
          theme={theme}
          defaultNodeColor={defaultNodeColor}
          defaultEdgeColor={defaultEdgeColor}
          lockedNodes={lockedNodes}
          lockedEdges={lockedEdges}
          lockedGroups={groupManager?.lockedGroups}
          onToggleNodeLock={(nodeId) => {
            setLockedNodes(prev => {
              const newSet = new Set(prev);
              if (newSet.has(nodeId)) { newSet.delete(nodeId); } else { newSet.add(nodeId); }
              return newSet;
            });
          }}
          onToggleEdgeLock={(edgeId) => {
            setLockedEdges(prev => {
              const newSet = new Set(prev);
              if (newSet.has(edgeId)) { newSet.delete(edgeId); } else { newSet.add(edgeId); }
              return newSet;
            });
          }}
          onToggleGroupLock={groupManager?.toggleGroupLock}
          onClose={() => setShowPropertiesPanel(false)}
        />
      )}
      
      <NodeListPanel
        nodes={nodes}
        selectedNodeId={selectedNodeIds[0] || null}
        selectedNodeIds={selectedNodeIds}
        onNodeSelect={handlers.handleNodeListSelect}
        onNodeFocus={handlers.handleNodeFocus}
        onClose={() => setShowNodeList(false)}
        isOpen={showNodeList}
        theme={theme}
        anchor={nodeListAnchor}
        propertiesPanelAnchor={nodePanelAnchor}
      />

      <GroupListPanel
        groups={groups}
        selectedGroupId={selectedGroupIds[0] || null}
        selectedGroupIds={selectedGroupIds}
        onGroupSelect={handlers.handleGroupListSelect}
        onGroupFocus={handlers.handleGroupFocus}
        onGroupDoubleClick={handlers.handleGroupDoubleClickFromList}
        onGroupToggleVisibility={handlers.handleGroupToggleVisibility}
        onGroupDelete={handlers.handleGroupDelete}
        onClose={() => setShowGroupList(false)}
        isOpen={showGroupList}
        theme={theme}
      />
      
      {documentMuiTheme ? (
        <MuiThemeProvider theme={documentMuiTheme}>
          <NodeGraph 
            key={`${backgroundUrl || 'no-background'}-${graphRenderKey}`}
            nodes={memoizedNodes}
            setNodes={memoizedSetNodes}
            setEdges={memoizedSetEdges}
            edges={memoizedEdges}
            groups={memoizedGroups}
            setGroups={memoizedSetGroups}
            pan={pan}
            zoom={zoom}
            setPan={memoizedSetPan}
            setZoom={memoizedSetZoom}
            selectedNodeId={memoizedSelectedNodeIds[0] || null}
            selectedEdgeId={memoizedSelectedEdgeIds[0] || null}
            selectedNodeIds={memoizedSelectedNodeIds}
            selectedEdgeIds={memoizedSelectedEdgeIds}
            selectedGroupIds={memoizedSelectedGroupIds}
            setSelectedNodeIds={memoizedSetSelectedNodeIds}
            setSelectedEdgeIds={memoizedSetSelectedEdgeIds}
            hoveredNodeId={hoveredNodeId}
            nodeTypes={nodeTypes}
            edgeTypes={EdgeTypes}
            mode={modesHook.mode}
            backgroundUrl={backgroundUrl}
            backgroundInteractive={backgroundInteractive}
            backgroundImage={documentBackgroundImage}
            setSnackbar={setSnackbar}
            showMinimap={showMinimap}
            snapToGrid={snapToGrid}
            showGrid={showGrid}
            gridSize={documentSettings.gridSize}
            lockedNodes={lockedNodes}
            lockedEdges={lockedEdges}
            onEdgeClick={undefined}
            onEdgeHover={undefined}
            hoveredEdgeId={hoveredEdgeId}
            showAllEdgeLabels={showAllEdgeLabels}
          />
        </MuiThemeProvider>
      ) : (
        <NodeGraph 
          key={`${backgroundUrl || 'no-background'}-${graphRenderKey}`}
          nodes={memoizedNodes}
          setNodes={memoizedSetNodes}
          setEdges={memoizedSetEdges}
          edges={memoizedEdges}
          groups={memoizedGroups}
          setGroups={memoizedSetGroups}
          pan={pan}
          zoom={zoom}
          setPan={memoizedSetPan}
          setZoom={memoizedSetZoom}
          selectedNodeId={memoizedSelectedNodeIds[0] || null}
          selectedEdgeId={memoizedSelectedEdgeIds[0] || null}
          selectedNodeIds={memoizedSelectedNodeIds}
          selectedEdgeIds={memoizedSelectedEdgeIds}
          selectedGroupIds={memoizedSelectedGroupIds}
          setSelectedNodeIds={memoizedSetSelectedNodeIds}
          setSelectedEdgeIds={memoizedSetSelectedEdgeIds}
          hoveredNodeId={hoveredNodeId}
          nodeTypes={nodeTypes}
          edgeTypes={EdgeTypes}
          mode={modesHook.mode}
          backgroundUrl={backgroundUrl}
          backgroundInteractive={backgroundInteractive}
          backgroundImage={documentBackgroundImage}
          setSnackbar={setSnackbar}
          showMinimap={showMinimap}
          snapToGrid={snapToGrid}
          showGrid={showGrid}
          gridSize={documentSettings.gridSize}
          lockedNodes={lockedNodes}
          lockedEdges={lockedEdges}
          onEdgeClick={undefined}
          onEdgeHover={undefined}
          hoveredEdgeId={hoveredEdgeId}
          showAllEdgeLabels={showAllEdgeLabels}
        />
      )}

      {/* Mount script runner and panel so scripts can run and panel can toggle */}
      <ScriptRunner onRequest={handleScriptRequest} />
      <ScriptPanel />
      
      {/* Document Properties Dialog */}
      <DocumentPropertiesDialog 
        open={showDocumentPropertiesDialog} 
        onClose={() => setShowDocumentPropertiesDialog(false)} 
        backgroundUrl={backgroundUrl} 
        setBackgroundUrl={setBackgroundUrl}
      />
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity || 'info'}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}