"use client";
import React, { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';

export default function NodePropertiesPanel({ selectedNode, onUpdateNode, onClose, theme }) {
  const [memo, setMemo] = useState('');
  const [link, setLink] = useState('');
  const [label, setLabel] = useState('');

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

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 16,
        top: 88,
        width: 320,
        maxHeight: 'calc(100vh - 104px)',
        backgroundColor: theme?.palette?.background?.paper || '#fff',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <NoteIcon sx={{ fontSize: 18, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary">
              Memo
            </Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={memo}
            onChange={handleMemoChange}
            variant="outlined"
            placeholder="Add notes about this node..."
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
    </Paper>
  );
}