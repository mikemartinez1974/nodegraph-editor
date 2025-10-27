// components/GraphEditor/components/NodeTypeSelector.js
import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import * as Icons from '@mui/icons-material';
import { getNodeTypeList } from '../nodeTypeRegistry';

const NodeTypeSelector = ({ value, onChange, fullWidth = true, size = 'small', sx = {} }) => {
  const nodeTypes = getNodeTypeList();

  const getIcon = (iconName) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent fontSize="small" /> : <Icons.Circle fontSize="small" />;
  };

  return (
    <FormControl fullWidth={fullWidth} size={size} sx={sx}>
      <InputLabel>Node Type</InputLabel>
      <Select
        value={value}
        label="Node Type"
        onChange={onChange}
      >
        {nodeTypes.map(({ type, label, icon }) => (
          <MenuItem key={type} value={type}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {getIcon(icon)}
            </ListItemIcon>
            <ListItemText primary={label} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default NodeTypeSelector;