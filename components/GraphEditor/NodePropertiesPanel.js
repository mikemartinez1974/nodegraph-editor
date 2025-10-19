"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, IconButton, Divider, Stack, Tooltip } from '@mui/material';
import { createPortal } from 'react-dom';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import TextField from '@mui/material/TextField';
import eventBus from '../NodeGraph/eventBus';
import ColorPickerInput from './ColorPickerInput';
import SaveIcon from '@mui/icons-material/Save';

export default function NodePropertiesPanel({
  selectedNode,
  onUpdateNode,
  onClose,
  theme,
  anchor = 'right',
  onAnchorChange,
  defaultNodeColor = '#1976d2'
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
  const [link, setLink] = useState('');
  const [label, setLabel] = useState('');
  const [memoView, setMemoView] = useState('edit'); // 'edit' or 'preview'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [width, setWidth] = useState(400);
  const [isOpen, setIsOpen] = useState(true); // Start open by default
  const [nodeColor, setNodeColor] = useState(selectedNode?.color || defaultNodeColor);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const memoInputRef = useRef();

  // Update local state when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setMemo(selectedNode.data?.memo || '');
      setLink(selectedNode.data?.link || '');
      setLabel(selectedNode.label || '');
      setNodeColor(selectedNode.color || defaultNodeColor);
    }
  }, [selectedNode?.id, defaultNodeColor]);

  const handleMemoChange = (e) => {
    const newMemo = e.target.value;
    setMemo(newMemo);
    onUpdateNode(selectedNode.id, { 
      ...selectedNode.data, 
      memo: newMemo 
    });
  };

  const handleLinkChange = (e) => {
    const newLink = e.target.value;
    setLink(newLink);
    onUpdateNode(selectedNode.id, { 
      ...selectedNode.data, 
      link: newLink 
    });
  };

  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    onUpdateNode(selectedNode.id, { 
      ...selectedNode.data,
      label: newLabel
    }, true); // true flag indicates label update
  };

  const handleLinkClick = () => {
    if (link) {
      const url = link.startsWith('http') ? link : `https://${link}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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
      onUpdateNode(selectedNode.id, { ...selectedNode.data, memo: newMemo });
      // Move cursor after emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setMemo(memo + emoji);
      onUpdateNode(selectedNode.id, { ...selectedNode.data, memo: memo + emoji });
    }
    setShowEmojiPicker(false);
  };

  const handleDockToggle = () => {
    setDockSide(dockSide === 'right' ? 'left' : 'right');
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
    onUpdateNode(selectedNode.id, { color });
  };
  
  const handleSetAsDefault = () => {
    if (nodeColor && typeof window !== 'undefined' && window.setDefaultNodeColor) {
      window.setDefaultNodeColor(nodeColor);
    }
  };

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        top: 64,
        [currentAnchor === 'right' ? 'right' : 'left']: isOpen ? 0 : -width - 50,
        width: width,
        height: 'calc(100vh - 64px)',
        backgroundColor: 'background.paper',
        borderLeft: currentAnchor === 'right' ? `1px solid ${theme.palette.divider}` : 'none',
        borderRight: currentAnchor === 'left' ? `1px solid ${theme.palette.divider}` : 'none',
        boxShadow: currentAnchor === 'right' ? '-2px 0 8px rgba(0,0,0,0.1)' : '2px 0 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1200,
        transition: 'right 0.3s ease, left 0.3s ease',
        pointerEvents: isOpen ? 'auto' : 'none',
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

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
        <Typography variant="h6">Node Properties</Typography>
        <Box>
          <IconButton onClick={toggleAnchor} size="small" title="Switch sides" aria-label="Toggle panel side">
            {anchor === 'right' ? <ArrowBackIcon /> : <ArrowForwardIcon />}
          </IconButton>
          <IconButton onClick={() => setIsOpen(false)} size="small" aria-label="close properties panel">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      <Divider />

      {/* Content */}
      {selectedNode && (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1, overflow: 'hidden' }}>
          {/* Node ID (read-only) */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            ID: {selectedNode.id}
          </Typography>

        {/* Label */}
        <TextField
          fullWidth
          label="Label"
          value={label}
          onChange={handleLabelChange}
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />

        {/* Memo */}
        <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <NoteIcon sx={{ fontSize: 18, mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="subtitle2" color="text.secondary">
                Memo (Markdown)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={handleEmojiClick} sx={{ p: 0.5 }}>
                <InsertEmoticonIcon fontSize="small" />
              </IconButton>
              <ToggleButtonGroup
                value={memoView}
                exclusive
                onChange={(e, newView) => newView && setMemoView(newView)}
                size="small"
              >
                <ToggleButton value="edit" sx={{ py: 0.5, px: 1 }}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </ToggleButton>
                <ToggleButton value="preview" sx={{ py: 0.5, px: 1 }}>
                  <VisibilityIcon sx={{ fontSize: 16 }} />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
          {showEmojiPicker && (
            <Box sx={{ position: 'absolute', zIndex: 1500, right: 40, top: 80 }}>
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
          <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            {memoView === 'edit' ? (
              <>
                <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                  <TextField
                    label="Memo"
                    multiline
                    rows={12}
                    value={memo}
                    onChange={handleMemoChange}
                    onBlur={handleMemoChange}
                    fullWidth
                    sx={{ 
                      mb: 2,
                      '& .MuiInputBase-root': {
                        overflow: 'hidden',
                        alignItems: 'flex-start',
                      },
                      '& .MuiInputBase-input': {
                        overflow: 'auto !important',
                        '&::-webkit-scrollbar': {
                          width: '8px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: theme.palette.divider,
                          borderRadius: '4px',
                        },
                      }
                    }}
                  />
                </Box>
                {memo && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {memo.length} characters
                  </Typography>
                )}
              </>
            ) : (
              <Box
                sx={{
                  flexGrow: 1,
                  minHeight: 0,
                  maxHeight: '100%',
                  overflowY: 'auto',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  backgroundColor: 'background.default',
                  '& h1': { fontSize: 20, fontWeight: 700, mt: 2, mb: 1 },
                  '& h2': { fontSize: 18, fontWeight: 600, mt: 1.5, mb: 1 },
                  '& h3': { fontSize: 16, fontWeight: 600, mt: 1.5, mb: 0.5 },
                  '& p': { mb: 1 },
                  '& ul, & ol': { pl: 3, mb: 1 },
                  '& li': { mb: 0.5 },
                  '& code': { backgroundColor: 'action.hover', padding: '2px 4px', borderRadius: 0.5, fontFamily: 'monospace', fontSize: 12 },
                  '& pre': { backgroundColor: 'action.hover', p: 1.5, borderRadius: 1, overflowX: 'auto', mb: 1 },
                  '& pre code': { backgroundColor: 'transparent', padding: 0 },
                  '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', pl: 2, ml: 0, fontStyle: 'italic', color: 'text.secondary' },
                  '& a': { color: 'primary.main', textDecoration: 'underline' },
                  '& table': { borderCollapse: 'collapse', width: '100%', mb: 1 },
                  '& th, & td': { border: '1px solid', borderColor: 'divider', padding: '6px 8px', textAlign: 'left' },
                  '& th': { backgroundColor: 'action.hover', fontWeight: 600 }
                }}
              >
                {memo ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {memo}
                  </ReactMarkdown>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No content to preview
                  </Typography>
                )}
              </Box>
            )}
            {memoView === 'preview' && memo && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {memo.length} characters
              </Typography>
            )}
          </Box>
        </Box>

        {/* Link */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <LinkIcon sx={{ fontSize: 18, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary">
              Link
            </Typography>
          </Box>
          <TextField
            fullWidth
            value={link}
            onChange={handleLinkChange}
            variant="outlined"
            size="small"
            placeholder="https://example.com"
            sx={{ mb: 1 }}
          />
          {link && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'primary.main',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  '&:hover': { color: 'primary.dark' }
                }}
                onClick={handleLinkClick}
              >
                Open link ↗
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>,
    document.body
  );
}