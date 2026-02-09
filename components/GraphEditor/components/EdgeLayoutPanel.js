"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Slider,
  TextField,
  Grid,
  Button
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import useIntentEmitter from "../hooks/useIntentEmitter";
import {
  DEFAULT_LAYOUT_SETTINGS,
  DEFAULT_ELK_ROUTING_SETTINGS,
  EDGE_ROUTING_OPTIONS,
  LAYOUT_DIRECTION_OPTIONS,
  LAYOUT_MODE_OPTIONS,
  LAYOUT_TYPE_OPTIONS,
  ELK_ALGORITHM_OPTIONS,
  ELK_EDGE_ROUTING_OPTIONS,
  ELK_PORT_CONSTRAINT_OPTIONS
} from "../layoutSettings";

const laneGapMarks = [
  { value: 0, label: "Tight" },
  { value: 25, label: "Default" },
  { value: 50, label: "Loose" }
];

const clampNumber = (value, min, max, fallback = 0) => {
  if (value === "" || value === null || typeof value === "undefined") return fallback;
  const coerced = Number(value);
  if (Number.isNaN(coerced)) return fallback;
  if (typeof min === "number" && coerced < min) return min;
  if (typeof max === "number" && coerced > max) return max;
  return coerced;
};

export default function EdgeLayoutPanel({
  open,
  onClose,
  documentSettings = {},
  setDocumentSettings = () => {},
  contractSummary = { version: "1.0", handleSummary: {} },
  onApplyLayout = null
}) {
  const { emitEdgeIntent } = useIntentEmitter();
  const layout = documentSettings.layout || {};
  const layoutElk = layout.elk || DEFAULT_ELK_ROUTING_SETTINGS;
  const rendering = documentSettings.rendering || {};
  const laneGap = Number(layout.edgeLaneGapPx ?? DEFAULT_LAYOUT_SETTINGS.edgeLaneGapPx);

  const layoutSerpentine = layout.serpentine || DEFAULT_LAYOUT_SETTINGS.serpentine || {};
  const layoutCycleFallback = layout.cycleFallback || DEFAULT_LAYOUT_SETTINGS.cycleFallback || {};
  const [liveReroute, setLiveReroute] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(false);
  const scheduleIntent = (type, payload) => {
    if (liveReroute) {
      emitEdgeIntent(type, payload);
    } else {
      setPendingChanges(true);
    }
  };

  const handleEdgeRoutingSelect = (value) => {
    scheduleIntent("edgeRoutingChange", { value });
    setDocumentSettings((prev = {}) => ({
      ...prev,
      edgeRouting: value
    }));
  };

  const patchLayout = (patch) => {
    setDocumentSettings((prev = {}) => ({
      ...prev,
      layout: {
        ...(prev.layout || {}),
        ...patch
      }
    }));
  };

  const patchLayoutSection = (section, patch) => {
    setDocumentSettings((prev = {}) => ({
      ...prev,
      layout: {
        ...(prev.layout || {}),
        [section]: {
          ...((prev.layout && prev.layout[section]) || {}),
          ...patch
        }
      }
    }));
  };

  const patchRendering = (patch) => {
    setDocumentSettings((prev = {}) => ({
      ...prev,
      rendering: {
        ...(prev.rendering || {}),
        ...patch
      }
    }));
  };

  const handleLayoutSettingChange = (key, value) => {
    scheduleIntent("layoutSettingChange", { key, value });
    patchLayout({ [key]: value });
    if (key === "defaultLayout") {
      emitEdgeIntent("applyLayout", { layoutType: value });
      scheduleIntent("applyLayout", { layoutType: value });
      if (typeof onApplyLayout === "function") {
        onApplyLayout(value);
      }
    }
  };

  const handleSerpentineChange = (key, value) => {
    scheduleIntent("layoutSettingChange", { key: `serpentine.${key}`, value });
    patchLayoutSection("serpentine", { [key]: value });
  };

  const handleCycleFallbackChange = (key, value) => {
    scheduleIntent("layoutSettingChange", { key: `cycleFallback.${key}`, value });
    patchLayoutSection("cycleFallback", { [key]: value });
  };

  const handleElkSettingsChange = (key, value) => {
    scheduleIntent("elkSettingChange", { key, value });
    patchLayoutSection("elk", { [key]: value });
  };

  const handleRenderingSettingChange = (key, value) => {
    patchRendering({ [key]: value });
  };

  const handleManualApply = () => {
    emitEdgeIntent("applyLayout", { layoutType: layout.defaultLayout || DEFAULT_LAYOUT_SETTINGS.defaultLayout });
    emitEdgeIntent("toolbarReroute");
    if (typeof onApplyLayout === "function") {
      onApplyLayout(layout.defaultLayout || DEFAULT_LAYOUT_SETTINGS.defaultLayout);
    }
    setPendingChanges(false);
  };

  useEffect(() => {
    if (liveReroute && pendingChanges) {
      emitEdgeIntent("toolbarReroute");
      setPendingChanges(false);
    }
  }, [liveReroute, pendingChanges, emitEdgeIntent]);

  const summaryText = useMemo(() => {
    const bySide = contractSummary.handleSummary?.handleBySide || {};
    const entries = Object.entries(bySide);
    return entries.length
      ? entries.map(([side, count]) => `${side}: ${count}`).join(", ")
      : "No ports";
  }, [contractSummary]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      ModalProps={{ keepMounted: true }}
      BackdropProps={{ invisible: true }}
    >
      <Box sx={{ width: 380, p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">Layout Panel</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        <Stack spacing={2}>
          <Typography variant="subtitle2">Routing defaults</Typography>
          <Stack direction="row" alignItems="center" spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={liveReroute}
                  onChange={(event) => setLiveReroute(event.target.checked)}
                />
              }
              label="Live updates"
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleManualApply}
              disabled={!pendingChanges}
            >
              Apply layout
            </Button>
          </Stack>
          {pendingChanges && (
            <Typography variant="caption" sx={{ color: (theme) => theme.palette.warning.main }}>
              Pending reroute · toggle live updates or click Apply.
            </Typography>
          )}
          <Grid container spacing={2}>
            <Grid xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Edge routing</InputLabel>
                <Select
                  value={documentSettings.edgeRouting || "auto"}
                  label="Edge routing"
                  onChange={(event) => handleEdgeRoutingSelect(event.target.value)}
                >
                  {EDGE_ROUTING_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  Auto respects per-edge styles; straight/orthogonal force overrides.
                </Typography>
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Auto-layout mode</InputLabel>
                <Select
                  value={layout.mode || DEFAULT_LAYOUT_SETTINGS.mode}
                  label="Auto-layout mode"
                  onChange={(event) => handleLayoutSettingChange("mode", event.target.value)}
                >
                  {LAYOUT_MODE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  Controls when Twilite auto-layouts after paste.
                </Typography>
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Default layout</InputLabel>
                <Select
                  value={layout.defaultLayout || DEFAULT_LAYOUT_SETTINGS.defaultLayout}
                  label="Default layout"
                  onChange={(event) => handleLayoutSettingChange("defaultLayout", event.target.value)}
                >
                  {LAYOUT_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  Used for Auto layout and the Apply layout button.
                </Typography>
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Direction</InputLabel>
                <Select
                  value={layout.direction || DEFAULT_LAYOUT_SETTINGS.direction}
                  label="Direction"
                  onChange={(event) => handleLayoutSettingChange("direction", event.target.value)}
                >
                  {LAYOUT_DIRECTION_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  Applies to hierarchical layouts.
                </Typography>
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Typography variant="subtitle2">Edge lane spacing (px)</Typography>
              <Slider
                value={laneGap}
                min={0}
                max={60}
                step={2}
                marks={laneGapMarks}
                onChangeCommitted={(_, value) => handleLayoutSettingChange("edgeLaneGapPx", value)}
              />
              <Typography variant="caption" color="text.secondary">
                Spacing between parallel edges at node endpoints.
              </Typography>
            </Grid>
            <Grid xs={12}>
              <Typography variant="subtitle2">Serpentine & fallback</Typography>
            </Grid>
            <Grid xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Serpentine: max nodes per row"
                value={layoutSerpentine.maxPerRow ?? DEFAULT_LAYOUT_SETTINGS.serpentine.maxPerRow}
                onChange={(event) => {
                  const value = clampNumber(event.target.value, 2, 50, DEFAULT_LAYOUT_SETTINGS.serpentine.maxPerRow);
                  handleSerpentineChange("maxPerRow", value);
                }}
                helperText="Limit before serpentine layout wraps."
                inputProps={{ min: 2, max: 50 }}
              />
            </Grid>
            <Grid xs={12} md={6} sx={{ display: "flex", alignItems: "center" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={layoutCycleFallback.enabled ?? DEFAULT_LAYOUT_SETTINGS.cycleFallback.enabled}
                    onChange={(event) =>
                      handleCycleFallbackChange("enabled", event.target.checked)
                    }
                  />
                }
                label="Cycle fallback (allow grid for loops)"
              />
            </Grid>
          </Grid>
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="subtitle2">ELK routing parameters</Typography>
          <Grid container spacing={2}>
            <Grid xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Elk algorithm</InputLabel>
                <Select
                  value={layoutElk.algorithm}
                  label="Elk algorithm"
                  onChange={(event) => handleElkSettingsChange("algorithm", event.target.value)}
                >
                  {ELK_ALGORITHM_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Elk edge routing</InputLabel>
                <Select
                  value={layoutElk.edgeRouting}
                  label="Elk edge routing"
                  onChange={(event) => handleElkSettingsChange("edgeRouting", event.target.value)}
                >
                  {ELK_EDGE_ROUTING_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Elk port constraints</InputLabel>
                <Select
                  value={layoutElk.portConstraints}
                  label="Elk port constraints"
                  onChange={(event) => handleElkSettingsChange("portConstraints", event.target.value)}
                >
                  {ELK_PORT_CONSTRAINT_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Node spacing (px)"
                value={layoutElk.nodeSpacing}
                onChange={(event) => {
                  const value = clampNumber(event.target.value, 20, 400, DEFAULT_ELK_ROUTING_SETTINGS.nodeSpacing);
                  handleElkSettingsChange("nodeSpacing", value);
                }}
                helperText="Spacing used by ELK when routing between nodes."
                inputProps={{ min: 20, max: 400 }}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Layered edge spacing (px)"
                value={layoutElk.layeredEdgeSpacing}
                onChange={(event) => {
                  const value = clampNumber(event.target.value, 10, 200, DEFAULT_ELK_ROUTING_SETTINGS.layeredEdgeSpacing);
                  handleElkSettingsChange("layeredEdgeSpacing", value);
                }}
                helperText="Spacing between edge nodes in layered layouts."
                inputProps={{ min: 10, max: 200 }}
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Edge curvature bias"
                value={typeof layoutElk.curveBias === "number" ? layoutElk.curveBias : 0}
                onChange={(event) => {
                  const value = clampNumber(event.target.value, -1, 1, 0);
                  handleElkSettingsChange("curveBias", value);
                }}
                helperText="Prefers straighter or more curved segments."
                inputProps={{ min: -1, max: 1, step: 0.1 }}
              />
            </Grid>
          </Grid>
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Typography variant="subtitle2">Rendering controls</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={rendering.curvedEdges || false}
                onChange={(event) => handleRenderingSettingChange("curvedEdges", event.target.checked)}
              />
            }
            label="Curved edge decorations"
          />
          <FormControlLabel
            control={
              <Switch
                checked={rendering.showArrowheads || false}
                onChange={(event) =>
                  handleRenderingSettingChange("showArrowheads", event.target.checked)
                }
              />
            }
            label="Show arrowheads"
          />
          <FormControlLabel
            control={
              <Switch
                checked={rendering.animateDashes || false}
                onChange={(event) =>
                  handleRenderingSettingChange("animateDashes", event.target.checked)
                }
              />
            }
            label="Animate dashes"
          />
          <Typography variant="body2" color="text.secondary">
            Rendering flags stay in <code>edge.style</code> so they decorate geometry without rewriting ELK paths.
          </Typography>
        </Stack>

        <Divider />

        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Handle summary</Typography>
          <Typography variant="body2" color="text.secondary">
            {summaryText}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Contract version {contractSummary.version}
          </Typography>
        </Stack>
      </Box>
    </Drawer>
  );
}
