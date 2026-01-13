"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Drawer,
  Box,
  Stack,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  Grid,
  TextField,
  Slider
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

const STYLE_PRESETS = [
  {
    label: "Default",
    value: "default",
    style: { background: "#ffffff", borderColor: "#1976d2", color: "#1976d2", borderWidth: 1, borderStyle: "solid" }
  },
  {
    label: "Highlight",
    value: "highlight",
    style: { background: "linear-gradient(135deg,#f44336,#ff9800)", borderRadius: 18, color: "#fff" }
  },
  {
    label: "Calm",
    value: "calm",
    style: { background: "#e0f7fa", borderColor: "#00acc1", color: "#006064", borderWidth: 2, borderStyle: "solid", boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }
  }
];

const describeValue = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return `Array (${value.length})`;
  if (value instanceof Object) return "Object";
  return typeof value;
};

const flattenPayloadEntries = (data = {}) => {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).map(([key, value]) => ({
    key,
    value,
    type: describeValue(value)
  }));
};

const buildConnectedEdges = (selectedNode, edges = []) => {
  if (!selectedNode) return [];
  return edges.filter(
    (edge) => edge && (edge.source === selectedNode.id || edge.target === selectedNode.id)
  );
};

const sanitizePayloadJSON = (payload = {}) => {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "{}";
  }
};

const copyToClipboard = async (text) => {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn("[PropertiesPanel] clipboard copy failed", err);
  }
};

