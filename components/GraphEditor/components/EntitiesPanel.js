"use client";
import React from "react";
import {
  Drawer,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip
} from "@mui/material";

const VIEW_LABELS = {
  nodes: "Nodes",
  edges: "Edges",
  groups: "Groups"
};

export default function EntitiesPanel({
  open = false,
  entityView = "nodes",
  nodes = [],
  edges = [],
  groups = [],
  selectedNodeId,
  selectedEdgeId,
  selectedGroupId,
  onSelectNode,
  onSelectEdge,
  onSelectGroup,
  onClose = () => {},
  anchor = "left"
}) {
  const renderNodes = () => {
    if (!nodes?.length) {
      return <Typography variant="body2" color="text.secondary">No nodes found.</Typography>;
    }
    const sorted = [...nodes].sort((a, b) => {
      const aLabel = (a?.label || a?.id || "").toLowerCase();
      const bLabel = (b?.label || b?.id || "").toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
    return (
      <List dense sx={{ p: 0 }}>
        {sorted.map((node) => (
          <ListItem key={node.id} disablePadding>
            <ListItemButton
              selected={node.id === selectedNodeId}
              onClick={() => onSelectNode?.(node.id, false)}
            >
              <ListItemText
                primary={node.label || node.id}
                secondary={node.type || "node"}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    );
  };

  const renderEdges = () => {
    if (!edges?.length) {
      return <Typography variant="body2" color="text.secondary">No edges defined yet.</Typography>;
    }
    return (
      <List dense sx={{ p: 0 }}>
        {edges.map((edge) => (
          <ListItem key={edge.id} disablePadding>
            <ListItemButton
              selected={edge.id === selectedEdgeId}
              onClick={() => onSelectEdge?.(edge.id)}
            >
              <ListItemText
                primary={edge.label || edge.id}
                secondary={`${edge.source} → ${edge.target}`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    );
  };

  const renderGroups = () => {
    if (!groups?.length) {
      return <Typography variant="body2" color="text.secondary">No groups created.</Typography>;
    }
    return (
      <List dense sx={{ p: 0 }}>
        {groups.map((group) => (
          <ListItem key={group.id} disablePadding>
            <ListItemButton
              selected={group.id === selectedGroupId}
              onClick={() => onSelectGroup?.(group.id, false)}
            >
              <ListItemText
                primary={group.label || group.id}
                secondary={`${group.nodeIds?.length || 0} nodes`}
              />
            </ListItemButton>
            {group.collapsed ? <Chip label="collapsed" size="small" /> : null}
          </ListItem>
        ))}
      </List>
    );
  };

  let content = null;
  if (entityView === "nodes") content = renderNodes();
  else if (entityView === "edges") content = renderEdges();
  else if (entityView === "groups") content = renderGroups();

  return (
    <Drawer
      anchor={anchor}
      open={Boolean(open)}
      onClose={onClose}
      variant="persistent"
      ModalProps={{ keepMounted: true }}
      BackdropProps={{ invisible: true }}
    >
      <Box sx={{ width: 320, p: 2, height: "100%", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
        <Typography variant="h6" gutterBottom>
          {VIEW_LABELS[entityView] || "Entities"}
        </Typography>
        <Divider />
        <Box sx={{ mt: 2, flex: 1, overflowY: "auto" }}>{content}</Box>
      </Box>
    </Drawer>
  );
}
