"use client";
import React, { useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText
} from '@mui/material';

const EdgeListPanel = ({
  open,
  onClose,
  edges = [],
  nodes = [],
  selectedEdgeId,
  onSelectEdge
}) => {
  const sortedEdges = useMemo(() => {
    return [...(edges || [])].sort((a, b) => {
      const aLabel = (a?.label || a?.id || '').toLowerCase();
      const bLabel = (b?.label || b?.id || '').toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
  }, [edges]);

  const findNodeLabel = (id) => {
    if (!id) return '';
    const node = nodes.find((n) => n.id === id);
    if (node?.label) return node.label;
    return id;
  };

  return (
    <Drawer
      anchor="right"
      open={Boolean(open)}
      variant="persistent"
      ModalProps={{ keepMounted: true }}
      BackdropProps={{ invisible: true }}
    >
      <Box
        sx={{
          width: 320,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          p: 2
        }}
      >
        <Typography variant="h6" gutterBottom>
          Edge list
        </Typography>
        <Divider sx={{ mb: 1 }} />
        <List dense sx={{ flex: 1, overflowY: 'auto' }}>
          {sortedEdges.length
            ? sortedEdges.map((edge) => (
                <ListItem key={edge.id} disablePadding>
                  <ListItemButton
                    selected={edge.id === selectedEdgeId}
                    onClick={() => onSelectEdge?.(edge.id)}
                  >
                    <ListItemText
                      primary={edge.label || edge.id}
                      secondary={`${findNodeLabel(edge.source)} → ${findNodeLabel(edge.target)}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))
            : (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                No edges defined yet.
              </Typography>
            )}
        </List>
      </Box>
    </Drawer>
  );
};

export default EdgeListPanel;
