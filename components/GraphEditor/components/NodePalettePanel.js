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

const BASE_CATEGORY_ORDER = ['favorites', 'breadboard', 'basic', 'utility', 'logic', 'content', 'definitions', 'media', 'integration', 'advanced', 'other'];
const categoryLabels = {
  favorites: 'Favorites',
  breadboard: 'Breadboard',
  basic: 'Basic Nodes',
  utility: 'Utility Nodes',
  logic: 'Logic Nodes',
  content: 'Content Nodes',
  definitions: 'Dictionary Definitions',
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

const VALID_ANCHORS = new Set(['left', 'right', 'top', 'bottom']);

export default function NodePalettePanel({
  open,
  onClose,
  anchor = 'left'
}) {
  const normalizedAnchor = typeof anchor === 'string' ? anchor.toLowerCase() : '';
  const safeAnchor = VALID_ANCHORS.has(normalizedAnchor) ? normalizedAnchor : 'left';

  const { plugins } = usePluginRegistry();
  const nodesByCategory = useMemo(() => getNodeTypesByCategory(), [plugins]);
  const [dictionaryEntries, setDictionaryEntries] = useState([]);
  const baseTypeSet = useMemo(() => {
    const set = new Set();
    Object.values(nodesByCategory || {}).forEach((nodes) => {
      nodes.forEach((meta) => {
        if (meta?.type) set.add(meta.type);
      });
    });
    return set;
  }, [nodesByCategory]);

  const buildEntriesFromDictionary = useCallback((dictionary) => {
    const nodeDefs = Array.isArray(dictionary?.data?.nodeDefs) ? dictionary.data.nodeDefs : [];
    return nodeDefs
      .map((entry) => {
        const type = entry?.key || entry?.type || entry?.nodeType;
        if (!type || typeof type !== 'string') return null;
        if (baseTypeSet.has(type)) return null;
        return {
          type,
          label: entry?.label || entry?.title || type,
          description: entry?.description || entry?.ref || entry?.source || '',
          icon: entry?.icon || 'Extension',
          category: 'definitions',
          definition: entry
        };
      })
      .filter(Boolean);
  }, [baseTypeSet]);

  useEffect(() => {
    const handleDictionaryResolved = ({ dictionary } = {}) => {
      setDictionaryEntries(buildEntriesFromDictionary(dictionary));
    };
    eventBus.on('dictionaryResolved', handleDictionaryResolved);
    eventBus.emit('dictionaryRequest');
    if (typeof window !== 'undefined' && window.graphAPI?.getNodes) {
      try {
        const nodes = window.graphAPI.getNodes() || [];
        const dictionaryNode = nodes.find((node) => node?.type === 'dictionary') || null;
        if (dictionaryNode) {
          setDictionaryEntries(buildEntriesFromDictionary(dictionaryNode));
        }
      } catch (err) {
        // ignore graphAPI lookup failures
      }
    }
    return () => {
      eventBus.off('dictionaryResolved', handleDictionaryResolved);
    };
  }, [baseTypeSet, buildEntriesFromDictionary]);

  const mergedNodesByCategory = useMemo(() => {
    if (!dictionaryEntries.length) return nodesByCategory;
    const merged = { ...nodesByCategory };
    merged.definitions = [...(merged.definitions || []), ...dictionaryEntries];
    return merged;
  }, [nodesByCategory, dictionaryEntries]);
  const orderedCategories = useMemo(() => {
    const extraCategories = Object.keys(mergedNodesByCategory || {})
      .filter((category) => category && category !== 'favorites' && !BASE_CATEGORY_ORDER.includes(category))
      .sort();
    return [...BASE_CATEGORY_ORDER, ...extraCategories];
  }, [mergedNodesByCategory]);
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
    Object.values(mergedNodesByCategory).forEach((nodes) => {
      nodes.forEach((meta) => {
        map[meta.type] = meta;
      });
    });
    return map;
  }, [mergedNodesByCategory]);

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

    orderedCategories.forEach((category) => {
      if (category === 'favorites') return;
      const nodes = (mergedNodesByCategory[category] || []).filter((meta) => matchesQuery(meta, query));
      if (nodes.length > 0) {
        sections.push({
          key: category,
          title: categoryLabels[category] || category,
          nodes
        });
      }
    });

    return sections;
  }, [favorites, metaByType, mergedNodesByCategory, search]);

  return (
    <Drawer
      anchor={safeAnchor}
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
