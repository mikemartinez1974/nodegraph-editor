import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import PlumbingIcon from '@mui/icons-material/Plumbing';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import ListIcon from '@mui/icons-material/List';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import LinkIcon from '@mui/icons-material/Link';
import AltRouteIcon from '@mui/icons-material/AltRoute';

export default function PanelActions({ 
  onToggleNodeList,
  onToggleGroupList,
  onToggleEdgeList,
  onToggleScriptPanel,
  onToggleLayoutPanel,
  onTogglePropertiesPanel,
  showPropertiesPanel,
  showEdgePanel,
  showNodeList,
  showGroupList,
  showEdgeList,
  isMobile,
  isFreeUser
}) {
  return (
    <>
      <Tooltip title="Toggle Node List">
        <span>
          <IconButton 
            onClick={onToggleNodeList} 
            color={showNodeList ? "primary" : "default"}
            size="small"
            disabled={isFreeUser}
          >
            <ListIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Toggle Cluster List">
        <span>
          <IconButton 
            onClick={onToggleGroupList} 
            color={showGroupList ? "primary" : "default"}
            size="small"
            disabled={isFreeUser}
          >
            <FolderSpecialIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Toggle Edge List">
        <span>
          <IconButton
            onClick={onToggleEdgeList}
            color={showEdgeList ? "primary" : "default"}
            size="small"
            disabled={isFreeUser}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Toggle Script Panel">
        <IconButton 
          onClick={onToggleScriptPanel} 
          color="primary"
          size="small"
        >
          <DeveloperModeIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Properties panel">
        <IconButton
          onClick={onTogglePropertiesPanel}
          color={showPropertiesPanel ? "primary" : "default"}
          size="small"
        >
          <PlumbingIcon fontSize="small" />
        </IconButton>
      </Tooltip>
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
