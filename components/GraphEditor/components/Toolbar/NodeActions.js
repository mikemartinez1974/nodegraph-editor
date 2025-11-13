import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import DrawIcon from '@mui/icons-material/Draw';
import PostAddIcon from '@mui/icons-material/PostAdd';
import AddNodeMenu from '../AddNodeMenu';

export default function NodeActions({ 
  onAddNode,
  onDeleteSelected,
  onCopySelected,
  onPaste,
  onCopyGraph,
  selectedNodeIds = [],
  selectedNodeId,
  selectedEdgeId,
  isMobile 
}) {
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);

  return (
    <>
      <Tooltip title="Add Node (Ctrl+N)">
        <IconButton 
          onClick={(e) => setAddMenuAnchor(e.currentTarget)}
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

      <AddNodeMenu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={() => setAddMenuAnchor(null)}
        onAddNode={onAddNode}
      />
    </>
  );
}
