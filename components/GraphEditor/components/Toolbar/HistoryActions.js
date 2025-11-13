import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

export default function HistoryActions({ 
  onUndo, 
  onRedo, 
  canUndo, 
  canRedo,
  isMobile 
}) {
  return (
    <>
      <Tooltip title="Undo">
        <span>
          <IconButton 
            onClick={onUndo} 
            disabled={!canUndo} 
            color="inherit"
            size={isMobile ? "small" : "medium"}
          >
            <UndoIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Redo">
        <span>
          <IconButton 
            onClick={onRedo} 
            disabled={!canRedo} 
            color="inherit"
            size={isMobile ? "small" : "medium"}
          >
            <RedoIcon />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
}
