"use client";

import { forwardRef, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Slide from '@mui/material/Slide';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import * as Icons from '@mui/icons-material';

import eventBus from '../../NodeGraph/eventBus';
import { getNodeTypesByCategory } from '../nodeTypeRegistry';

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const categoryOrder = ['basic', 'content', 'media', 'advanced', 'other'];
const categoryLabels = {
  basic: 'Basic Nodes',
  content: 'Content Nodes',
  media: 'Media Nodes',
  advanced: 'Advanced Nodes',
  other: 'Other'
};

const getIcon = (iconName) => {
  const IconComponent = Icons[iconName];
  return IconComponent ? <IconComponent /> : <Icons.Circle />;
};

export default function MobileAddNodeSheet({ open, onClose, search, onSearchChange }) {
  const nodesByCategory = useMemo(() => getNodeTypesByCategory(), []);

  const filteredCategories = useMemo(() => {
    const query = (search || '').trim().toLowerCase();
    if (!query) return nodesByCategory;

    const result = {};
    Object.entries(nodesByCategory).forEach(([category, nodes]) => {
      const matches = nodes.filter(({ label, description, type }) => {
        const haystack = `${label ?? ''} ${description ?? ''} ${type ?? ''}`.toLowerCase();
        return haystack.includes(query);
      });
      if (matches.length) {
        result[category] = matches;
      }
    });
    return result;
  }, [nodesByCategory, search]);

  return (
    <Dialog
      fullScreen
      open={open}
      TransitionComponent={Transition}
      onClose={onClose}
    >
      <AppBar position="relative" color="primary" sx={{ boxShadow: 'none' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="Close add node dialog">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Add Node
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 2, py: 2 }}>
        <Stack spacing={2}>
          <TextField
            placeholder="Search nodes..."
            fullWidth
            autoFocus
            value={search}
            onChange={(event) => onSearchChange?.(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              )
            }}
          />
        </Stack>
      </Box>

      <List
        sx={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'background.default'
        }}
        subheader={<li />}
      >
        {categoryOrder.map((category) => {
          const nodes = filteredCategories[category];
          if (!nodes || nodes.length === 0) return null;

          return (
            <li key={category}>
              <ul style={{ padding: 0, margin: 0 }}>
                <ListSubheader sx={{ bgcolor: 'background.paper', lineHeight: '32px' }}>
                  {categoryLabels[category] || category}
                </ListSubheader>
                <Divider />
                {nodes.map((nodeMeta) => {
                  const { type, label, description, icon } = nodeMeta;
                  return (
                    <ListItemButton
                      key={type}
                      onClick={() => {
                        eventBus.emit('addNode', { type, meta: nodeMeta });
                        onClose?.();
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 42 }}>
                        {getIcon(icon)}
                      </ListItemIcon>
                      <ListItemText
                        primary={label}
                        secondary={description}
                        primaryTypographyProps={{ variant: 'subtitle1' }}
                        secondaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      />
                    </ListItemButton>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </List>
    </Dialog>
  );
}
