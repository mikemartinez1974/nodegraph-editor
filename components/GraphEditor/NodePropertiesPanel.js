"use client";
import React, { useState, useEffect, useRef } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';

export default function NodePropertiesPanel({ selectedNode, onUpdateNode, onClose, theme }) {
  const [memo, setMemo] = useState('');
  const [link, setLink] = useState('');
  const [label, setLabel] = useState('');
  const [memoView, setMemoView] = useState('edit'); // 'edit' or 'preview'
  const [panelPos, setPanelPos] = useState({ top: 88, right: 16 });
  const [panelSize, setPanelSize] = useState({ width: 320, height: 520 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 320, height: 520 });
  const memoInputRef = useRef();

  // Update local state when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setMemo(selectedNode.data?.memo || '');
      setLink(selectedNode.data?.link || '');
      setLabel(selectedNode.label || '');
    }
  }, [selectedNode?.id]);

  if (!selectedNode) return null;

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

  // Drag handlers
  const onHeaderMouseDown = (e) => {
    draggingRef.current = true;
    dragOffset.current = {
      x: e.clientX,
      y: e.clientY,
      top: panelPos.top,
      right: panelPos.right
    };
    document.addEventListener('mousemove', onHeaderMouseMove);
    document.addEventListener('mouseup', onHeaderMouseUp);
  };
  const onHeaderMouseMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragOffset.current.x;
    const dy = e.clientY - dragOffset.current.y;
    setPanelPos(pos => ({
      top: Math.max(0, dragOffset.current.top + dy),
      right: Math.max(0, dragOffset.current.right - dx)
    }));
  };
  const onHeaderMouseUp = () => {
    draggingRef.current = false;
    document.removeEventListener('mousemove', onHeaderMouseMove);
    document.removeEventListener('mouseup', onHeaderMouseUp);
  };

  // Resize handlers
  const onResizeMouseDown = (e) => {
    e.stopPropagation();
    resizingRef.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelSize.width,
      height: panelSize.height
    };
    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', onResizeMouseUp);
  };
  const onResizeMouseMove = (e) => {
    if (!resizingRef.current) return;
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    setPanelSize(size => ({
      width: Math.max(240, resizeStart.current.width + dx),
      height: Math.max(320, resizeStart.current.height + dy)
    }));
  };
  const onResizeMouseUp = () => {
    resizingRef.current = false;
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', onResizeMouseUp);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: panelPos.top,
        right: panelPos.right,
        width: panelSize.width,
        height: panelSize.height,
        maxHeight: 'calc(100vh - 24px)',
        backgroundColor: theme?.palette?.background?.paper || '#fff',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        resize: 'none',
        userSelect: 'none'
      }}
    >
      {/* Header (draggable) */}
      <Box sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme?.palette?.primary?.main || '#1976d2',
        color: theme?.palette?.primary?.contrastText || '#fff',
        cursor: 'move',
        userSelect: 'none'
      }}
        onMouseDown={onHeaderMouseDown}
      >
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
          Node Properties
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
        <Box sx={{ mb: 2 }}>
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
          {memoView === 'edit' ? (
            <>
              <TextField
                fullWidth
                multiline
                rows={6}
                value={memo}
                onChange={handleMemoChange}
                variant="outlined"
                placeholder="Add notes about this node... (Markdown supported)"
                inputRef={memoInputRef}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                    fontSize: 13
                  }
                }}
              />
              {memo && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {memo.length} characters
                </Typography>
              )}
            </>
          ) : (
            <Box
              sx={{
                minHeight: 160,
                maxHeight: 300,
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
                '& code': { 
                  backgroundColor: 'action.hover', 
                  padding: '2px 4px', 
                  borderRadius: 0.5,
                  fontFamily: 'monospace',
                  fontSize: 12
                },
                '& pre': { 
                  backgroundColor: 'action.hover', 
                  p: 1.5, 
                  borderRadius: 1,
                  overflowX: 'auto',
                  mb: 1
                },
                '& pre code': {
                  backgroundColor: 'transparent',
                  padding: 0
                },
                '& blockquote': {
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                  pl: 2,
                  ml: 0,
                  fontStyle: 'italic',
                  color: 'text.secondary'
                },
                '& a': {
                  color: 'primary.main',
                  textDecoration: 'underline'
                },
                '& table': {
                  borderCollapse: 'collapse',
                  width: '100%',
                  mb: 1
                },
                '& th, & td': {
                  border: '1px solid',
                  borderColor: 'divider',
                  padding: '6px 8px',
                  textAlign: 'left'
                },
                '& th': {
                  backgroundColor: 'action.hover',
                  fontWeight: 600
                }
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
        </Box>

        {/* Link */}
        <Box>
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
      </Box>

      {/* Resize handle */}
      <Box
        sx={{
          position: 'absolute',
          right: 2,
          bottom: 2,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          zIndex: 1400,
          background: 'transparent',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end'
        }}
        onMouseDown={onResizeMouseDown}
      >
        <Box sx={{ width: 16, height: 16, borderRight: '2px solid #888', borderBottom: '2px solid #888', borderRadius: 2 }} />
      </Box>
    </Paper>
  );
}