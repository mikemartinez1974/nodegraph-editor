"use client";
import React, { useState, useEffect, useRef } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Chip from '@mui/material/Chip';

export default function GroupPropertiesPanel({ 
  selectedGroup,
  nodes = [],
  onUpdateGroup, 
  onUngroupGroup,
  onAddNodes,
  onRemoveNodes,
  onClose, 
  theme 
}) {
  const [label, setLabel] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('');
  const [borderColor, setBorderColor] = useState('');
  const [borderWidth, setBorderWidth] = useState(2);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 88 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // Debounce helpers
  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const DEBOUNCE_MS = 400;

  const scheduleUpdate = (fields) => {
    pendingRef.current = {
      ...pendingRef.current,
      ...fields
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload = { ...pendingRef.current };
      pendingRef.current = {};
      timerRef.current = null;
      if (!selectedGroup) return;
      onUpdateGroup(selectedGroup.id, payload);
    }, DEBOUNCE_MS);
  };

  const flushPending = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current && Object.keys(pendingRef.current).length > 0) {
      const payload = { ...pendingRef.current };
      pendingRef.current = {};
      if (selectedGroup) onUpdateGroup(selectedGroup.id, payload);
    }
  };

  // Update local state when selected group changes
  useEffect(() => {
    // Flush any pending changes for previous group
    flushPending();
    if (selectedGroup) {
      setLabel(selectedGroup.label || '');
      setBackgroundColor(selectedGroup.style?.backgroundColor || 'rgba(25, 118, 210, 0.1)');
      setBorderColor(selectedGroup.style?.borderColor || '#1976d2');
      setBorderWidth(selectedGroup.style?.borderWidth || 2);
      // Preserve group's visibility state (default: visible unless explicitly false)
      setVisible(selectedGroup.visible !== false);
    }
    // Cleanup when component unmounts or selectedGroup changes
    return () => {
      flushPending();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id]);

  if (!selectedGroup) return null;

  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    scheduleUpdate({ label: newLabel });
  };

  const handleBackgroundColorChange = (e) => {
    const newColor = e.target.value;
    setBackgroundColor(newColor);
    scheduleUpdate({ style: { ...(selectedGroup.style || {}), backgroundColor: newColor } });
  };

  const handleBorderColorChange = (e) => {
    const newColor = e.target.value;
    setBorderColor(newColor);
    scheduleUpdate({ style: { ...(selectedGroup.style || {}), borderColor: newColor } });
  };

  const handleBorderWidthChange = (e) => {
    const newWidth = parseInt(e.target.value, 10) || 2;
    setBorderWidth(newWidth);
    // Always merge with previous style and trigger update
    scheduleUpdate({ style: { ...((selectedGroup && selectedGroup.style) || {}), borderWidth: newWidth } });
  };

  const handleVisibilityChange = (e) => {
    const newVisible = e.target.checked;
    setVisible(newVisible);
    scheduleUpdate({ visible: newVisible });
  };

  const handleUngroup = () => {
    flushPending();
    onUngroupGroup(selectedGroup.id);
    onClose();
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
      x: Math.max(0, Math.min(e.clientX - offset.current.x, window.innerWidth - 340)),
      y: Math.max(0, Math.min(e.clientY - offset.current.y, window.innerHeight - 104)),
    });
  };

  const onMouseUp = () => {
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 320,
        maxHeight: 'calc(100vh - 104px)',
        background: `linear-gradient(135deg, ${theme?.palette?.primary?.light} 0%, ${theme?.palette?.primary?.dark} 100%)`,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // cursor and userSelect moved to header to avoid intercepting internal control clicks
      }}
      // removed onMouseDown here to avoid capturing clicks on buttons inside the panel
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: theme?.palette?.primary?.main || '#1976d2',
        color: theme?.palette?.primary?.contrastText || '#fff',
        cursor: dragging.current ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={onMouseDown}
      >
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
          Cluster Properties
        </Typography>
        <IconButton 
          size="small" 
          onClick={onClose}
          sx={{ color: 'inherit' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Content */}
      <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          ID: {selectedGroup.id}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Contains {selectedGroup.nodeIds?.length || 0} members
        </Typography>

        <TextField
          fullWidth
          label="Label"
          value={label}
          onChange={handleLabelChange}
          variant="filled"
          size="small"
          sx={{ mb: 2, backgroundColor: theme.palette.background.paper }}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          Style
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Background Color
          </Typography>
          <TextField
            fullWidth
            type="color"
            value={backgroundColor}
            onChange={handleBackgroundColorChange}
            variant="filled"
            size="small"
            sx={{ backgroundColor: theme.palette.background.paper }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Border Color
          </Typography>
          <TextField
            fullWidth
            type="color"
            value={borderColor}
            onChange={handleBorderColorChange}
            variant="filled"
            size="small"
            sx={{ backgroundColor: theme.palette.background.paper }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Border Width: {borderWidth}px
          </Typography>
          <TextField
            fullWidth
            type="number"
            value={borderWidth}
            onChange={handleBorderWidthChange}
            variant="filled"
            size="small"
            inputProps={{ min: 1, max: 10 }}
            sx={{ backgroundColor: theme.palette.background.paper }}
          />
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={visible}
              onChange={handleVisibilityChange}
              size="small"
            />
          }
          label="Visible"
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Members ({selectedGroup.nodeIds?.length || 0})
        </Typography>

        <List dense sx={{ maxHeight: 200, overflow: 'auto', mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: theme.palette.background.paper }}>
          {(selectedGroup.nodeIds || []).map((nodeId) => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;
            return (
              <ListItem key={nodeId}>
                <ListItemText
                  primary={node.label || `Node ${nodeId.slice(0, 8)}`}
                  secondary={`ID: ${nodeId.slice(0, 8)}...`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => onRemoveNodes(selectedGroup.id, [nodeId])}
                    title="Remove from cluster"
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Available Nodes
        </Typography>

        <List dense sx={{ maxHeight: 200, overflow: 'auto', mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: theme.palette.background.paper }}>
          {nodes
            .filter(node => !(selectedGroup.nodeIds || []).includes(node.id))
            .map((node) => (
              <ListItem key={node.id}>
                <ListItemText
                  primary={node.label || `Node ${node.id.slice(0, 8)}`}
                  secondary={`ID: ${node.id.slice(0, 8)}...`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => onAddNodes(selectedGroup.id, [node.id])}
                    title="Add to cluster"
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
        </List>

        <Divider sx={{ my: 2 }} />

        <Button
          fullWidth
          variant="outlined"
          color="error"
          onClick={handleUngroup}
          sx={{ mt: 1 }}
        >
          Ungroup Cluster
        </Button>
      </Box>
    </Paper>
  );
}
