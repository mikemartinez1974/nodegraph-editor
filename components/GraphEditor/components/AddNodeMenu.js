// components/GraphEditor/components/AddNodeMenu.js
import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import * as Icons from '@mui/icons-material';
import { getNodeTypesByCategory } from '../nodeTypeRegistry';
import eventBus from '../../NodeGraph/eventBus';

const AddNodeMenu = ({ anchorEl, open, onClose }) => {
  const nodesByCategory = getNodeTypesByCategory();
  
  // Category display order and labels
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
    return IconComponent ? <IconComponent fontSize="small" /> : <Icons.Circle fontSize="small" />;
  };

  // Build flat array of menu items
  const menuItems = [];
  
  categoryOrder.forEach((category, catIndex) => {
    const nodes = nodesByCategory[category];
    if (!nodes || nodes.length === 0) return;

    // Add divider before categories after the first
    if (catIndex > 0) {
      menuItems.push(
        <Divider key={`divider-${category}`} sx={{ my: 0.5 }} />
      );
    }
    
    // Add category header
    menuItems.push(
      <MenuItem key={`header-${category}`} disabled sx={{ opacity: 1, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {categoryLabels[category] || category}
        </Typography>
      </MenuItem>
    );
    
    // Add node type items
    nodes.forEach(({ type, label, description, icon }) => {
      menuItems.push(
        <MenuItem
          key={type}
          onClick={() => {
            eventBus.emit('addNode', { type });
            onClose();
          }}
          sx={{ pl: 3 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            {getIcon(icon)}
          </ListItemIcon>
          <ListItemText
            primary={label}
            secondary={description}
            primaryTypographyProps={{ variant: 'body2' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>
      );
    });
  });

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        style: {
          maxHeight: 500,
          minWidth: 220,
        },
      }}
    >
      {menuItems}
    </Menu>
  );
};

export default AddNodeMenu;