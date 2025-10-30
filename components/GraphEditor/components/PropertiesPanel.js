import React, { useState, useEffect } from 'react';
import { Drawer, IconButton, Typography, Box } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NodePropertiesPanel from './NodePropertiesPanel';
import EdgePropertiesPanel from './EdgePropertiesPanel';
import GroupPropertiesPanel from './GroupPropertiesPanel';

const ANCHOR_KEY = 'propertiesPanelAnchor';

export default function PropertiesPanel({
  selectedNode,
  selectedEdge,
  selectedGroup,
  onUpdateNode,
  onUpdateEdge,
  onUpdateGroup,
  theme,
  defaultNodeColor,
  defaultEdgeColor,
  lockedNodes,
  lockedEdges,
  lockedGroups,
  onToggleNodeLock,
  onToggleEdgeLock,
  onToggleGroupLock,
  onClose
}) {
  // Remember anchor in localStorage
  const [anchor, setAnchor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ANCHOR_KEY) || 'right';
    }
    return 'right';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ANCHOR_KEY, anchor);
    }
  }, [anchor]);

  let panelTitle = 'Properties';
  let panelContent = null;
  if (selectedNode) {
    panelTitle = 'Node Properties';
    panelContent = (
      <NodePropertiesPanel
        selectedNode={selectedNode}
        onUpdateNode={onUpdateNode}
        theme={theme}
        defaultNodeColor={defaultNodeColor}
        lockedNodes={lockedNodes}
        onToggleNodeLock={onToggleNodeLock}
      />
    );
  } else if (selectedEdge) {
    panelTitle = 'Edge Properties';
    panelContent = (
      <EdgePropertiesPanel
        selectedEdge={selectedEdge}
        onUpdateEdge={onUpdateEdge}
        theme={theme}
        defaultEdgeColor={defaultEdgeColor}
        lockedEdges={lockedEdges}
        onToggleEdgeLock={onToggleEdgeLock}
      />
    );
  } else if (selectedGroup) {
    panelTitle = 'Group Properties';
    panelContent = (
      <GroupPropertiesPanel
        selectedGroup={selectedGroup}
        onUpdateGroup={onUpdateGroup}
        theme={theme}
        lockedGroups={lockedGroups}
        onToggleGroupLock={onToggleGroupLock}
      />
    );
  } else {
    panelContent = (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        Select a node, edge, or group to edit its properties.
      </Typography>
    );
  }

  return (
    <Drawer
      anchor={anchor}
      open={true}
      onClose={onClose}
      PaperProps={{ sx: { width: 380, zIndex: 1300 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
        <Typography variant="h6">{panelTitle}</Typography>
        <Box>
          <IconButton onClick={() => setAnchor(anchor === 'right' ? 'left' : 'right')} size="small" title="Switch side">
            {anchor === 'right' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
          <IconButton onClick={onClose} size="small" title="Close">
            <span aria-hidden>×</span>
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ p: 2 }}>{panelContent}</Box>
    </Drawer>
  );
}
