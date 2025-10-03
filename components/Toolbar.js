"use client";
import React, { useEffect, useRef, useState } from 'react';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ViewListIcon from '@mui/icons-material/ViewList';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

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
  showNodeList = true
}) => {
  const theme = useTheme();
  const palette = theme?.palette || {};
  const primary = palette.primary || {};
  const [pos, setPos] = useState({ x: 0, y: 88 });
  const [copied, setCopied] = useState(false);
  const [metadataCopied, setMetadataCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pasted, setPasted] = useState(false);
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

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        minWidth: 560,
        height: 56,
        backgroundColor: primary.main,
        color: primary.contrastText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        gap: 0.5,
        borderRadius: 2,
        zIndex: 1200,
        pointerEvents: 'auto',
        userSelect: 'none',
        transition: 'background-color 0.2s, color 0.2s',
      }}
      tabIndex={0}
    >
      {/* Draggable area */}
      <Box
        sx={{
          flexGrow: 1,
          cursor: 'move',
          display: 'flex',
          alignItems: 'center',
          fontWeight: 600,
          fontSize: 16,
          mr: 1
        }}
        onMouseDown={onMouseDown}
      >
        Tools
      </Box>

      {/* Add Node Button */}
      <Tooltip title="Add new node" arrow>
        <IconButton
          onClick={handleAddNode}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          <AddCircleIcon />
        </IconButton>
      </Tooltip>

      {/* Delete Selected Button */}
      <Tooltip title={selectedNodeId || selectedEdgeId ? "Delete selected" : "No selection"} arrow>
        <span>
          <IconButton
            onClick={handleDelete}
            disabled={!selectedNodeId && !selectedEdgeId}
            sx={{
              color: primary.contrastText,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              },
              '&.Mui-disabled': {
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Clear Graph Button */}
      <Tooltip title="Clear entire graph" arrow>
        <IconButton
          onClick={handleClear}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          <ClearIcon />
        </IconButton>
      </Tooltip>

      {/* Divider */}
      <Box sx={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)', mx: 0.5 }} />

      {/* Undo Button */}
      <Tooltip title={canUndo ? "Undo" : "Nothing to undo"} arrow>
        <span>
          <IconButton
            onClick={handleUndo}
            disabled={!canUndo}
            sx={{
              color: primary.contrastText,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              },
              '&.Mui-disabled': {
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
            size="small"
          >
            <UndoIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Redo Button */}
      <Tooltip title={canRedo ? "Redo" : "Nothing to redo"} arrow>
        <span>
          <IconButton
            onClick={handleRedo}
            disabled={!canRedo}
            sx={{
              color: primary.contrastText,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              },
              '&.Mui-disabled': {
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
            size="small"
          >
            <RedoIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Divider */}
      <Box sx={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)', mx: 0.5 }} />

      {/* Paste Graph Button */}
      <Tooltip title={pasted ? "Pasted!" : "Paste graph from clipboard"} arrow>
        <IconButton
          onClick={handlePasteGraph}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          {pasted ? <CheckIcon /> : <ContentPasteIcon />}
        </IconButton>
      </Tooltip>

      {/* Load File Button */}
      <Tooltip title="Load graph from file" arrow>
        <IconButton
          onClick={handleLoadFile}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          <FolderOpenIcon />
        </IconButton>
      </Tooltip>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Save to File Button */}
      <Tooltip title={saved ? "Saved!" : "Save graph to file"} arrow>
        <IconButton
          onClick={handleSaveToFile}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          {saved ? <CheckIcon /> : <SaveIcon />}
        </IconButton>
      </Tooltip>

      {/* Copy Metadata Button */}
      <Tooltip title={metadataCopied ? "Copied!" : "Copy metadata"} arrow>
        <IconButton
          onClick={handleCopyMetadata}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          {metadataCopied ? <CheckIcon /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      {/* Copy Full JSON Button */}
      <Tooltip title={copied ? "Copied!" : "Export full graph JSON"} arrow>
        <IconButton
          onClick={handleCopyJSON}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          {copied ? <CheckIcon /> : <ContentCopyIcon />}
        </IconButton>
      </Tooltip>

      {/* Toggle Node List Button */}
      <Tooltip title={showNodeList ? "Hide Node List" : "Show Node List"} arrow>
        <IconButton 
          onClick={onToggleNodeList}
          color={showNodeList ? "primary" : "default"}
          sx={{
            color: primary.contrastText,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          size="small"
        >
          <ViewListIcon />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};

export default Toolbar;