import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AltRouteIcon from '@mui/icons-material/AltRoute';

export default function FileActions({ 
  onSave, 
  onSaveWithoutExpanded,
  onExportFragment,
  exportBoundaryPortsEnabled,
  onToggleExportBoundaryPorts,
  onLoad, 
  onNewFile,
  isMobile,
  isFreeUser
}) {
  return (
    <>
      <Tooltip title="New File">
        <span>
          <IconButton 
            onClick={onNewFile} 
            color="inherit" 
            size={isMobile ? "small" : "small"}
            disabled={isFreeUser}
          >
            <NoteAddIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Save Graph">
        <span>
          <IconButton 
            onClick={onSave} 
            color="inherit" 
            size={isMobile ? "small" : "small"}
            disabled={isFreeUser}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Save Without Expanded">
        <span>
          <IconButton
            onClick={onSaveWithoutExpanded}
            color="inherit"
            size={isMobile ? "small" : "small"}
            disabled={isFreeUser}
          >
            <SaveAsIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Export Fragment">
        <span>
          <IconButton
            onClick={onExportFragment}
            color="inherit"
            size={isMobile ? "small" : "small"}
            disabled={isFreeUser}
          >
            <AccountTreeIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={exportBoundaryPortsEnabled ? "Boundary Ports: On" : "Boundary Ports: Off"}>
        <span>
          <IconButton
            onClick={onToggleExportBoundaryPorts}
            color={exportBoundaryPortsEnabled ? "primary" : "inherit"}
            size={isMobile ? "small" : "small"}
            disabled={isFreeUser}
          >
            <AltRouteIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Load Graph">
        <span>
          <IconButton 
            onClick={onLoad} 
            color="inherit" 
            size={isMobile ? "small" : "small"}
            disabled={isFreeUser}
          >
            <FolderOpenIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
}
