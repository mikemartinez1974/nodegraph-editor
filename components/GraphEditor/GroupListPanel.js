"use client";
import React, { useState, useRef } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Box,
  Chip
} from '@mui/material';
import * as ReactWindow from 'react-window';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Delete as DeleteIcon,
  CenterFocusStrong as CenterFocusStrongIcon
} from '@mui/icons-material';

const { FixedSizeList } = ReactWindow;

export default function GroupListPanel({
  groups = [],
  selectedGroupId,
  selectedGroupIds = [],
  onGroupSelect,
  onGroupFocus,
  onGroupDoubleClick,
  onGroupToggleVisibility,
  onGroupDelete,
  onClose,
  isOpen = true,
  theme
}) {
  const [pos, setPos] = useState({ x: 16, y: 88 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

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

  const drawerWidth = 300;

  // Virtualized row renderer
  const VirtualRow = ({ index, style }) => {
    const group = groups[index];
    const isSelected = selectedGroupIds?.includes(group.id);
    const isVisible = group.visible !== false;
    
    return (
      <ListItem
        style={style}
        key={group.id}
        disablePadding
        secondaryAction={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              edge="end"
              size="small"
              aria-label="toggle group visibility"
              onClick={(e) => {
                e.stopPropagation();
                if (onGroupToggleVisibility) onGroupToggleVisibility(group.id);
              }}
            >
              {isVisible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
            </IconButton>
            <IconButton
              edge="end"
              size="small"
              aria-label="focus on group"
              onClick={(e) => {
                e.stopPropagation();
                if (onGroupFocus) onGroupFocus(group.id);
              }}
            >
              <CenterFocusStrongIcon fontSize="small" />
            </IconButton>
            <IconButton
              edge="end"
              size="small"
              aria-label="delete group"
              onClick={(e) => {
                e.stopPropagation();
                if (onGroupDelete) onGroupDelete(group.id);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        }
      >
        <ListItemButton
          selected={isSelected}
          onClick={(e) => {
            const isMultiSelect = e.ctrlKey || e.metaKey;
            if (onGroupSelect) onGroupSelect(group.id, isMultiSelect);
          }}
          onDoubleClick={() => {
            if (onGroupDoubleClick) onGroupDoubleClick(group.id);
          }}
        >
          <ListItemText
            primary={group.label || group.id}
            secondary={`${group.nodeIds?.length || 0} nodes • ${group.collapsed ? 'Collapsed' : 'Expanded'}`}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  // Use virtualization when list is large (>100 items)
  const useVirtualization = groups.length > 100;

  if (!isOpen) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 280,
        maxHeight: 'calc(100vh - 104px)',
        background: `linear-gradient(135deg, ${theme?.palette?.primary?.light} 0%, ${theme?.palette?.primary?.dark} 100%)`,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: dragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
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
          Groups ({groups.length})
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: 'inherit' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Group List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
        {useVirtualization ? (
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <FixedSizeList
              height={window.innerHeight - 200}
              itemCount={groups.length}
              itemSize={72}
              width="100%"
              overscanCount={5}
            >
              {VirtualRow}
            </FixedSizeList>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {groups.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No groups in this graph.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Select 2+ nodes and press Ctrl+G to create a group.
                </Typography>
              </Box>
            ) : (
              groups.map((group) => {
                const isSelected = selectedGroupIds.includes(group.id) || selectedGroupId === group.id;
                
                return (
                  <ListItem
                    key={group.id}
                    disablePadding
                    sx={{
                      borderBottom: `1px solid ${theme?.palette?.divider || '#e0e0e0'}`,
                      backgroundColor: isSelected ? theme?.palette?.action?.selected : 'transparent'
                    }}
                  >
                    <ListItemButton
                      onClick={(e) => {
                        const isMultiSelect = e.ctrlKey || e.metaKey;
                        onGroupSelect(group.id, isMultiSelect);
                      }}
                      onDoubleClick={() => {
                        if (onGroupDoubleClick) {
                          onGroupDoubleClick(group.id);
                        }
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: isSelected ? 600 : 400 }}>
                              {group.label || `Group ${group.id}`}
                            </Typography>
                            <Chip
                              label={group.nodeIds?.length || 0}
                              size="small"
                              sx={{ height: 20, fontSize: 11 }}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {group.collapsed ? 'Collapsed' : 'Expanded'} • ID: {group.id.slice(0, 8)}...
                          </Typography>
                        }
                      />
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGroupToggleVisibility(group.id);
                          }}
                          title={group.visible === true ? "Hide" : "Show"}
                        >
                          {group.visible === true ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGroupDelete(group.id);
                          }}
                          title="Delete Group"
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                );
              })
            )}
          </List>
        )}
      </Box>
    </Paper>
  );
}
