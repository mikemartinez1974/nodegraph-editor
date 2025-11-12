"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  TextField,
  Typography,
  IconButton,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  Paper,
  SwipeableDrawer
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
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
  propertiesPanelAnchor = 'right',
  isMobile = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [showVisible, setShowVisible] = useState(true);
  const [showHidden, setShowHidden] = useState(true);

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

  const handleClosePanel = () => {
    if (onClose) onClose();
  };

  const statsChips = (
    <Box sx={{ px: 2, pb: 1 }}>
      <Chip label={`${nodes.length} nodes`} size="small" color="primary" />
      {selectedNodeIds.length > 0 && (
        <Chip label={`${selectedNodeIds.length} selected`} size="small" color="secondary" sx={{ ml: 1 }} />
      )}
    </Box>
  );

  const listSection = useVirtualization ? (
    <Box sx={{ flex: 1, overflow: 'hidden' }}>
      <FixedSizeList
        height={typeof window !== 'undefined' ? window.innerHeight - 200 : 400}
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
  );

  const panelHeader = (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      p: 2, 
      backgroundColor: isMobile ? theme.palette.background.paper : theme.palette.primary.main, 
      color: isMobile ? theme.palette.text.primary : theme.palette.primary.contrastText 
    }}>
      <Typography variant="h6">Nodes</Typography>
      <IconButton onClick={handleClosePanel} aria-label="close node list" sx={{ color: 'inherit' }}>
        <CloseIcon />
      </IconButton>
    </Box>
  );

  const panelBody = (
    <>
      {statsChips}
      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search nodes..."
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={(e) => setFilterMenuAnchor(e.currentTarget)}>
                  <FilterIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
      </Box>
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem onClick={clearFilters}>Clear filters</MenuItem>
        <Divider />
        <MenuItem onClick={() => setShowVisible(prev => !prev)}>
          <ListItemText primary={showVisible ? 'Hide visible nodes' : 'Show visible nodes'} />
        </MenuItem>
        <MenuItem onClick={() => setShowHidden(prev => !prev)}>
          <ListItemText primary={showHidden ? 'Hide hidden nodes' : 'Show hidden nodes'} />
        </MenuItem>
        <Divider />
        {nodeTypes.map(type => (
          <MenuItem key={type} onClick={() => handleTypeFilter(type)}>
            <ListItemText primary={type} />
            {selectedTypes.has(type) ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
          </MenuItem>
        ))}
      </Menu>
      {listSection}
    </>
  );

  if (isMobile) {
    return createPortal(
      <SwipeableDrawer
        anchor="bottom"
        open={isOpen}
        onClose={() => handleClosePanel()}
        onOpen={() => {}}
        disableDiscovery
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <Box sx={{ px: 1.5, pt: 1, pb: `calc(12px + env(safe-area-inset-bottom, 16px))`, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 999, backgroundColor: theme.palette.divider, mx: 'auto', mb: 1.5 }} />
          {panelHeader}
          <Divider />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {panelBody}
          </Box>
        </Box>
      </SwipeableDrawer>,
      document.body
    );
  }

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
      {panelHeader}
      <Divider />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {panelBody}
      </Box>
    </Paper>,
    document.body
  );
}
