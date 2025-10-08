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
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

// Helper to get GraphCRUD API
const getGraphAPI = () => (typeof window !== 'undefined' ? window.graphAPI : null);

const Toolbar = ({ 
  nodes = [], 
  edges = [], 
  onLoadGraph, 
  onAddNode, 
  onDeleteSelected, 
  onClearGraph,
  onUndo,
  onRedo,
  selectedNodeId,
  selectedEdgeId,
  canUndo = false,
  canRedo = false,
  onToggleNodeList,
  showNodeList = true,
  mode,
  autoLayoutType,
  onModeChange,
  onAutoLayoutChange,
  onApplyLayout
}) => {
  const theme = useTheme();
  const palette = theme?.palette || {};
  const primary = palette.primary || {};
  const [pos, setPos] = useState({ x: 0, y: 88 });
  const [copied, setCopied] = useState(false);
  const [metadataCopied, setMetadataCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const [loadMenuAnchor, setLoadMenuAnchor] = useState(null);
  const [autoLayoutMenuAnchor, setAutoLayoutMenuAnchor] = useState(null);
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

  const handlePasteGraph = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const jsonData = JSON.parse(clipboardText);

      // Validate the structure
      if (!jsonData.nodes || !jsonData.edges) {
        console.error('Invalid graph format in clipboard');
        alert('Invalid graph format. Clipboard must contain a graph with nodes and edges.');
        return;
      }

      // Call the callback to update the graph
      if (onLoadGraph) {
        onLoadGraph(jsonData.nodes, jsonData.edges);
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
        console.log('Graph pasted from clipboard!');
      }
    } catch (error) {
      console.error('Error reading from clipboard:', error);
      alert('Error reading from clipboard. Please ensure you have a valid JSON graph copied.');
    }
  };

  const handleAddNode = () => {
    const graphAPI = getGraphAPI();
    if (graphAPI) {
      graphAPI.createNode({
        type: 'default',
        label: `Node ${nodes.length + 1}`,
        data: {},
        position: { x: 100 + (nodes.length * 20), y: 100 + (nodes.length * 20) },
        showLabel: true,
        width: 80,
        height: 48
      });
      console.log('Add node clicked (GraphCRUD)');
    } else if (onAddNode) {
      onAddNode();
      console.log('Add node clicked (fallback)');
    }
  };

  const handleDelete = () => {
    if (onDeleteSelected) {
      onDeleteSelected();
      console.log('Delete selected clicked');
    }
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

  const handleUndo = () => {
    if (onUndo && canUndo) {
      onUndo();
      console.log('Undo clicked');
    }
  };

  const handleRedo = () => {
    if (onRedo && canRedo) {
      onRedo();
      console.log('Redo clicked');
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
        
        // Validate the structure
        if (!jsonData.nodes || !jsonData.edges) {
          console.error('Invalid graph file format');
          alert('Invalid graph file format. Missing nodes or edges.');
          return;
        }

        // Call the callback to update the graph
        if (onLoadGraph) {
          onLoadGraph(jsonData.nodes, jsonData.edges);
          console.log('Graph loaded successfully!');
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Error loading file. Please ensure it\'s a valid JSON graph file.');
      }
    };

    reader.readAsText(file);
    // Reset the input so the same file can be loaded again
    e.target.value = '';
  };

  const handleSaveToFile = () => {
    const schema = {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: node.position,
        width: node.width,
        height: node.height,
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        style: edge.style
      }))
    };

    const jsonString = JSON.stringify(schema, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    console.log('Graph saved to file!');
  };

  const handleCopyMetadata = async () => {
    // Extract only metadata - node/edge types and data structure
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
      // Fallback for older browsers
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
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        style: edge.style
      }))
    };

    const jsonString = JSON.stringify(schema, null, 2);

    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      console.log('Graph schema copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
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
      } catch (err2) {
        console.error('Fallback copy failed:', err2);
      }
      document.body.removeChild(textArea);
    }
  };

  const getModeIcon = (modeType) => {
    switch (modeType) {
      case 'manual': return <ManualIcon />;
      case 'nav': return <NavIcon />;
      case 'auto': return <AutoIcon />;
      default: return <NavIcon />;
    }
  };

  const getModeLabel = (modeType) => {
    switch (modeType) {
      case 'manual': return 'Manual';
      case 'nav': return 'Nav';
      case 'auto': return 'Auto';
      default: return 'Nav';
    }
  };

  return (
    <Paper
      elevation={3}
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
        flexWrap: 'wrap'
      }}>
        {/* Left section - Main actions */}
        <ButtonGroup variant="contained" size="small" sx={{ mr: 2 }}>
          <Button
            startIcon={<AddIcon />}
            onClick={onAddNode}
          >
            Add Node
          </Button>
          <Button
            startIcon={<DeleteIcon />}
            onClick={onDeleteSelected}
            disabled={!selectedNodeId && !selectedEdgeId}
            color={selectedNodeId || selectedEdgeId ? "error" : "inherit"}
          >
            Delete
          </Button>
          <Button
            startIcon={<ClearIcon />}
            onClick={onClearGraph}
            color="error"
          >
            Clear
          </Button>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Mode Selector */}
        <Box sx={{ mr: 2 }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.7 }}>
            Positioning Mode
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(event, newMode) => {
              if (newMode !== null) {
                onModeChange(newMode);
              }
            }}
            size="small"
            sx={{ height: 32 }}
          >
            <ToggleButton value="manual" aria-label="manual positioning">
              <ManualIcon sx={{ mr: 0.5, fontSize: 16 }} />
              Manual
            </ToggleButton>
            <ToggleButton value="nav" aria-label="navigation mode">
              <NavIcon sx={{ mr: 0.5, fontSize: 16 }} />
              Nav
            </ToggleButton>
            <ToggleButton value="auto" aria-label="auto layout">
              <AutoIcon sx={{ mr: 0.5, fontSize: 16 }} />
              Auto
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Auto Layout Type Selector (only visible in auto mode) */}
        {mode === 'auto' && (
          <Box sx={{ mr: 2 }}>
            <Button
              endIcon={<ExpandMoreIcon />}
              onClick={(event) => setAutoLayoutMenuAnchor(event.currentTarget)}
              size="small"
              variant="outlined"
            >
              {autoLayoutType}
            </Button>
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
            <Button
              onClick={onApplyLayout}
              size="small"
              variant="contained"
              sx={{ ml: 1 }}
            >
              Apply Layout
            </Button>
          </Box>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* History controls */}
        <ButtonGroup variant="outlined" size="small" sx={{ mr: 2 }}>
          <IconButton
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
          >
            <UndoIcon />
          </IconButton>
          <IconButton
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <RedoIcon />
          </IconButton>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* File operations */}
        <ButtonGroup variant="outlined" size="small" sx={{ mr: 2 }}>
          <Button
            startIcon={<SaveIcon />}
            onClick={(event) => setSaveMenuAnchor(event.currentTarget)}
          >
            Save
          </Button>
          <Button
            startIcon={<LoadIcon />}
            onClick={(event) => setLoadMenuAnchor(event.currentTarget)}
          >
            Load
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </Button>
        </ButtonGroup>

        {/* Save Menu */}
        <Menu
          anchorEl={saveMenuAnchor}
          open={Boolean(saveMenuAnchor)}
          onClose={() => setSaveMenuAnchor(null)}
        >
          <MenuItem onClick={() => { handleSaveToFile(); setSaveMenuAnchor(null); }}>
            Save to File
          </MenuItem>
          <MenuItem onClick={() => { handleCopyJSON(); setSaveMenuAnchor(null); }}>
            Copy JSON
          </MenuItem>
          <MenuItem onClick={() => { handleCopyMetadata(); setSaveMenuAnchor(null); }}>
            Copy Metadata
          </MenuItem>
        </Menu>

        {/* Load Menu */}
        <Menu
          anchorEl={loadMenuAnchor}
          open={Boolean(loadMenuAnchor)}
          onClose={() => setLoadMenuAnchor(null)}
        >
          <MenuItem onClick={() => { handleLoadFile(); setLoadMenuAnchor(null); }}>
            Load from File
          </MenuItem>
          <MenuItem onClick={() => { handlePasteGraph(); setLoadMenuAnchor(null); }}>
            Paste Graph
          </MenuItem>
        </Menu>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right section - Info and toggles */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Status indicators */}
          {copied && (
            <Chip
              label="JSON Copied!"
              size="small"
              color="success"
              sx={{ animation: 'fadeInOut 2s' }}
            />
          )}
          {metadataCopied && (
            <Chip
              label="Metadata Copied!"
              size="small"
              color="success"
              sx={{ animation: 'fadeInOut 2s' }}
            />
          )}
          {saved && (
            <Chip
              label="Saved!"
              size="small"
              color="success"
              sx={{ animation: 'fadeInOut 2s' }}
            />
          )}
          {pasted && (
            <Chip
              label="Pasted!"
              size="small"
              color="success"
              sx={{ animation: 'fadeInOut 2s' }}
            />
          )}

          {/* Current mode indicator */}
          <Chip
            icon={getModeIcon(mode)}
            label={getModeLabel(mode)}
            size="small"
            color={mode === 'nav' ? 'primary' : mode === 'auto' ? 'secondary' : 'default'}
            variant="outlined"
          />

          {/* Graph stats */}
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {nodes.length} nodes, {edges.length} edges
          </Typography>

          {/* Node list toggle */}
          <IconButton
            onClick={onToggleNodeList}
            color={showNodeList ? "primary" : "inherit"}
            title="Toggle Node List"
          >
            <ListIcon />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default Toolbar;