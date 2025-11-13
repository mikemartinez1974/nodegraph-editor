import React, { useState } from 'react';
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import GridOnIcon from '@mui/icons-material/GridOn';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';

export default function ViewActions({ 
  onToggleMinimap,
  onToggleGrid,
  onAutoLayout,
  onAlignNodes,
  onDistributeNodes,
  showMinimap,
  snapToGrid,
  selectionCount,
  isMobile,
  isFreeUser
}) {
  const [alignMenuAnchor, setAlignMenuAnchor] = useState(null);
  const [gridMenuAnchor, setGridMenuAnchor] = useState(null);

  const canAlign = selectionCount > 1;
  const canDistribute = selectionCount > 2;

  return (
    <>
      <Tooltip title={showMinimap ? "Hide Minimap" : "Show Minimap"}>
        <span>
          <IconButton 
            onClick={onToggleMinimap} 
            color={showMinimap ? "primary" : "inherit"}
            size="small"
            disabled={isFreeUser}
          >
            <MapIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Grid Options">
        <span>
          <IconButton 
            onClick={(e) => setGridMenuAnchor(e.currentTarget)} 
            color={snapToGrid ? "primary" : "inherit"}
            size="small"
            disabled={isFreeUser}
          >
            <GridOnIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Auto Layout">
        <span>
          <IconButton 
            onClick={onAutoLayout} 
            color="inherit"
            size="small"
            disabled={isFreeUser}
          >
            <AccountTreeIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Alignment Tools">
        <span>
          <IconButton 
            onClick={(e) => setAlignMenuAnchor(e.currentTarget)} 
            color="inherit"
            size="small"
            disabled={isFreeUser || selectionCount < 2}
          >
            <FormatAlignCenterIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {/* Grid Options Menu */}
      <Menu
        anchorEl={gridMenuAnchor}
        open={Boolean(gridMenuAnchor)}
        onClose={() => setGridMenuAnchor(null)}
      >
        <MenuItem onClick={() => { onToggleGrid(); setGridMenuAnchor(null); }}>
          Show Grid
        </MenuItem>
        <MenuItem onClick={() => { onAlignNodes('grid'); setGridMenuAnchor(null); }}>
          Align to Grid
        </MenuItem>
      </Menu>

      {/* Alignment Menu */}
      <Menu
        anchorEl={alignMenuAnchor}
        open={Boolean(alignMenuAnchor)}
        onClose={() => setAlignMenuAnchor(null)}
      >
        <MenuItem disabled={!canAlign} onClick={() => { onAlignNodes('left'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><FormatAlignLeftIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Align Left</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canAlign} onClick={() => { onAlignNodes('center-horizontal'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><FormatAlignCenterIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Align Horizontal Center</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canAlign} onClick={() => { onAlignNodes('right'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><FormatAlignRightIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Align Right</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canAlign} onClick={() => { onAlignNodes('top'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><VerticalAlignTopIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Align Top</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canAlign} onClick={() => { onAlignNodes('center-vertical'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><VerticalAlignCenterIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Align Vertical Center</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canAlign} onClick={() => { onAlignNodes('bottom'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><VerticalAlignBottomIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Align Bottom</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem disabled={!canDistribute} onClick={() => { onDistributeNodes('horizontal'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Distribute Horizontally</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canDistribute} onClick={() => { onDistributeNodes('vertical'); setAlignMenuAnchor(null); }}>
          <ListItemIcon><SwapVertIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Distribute Vertically</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
