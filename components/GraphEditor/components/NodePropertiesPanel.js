"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, IconButton, Divider, Stack, Tooltip, Paper } from '@mui/material';
import { createPortal } from 'react-dom';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NoteIcon from '@mui/icons-material/Note';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import EmojiPicker from 'emoji-picker-react';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import TextField from '@mui/material/TextField';
import eventBus from '../../NodeGraph/eventBus';
import ColorPickerInput from './ColorPickerInput';
import SaveIcon from '@mui/icons-material/Save';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import { TlzLink } from './TlzLink';
import AddNodeMenu from './AddNodeMenu';
import NodeTypeSelector from './NodeTypeSelector';
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from '@mui/icons-material';

export default function NodePropertiesPanel({
  selectedNode,
  onUpdateNode,
  onClose,
  theme,
  anchor = 'right',
  onAnchorChange,
  defaultNodeColor = '#1976d2',
  nodeTypes = {},
  lockedNodes = new Set(),
  onToggleNodeLock
}) {
  const drawerWidth = 400;
  
  // Use prop anchor, but remember preference in localStorage
  const [currentAnchor, setCurrentAnchor] = useState(anchor);

  useEffect(() => {
    setCurrentAnchor(anchor);
  }, [anchor]);

  const toggleAnchor = () => {
    const newAnchor = currentAnchor === 'right' ? 'left' : 'right';
    setCurrentAnchor(newAnchor);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nodePropertiesPanelAnchor', newAnchor);
    }
    if (onAnchorChange) onAnchorChange(newAnchor);
  };

  const [memo, setMemo] = useState('');
  const [label, setLabel] = useState('');
  const [memoView, setMemoView] = useState('edit'); // default to edit mode
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [width, setWidth] = useState(400);
  const [isOpen, setIsOpen] = useState(true); // Start open by default
  const [nodeColor, setNodeColor] = useState(selectedNode?.color || defaultNodeColor);
  const [nodeType, setNodeType] = useState('');
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const memoInputRef = useRef();

  // Update local state when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setMemo(selectedNode.data?.memo || '');
      setLabel(selectedNode.label || '');
      setNodeColor(selectedNode.color || defaultNodeColor);
      setNodeType(selectedNode.type || 'default');
      // Keep memoView as-is (default to edit) instead of forcing preview
    }
  }, [selectedNode?.id, defaultNodeColor]);

  const handleMemoChange = (e) => {
    const newMemo = e.target.value;
    setMemo(newMemo);
    // send structured update: data.memo
    if (onUpdateNode) onUpdateNode(selectedNode.id, { data: { memo: newMemo } });
  };

  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    // label is a top-level node property
    if (onUpdateNode) onUpdateNode(selectedNode.id, { label: newLabel }, true); // true flag indicates label update
  };

  const handleNodeTypeChangeInternal = (newType) => {
    setNodeType(newType);
    if (onUpdateNode) onUpdateNode(selectedNode.id, { type: newType });
  };

  const handleEmojiClick = () => {
    setShowEmojiPicker(val => !val);
  };

  const handleEmojiSelect = (emojiData) => {
    const emoji = emojiData.emoji;
    // Insert emoji at cursor position in memo
    const input = memoInputRef.current;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const newMemo = memo.slice(0, start) + emoji + memo.slice(end);
      setMemo(newMemo);
      if (onUpdateNode) onUpdateNode(selectedNode.id, { data: { memo: newMemo } });
      // Move cursor after emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      const newMemo = memo + emoji;
      setMemo(newMemo);
      if (onUpdateNode) onUpdateNode(selectedNode.id, { data: { memo: newMemo } });
    }
    setShowEmojiPicker(false);
  };

  const onResizeMouseDown = (e) => {
    resizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', onResizeMouseUp);
  };

  const onResizeMouseMove = (e) => {
    if (!resizing.current) return;
    // When on the right side, dragging left decreases width; when on the left, dragging right decreases width
    let delta = currentAnchor === 'right' ? startX.current - e.clientX : e.clientX - startX.current;
    let newWidth = Math.max(240, Math.min(startWidth.current + delta, 700));
    setWidth(newWidth);
  };

  const onResizeMouseUp = () => {
    resizing.current = false;
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', onResizeMouseUp);
  };

  // Listen for selectedNodeClick event to toggle panel
  useEffect(() => {
    const handleSelectedNodeClick = () => {
      setIsOpen(prev => !prev);
    };

    const handleBackgroundClick = () => {
      setIsOpen(false);
    };

    eventBus.on('selectedNodeClick', handleSelectedNodeClick);
    eventBus.on('backgroundClick', handleBackgroundClick);
    
    return () => {
      eventBus.off('selectedNodeClick', handleSelectedNodeClick);
      eventBus.off('backgroundClick', handleBackgroundClick);
    };
  }, [isOpen]);

  const handleColorChange = (color) => {
    setNodeColor(color);
    if (onUpdateNode) onUpdateNode(selectedNode.id, { color });
  };
  
  const handleSetAsDefault = () => {
    if (nodeColor && typeof window !== 'undefined' && window.setDefaultNodeColor) {
      window.setDefaultNodeColor(nodeColor);
    }
  };

  const handleToggleLock = () => {
    if (onToggleNodeLock) {
      onToggleNodeLock(selectedNode.id);
    }
  };

  const isLocked = lockedNodes.has(selectedNode.id);

  // Extend sanitize schema to allow 'tlz' protocol in preview
  const sanitizeSchema = {
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href || []), 'tlz']
    }
  };

  return createPortal(
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 64,
        [currentAnchor === 'right' ? 'right' : 'left']: isOpen ? 0 : -width - 50,
        width: width,
        height: 'calc(100vh - 64px)',
        background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.dark} 100%)`,
        borderLeft: currentAnchor === 'right' ? `1px solid ${theme.palette.divider}` : 'none',
        borderRight: currentAnchor === 'left' ? `1px solid ${theme.palette.divider}` : 'none',
        boxShadow: currentAnchor === 'right' ? '-2px 0 8px rgba(0,0,0,0.1)' : '2px 0 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1200,
        transition: 'right 0.3s ease, left 0.3s ease',
        pointerEvents: isOpen ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Resize handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          [currentAnchor === 'right' ? 'left' : 'right']: -6,
          width: 12,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 2000,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseDown={onResizeMouseDown}
        title="Resize panel"
        aria-label="Resize properties panel"
      >
        <div style={{
          width: 6,
          height: 48,
          borderRadius: 3,
          background: theme.palette.divider,
          opacity: 0.7,
          boxShadow: '0 0 4px rgba(0,0,0,0.15)'
        }} />
      </div>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText }}>
        <Typography variant="h6">Node Properties</Typography>
        <Box>
          <IconButton onClick={toggleAnchor} size="small" title="Switch sides" aria-label="Toggle panel side" sx={{ color: 'inherit' }}>
            {anchor === 'right' ? <ArrowBackIcon /> : <ArrowForwardIcon />}
          </IconButton>
          <IconButton onClick={() => setIsOpen(false)} size="small" aria-label="close properties panel" sx={{ color: 'inherit' }}>
            <CloseIcon />
          </IconButton>
          <IconButton
            onClick={() => onToggleNodeLock(selectedNode.id)}
            title={lockedNodes.has(selectedNode.id) ? "Unlock Node" : "Lock Node"}
            size="small"
          >
            {lockedNodes.has(selectedNode.id) ? <LockIcon /> : <LockOpenIcon />}
          </IconButton>
        </Box>
      </Box>
      <Divider />

      {/* Content */}
      <Box sx={{ p: 2, pt: 0, display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1, overflow: 'hidden' }}>
      {selectedNode && (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1, overflow: 'hidden' }}>
          {/* Node ID (read-only) */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            ID: {selectedNode.id}
          </Typography>

        {/* Label */}
        <TextField
          fullWidth
          label="Label"
          value={label}
          onChange={handleLabelChange}
          variant="filled"
          size="small"
          sx={{ mb: 2, backgroundColor: theme.palette.background.paper }}
        />

        {/* Node Type */}
        <NodeTypeSelector
          value={nodeType}
          nodeTypes={nodeTypes}
          onChange={(val) => handleNodeTypeChangeInternal(val)}
          sx={{ mb: 2 }}
        />

        {/* Memo header and controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mt: '6px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <NoteIcon sx={{ fontSize: 18, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ pt: '3px', ml: 0.5 }}>
              Memo (Markdown)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={handleEmojiClick} sx={{ p: 0.5 }} aria-label="Insert emoji">
              <InsertEmoticonIcon fontSize="small" />
            </IconButton>
            <ToggleButtonGroup
              value={memoView}
              exclusive
              onChange={(e, newView) => newView && setMemoView(newView)}
              size="small"
            >
              <ToggleButton value="edit" sx={{ py: 0.5, px: 1 }} aria-label="Edit memo">
                <EditIcon sx={{ fontSize: 16 }} />
              </ToggleButton>
              <ToggleButton value="preview" sx={{ py: 0.5, px: 1 }} aria-label="Preview memo">
                <VisibilityIcon sx={{ fontSize: 16 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
        {showEmojiPicker && (
          <Box sx={{ position: 'fixed', zIndex: 1500, right: 40, top: 120 }}>
            <EmojiPicker 
              onEmojiClick={handleEmojiSelect}
              height={350}
              width={320}
              theme={theme?.palette?.mode === 'dark' ? 'dark' : 'light'}
              style={{
                backgroundColor: theme?.palette?.background?.paper,
                color: theme?.palette?.text?.primary
              }}
            />
          </Box>
        )}

        {/* Memo area (simple vertical flow) */}
        {memoView === 'edit' ? (
          <Box sx={{ mb: 1 }}>
            <TextField
              inputRef={memoInputRef}
              label="Edit Mode"
              multiline
              rows={10}
              value={memo}
              onChange={handleMemoChange}
              onBlur={handleMemoChange}
              fullWidth
              variant="filled"
              sx={{
                backgroundColor: theme.palette.background.paper,
                '& .MuiInputBase-root': { alignItems: 'flex-start' },
                '& .MuiInputBase-input': {
                  overflow: 'auto !important',
                  '&::-webkit-scrollbar': { width: '8px', cursor: 'pointer' },
                  '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: '4px', cursor: 'pointer' }
                }
              }}
            />
          </Box>
        ) : (
          <Box sx={{ mb: 1, height: 240, overflowY: 'auto', p: 1, backgroundColor: theme.palette.background.paper, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            {memo ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} urlTransform={(url) => url} components={{ a: TlzLink }}>
                {memo}
              </ReactMarkdown>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No content to preview
              </Typography>
            )}
          </Box>
        )}

        {/* Character count */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {memo.length} characters
        </Typography>

        {/* Color picker and other controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
          <ColorPickerInput value={nodeColor} onChange={handleColorChange} />
          <Tooltip title="Set as default color">
            <IconButton size="small" onClick={handleSetAsDefault}>
              <SaveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {/* Lock toggle */}
          <Tooltip title={lockedNodes.has(selectedNode.id) ? "Unlock node" : "Lock node"}>
            <IconButton
              size="small"
              onClick={handleToggleLock}
              color={lockedNodes.has(selectedNode.id) ? "error" : "default"}
            >
              {lockedNodes.has(selectedNode.id) ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Position inputs (X, Y) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <TextField
            label="X Position"
            type="number"
            value={selectedNode.position?.x || 0}
            onChange={(e) => onUpdateNode(selectedNode.id, { position: { ...selectedNode.position, x: parseFloat(e.target.value) || 0 } })}
            size="small"
            disabled={isLocked}
          />
          <TextField
            label="Y Position"
            type="number"
            value={selectedNode.position?.y || 0}
            onChange={(e) => onUpdateNode(selectedNode.id, { position: { ...selectedNode.position, y: parseFloat(e.target.value) || 0 } })}
            size="small"
            disabled={isLocked}
          />
          <TextField
            label="Width"
            type="number"
            value={selectedNode.width || 200}
            onChange={(e) => onUpdateNode(selectedNode.id, { width: parseFloat(e.target.value) || 200 })}
            size="small"
            disabled={isLocked}
          />
          <TextField
            label="Height"
            type="number"
            value={selectedNode.height || 120}
            onChange={(e) => onUpdateNode(selectedNode.id, { height: parseFloat(e.target.value) || 120 })}
            size="small"
            disabled={isLocked}
          />
        </Box>
        </Box>
      )}
      </Box>
    </Paper>,
    document.body
  );
}