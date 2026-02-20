import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import AltRouteIcon from '@mui/icons-material/AltRoute';

export default function PanelActions({ 
  onToggleLayoutPanel,
  showEdgePanel,
  isMobile
}) {
  return (
    <>
      <Tooltip title="Layout panel">
        <IconButton
          onClick={onToggleLayoutPanel}
          color={showEdgePanel ? "primary" : "inherit"}
          size="small"
        >
          <AltRouteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );
}
