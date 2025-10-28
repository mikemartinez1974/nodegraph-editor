// components/GraphEditor/components/NodeTypeSelector.js
import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import * as Icons from '@mui/icons-material';
import { getNodeTypeList } from '../nodeTypeRegistry';

const NodeTypeSelector = ({ value, onChange, fullWidth = true, size = 'small', sx = {} }) => {
  const nodeTypes = getNodeTypeList();

  const getIcon = (iconName) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent fontSize="small" /> : null;
  };

  const displayLabel = (typeKey) => {
    const item = nodeTypes.find(n => n.type === typeKey);
    return item ? item.label : (typeKey ? (typeKey.charAt(0).toUpperCase() + typeKey.slice(1)) : '');
  };

  return (
    <FormControl fullWidth={fullWidth} size={size} sx={sx}>
      <InputLabel shrink>Node Type</InputLabel>
      <Select
        value={value || ''}
        label="Node Type"
        onChange={(e) => { if (typeof onChange === 'function') onChange(e.target.value); }}
        displayEmpty
        inputProps={{ 'aria-label': 'Node Type' }}
        sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        renderValue={(v) => (
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayLabel(v)}
          </div>
        )}
      >
        {nodeTypes.map(({ type, label, icon }) => (
          <MenuItem key={type} value={type} sx={{ whiteSpace: 'nowrap' }}>
            {icon ? (
              <ListItemIcon sx={{ minWidth: 36 }}>{getIcon(icon)}</ListItemIcon>
            ) : null}
            <ListItemText primary={label} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default NodeTypeSelector;