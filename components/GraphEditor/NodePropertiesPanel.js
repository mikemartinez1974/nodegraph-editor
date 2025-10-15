"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Paper, Box, Typography, IconButton, Divider } from '@mui/material';
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


export default function NodePropertiesPanel({
  selectedNode,
  onUpdateNode,
  onClose,
  theme
}) {
  const [memo, setMemo] = useState('');
  const [link, setLink] = useState('');
  const [label, setLabel] = useState('');
  const [memoView, setMemoView] = useState('edit'); // 'edit' or 'preview'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [markdownView, setMarkdownView] = useState(true); // true = view mode, false = edit mode
  const [dockSide, setDockSide] = useState('right');
  const [width, setWidth] = useState(320);
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
    }
  }, [selectedNode?.id]);

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
    let delta = dockSide === 'right' ? startX.current - e.clientX : e.clientX - startX.current;
    let newWidth = Math.max(240, Math.min(startWidth.current + delta, 600));
    setWidth(newWidth);
  };

  const onResizeMouseUp = () => {
    resizing.current = false;
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', onResizeMouseUp);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        [dockSide]: 0,
        top: 64,
        height: 'calc(100vh - 64px)', // AppBar height is 64px
        width: width,
        backgroundColor: theme?.palette?.background?.paper || '#fff',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 4,
        borderRadius: 0,
      }}
    >
      <Box sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme?.palette?.primary?.main || '#1976d2',
        color: theme?.palette?.primary?.contrastText || '#fff'
      }}>
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
          Node Properties
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={handleDockToggle} sx={{ color: 'inherit' }}>
            {dockSide === 'right' ? <ArrowBackIcon /> : <ArrowForwardIcon />}
          </IconButton>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      <Divider />

      {/* Content */}
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
                    fullWidth
                    multiline
                    value={memo}
                    onChange={handleMemoChange}
                    variant="outlined"
                    placeholder="Add notes about this node... (Markdown supported)"
                    inputRef={memoInputRef}
                    sx={{
                      flexGrow: 1,
                      minHeight: 0,
                      maxHeight: '100%',
                      resize: 'none',
                      overflow: 'auto',
                      '& .MuiOutlinedInput-root': {
                        fontFamily: 'monospace',
                        fontSize: 13,
                        height: '100%',
                        alignItems: 'flex-start',
                        '& textarea': {
                          height: '100%',
                          minHeight: 0,
                          resize: 'none',
                          boxSizing: 'border-box',
                          overflow: 'auto',
                        }
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
        <Box sx={{ mt: 'auto' }}>
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
          top: 0,
          [dockSide === 'right' ? 'left' : 'right']: -6,
          width: 12,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 1400,
        }}
        onMouseDown={onResizeMouseDown}
      />
    </Paper>
  );
}