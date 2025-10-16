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
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';

// Helper to get GraphCRUD API
const getGraphAPI = () => (typeof window !== 'undefined' ? window.graphAPI : null);

const Toolbar = ({ 
  nodes = [], 
  edges = [], 
  groups = [], // <-- add this prop
  onLoadGraph, 
  onAddNode, 
  onDeleteSelected, 
  onClearGraph,
  onUndo,
  onRedo,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds = [], // <-- add this prop
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
  onShowMessage // Add this new prop
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
        if (onShowMessage) onShowMessage('Invalid graph format. Clipboard must contain nodes and edges.', 'error');
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
      if (onShowMessage) onShowMessage('Error reading from clipboard. Please ensure you have valid JSON copied.', 'error');
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
          if (onShowMessage) onShowMessage('Invalid graph file format. Missing nodes or edges.', 'error');
          return;
        }

        // Call the callback to update the graph
        if (onLoadGraph) {
          onLoadGraph(jsonData.nodes, jsonData.edges, jsonData.groups || []);
          console.log('Graph loaded successfully!');
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        if (onShowMessage) onShowMessage('Error loading file. Please ensure it\'s valid JSON.', 'error');
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
      })),
      groups: groups.map(group => ({ ...group })) // use prop
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
      if (onShowMessage) onShowMessage('Graph copied to clipboard!', 'success');
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

    // Get selected nodes
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    
    // Get all edges that connect selected nodes (both source and target must be selected)
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
        data: node.data
      })),
      edges: selectedEdges.map(edge => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edge.label,
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

      // Validate structure
      if (!jsonData.nodes || !Array.isArray(jsonData.nodes)) {
        if (onShowMessage) onShowMessage('Invalid clipboard data. Must contain nodes array.', 'error');
        return;
      }

      // Call the global paste handler if available
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
        {/* Essential actions */}
        <ButtonGroup variant="contained" size="small" sx={{ mr: 1 }}>
          {/* Onboard LLM button - position #1 */}
          <IconButton
            onClick={handleCopyOnboard}
            title="Onboard LLM"
            size="small"
          >
            <ContentPasteGoIcon fontSize="small" />
          </IconButton>
          
          {/* Paste button - position #2 */}
          <IconButton
            onClick={handlePasteSelected}
            title="Paste from Clipboard"
            size="small"
          >
            <ContentPasteIcon fontSize="small" />
          </IconButton>

          {/* Copy Selected button - position #3 */}
          <IconButton
            onClick={handleCopySelected}
            disabled={selectedNodeIds.length === 0}
            title="Copy Selected Nodes + Edges"
            size="small"
            color={selectedNodeIds.length > 0 ? "primary" : "default"}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            onClick={onAddNode}
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
            onClick={onClearGraph}
            title="Clear Graph"
            size="small"
            color="error"
          >
            <ThumbDownOffAltIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={handleSaveToFile}
            title="Save Graph to File"
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
        </ButtonGroup>

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
              // Only set the layout type, do not apply layout
              onAutoLayoutChange('hierarchical');
              setAutoLayoutMenuAnchor(null);
            }}
            selected={autoLayoutType === 'hierarchical'}
          >
            Hierarchical
          </MenuItem>
          <MenuItem
            onClick={() => {
              // Only set the layout type, do not apply layout
              onAutoLayoutChange('radial');
              setAutoLayoutMenuAnchor(null);
            }}
            selected={autoLayoutType === 'radial'}
          >
            Radial
          </MenuItem>
          <MenuItem
            onClick={() => {
              // Only set the layout type, do not apply layout
              onAutoLayoutChange('grid');
              setAutoLayoutMenuAnchor(null);
            }}
            selected={autoLayoutType === 'grid'}
          >
            Grid
          </MenuItem>
        </Menu>

        {/* Status indicators */}
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </Box>
    </Paper>
  );
};

export default Toolbar;