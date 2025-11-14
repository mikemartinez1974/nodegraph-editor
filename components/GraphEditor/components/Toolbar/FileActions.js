import React from 'react';
import { IconButton, Tooltip, MenuItem, ListItemIcon } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadIcon from '@mui/icons-material/Download';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import HomeIcon from '@mui/icons-material/Home';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function FileActions({ 
  onSave, 
  onLoad, 
  onExport,
  onNewFile,
  isMobile,
  isFreeUser,
  onClearHomePage
}) {
  const handleClearHomePage = () => {
    if (typeof onClearHomePage === 'function') {
      onClearHomePage();
      return;
    }
    try {
      localStorage.removeItem('graphEditorHomeUrl');
    } catch (err) {
      /* ignore storage errors */
    }
    eventBus.emit('clearBackgroundUrl');
    eventBus.emit('setAddress', 'local://untitled.node');
    onShowMessage?.('Home page cleared. New tab will appear next time.', 'info');
  };

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

      <MenuItem onClick={() => eventBus.emit('navigateHome')}>
        <ListItemIcon>
          <HomeIcon fontSize="small" />
        </ListItemIcon>
        Home
      </MenuItem>
      <MenuItem onClick={handleClearHomePage}>
        <ListItemIcon>
          <DeleteOutlineIcon fontSize="small" />
        </ListItemIcon>
        Clear home page
      </MenuItem>
    </>
  );
}
