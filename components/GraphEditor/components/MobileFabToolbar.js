"use client";

import Box from '@mui/material/Box';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import PostAddIcon from '@mui/icons-material/PostAdd';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import PlumbingIcon from '@mui/icons-material/Plumbing';
import ListIcon from '@mui/icons-material/List';
import GroupIcon from '@mui/icons-material/FolderSpecial';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';

export default function MobileFabToolbar({
  onAddNode,
  onUndo,
  onRedo,
  onFitToNodes,
  onToggleProperties,
  onOpenDocumentProperties,
  onToggleNodeList,
  onToggleGroupList,
  onDeleteSelected,
  canUndo = false,
  canRedo = false,
  hasSelection = false,
  showPropertiesPanel = false,
  showNodeList = false,
  showGroupList = false
}) {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1400
      }}
    >
      <SpeedDial
        ariaLabel="Mobile graph actions"
        icon={<SpeedDialIcon />}
        direction="up"
      >
        <SpeedDialAction
          icon={<PostAddIcon />}
          tooltipTitle="Add node"
          onClick={onAddNode}
        />
        <SpeedDialAction
          icon={<UndoIcon />}
          tooltipTitle={canUndo ? "Undo" : "Nothing to undo"}
          FabProps={{ disabled: !canUndo }}
          onClick={canUndo ? onUndo : undefined}
        />
        <SpeedDialAction
          icon={<RedoIcon />}
          tooltipTitle={canRedo ? "Redo" : "Nothing to redo"}
          FabProps={{ disabled: !canRedo }}
          onClick={canRedo ? onRedo : undefined}
        />
        <SpeedDialAction
          icon={<CenterFocusStrongIcon />}
          tooltipTitle="Fit nodes to view"
          onClick={onFitToNodes}
        />
        {onOpenDocumentProperties && (
          <SpeedDialAction
            icon={<HistoryEduIcon />}
            tooltipTitle="Document properties"
            onClick={onOpenDocumentProperties}
          />
        )}
        <SpeedDialAction
          icon={<PlumbingIcon color={showPropertiesPanel ? 'primary' : undefined} />}
          tooltipTitle={showPropertiesPanel ? "Hide properties" : "Show properties"}
          onClick={onToggleProperties}
        />
        <SpeedDialAction
          icon={<ListIcon color={showNodeList ? 'primary' : undefined} />}
          tooltipTitle={showNodeList ? "Hide node list" : "Show node list"}
          onClick={onToggleNodeList}
        />
        <SpeedDialAction
          icon={<GroupIcon color={showGroupList ? 'primary' : undefined} />}
          tooltipTitle={showGroupList ? "Hide group list" : "Show group list"}
          onClick={onToggleGroupList}
        />
        <SpeedDialAction
          icon={<DeleteIcon color={hasSelection ? 'error' : undefined} />}
          tooltipTitle={hasSelection ? "Delete selection" : "Nothing selected"}
          FabProps={{ disabled: !hasSelection }}
          onClick={hasSelection ? onDeleteSelected : undefined}
        />
      </SpeedDial>
    </Box>
  );
}