export default function PropertiesPanel({
  open,
  onClose,
  selectedNode,
  selectedEdge,
  nodes = [],
  edges = [],
  onUpdateNode = () => {},
  theme = {},
  anchor = "right"
}) {
  const [payloadView, setPayloadView] = useState("friendly");
  const [preset, setPreset] = useState("default");

  const payloadSource = selectedNode?.data || selectedEdge?.data || {};
  const currentStyle = selectedNode?.style || {};
  const parsedOpacity = Number(currentStyle.opacity);
  const opacityPercent = Number.isFinite(parsedOpacity) ? Math.min(Math.max(Math.round(parsedOpacity * 100), 0), 100) : 100;
  const [styleJsonText, setStyleJsonText] = useState(() => JSON.stringify(currentStyle, null, 2));
  const payloadEntries = useMemo(() => flattenPayloadEntries(payloadSource), [payloadSource]);
  const connectedEdges = useMemo(() => buildConnectedEdges(selectedNode, edges), [selectedNode, edges]);
  const nodeStyle = selectedNode?.style || {};
  const selectedPreset = STYLE_PRESETS.find((option) => option.value === preset) || STYLE_PRESETS[0];

  const handlePresetChange = (value) => {
    setPreset(value);
    const presetStyle = STYLE_PRESETS.find((option) => option.value === value)?.style || {};
    if (selectedNode) {
      onUpdateNode(selectedNode.id, { style: { ...nodeStyle, ...presetStyle } });
    }
  };

  const payloadJson = useMemo(() => sanitizePayloadJSON(payloadSource), [payloadSource]);
  const [jsonError, setJsonError] = useState("");
  const isNodeSelected = Boolean(selectedNode);

  useEffect(() => {
    setStyleJsonText(JSON.stringify(currentStyle || {}, null, 2));
  }, [currentStyle]);

  const updateStyle = (patch) => {
    if (!selectedNode) return;
    onUpdateNode(selectedNode.id, {
      style: {
        ...currentStyle,
        ...patch
      }
    });
  };

  const handleApplyStyleJson = () => {
    if (!selectedNode) return;
    try {
      const parsed = JSON.parse(styleJsonText || "{}");
      updateStyle(parsed);
      setJsonError("");
    } catch (err) {
      setJsonError("Invalid JSON");
    }
  };

  const handleResetStyle = () => {
    if (!selectedNode) return;
    onUpdateNode(selectedNode.id, { style: undefined });
  };


  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      variant="persistent"
      ModalProps={{ keepMounted: true }}
      BackdropProps={{ invisible: true }}
    >
      <Box
        sx={{
          width: 420,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          bgcolor: "background.paper",
          p: 2
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h6">{selectedNode?.label || 'Properties'}</Typography>
            {selectedNode?.id && (
              <Typography variant="caption" color="text.secondary">
                {selectedNode.id}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Divider sx={{ my: 2 }} />

        <Box sx={{ flex: "1 1 auto", overflowY: "auto" }}>
          <Section title="Payload">
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Button size="small" onClick={() => setPayloadView("friendly")}>
                Friendly view
              </Button>
              <Button size="small" onClick={() => setPayloadView("json")}>
                JSON
              </Button>
              <Tooltip title="Copy payload JSON">
                <IconButton size="small" onClick={() => copyToClipboard(payloadJson)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {payloadView === "friendly" ? (
              payloadEntries.length ? (
                <Stack spacing={1}>
                  {payloadEntries.map((entry) => (
                    <Paper key={entry.key} variant="outlined" sx={{ p: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2">{entry.key}</Typography>
                        <Chip size="small" label={entry.type} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value)}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No payload data to show.
                </Typography>
              )
            ) : (
              <Paper variant="outlined" sx={{ p: 1, fontFamily: "Monospace", whiteSpace: "pre-wrap" }}>
                {payloadJson}
              </Paper>
            )}
          </Section>

          <Section title="Connected edges">
            {selectedNode ? (
              connectedEdges.length ? (
                <List dense>
                  {connectedEdges.map((edge) => (
                    <ListItem key={edge.id} divider>
                      <ListItemText
                        primary={`${edge.label || edge.type || edge.id}`}
                        secondary={`handles ${edge.sourceHandle || "out"} → ${edge.targetHandle || "in"}`}
                      />
                      <ListItemSecondaryAction>
                        <Chip label={selectedNode.id === edge.source ? "source" : "target"} size="small" />
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No edges connected.
                </Typography>
              )
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a node to see connected edges.
              </Typography>
            )}
          </Section>

          <Section title="Style controls">
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Background"
                  type="color"
                  fullWidth
                  size="small"
                  value={currentStyle.background || "#ffffff"}
                  onChange={(event) => updateStyle({ background: event.target.value })}
                  disabled={!isNodeSelected}
                  sx={{ py: 0.5 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Text color"
                  type="color"
                  fullWidth
                  size="small"
                  value={currentStyle.color || "#000000"}
                  onChange={(event) => updateStyle({ color: event.target.value })}
                  disabled={!isNodeSelected}
                  sx={{ py: 0.5 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Border color"
                  type="color"
                  fullWidth
                  size="small"
                  value={currentStyle.borderColor || "#000000"}
                  onChange={(event) => updateStyle({ borderColor: event.target.value })}
                  disabled={!isNodeSelected}
                  sx={{ py: 0.5 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Border style</InputLabel>
                  <Select
                    value={currentStyle.borderStyle || "solid"}
                    label="Border style"
                    onChange={(event) => updateStyle({ borderStyle: event.target.value })}
                    disabled={!isNodeSelected}
                  >
                    {["solid", "dashed", "dotted", "double", "groove"].map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Border width (px)"
                  type="number"
                  fullWidth
                  size="small"
                  value={currentStyle.borderWidth ?? 0}
                  onChange={(event) => updateStyle({ borderWidth: Number(event.target.value) })}
                  disabled={!isNodeSelected}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Border radius (px)"
                  type="number"
                  fullWidth
                  size="small"
                  value={currentStyle.borderRadius ?? 0}
                  onChange={(event) => updateStyle({ borderRadius: Number(event.target.value) })}
                  disabled={!isNodeSelected}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Font weight</InputLabel>
                  <Select
                    value={currentStyle.fontWeight || "normal"}
                    label="Font weight"
                    onChange={(event) => updateStyle({ fontWeight: event.target.value })}
                    disabled={!isNodeSelected}
                  >
                    {["normal", "bold", "bolder", "lighter"].map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Font size"
                  placeholder="e.g. 14px"
                  fullWidth
                  size="small"
                  value={currentStyle.fontSize || ""}
                  onChange={(event) => updateStyle({ fontSize: event.target.value })}
                  disabled={!isNodeSelected}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Box shadow"
                  placeholder="e.g. 0px 4px 16px rgba(0,0,0,0.2)"
                  fullWidth
                  size="small"
                  value={currentStyle.boxShadow || ""}
                  onChange={(event) => updateStyle({ boxShadow: event.target.value })}
                  disabled={!isNodeSelected}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">Opacity</Typography>
                <Slider
                  value={opacityPercent}
                  min={0}
                  max={100}
                  onChange={(_, value) => {
                    if (Array.isArray(value)) return;
                    updateStyle({ opacity: Number(value) / 100 });
                  }}
                  disabled={!isNodeSelected}
                />
              </Grid>
            </Grid>
          </Section>

          <Section title="Formatting">
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Preset style</InputLabel>
              <Select value={preset} label="Preset style" onChange={(event) => handlePresetChange(event.target.value)}>
                {STYLE_PRESETS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Paper
              variant="outlined"
              sx={{
                minHeight: 120,
                p: 2,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                borderRadius: 2,
                borderColor: selectedPreset.style.borderColor || "divider"
              }}
            >
              <Typography variant="subtitle2">Style preview</Typography>
              <Box
                sx={{
                  mt: 1,
                  flex: 1,
                  borderRadius: 1,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: selectedPreset.style.background,
                  color: selectedPreset.style.color,
                  p: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Typography variant="body2">
                  {selectedNode ? selectedNode.label || selectedNode.id : "No node selected"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} mt={1}>
                <Button variant="text" size="small" onClick={() => copyToClipboard(JSON.stringify(selectedPreset.style))}>
                  Copy style
                </Button>
                <Button variant="contained" size="small" onClick={() => handlePresetChange(preset)}>
                  Apply
                </Button>
              </Stack>
            </Paper>
          </Section>
          <Section title="Advanced style JSON">
            <TextField
              fullWidth
              multiline
              minRows={4}
              size="small"
              value={styleJsonText}
              onChange={(event) => setStyleJsonText(event.target.value)}
              disabled={!isNodeSelected}
              helperText={jsonError || "Edit the raw style JSON and apply safely."}
              error={Boolean(jsonError)}
            />
            <Stack direction="row" spacing={1} mt={1}>
              <Button
                variant="contained"
                size="small"
                onClick={handleApplyStyleJson}
                disabled={!isNodeSelected}
              >
                Apply JSON
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleResetStyle}
                disabled={!isNodeSelected}
              >
                Reset style
              </Button>
            </Stack>
          </Section>
        </Box>
      </Box>
    </Drawer>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        {title}
      </Typography>
      {children}
      <Divider sx={{ mt: 2 }} />
    </Box>
  );
}
