"use client";
import React, { useState, useEffect, useMemo } from 'react';
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
  Tooltip
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

export default function NodeListPanel({ 
  nodes = [], 
  selectedNodeId, 
  selectedNodeIds = [],
  onNodeSelect, 
  onNodeFocus, 
  onClose, 
  theme, 
  isOpen = true 
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

  const activeFiltersCount = selectedTypes.size + (showVisible && showHidden ? 0 : 1);

  return (
    <Drawer
      anchor="left"
      open={isOpen}
      onClose={onClose}
      variant="persistent"
      sx={{
        width: isOpen ? 320 : 0,
        flexShrink: 0,
        zIndex: 1200,
        '& .MuiDrawer-paper': {
          width: 320,
          boxSizing: 'border-box',
          backgroundColor: theme?.palette?.background?.paper || '#fff',
          borderRight: `1px solid ${theme?.palette?.divider || '#e0e0e0'}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          top: 64, // Start below the AppBar (Material-UI default height)
          height: 'calc(100vh - 64px)', // Full height minus AppBar
          position: 'fixed'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: theme?.palette?.primary?.main || '#1976d2',
        color: theme?.palette?.primary?.contrastText || '#fff',
        borderBottom: `1px solid ${theme?.palette?.primary?.dark || '#1565c0'}`
      }}>
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
          Node List ({filteredNodes.length}
          {selectedNodeIds.length > 0 && ` • ${selectedNodeIds.length} selected`})
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="Filter nodes">
            <IconButton 
              size="small" 
              onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
              sx={{ 
                color: 'inherit', 
                mr: 0.5,
                '&:hover': {
                  backgroundColor: theme?.palette?.primary?.dark || '#1565c0'
                }
              }}
            >
              <FilterIcon />
              {activeFiltersCount > 0 && (
                <Box sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  backgroundColor: theme?.palette?.warning?.main || '#ff9800',
                  borderRadius: '50%'
                }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Close panel">
            <IconButton 
              size="small" 
              onClick={onClose}
              sx={{ 
                color: 'inherit',
                '&:hover': {
                  backgroundColor: theme?.palette?.primary?.dark || '#1565c0'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ borderColor: theme?.palette?.divider || '#e0e0e0' }} />

      {/* Search */}
      <Box sx={{ p: 2, pb: 1, backgroundColor: theme?.palette?.background?.default || '#fafafa' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme?.palette?.background?.paper || '#fff',
              '& fieldset': {
                borderColor: theme?.palette?.divider || '#e0e0e0',
              },
              '&:hover fieldset': {
                borderColor: theme?.palette?.primary?.main || '#1976d2',
              },
              '&.Mui-focused fieldset': {
                borderColor: theme?.palette?.primary?.main || '#1976d2',
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: theme?.palette?.text?.secondary || '#666' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton 
                  size="small" 
                  onClick={() => setSearchTerm('')}
                  sx={{
                    '&:hover': {
                      backgroundColor: theme?.palette?.action?.hover || 'rgba(0,0,0,0.04)'
                    }
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16, color: theme?.palette?.text?.secondary || '#666' }} />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <Box sx={{ 
          px: 2, 
          pb: 1, 
          backgroundColor: theme?.palette?.background?.default || '#fafafa',
          borderBottom: `1px solid ${theme?.palette?.divider || '#e0e0e0'}`
        }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {Array.from(selectedTypes).map(type => (
              <Chip
                key={type}
                label={type}
                size="small"
                onDelete={() => handleTypeFilter(type)}
                sx={{ 
                  height: 24, 
                  fontSize: 11,
                  backgroundColor: theme?.palette?.primary?.light || '#42a5f5',
                  color: theme?.palette?.primary?.contrastText || '#fff',
                  '& .MuiChip-deleteIcon': {
                    color: 'inherit',
                    '&:hover': {
                      color: theme?.palette?.primary?.contrastText || '#fff'
                    }
                  }
                }}
              />
            ))}
            {(!showVisible || !showHidden) && (
              <Chip
                label={showVisible ? 'Visible only' : 'Hidden only'}
                size="small"
                onDelete={() => {
                  setShowVisible(true);
                  setShowHidden(true);
                }}
                sx={{ 
                  height: 24, 
                  fontSize: 11,
                  backgroundColor: theme?.palette?.secondary?.light || '#ba68c8',
                  color: theme?.palette?.secondary?.contrastText || '#fff'
                }}
              />
            )}
          </Box>
        </Box>
      )}

      <Divider sx={{ borderColor: theme?.palette?.divider || '#e0e0e0' }} />

      {/* Node List */}
      <Box sx={{ 
        flexGrow: 1, 
        overflowY: 'auto',
        backgroundColor: theme?.palette?.background?.default || '#fafafa'
      }}>
        {filteredNodes.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || activeFiltersCount > 0 ? 'No nodes match your filters' : 'No nodes available'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {filteredNodes.map((node) => {
              const isSelected = selectedNodeIds.includes(node.id);
              const isMultiSelect = selectedNodeIds.length > 1;
              
              return (
                <ListItem key={node.id} disablePadding>
                  <ListItemButton
                    selected={isSelected}
                    onClick={(e) => {
                      const isCtrlClick = e.ctrlKey || e.metaKey;
                      if (isCtrlClick) {
                        // For multi-select, we need a different handler
                        // For now, we'll use the existing handler but indicate it's a multi-select
                        onNodeSelect?.(node.id, true);
                      } else {
                        onNodeSelect?.(node.id, false);
                      }
                    }}
                    sx={{
                      py: 1,
                      px: 2,
                      borderBottom: `1px solid ${theme?.palette?.divider || '#e0e0e0'}`,
                      backgroundColor: isSelected 
                        ? (isMultiSelect 
                          ? theme?.palette?.secondary?.main + '20' || 'rgba(156, 39, 176, 0.12)'
                          : theme?.palette?.primary?.main + '20' || 'rgba(25, 118, 210, 0.12)')
                        : 'transparent',
                      '&.Mui-selected': {
                        backgroundColor: isSelected 
                          ? (isMultiSelect 
                            ? theme?.palette?.secondary?.main + '20' || 'rgba(156, 39, 176, 0.12)'
                            : theme?.palette?.primary?.main + '20' || 'rgba(25, 118, 210, 0.12)')
                          : theme?.palette?.primary?.main + '20' || 'rgba(25, 118, 210, 0.12)',
                        '&:hover': {
                          backgroundColor: isSelected 
                            ? (isMultiSelect 
                              ? theme?.palette?.secondary?.main + '30' || 'rgba(156, 39, 176, 0.18)'
                              : theme?.palette?.primary?.main + '30' || 'rgba(25, 118, 210, 0.18)')
                            : theme?.palette?.primary?.main + '30' || 'rgba(25, 118, 210, 0.18)',
                        }
                      },
                      '&:hover': {
                        backgroundColor: isSelected 
                          ? (isMultiSelect 
                            ? theme?.palette?.secondary?.main + '30' || 'rgba(156, 39, 176, 0.18)'
                            : theme?.palette?.primary?.main + '30' || 'rgba(25, 118, 210, 0.18)')
                          : theme?.palette?.action?.hover || 'rgba(0,0,0,0.04)',
                      }
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: selectedNodeId === node.id ? 600 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flexGrow: 1,
                            color: theme?.palette?.text?.primary || '#000'
                          }}
                        >
                          {node.label || node.id}
                        </Typography>
                        {node.visible === false && (
                          <VisibilityOffIcon sx={{ fontSize: 16, color: theme?.palette?.text?.disabled || '#999', ml: 1 }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: theme?.palette?.text?.secondary || '#666'
                          }}
                        >
                          {node.type || 'default'}
                        </Typography>
                        {node.data?.memo && (
                          <Typography variant="caption" color="text.secondary" sx={{ color: theme?.palette?.text?.secondary || '#666' }}>
                            📝
                          </Typography>
                        )}
                        {node.data?.link && (
                          <Typography variant="caption" color="text.secondary" sx={{ color: theme?.palette?.text?.secondary || '#666' }}>
                            🔗
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    {onNodeFocus && (
                      <Tooltip title="Focus on node">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNodeFocus(node.id);
                          }}
                          sx={{ 
                            ml: 1,
                            color: theme?.palette?.text?.secondary || '#666',
                            '&:hover': {
                              backgroundColor: theme?.palette?.action?.hover || 'rgba(0,0,0,0.04)',
                              color: theme?.palette?.primary?.main || '#1976d2'
                            }
                          }}
                        >
                          <LocationIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        PaperProps={{
          sx: { 
            minWidth: 200,
            backgroundColor: theme?.palette?.background?.paper || '#fff',
            border: `1px solid ${theme?.palette?.divider || '#e0e0e0'}`,
            borderRadius: theme?.shape?.borderRadius || 4,
            boxShadow: theme?.shadows?.[4] || '0 4px 8px rgba(0,0,0,0.1)'
          }
        }}
      >
        <MenuItem 
          onClick={() => setShowVisible(!showVisible)}
          sx={{
            '&:hover': {
              backgroundColor: theme?.palette?.action?.hover || 'rgba(0,0,0,0.04)'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <VisibilityIcon sx={{ fontSize: 18, mr: 1, color: theme?.palette?.text?.secondary || '#666' }} />
            <Typography sx={{ flexGrow: 1, color: theme?.palette?.text?.primary || '#000' }}>Visible nodes</Typography>
            {showVisible && <Typography color="primary" sx={{ color: theme?.palette?.primary?.main || '#1976d2' }}>✓</Typography>}
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => setShowHidden(!showHidden)}
          sx={{
            '&:hover': {
              backgroundColor: theme?.palette?.action?.hover || 'rgba(0,0,0,0.04)'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <VisibilityOffIcon sx={{ fontSize: 18, mr: 1, color: theme?.palette?.text?.secondary || '#666' }} />
            <Typography sx={{ flexGrow: 1, color: theme?.palette?.text?.primary || '#000' }}>Hidden nodes</Typography>
            {showHidden && <Typography color="primary" sx={{ color: theme?.palette?.primary?.main || '#1976d2' }}>✓</Typography>}
          </Box>
        </MenuItem>
        <Divider sx={{ borderColor: theme?.palette?.divider || '#e0e0e0' }} />
        <MenuItem disabled sx={{ opacity: 0.6 }}>
          <Typography variant="caption" color="text.secondary" sx={{ color: theme?.palette?.text?.secondary || '#666' }}>
            Node Types
          </Typography>
        </MenuItem>
        {nodeTypes.map(type => (
          <MenuItem 
            key={type} 
            onClick={() => handleTypeFilter(type)}
            sx={{
              '&:hover': {
                backgroundColor: theme?.palette?.action?.hover || 'rgba(0,0,0,0.04)'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Typography sx={{ flexGrow: 1, textTransform: 'capitalize', color: theme?.palette?.text?.primary || '#000' }}>
                {type}
              </Typography>
              {selectedTypes.has(type) && <Typography color="primary" sx={{ color: theme?.palette?.primary?.main || '#1976d2' }}>✓</Typography>}
            </Box>
          </MenuItem>
        ))}
        <Divider sx={{ borderColor: theme?.palette?.divider || '#e0e0e0' }} />
        <MenuItem 
          onClick={clearFilters} 
          disabled={activeFiltersCount === 0}
          sx={{
            '&:hover': {
              backgroundColor: theme?.palette?.action?.hover || 'rgba(0,0,0,0.04)'
            },
            opacity: activeFiltersCount === 0 ? 0.5 : 1
          }}
        >
          <Typography color="error" sx={{ color: theme?.palette?.error?.main || '#f44336' }}>Clear all filters</Typography>
        </MenuItem>
      </Menu>
    </Drawer>
  );
}