import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import DrawIcon from '@mui/icons-material/Draw';
import PostAddIcon from '@mui/icons-material/PostAdd';

export default function NodeActions({ 
  onTogglePalette,
  onDeleteSelected,
  onCopySelected,
  onPaste,
  onCopyGraph,
  selectedNodeIds = [],
  selectedNodeId,
  selectedEdgeId,
  isMobile 
}) {
  return (
    <>
      <Tooltip title="Open node palette (Ctrl+N)">
        <IconButton 
          onClick={() => onTogglePalette?.()}
          color="inherit"
          size="small"
        >
          <PostAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Delete Selected (Delete)">
        <span>
          <IconButton 
            onClick={onDeleteSelected}
            disabled={!selectedNodeId && !selectedEdgeId}
            color={selectedNodeId || selectedEdgeId ? "error" : "inherit"}
            size="small"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Copy Selected Nodes + Edges">
        <span>
          <IconButton 
            onClick={onCopySelected}
            disabled={selectedNodeIds.length === 0}
            color={selectedNodeIds.length > 0 ? "primary" : "default"}
            size="small"
            aria-label={`Copy ${selectedNodeIds.length} selected nodes to clipboard`}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Paste (JSON or Text)">
        <IconButton 
          onClick={onPaste}
          size="small"
          aria-label="Paste graph JSON or create node from text"
        >
          <DrawIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Copy Entire Graph">
        <span>
          <IconButton 
            onClick={onCopyGraph}
            size="small"
            disabled={selectedNodeIds.length === 0 && !selectedNodeId}
            aria-label="Copy entire graph JSON"
          >
            <FileCopyIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
}
