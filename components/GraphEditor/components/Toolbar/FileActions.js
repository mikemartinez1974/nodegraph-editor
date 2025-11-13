import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadIcon from '@mui/icons-material/Download';
import NoteAddIcon from '@mui/icons-material/NoteAdd';

export default function FileActions({ 
  onSave, 
  onLoad, 
  onExport,
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
