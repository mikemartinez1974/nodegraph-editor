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
  Chip
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
  MoreHoriz as MoreIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  ContentPasteGo as ContentPasteGoIcon,
  ThumbDownOffAlt as ThumbDownOffAltIcon,
  FolderSpecial as GroupIcon,
  ContentPaste as ContentPasteIcon,
  ContentCopy as ContentCopyIcon,
  FileCopy as FileCopyIcon,
  MenuBook as MenuBookIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import eventBus from '../components/NodeGraph/eventBus';
import PreferencesDialog from './GraphEditor/PreferencesDialog';

// Helper to detect theme name from colors
const detectThemeNameFromPalette = (theme) => {
  if (!theme?.palette?.primary?.main) return 'light';
  
  const primaryColor = theme.palette.primary.main;
  
  // Map primary colors to theme names (from your themes.js)
  const colorToThemeMap = {
    '#1976d2': 'light',
    '#90caf9': 'dark',
    '#2e7d32': 'forest',
    '#0288d1': 'ocean',
    '#d84315': 'desert',
    '#ec407a': 'sakura',
    '#0097a7': 'arctic',
    '#ff6f00': 'sunset',
    '#00e676': 'neon',
    '#ff0266': 'cyberpunk',
    '#00bfa5': 'tropical',
    '#3949ab': 'midnight',
    '#512da8': 'royal',
    '#546e7a': 'charcoal',
    '#9c7a3c': 'champagne',
    '#607d8b': 'slate',
    '#bf360c': 'autumn',
    '#6d4c41': 'cafe',
    '#ff8f00': 'amber',
    '#d84315': 'terracotta',
    '#00897b': 'mint',
    '#7e57c2': 'lavender',
    '#90a4ae': 'mist',
    '#d32f2f': 'volcano',
    '#5e35b1': 'deepSpace',
    '#00695c': 'emerald',
    '#c62828': 'crimson',
  };
  
  return colorToThemeMap[primaryColor] || theme.palette.mode || 'light';
};

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
  // New props for capturing settings
  currentTheme = 'light',
  backgroundImage = null,
  defaultNodeColor = '#1976d2',
  defaultEdgeColor = '#666666'
}) => {
  const theme = useTheme();
  const palette = theme?.palette || {};
  const primary = palette.primary || {};
  const [pos, setPos] = useState({ x: 0, y: 88 });
  const [copied, setCopied] = useState(false);
  const [metadataCopied, setMetadataCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [selectedCopied, setSelectedCopied] = useState(false);
  const [onboardCopied, setOnboardCopied] = useState(false);
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const [loadMenuAnchor, setLoadMenuAnchor] = useState(null);
  const [autoLayoutMenuAnchor, setAutoLayoutMenuAnchor] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPos({ x: window.innerWidth - 600, y: 88 });
    }
  }, []);

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
        console.log('Graph cleared');
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
        
        // Support both old format and new NodeGraphSaveFormat
        let nodesToLoad, edgesToLoad, groupsToLoad;
        
        if (jsonData.fileVersion && jsonData.nodes) {
          // New format - extract from NodeGraphSaveFormat
          nodesToLoad = jsonData.nodes;
          edgesToLoad = jsonData.edges;
          groupsToLoad = jsonData.groups || [];
          
          // TODO: Apply settings from the file (theme, viewport, etc.)
          console.log('Loaded NodeGraphSaveFormat v' + jsonData.fileVersion);
        } else if (jsonData.nodes && jsonData.edges) {
          // Legacy format - direct nodes/edges
          nodesToLoad = jsonData.nodes;
          edgesToLoad = jsonData.edges;
          groupsToLoad = jsonData.groups || [];
        } else {
          console.error('Invalid graph file format');
          if (onShowMessage) onShowMessage('Invalid graph file format. Missing nodes or edges.', 'error');
          return;
        }

        // Call the callback to update the graph
        if (onLoadGraph) {
          onLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
          console.log('Graph loaded successfully!');
          if (onShowMessage) onShowMessage('Graph loaded successfully!', 'success');

          // Emit optional settings/viewport for the editor to apply (settings are optional)
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
    
    // Extract theme object from current theme
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

    // Build NodeGraphSaveFormat compliant file
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
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.nodegraph`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (onShowMessage) onShowMessage('Graph saved to .nodegraph file!', 'success');
    console.log('Graph saved to file in NodeGraphSaveFormat!');
  };

  const handleCopyMetadata = async () => {
    const edgeTypesUsed = [...new Set(edges.map(e => e.type))];
    const edgeMetadata = {};
    
    edgeTypesUsed.forEach(type => {
      const edgesOfType = edges.filter(e => e.type === type);
      const sampleEdge = edgesOfType[0];
      edgeMetadata[type] = {
        count: edgesOfType.length,
        style: sampleEdge?.style || {},
        label: sampleEdge?.label || '',
        showLabel: sampleEdge?.showLabel || false
      };
    });

    const metadata = {
      nodeTypes: [...new Set(nodes.map(n => n.type))],
      nodeCount: nodes.length,
      edgeTypes: edgeTypesUsed,
      edgeCount: edges.length,
      edgeMetadata: edgeMetadata,
      dataFields: {
        memo: nodes.some(n => n.data?.memo),
        link: nodes.some(n => n.data?.link)
      }
    };

    const jsonString = JSON.stringify(metadata, null, 2);

    try {
      await navigator.clipboard.writeText(jsonString);
      setMetadataCopied(true);
      setTimeout(() => setMetadataCopied(false), 2000);
      console.log('Graph metadata copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      const textArea = document.createElement('textarea');
      textArea.value = jsonString;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setMetadataCopied(true);
        setTimeout(() => setMetadataCopied(false), 2000);
      } catch (err2) {
        console.error('Fallback copy failed:', err2);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleCopyJSON = async () => {
    const schema = {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: node.position,
        width: node.width,
        height: node.height,
        color: node.color,
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        color: edge.color,
        style: edge.style
      }))
    };

    const jsonString = JSON.stringify(schema, null, 2);

    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onShowMessage) onShowMessage('Graph copied to clipboard!', 'success');
      console.log('Graph schema copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      const textArea = document.createElement('textarea');
      textArea.value = jsonString;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (onShowMessage) onShowMessage('Graph copied to clipboard!', 'success');
      } catch (err2) {
        console.error('Fallback copy failed:', err2);
        if (onShowMessage) onShowMessage('Failed to copy to clipboard.', 'error');
      }
      document.body.removeChild(textArea);
    }
  };

  const handleCopyOnboard = async () => {
    try {
      const resp = await fetch('/data/OnboardLLM.md');
      let text;
      if (resp.ok) text = await resp.text(); else text = 'OnboardLLM.md not available.';
      await navigator.clipboard.writeText(text);
      setOnboardCopied(true);
      setTimeout(() => setOnboardCopied(false), 2000);
      console.log('Onboard LLM guide copied to clipboard!');
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
      console.log(`Copied ${selectedNodes.length} nodes and ${selectedEdges.length} edges to clipboard!`);
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
        console.log('Pasted data from clipboard!');
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
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) return;

      try {
        JSON.parse(text);
        return handlePasteSelected();
      } catch {
        const lines = text.trim().split('\n');
        const label = lines[0].substring(0, 50);
        const memo = text.trim();
        
        const width = Math.max(200, Math.min(600, label.length * 8 + 100));
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
        
        saveToHistory(nodesRef.current, edgesRef.current);
        if (onShowMessage) onShowMessage('Created resizable node from pasted text', 'success');
      }
    } catch (err) {
      console.error('Error handling paste:', err);
      if (onShowMessage) onShowMessage('Error reading clipboard. Grant permission and try again.', 'error');
    }
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
        console.log('Graph schema copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        const textArea = document.createElement('textarea');
        textArea.value = jsonString;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          if (onShowMessage) onShowMessage('Graph copied to clipboard!', 'success');
        } catch (err2) {
          console.error('Fallback copy failed:', err2);
          if (onShowMessage) onShowMessage('Failed to copy to clipboard.', 'error');
        }
        document.body.removeChild(textArea);
      });
  };

  // Build a compact theme object to persist in save file
  const exportThemeObject = (theme) => ({
    primary: theme.palette?.primary?.main || null,
    primaryContrast: theme.palette?.primary?.contrastText || null,
    secondary: theme.palette?.secondary?.main || null,
    secondaryContrast: theme.palette?.secondary?.contrastText || null,
    background: theme.palette?.background?.default || null,
    paper: theme.palette?.background?.paper || null,
    textPrimary: theme.palette?.text?.primary || null,
    textSecondary: theme.palette?.text?.secondary || null,
    divider: theme.palette?.divider || null,
    success: theme.palette?.success?.main || null,
    error: theme.palette?.error?.main || null,
    warning: theme.palette?.warning?.main || null,
    info: theme.palette?.info?.main || null
  });

  const handleExport = () => {
    const payload = {
      fileVersion: "1.0",
      metadata: {
        title: "Untitled Graph",
        description: "",
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        author: "",
        tags: []
      },
      settings: {
        theme: null,
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

    // Ensure settings.theme is a theme object, not a string
    try {
      payload.settings = payload.settings || {};
      payload.settings.theme = exportThemeObject(theme);
      // remove any legacy themeName or mode fields
      if (payload.settings.themeName) delete payload.settings.themeName;
      if (payload.settings.theme && payload.settings.theme.mode) delete payload.settings.theme.mode;
    } catch (err) {
      // Fallback: leave existing value if theme not available
      console.warn('Could not include theme object in export:', err);
    }

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.nodegraph`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onShowMessage) onShowMessage('Graph exported to .nodegraph file!', 'success');
    console.log('Graph exported to file in NodeGraphSaveFormat!');
  };

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
            onClick={e => {
              console.log('Toolbar Add Node button clicked');
              onAddNode(e);
            }}
            title="Add Node (Ctrl+N)"
            size="small"
          >
            <AddIcon />
          </IconButton>
          
          <IconButton
            onClick={onToggleNodeList}
            color={showNodeList ? "primary" : "default"}
            title="Toggle Node List"
            size="small"
          >
            <ListIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={onToggleGroupList}
            color={showGroupList ? "primary" : "default"}
            title="Toggle Group List"
            size="small"
          >
            <GroupIcon fontSize="small" />
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
          >
            <ThumbDownOffAltIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleSaveToFile}
            title="Save Graph to File (.nodegraph)"
            size="small"
          >
            <SaveIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleLoadFile}
            title="Load Graph from File"
            size="small"
          >
            <LoadIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={() => setPreferencesOpen(true)}
            title="Preferences"
            aria-label="Open Preferences"
            size="small"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </ButtonGroup>

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
            >
              {autoLayoutType}
            </Button>
            <Button
              onClick={onApplyLayout}
              size="small"
              variant="contained"
              startIcon={<AutoIcon fontSize="small" />}
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

        {(copied || metadataCopied || saved || pasted || selectedCopied || onboardCopied) && (
          <Chip
            label={
              copied ? "JSON Copied!" :
              metadataCopied ? "Metadata Copied!" :
              saved ? "Saved!" :
              pasted ? "Pasted!" :
              selectedCopied ? "Selected Copied!" :
              onboardCopied ? "LLM Guide Copied!" : ""
            }
            size="small"
            color="success"
            sx={{ animation: 'fadeInOut 2s' }}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.nodegraph"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <PreferencesDialog
          open={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
        />
      </Box>
    </Paper>
  );
};

export default Toolbar;