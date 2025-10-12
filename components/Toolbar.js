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
  ChevronRight as ExpandIcon
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
  const [onboardCopied, setOnboardCopied] = useState(false);
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const [loadMenuAnchor, setLoadMenuAnchor] = useState(null);
  const [autoLayoutMenuAnchor, setAutoLayoutMenuAnchor] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
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
      alert('Unable to copy Onboard LLM guide to clipboard.');
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
        flexWrap: 'nowrap'
      }}>
        {/* Collapse/Expand toggle */}
        <IconButton
          onClick={() => setIsCollapsed(!isCollapsed)}
          size="small"
          title={isCollapsed ? "Expand Toolbar" : "Collapse Toolbar"}
        >
          {isCollapsed ? <ExpandIcon /> : <CollapseIcon />}
        </IconButton>

        {!isCollapsed ? (
          <>
            {/* Essential actions */}
            <ButtonGroup variant="contained" size="small" sx={{ mr: 1 }}>
              <IconButton
                onClick={onAddNode}
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
            </ButtonGroup>

            {/* Mode selector */}
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

            {/* Auto layout options - only in auto mode */}
            {mode === 'auto' && (
              <ButtonGroup size="small" sx={{ mr: 1 }}>
                <Button
                  onClick={(event) => setAutoLayoutMenuAnchor(event.currentTarget)}
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

            {/* History controls */}
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

            {/* More actions menu */}
            <IconButton
              onClick={(event) => setMoreMenuAnchor(event.currentTarget)}
              title="More Actions"
              size="small"
            >
              <MoreIcon />
            </IconButton>
          </>
        ) : (
          /* Collapsed state */
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {nodes.length}N • {edges.length}E
            </Typography>
            <IconButton
              onClick={onAddNode}
              title="Add Node"
              size="small"
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* Auto Layout Menu */}
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

        {/* More Menu */}
        <Menu
          anchorEl={moreMenuAnchor}
          open={Boolean(moreMenuAnchor)}
          onClose={() => setMoreMenuAnchor(null)}
        >
          <MenuItem onClick={() => { handleClear(); setMoreMenuAnchor(null); }}>
            <ClearIcon sx={{ mr: 1 }} />
            Clear Graph
          </MenuItem>
          <MenuItem onClick={() => { setSaveMenuAnchor(moreMenuAnchor); setMoreMenuAnchor(null); }}>
            <SaveIcon sx={{ mr: 1 }} />
            Save Options...
          </MenuItem>
          <MenuItem onClick={() => { setLoadMenuAnchor(moreMenuAnchor); setMoreMenuAnchor(null); }}>
            <LoadIcon sx={{ mr: 1 }} />
            Load Options...
          </MenuItem>
          {mode === 'auto' && (
            <MenuItem onClick={() => { setAutoLayoutMenuAnchor(moreMenuAnchor); setMoreMenuAnchor(null); }}>
              <AutoIcon sx={{ mr: 1 }} />
              Layout Options...
            </MenuItem>
          )}
        </Menu>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Spacer - only in expanded mode */}
        {!isCollapsed && <Box sx={{ flexGrow: 1 }} />}

        {/* Right section - only in expanded mode */}
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Status indicators */}
            {(copied || metadataCopied || saved || pasted || onboardCopied) && (
              <Chip
                label={
                  copied ? "JSON Copied!" :
                  metadataCopied ? "Metadata Copied!" :
                  saved ? "Saved!" :
                  pasted ? "Pasted!" :
                  onboardCopied ? "LLM Guide Copied!" : ""
                }
                size="small"
                color="success"
                sx={{ animation: 'fadeInOut 2s' }}
              />
            )}

            {/* Graph stats */}
            <Typography variant="caption" color="text.secondary">
              {nodes.length}N • {edges.length}E
            </Typography>

            {/* Node list toggle */}
            <IconButton
              onClick={onToggleNodeList}
              color={showNodeList ? "primary" : "default"}
              title="Toggle Node List"
              size="small"
            >
              <ListIcon fontSize="small" />
            </IconButton>
            {/* Copy LLM guide to clipboard */}
            <IconButton
              onClick={handleCopyOnboard}
              title="Copy LLM Guide"
              size="small"
            >
              <ManualIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default Toolbar;