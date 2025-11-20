"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Chip,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import * as Icons from '@mui/icons-material';
import eventBus from '../../NodeGraph/eventBus';
import { getNodeTypesByCategory } from '../nodeTypeRegistry';
import usePluginRegistry from '../hooks/usePluginRegistry';

const FAVORITES_KEY = 'nodegraph-editor:palette:favorites';

const categoryOrder = ['favorites', 'basic', 'utility', 'logic', 'content', 'media', 'integration', 'advanced', 'other'];
const categoryLabels = {
  favorites: 'Favorites',
  basic: 'Basic Nodes',
  utility: 'Utility Nodes',
  logic: 'Logic Nodes',
  content: 'Content Nodes',
  media: 'Media Nodes',
  integration: 'Integration',
  advanced: 'Advanced Nodes',
  other: 'Other'
};

const getIconComponent = (iconName) => {
  if (!iconName) return Icons.Circle;
  return Icons[iconName] || Icons.Circle;
};

const matchesQuery = (meta, query) => {
  if (!query) return true;
  const haystack = [
    meta.label,
    meta.type,
    meta.description,
    meta.category,
    meta.pluginId
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

const NodePaletteSection = ({ title, nodes, onSelect, favorites, onToggleFavorite }) => {
  if (!nodes || nodes.length === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ px: 2 }}>
        {title}
      </Typography>
      <List dense disablePadding>
        {nodes.map((meta) => {
          const Icon = getIconComponent(meta.icon);
          const isFavorite = favorites.has(meta.type);
          return (
            <ListItemButton
              key={meta.type}
              alignItems="flex-start"
              onClick={() => onSelect(meta)}
              sx={{ py: 1, pr: 10 }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Icon fontSize="small" />
                    <Typography variant="body2" component="span">
                      {meta.label}
                    </Typography>
                    {meta.pluginId && (
                      <Chip
                        size="small"
                        label="Plugin"
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                }
                secondary={
                  meta.description ? (
                    <Typography variant="caption" color="text.secondary">
                      {meta.description}
                    </Typography>
                  ) : null
                }
              />
              <Tooltip title={isFavorite ? 'Remove favorite' : 'Mark as favorite'}>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(meta.type);
                  }}
                >
                  {isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};

export default function NodePalettePanel({
  open,
  onClose,
  anchor = 'left'
}) {
  const { plugins } = usePluginRegistry();
  const nodesByCategory = useMemo(() => getNodeTypesByCategory(), [plugins]);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });

  const metaByType = useMemo(() => {
    const map = {};
    Object.values(nodesByCategory).forEach((nodes) => {
      nodes.forEach((meta) => {
        map[meta.type] = meta;
      });
    });
    return map;
  }, [nodesByCategory]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  const handleToggleFavorite = useCallback((type) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleSelectNode = useCallback((nodeMeta) => {
    if (!nodeMeta || !nodeMeta.type) return;
    eventBus.emit('addNode', { type: nodeMeta.type, meta: nodeMeta });
  }, []);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sections = [];
    const favoriteNodes = Array.from(favorites)
      .map((type) => metaByType[type])
      .filter(Boolean)
      .filter((meta) => matchesQuery(meta, query));

    if (favoriteNodes.length > 0) {
      sections.push({
        key: 'favorites',
        title: categoryLabels.favorites,
        nodes: favoriteNodes
      });
    }

    categoryOrder.forEach((category) => {
      if (category === 'favorites') return;
      const nodes = (nodesByCategory[category] || []).filter((meta) => matchesQuery(meta, query));
      if (nodes.length > 0) {
        sections.push({
          key: category,
          title: categoryLabels[category] || category,
          nodes
        });
      }
    });

    return sections;
  }, [favorites, metaByType, nodesByCategory, search]);

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
    >
      <Box
        sx={{
          width: 340,
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 2
          }}
        >
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search components"
            size="small"
            fullWidth
          />
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
          {filteredSections.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No node types match “{search}”.
            </Typography>
          ) : (
            filteredSections.map((section) => (
              <NodePaletteSection
                key={section.key}
                title={section.title}
                nodes={section.nodes}
                onSelect={handleSelectNode}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />
            ))
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
