"use client";
import React from "react";
import {
  Drawer,
  Box,
  Typography,
  Divider,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip
} from "@mui/material";

const VIEW_LABELS = {
  nodes: "Nodes",
  edges: "Edges",
  clusters: "Clusters"
};
const HIDDEN_SYSTEM_NODE_TYPES = new Set(["manifest", "legend", "dictionary"]);

const VALID_ANCHORS = new Set(["left", "right", "top", "bottom"]);

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
  onEntityViewChange,
  onClose = () => {},
  anchor = "left"
}) {
  const normalizedAnchor = typeof anchor === "string" ? anchor.toLowerCase() : "";
  const safeAnchor = VALID_ANCHORS.has(normalizedAnchor) ? normalizedAnchor : "left";

  const renderNodes = () => {
    const visibleNodes = Array.isArray(nodes)
      ? nodes.filter((node) => !HIDDEN_SYSTEM_NODE_TYPES.has(node?.type))
      : [];
    if (!visibleNodes.length) {
      return <Typography variant="body2" color="text.secondary">No nodes found.</Typography>;
    }
    const sorted = [...visibleNodes].sort((a, b) => {
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
              onDoubleClick={() => onSelectNode?.(node.id, true)}
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
              onClick={() => onSelectEdge?.(edge.id, false)}
              onDoubleClick={() => onSelectEdge?.(edge.id, true)}
            >
              <ListItemText
                primary={edge.label || edge.id}
                secondary={`${edge.source} -> ${edge.target}`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    );
  };

  const renderGroups = () => {
    if (!groups?.length) {
      return <Typography variant="body2" color="text.secondary">No clusters created.</Typography>;
    }
    return (
      <List dense sx={{ p: 0 }}>
        {groups.map((group) => (
          <ListItem key={group.id} disablePadding>
            <ListItemButton
              selected={group.id === selectedGroupId}
              onClick={() => onSelectGroup?.(group.id, false)}
              onDoubleClick={() => onSelectGroup?.(group.id, true)}
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

  const normalizedView = entityView === "groups" ? "clusters" : entityView;
  let content = null;
  if (normalizedView === "nodes") content = renderNodes();
  else if (normalizedView === "edges") content = renderEdges();
  else if (normalizedView === "clusters") content = renderGroups();
  else content = renderNodes();

  return (
    <Drawer
      anchor={safeAnchor}
      open={Boolean(open)}
      onClose={onClose}
      variant="persistent"
      ModalProps={{ keepMounted: true }}
      BackdropProps={{ invisible: true }}
    >
      <Box sx={{ width: 320, p: 2, height: "100%", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
        <Typography variant="h6" gutterBottom>
          Elements
        </Typography>
        <Tabs
          value={normalizedView === "clusters" ? "clusters" : normalizedView}
          onChange={(_, value) => onEntityViewChange?.(value)}
          variant="fullWidth"
          sx={{ minHeight: 36 }}
        >
          <Tab label="Nodes" value="nodes" sx={{ minHeight: 36 }} />
          <Tab label="Edges" value="edges" sx={{ minHeight: 36 }} />
          <Tab label="Clusters" value="clusters" sx={{ minHeight: 36 }} />
        </Tabs>
        <Divider />
        <Box sx={{ mt: 2, flex: 1, overflowY: "auto" }}>{content}</Box>
      </Box>
    </Drawer>
  );
}
