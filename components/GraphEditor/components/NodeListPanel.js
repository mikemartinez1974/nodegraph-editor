"use client";
import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
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
  Paper,
  SwipeableDrawer,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import * as ReactWindow from 'react-window';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { createPortal } from 'react-dom';
import { filterNodesForPanel } from '../utils/nodeFilters';

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
  isMobile = false,
  graphApiRef
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [showVisible, setShowVisible] = useState(true);
  const [showHidden, setShowHidden] = useState(true);
  const SAVED_QUERIES_KEY = 'nodegraph-editor:nodes:savedQueries';
  const [hasMemoOnly, setHasMemoOnly] = useState(false);
  const [hasLinkOnly, setHasLinkOnly] = useState(false);
  const [minWidth, setMinWidth] = useState('');
  const [maxWidth, setMaxWidth] = useState('');
  const [minHeight, setMinHeight] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [savedQueries, setSavedQueries] = useState([]);
  const [activeQueryId, setActiveQueryId] = useState(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newQueryName, setNewQueryName] = useState('');
  const headingId = useId();
  const liveStatusId = useId();
  const headerRef = useRef(null);

  const parseMetric = (value) => {
    if (value === null || value === undefined) return undefined;
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (trimmed === '') return undefined;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : undefined;
  };

  const selectedTypeArray = useMemo(() => Array.from(selectedTypes), [selectedTypes]);

  const filterCriteria = useMemo(() => {
    const criteria = {
      includeVisible: showVisible,
      includeHidden: showHidden
    };

    const textValue = searchTerm.trim();
    if (textValue.length > 0) {
      criteria.text = textValue;
    }

    if (selectedTypeArray.length > 0) {
      criteria.types = selectedTypeArray;
    }

    if (hasMemoOnly) {
      criteria.hasMemo = true;
    }

    if (hasLinkOnly) {
      criteria.hasLink = true;
    }

    const minWidthNum = parseMetric(minWidth);
    if (minWidthNum !== undefined) {
      criteria.minWidth = minWidthNum;
    }

    const maxWidthNum = parseMetric(maxWidth);
    if (maxWidthNum !== undefined) {
      criteria.maxWidth = maxWidthNum;
    }

    const minHeightNum = parseMetric(minHeight);
    if (minHeightNum !== undefined) {
      criteria.minHeight = minHeightNum;
    }

    const maxHeightNum = parseMetric(maxHeight);
    if (maxHeightNum !== undefined) {
      criteria.maxHeight = maxHeightNum;
    }

    return criteria;
  }, [
    searchTerm,
    selectedTypeArray,
    showVisible,
    showHidden,
    hasMemoOnly,
    hasLinkOnly,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight
  ]);

  const hasActiveFilter = useMemo(() => Boolean(
    (filterCriteria.text && filterCriteria.text.length > 0) ||
    (filterCriteria.types && filterCriteria.types.length > 0) ||
    filterCriteria.hasMemo === true ||
    filterCriteria.hasLink === true ||
    filterCriteria.minWidth !== undefined ||
    filterCriteria.maxWidth !== undefined ||
    filterCriteria.minHeight !== undefined ||
    filterCriteria.maxHeight !== undefined ||
    filterCriteria.includeVisible === false ||
    filterCriteria.includeHidden === false
  ), [filterCriteria]);

  const currentSavedState = useMemo(
    () => ({
      searchTerm,
      types: selectedTypeArray,
      includeVisible: showVisible,
      includeHidden: showHidden,
      hasMemo: hasMemoOnly,
      hasLink: hasLinkOnly,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight
    }),
    [
      searchTerm,
      selectedTypeArray,
      showVisible,
      showHidden,
      hasMemoOnly,
      hasLinkOnly,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight
    ]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SAVED_QUERIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedQueries(parsed);
        }
      }
    } catch (err) {
      console.warn('[NodeListPanel] Failed to load saved queries', err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(savedQueries));
    } catch (err) {
      console.warn('[NodeListPanel] Failed to persist saved queries', err);
    }
  }, [savedQueries]);

  useEffect(() => {
    if (isOpen && headerRef.current) {
      headerRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  // Get unique node types for filtering
  const nodeTypes = useMemo(() => {
    const types = new Set(nodes.map(node => node.type || 'default'));
    return Array.from(types);
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    const criteria = filterCriteria;

    if (graphApiRef?.current && typeof graphApiRef.current.findNodes === 'function') {
      try {
        const result = graphApiRef.current.findNodes(criteria);
        if (result?.success && Array.isArray(result.data)) {
          return result.data;
        }
      } catch (err) {
        console.warn('[NodeListPanel] Graph API search failed, using fallback filter', err);
      }
    }

    return filterNodesForPanel(nodes, criteria);
  }, [graphApiRef, nodes, filterCriteria]);

  const handleTypeFilter = (type) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  const clearFilters = () => {
    setSelectedTypes(new Set());
    setShowVisible(true);
    setShowHidden(true);
    setSearchTerm('');
    setHasMemoOnly(false);
    setHasLinkOnly(false);
    setMinWidth('');
    setMaxWidth('');
    setMinHeight('');
    setMaxHeight('');
    setActiveQueryId(null);
    setFilterMenuAnchor(null);
  };

  const anchor = propertiesPanelAnchor === 'right' ? 'left' : 'right';

  const handleSaveQueryRequest = () => {
    setFilterMenuAnchor(null);
    const suggestedName = currentSavedState.searchTerm?.trim()
      ? currentSavedState.searchTerm.trim()
      : `Query ${savedQueries.length + 1}`;
    setNewQueryName(suggestedName);
    setSaveDialogOpen(true);
  };

  const handleConfirmSaveQuery = () => {
    const name = newQueryName.trim();
    if (!name) return;

    const payload = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `query-${Date.now()}`,
      name,
      criteria: { ...currentSavedState }
    };

    setSavedQueries(prev => {
      const remaining = prev.filter(q => q.name !== name);
      return [payload, ...remaining];
    });
    setActiveQueryId(payload.id);
    setSaveDialogOpen(false);
  };

  const handleDeleteSavedQuery = (id) => {
    setSavedQueries(prev => prev.filter(q => q.id !== id));
    if (activeQueryId === id) {
      setActiveQueryId(null);
    }
  };

  const applySavedQuery = (query) => {
    if (!query) return;
    const { criteria = {} } = query;
    setActiveQueryId(query.id);
    setSearchTerm(criteria.searchTerm ?? '');
    setSelectedTypes(new Set(criteria.types || []));
    setShowVisible(criteria.includeVisible !== undefined ? !!criteria.includeVisible : true);
    setShowHidden(criteria.includeHidden !== undefined ? !!criteria.includeHidden : true);
    setHasMemoOnly(!!criteria.hasMemo);
    setHasLinkOnly(!!criteria.hasLink);
    setMinWidth(criteria.minWidth ?? '');
    setMaxWidth(criteria.maxWidth ?? '');
    setMinHeight(criteria.minHeight ?? '');
    setMaxHeight(criteria.maxHeight ?? '');
    setFilterMenuAnchor(null);
  };

  // Virtualized row renderer
  const VirtualRow = ({ index, style }) => {
    const node = filteredNodes[index];
    const isSelected = selectedNodeIds?.includes(node.id);
    
    return (
      <ListItem
        style={style}
        key={node.id}
        disablePadding
        secondaryAction={
          <IconButton
            edge="end"
            aria-label={`Focus canvas on ${node.label || node.id}`}
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
  const useVirtualization = filteredNodes.length > 100;

  const handleClosePanel = () => {
    if (onClose) onClose();
  };

  const nodeSummary = `${filteredNodes.length} of ${nodes.length} nodes match the current filters${
    selectedNodeIds.length ? `, ${selectedNodeIds.length} selected` : ''
  }.`;

  const statsChips = (
    <Box sx={{ px: 2, pb: 1 }}>
      <Chip label={`${nodes.length} total`} size="small" color="primary" />
      <Chip label={`${filteredNodes.length} shown`} size="small" sx={{ ml: 1 }} />
      {selectedNodeIds.length > 0 && (
        <Chip label={`${selectedNodeIds.length} selected`} size="small" color="secondary" sx={{ ml: 1 }} />
      )}
    </Box>
  );

  const savedQueryChips = savedQueries.length > 0 ? (
    <Box sx={{ px: 2, pb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {savedQueries.map((query) => (
        <Chip
          key={query.id}
          label={query.name}
          variant={activeQueryId === query.id ? 'filled' : 'outlined'}
          aria-pressed={activeQueryId === query.id}
          onClick={() => applySavedQuery(query)}
          onDelete={() => handleDeleteSavedQuery(query.id)}
          size="small"
        />
      ))}
    </Box>
  ) : null;

  const listSection = useVirtualization ? (
    <Box sx={{ flex: 1, overflow: 'hidden' }}>
      <FixedSizeList
        height={typeof window !== 'undefined' ? window.innerHeight - 200 : 400}
        itemCount={filteredNodes.length}
        itemSize={72}
        width="100%"
        overscanCount={5}
      >
        {VirtualRow}
      </FixedSizeList>
    </Box>
  ) : (
    <List sx={{ height: 'calc(100vh - 180px)', overflowY: 'auto' }}>
      {filteredNodes.map((node) => {
        const isSelected = selectedNodeIds?.includes(node.id);
        return (
          <ListItem
            key={node.id}
            disablePadding
            sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
            secondaryAction={
              <IconButton
                edge="end"
                aria-label={`Focus canvas on ${node.label || node.id}`}
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
      <Typography
        variant="h6"
        id={headingId}
        tabIndex={-1}
        ref={headerRef}
      >
        Nodes
      </Typography>
      <IconButton onClick={handleClosePanel} aria-label="Close node list panel" sx={{ color: 'inherit' }}>
        <CloseIcon />
      </IconButton>
    </Box>
  );

  const panelBody = (
    <>
      <Typography
        id={liveStatusId}
        component="p"
        role="status"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {nodeSummary}
      </Typography>
      {statsChips}
      {savedQueryChips}
      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          label="Search nodes"
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Save current filters"
                  onClick={handleSaveQueryRequest}
                  disabled={!hasActiveFilter}
                >
                  <SaveAltIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Open filter menu"
                  onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                  aria-haspopup="menu"
                  aria-expanded={Boolean(filterMenuAnchor)}
                >
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
        <Box sx={{ p: 1.5, width: 300 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">Filters</Typography>
            <Button size="small" onClick={clearFilters}>Clear</Button>
          </Box>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showVisible}
                  onChange={(e) => setShowVisible(e.target.checked)}
                  size="small"
                />
              }
              label="Include visible nodes"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                  size="small"
                />
              }
              label="Include hidden nodes"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={hasMemoOnly}
                  onChange={(e) => setHasMemoOnly(e.target.checked)}
                  size="small"
                />
              }
              label="Require memo content"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={hasLinkOnly}
                  onChange={(e) => setHasLinkOnly(e.target.checked)}
                  size="small"
                />
              }
              label="Require link value"
            />
          </FormGroup>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
            Dimensions
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mt: 1 }}>
            <TextField
              label="Min width"
              size="small"
              type="number"
              value={minWidth}
              onChange={(e) => setMinWidth(e.target.value)}
              InputLabelProps={{ shrink: Boolean(minWidth) }}
            />
            <TextField
              label="Max width"
              size="small"
              type="number"
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              InputLabelProps={{ shrink: Boolean(maxWidth) }}
            />
            <TextField
              label="Min height"
              size="small"
              type="number"
              value={minHeight}
              onChange={(e) => setMinHeight(e.target.value)}
              InputLabelProps={{ shrink: Boolean(minHeight) }}
            />
            <TextField
              label="Max height"
              size="small"
              type="number"
              value={maxHeight}
              onChange={(e) => setMaxHeight(e.target.value)}
              InputLabelProps={{ shrink: Boolean(maxHeight) }}
            />
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
            Node types
          </Typography>
          <FormGroup sx={{ mt: 1, maxHeight: 180, overflowY: 'auto', pr: 1 }}>
            {nodeTypes.map(type => (
              <FormControlLabel
                key={type}
                control={
                  <Checkbox
                    checked={selectedTypes.has(type)}
                    onChange={() => handleTypeFilter(type)}
                    size="small"
                  />
                }
                label={type}
              />
            ))}
          </FormGroup>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveAltIcon fontSize="small" />}
              onClick={handleSaveQueryRequest}
              disabled={!hasActiveFilter}
            >
              Save filters
            </Button>
          </Box>
        </Box>
      </Menu>
      {listSection}
    </>
  );

  const saveQueryDialog = (
    <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
      <DialogTitle>Save filter preset</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Preset name"
          value={newQueryName}
          onChange={(e) => setNewQueryName(e.target.value)}
        />
        <Typography variant="caption" color="text.secondary">
          Presets are stored locally so you can quickly reapply complex searches.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirmSaveQuery}
          disabled={!newQueryName.trim()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (isMobile) {
    const mobileDrawer = createPortal(
      <SwipeableDrawer
        anchor="bottom"
        open={isOpen}
        onClose={() => handleClosePanel()}
        onOpen={() => {}}
        disableDiscovery
        ModalProps={{ keepMounted: true, disableRestoreFocus: true }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          },
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': headingId,
          'aria-describedby': liveStatusId
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

    return (
      <>
        {saveQueryDialog}
        {mobileDrawer}
      </>
    );
  }

  const desktopPanel = createPortal(
    <Paper
      elevation={8}
      role="complementary"
      aria-labelledby={headingId}
      aria-describedby={liveStatusId}
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

  return (
    <>
      {saveQueryDialog}
      {desktopPanel}
    </>
  );
}
