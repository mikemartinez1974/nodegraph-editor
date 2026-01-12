"use client";

import { useCallback } from 'react';
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
import {
  useGraphEditorStateContext,
  useGraphEditorHistoryContext,
  useGraphEditorLayoutContext,
  useGraphEditorServicesContext
} from '../providers/GraphEditorContext';
import useIntentEmitter from '../hooks/useIntentEmitter';

export default function MobileFabToolbar() {
  const {
    selectedNodeIds = [],
    selectedEdgeIds = [],
    selectedGroupIds = []
  } = useGraphEditorStateContext();
  const {
    handleUndo,
    handleRedo,
    canUndo = false,
    canRedo = false
  } = useGraphEditorHistoryContext();
  const layout = useGraphEditorLayoutContext();
  const services = useGraphEditorServicesContext();

  const onAddNode = layout?.handleOpenMobileAddNode;
  const onToggleProperties = layout?.togglePropertiesPanel;
  const onOpenDocumentProperties = layout?.handleOpenDocumentProperties;
  const onToggleNodeList = layout?.toggleNodeList;
  const onToggleGroupList = layout?.toggleGroupList;
  const onFitToNodes = services?.handleFitToNodes;
  const onDeleteSelected = services?.handlers?.handleDeleteSelected;

  const showPropertiesPanel = !!layout?.showPropertiesPanel;
  const showNodeList = !!layout?.showNodeList;
  const showGroupList = !!layout?.showGroupList;

  const { emitEdgeIntent } = useIntentEmitter();

  const handleAddNodeIntent = useCallback(() => {
    emitEdgeIntent('openAddNodeSheet', { source: 'mobile' });
    onAddNode?.();
  }, [emitEdgeIntent, onAddNode]);

  const handleUndoIntent = useCallback(() => {
    emitEdgeIntent('undo', { source: 'mobile' });
    if (canUndo) handleUndo();
  }, [emitEdgeIntent, handleUndo, canUndo]);

  const handleRedoIntent = useCallback(() => {
    emitEdgeIntent('redo', { source: 'mobile' });
    if (canRedo) handleRedo();
  }, [emitEdgeIntent, handleRedo, canRedo]);

  const handleFitToNodesIntent = useCallback(() => {
    emitEdgeIntent('fitToNodes', { source: 'mobile' });
    onFitToNodes?.();
  }, [emitEdgeIntent, onFitToNodes]);

  const handleTogglePropertiesIntent = useCallback(() => {
    emitEdgeIntent('togglePropertiesPanel', { open: !showPropertiesPanel, source: 'mobile' });
    onToggleProperties?.();
  }, [emitEdgeIntent, onToggleProperties, showPropertiesPanel]);

  const handleToggleNodeListIntent = useCallback(() => {
    emitEdgeIntent('toggleNodeList', { open: !showNodeList, source: 'mobile' });
    onToggleNodeList?.();
  }, [emitEdgeIntent, onToggleNodeList, showNodeList]);

  const handleToggleGroupListIntent = useCallback(() => {
    emitEdgeIntent('toggleGroupList', { open: !showGroupList, source: 'mobile' });
    onToggleGroupList?.();
  }, [emitEdgeIntent, onToggleGroupList, showGroupList]);

  const handleDeleteSelectedIntent = useCallback(() => {
    emitEdgeIntent('deleteSelection', {
      selectedNodeIds: selectedNodeIds.length,
      selectedEdgeIds: selectedEdgeIds.length,
      selectedGroupIds: selectedGroupIds.length,
      source: 'mobile'
    });
    onDeleteSelected?.();
  }, [emitEdgeIntent, onDeleteSelected, selectedNodeIds, selectedEdgeIds, selectedGroupIds]);

  const handleOpenDocumentPropertiesIntent = useCallback(() => {
    emitEdgeIntent('openDocumentProperties', { source: 'mobile' });
    onOpenDocumentProperties?.();
  }, [emitEdgeIntent, onOpenDocumentProperties]);

  const hasSelection =
    (selectedNodeIds?.length || 0) +
    (selectedEdgeIds?.length || 0) +
    (selectedGroupIds?.length || 0) > 0;

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
          onClick={handleAddNodeIntent}
        />
        <SpeedDialAction
          icon={<UndoIcon />}
          tooltipTitle={canUndo ? "Undo" : "Nothing to undo"}
          FabProps={{ disabled: !canUndo }}
          onClick={canUndo ? handleUndoIntent : undefined}
        />
        <SpeedDialAction
          icon={<RedoIcon />}
          tooltipTitle={canRedo ? "Redo" : "Nothing to redo"}
          FabProps={{ disabled: !canRedo }}
          onClick={canRedo ? handleRedoIntent : undefined}
        />
        <SpeedDialAction
          icon={<CenterFocusStrongIcon />}
          tooltipTitle="Fit nodes to view"
          onClick={handleFitToNodesIntent}
        />
        {onOpenDocumentProperties && (
          <SpeedDialAction
            icon={<HistoryEduIcon />}
            tooltipTitle="Document properties"
            onClick={handleOpenDocumentPropertiesIntent}
          />
        )}
        <SpeedDialAction
          icon={<PlumbingIcon color={showPropertiesPanel ? 'primary' : undefined} />}
          tooltipTitle={showPropertiesPanel ? "Hide properties" : "Show properties"}
          onClick={handleTogglePropertiesIntent}
        />
        <SpeedDialAction
          icon={<ListIcon color={showNodeList ? 'primary' : undefined} />}
          tooltipTitle={showNodeList ? "Hide node list" : "Show node list"}
          onClick={handleToggleNodeListIntent}
        />
        <SpeedDialAction
          icon={<GroupIcon color={showGroupList ? 'primary' : undefined} />}
          tooltipTitle={showGroupList ? "Hide group list" : "Show group list"}
          onClick={handleToggleGroupListIntent}
        />
        <SpeedDialAction
          icon={<DeleteIcon color={hasSelection ? 'error' : undefined} />}
          tooltipTitle={hasSelection ? "Delete selection" : "Nothing selected"}
          FabProps={{ disabled: !hasSelection }}
          onClick={hasSelection ? handleDeleteSelectedIntent : undefined}
        />
      </SpeedDial>
    </Box>
  );
}
