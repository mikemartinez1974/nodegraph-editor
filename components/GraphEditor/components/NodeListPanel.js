"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Drawer,
  TextField,
  Typography,
  IconButton,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Collapse,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
  Paper
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandLess,
  ExpandMore,
  Close as CloseIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import * as ReactWindow from 'react-window';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { createPortal } from 'react-dom';

const { FixedSizeList } = ReactWindow;

export default function NodeListPanel({ 
  nodes = [], 
  selectedNodeId = null,
  selectedNodeIds = [],
  onNodeSelect, 
  onNodeFocus, 
  onClose,
  isOpen = false,
  theme,
  propertiesPanelAnchor = 'right'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [showVisible, setShowVisible] = useState(true);
  const [showHidden, setShowHidden] = useState(true);
  const [pos, setPos] = useState({ x: 16, y: 88 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // Get unique node types for filtering
  const nodeTypes = useMemo(() => {
    const types = new Set(nodes.map(node => node.type || 'default'));
    return Array.from(types);
  }, [nodes]);

  // Filter nodes based on search term and filters
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      // Search filter
      const matchesSearch = !searchTerm || 
        node.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.data?.memo?.toLowerCase().includes(searchTerm.toLowerCase());

      // Type filter
      const matchesType = selectedTypes.size === 0 || selectedTypes.has(node.type || 'default');

      // Visibility filter
      const isVisible = node.visible !== false;
      const matchesVisibility = (isVisible && showVisible) || (!isVisible && showHidden);

      return matchesSearch && matchesType && matchesVisibility;
    });
  }, [nodes, searchTerm, selectedTypes, showVisible, showHidden]);

  const handleTypeFilter = (type) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
    setFilterMenuAnchor(null);
  };

  const clearFilters = () => {
    setSelectedTypes(new Set());
    setShowVisible(true);
    setShowHidden(true);
    setSearchTerm('');
    setFilterMenuAnchor(null);
  };

  const activeFiltersCount = selectedTypes.size + (showVisible && showHidden ? 0 : 1);

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

  const anchor = propertiesPanelAnchor === 'right' ? 'left' : 'right';

  // Virtualized row renderer
  const VirtualRow = ({ index, style }) => {
    const node = nodes[index];
    const isSelected = selectedNodeIds?.includes(node.id);
    
    return (
      <ListItem
        style={style}
        key={node.id}
        disablePadding
        secondaryAction={
          <IconButton
            edge="end"
            aria-label="focus on node"
            onClick={(e) => {
              e.stopPropagation();
              if (onNodeFocus) onNodeFocus(node.id);
            }}
          >
            <CenterFocusStrongIcon />
          </IconButton>
        }
      >
        <ListItemButton
          selected={isSelected}
          onClick={(e) => {
            const isMultiSelect = e.ctrlKey || e.metaKey;
            if (onNodeSelect) onNodeSelect(node.id, isMultiSelect);
          }}
        >
          <ListItemText
            primary={node.label || node.id}
            secondary={`Type: ${node.type || 'default'}`}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  // Use virtualization when list is large (>100 items)
  const useVirtualization = nodes.length > 100;

  return createPortal(
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        [anchor]: isOpen ? 0 : -300,
        top: 64,
        width: 280,
        height: 'calc(100vh - 64px)',
        background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.dark} 100%)`,
        borderRight: anchor === 'left' ? `1px solid ${theme.palette.divider}` : 'none',
        borderLeft: anchor === 'right' ? `1px solid ${theme.palette.divider}` : 'none',
        boxShadow: anchor === 'left' ? '2px 0 8px rgba(0,0,0,0.1)' : '-2px 0 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1100,
        transition: `${anchor} 0.3s ease`,
        pointerEvents: isOpen ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText }}>
        <Typography variant="h6">Nodes</Typography>
        <IconButton onClick={onClose} aria-label="close node list" sx={{ color: 'inherit' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ px: 2, pb: 1 }}>
        <Chip label={`${nodes.length} nodes`} size="small" color="primary" />
        {selectedNodeIds.length > 0 && (
          <Chip label={`${selectedNodeIds.length} selected`} size="small" color="secondary" sx={{ ml: 1 }} />
        )}
      </Box>
      
      {useVirtualization ? (
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <FixedSizeList
            height={window.innerHeight - 200}
            itemCount={nodes.length}
            itemSize={72}
            width="100%"
            overscanCount={5}
          >
            {VirtualRow}
          </FixedSizeList>
        </Box>
      ) : (
        <List sx={{ height: 'calc(100vh - 180px)', overflowY: 'auto' }}>
          {nodes.map((node) => {
            const isSelected = selectedNodeIds?.includes(node.id);
            return (
              <ListItem
                key={node.id}
                disablePadding
                sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="focus on node"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onNodeFocus) onNodeFocus(node.id);
                    }}
                  >
                    <CenterFocusStrongIcon />
                  </IconButton>
                }
              >
                <ListItemButton
                  selected={isSelected}
                  onClick={(e) => {
                    const isMultiSelect = e.ctrlKey || e.metaKey;
                    if (onNodeSelect) onNodeSelect(node.id, isMultiSelect);
                  }}
                  sx={{
                    backgroundColor: isSelected ? theme.palette.secondary.main : theme.palette.background.paper,
                    color: isSelected ? theme.palette.secondary.contrastText : theme.palette.text.primary,
                    boxShadow: isSelected ? `0 0 8px ${theme.palette.primary.main}` : '0 1px 4px #aaa',
                    borderRadius: 1,
                    fontWeight: isSelected ? 600 : 400,
                    '&:hover': {
                      backgroundColor: isSelected ? theme.palette.secondary.dark : theme.palette.action.hover
                    }
                  }}
                >
                  <ListItemText
                    primary={node.label || node.id}
                    secondary={`Type: ${node.type || 'default'}`}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>,
    document.body
  );
}