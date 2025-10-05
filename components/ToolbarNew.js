import React, { useState, useRef } from 'react';
import {
  AppBar,
  Toolbar as MuiToolbar,
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
  DeleteSweep as ClearIcon,
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

export default function Toolbar({
  onToggleNodeList,
  showNodeList,
  nodes,
  edges,
  onLoadGraph,
  onAddNode,
  onDeleteSelected,
  onClearGraph,
  onUndo,
  onRedo,
  selectedNodeId,
  selectedEdgeId,
  canUndo,
  canRedo,
  mode,
  autoLayoutType,
  onModeChange,
  onAutoLayoutChange,
  onApplyLayout
}) {
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const [loadMenuAnchor, setLoadMenuAnchor] = useState(null);
  const [autoLayoutMenuAnchor, setAutoLayoutMenuAnchor] = useState(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef(null);

  const handleSaveGraph = () => {
    const graphData = {
      nodes,
      edges,
      timestamp: new Date().toISOString()
    };
    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSaveMenuAnchor(null);
  };

  const handleLoadGraph = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const graphData = JSON.parse(e.target.result);
          onLoadGraph(graphData.nodes || [], graphData.edges || []);
        } catch (error) {
          console.error('Failed to load graph:', error);
        }
      };
      reader.readAsText(file);
    }
    setLoadMenuAnchor(null);
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

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <Box
      ref={toolbarRef}
      sx={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 1300,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: 3,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      <AppBar 
        position="static" 
        sx={{ 
          borderRadius: 2
        }}
      >
      <MuiToolbar variant="dense">
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
            onClick={handleSaveGraph}
          >
            Save
          </Button>
          <Button
            component="label"
            startIcon={<LoadIcon />}
          >
            Load
            <input
              type="file"
              accept=".json"
              onChange={handleLoadGraph}
              style={{ display: 'none' }}
            />
          </Button>
        </ButtonGroup>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right section - Info and toggles */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
      </MuiToolbar>
      </AppBar>
    </Box>
  );
}