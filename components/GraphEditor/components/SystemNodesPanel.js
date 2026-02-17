"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Drawer,
  Box,
  Stack,
  Typography,
  Divider,
  IconButton,
  TextField,
  Button,
  Alert,
  Paper,
  Chip,
  Tabs,
  Tab
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

export default function SystemNodesPanel({
  open = false,
  onClose = () => {},
  anchor = "right",
  nodes = [],
  validationReport = { errors: [], warnings: [] },
  width = 760,
  minWidth = 520,
  maxWidth = 1200,
  onWidthChange = () => {},
  onUpdateNode = () => {}
}) {
  const manifestNode = useMemo(() => nodes.find((n) => n?.type === "manifest") || null, [nodes]);
  const legendNode = useMemo(() => nodes.find((n) => n?.type === "legend") || null, [nodes]);
  const dictionaryNode = useMemo(() => nodes.find((n) => n?.type === "dictionary") || null, [nodes]);

  const [manifestDraft, setManifestDraft] = useState({
    name: "",
    version: "",
    description: "",
    documentUrl: "",
    nodeTypesCsv: ""
  });
  const [legendEntries, setLegendEntries] = useState([]);
  const [dictionaryNodeDefs, setDictionaryNodeDefs] = useState([]);
  const [dictionaryViews, setDictionaryViews] = useState([]);
  const [error, setError] = useState("");
  const [selectedSection, setSelectedSection] = useState("legend");
  const resizeStateRef = useRef(null);
  const validationErrors = Array.isArray(validationReport?.errors) ? validationReport.errors : [];
  const validationWarnings = Array.isArray(validationReport?.warnings) ? validationReport.warnings : [];
  const totalIssues = validationErrors.length + validationWarnings.length;

  const beginResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const maxAllowed = typeof window !== "undefined"
      ? Math.max(minWidth, Math.min(maxWidth, window.innerWidth - 120))
      : maxWidth;
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: width,
      maxAllowed
    };
    const onMove = (moveEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const delta = moveEvent.clientX - state.startX;
      const nextRaw = anchor === "left" ? state.startWidth + delta : state.startWidth - delta;
      const nextWidth = Math.max(minWidth, Math.min(state.maxAllowed, nextRaw));
      onWidthChange(nextWidth);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      resizeStateRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    if (!manifestNode) return;
    const data = manifestNode.data || {};
    setManifestDraft({
      name: data?.identity?.name || "",
      version: data?.identity?.version || "",
      description: data?.identity?.description || "",
      documentUrl: data?.document?.url || "",
      nodeTypesCsv: Array.isArray(data?.dependencies?.nodeTypes) ? data.dependencies.nodeTypes.join(", ") : ""
    });
  }, [manifestNode?.id]);

  useEffect(() => {
    if (!legendNode) return;
    const entries = Array.isArray(legendNode?.data?.entries) ? legendNode.data.entries : [];
    setLegendEntries(entries.map((entry) => ({
      key: entry?.key || "",
      intent: entry?.intent || "",
      implementation: entry?.implementation || "",
      dictionaryKey: entry?.dictionaryKey || ""
    })));
  }, [legendNode?.id]);

  useEffect(() => {
    if (!dictionaryNode) return;
    const nodeDefs = Array.isArray(dictionaryNode?.data?.nodeDefs) ? dictionaryNode.data.nodeDefs : [];
    const views = Array.isArray(dictionaryNode?.data?.views) ? dictionaryNode.data.views : [];
    setDictionaryNodeDefs(nodeDefs.map((entry) => ({
      key: entry?.key || "",
      ref: entry?.ref || "",
      source: entry?.source || "",
      version: entry?.version || ""
    })));
    setDictionaryViews(views.map((entry) => ({
      key: entry?.key || "",
      intent: entry?.intent || "",
      payload: entry?.payload || "",
      ref: entry?.ref || "",
      source: entry?.source || "",
      version: entry?.version || ""
    })));
  }, [dictionaryNode?.id]);

  const applyManifest = () => {
    if (!manifestNode) return;
    const current = manifestNode.data || {};
    const nextData = {
      ...current,
      identity: {
        ...(current.identity || {}),
        name: manifestDraft.name,
        version: manifestDraft.version,
        description: manifestDraft.description
      },
      document: {
        ...(current.document || {}),
        url: manifestDraft.documentUrl
      },
      dependencies: {
        ...(current.dependencies || {}),
        nodeTypes: manifestDraft.nodeTypesCsv
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      }
    };
    onUpdateNode(manifestNode.id, { data: nextData }, { replaceData: true });
    setError("");
  };

  const applyLegend = () => {
    if (!legendNode) return;
    const nextEntries = legendEntries
      .map((entry) => ({
        key: String(entry?.key || "").trim(),
        intent: String(entry?.intent || "").trim(),
        implementation: String(entry?.implementation || "").trim(),
        dictionaryKey: String(entry?.dictionaryKey || "").trim()
      }))
      .filter((entry) => entry.key);
    onUpdateNode(
      legendNode.id,
      { data: { ...(legendNode.data || {}), entries: nextEntries } },
      { replaceData: true }
    );
    setError("");
  };

  const applyDictionary = () => {
    if (!dictionaryNode) return;
    const nextNodeDefs = dictionaryNodeDefs
      .map((entry) => ({
        key: String(entry?.key || "").trim(),
        ref: String(entry?.ref || "").trim(),
        source: String(entry?.source || "").trim(),
        version: String(entry?.version || "").trim()
      }))
      .filter((entry) => entry.key);
    const nextViews = dictionaryViews
      .map((entry) => ({
        key: String(entry?.key || "").trim(),
        intent: String(entry?.intent || "").trim(),
        payload: String(entry?.payload || "").trim(),
        ref: String(entry?.ref || "").trim(),
        source: String(entry?.source || "").trim(),
        version: String(entry?.version || "").trim()
      }))
      .filter((entry) => entry.key);
    const nextData = {
      ...(dictionaryNode.data || {}),
      nodeDefs: nextNodeDefs,
      views: nextViews
    };
    onUpdateNode(dictionaryNode.id, { data: nextData }, { replaceData: true });
    setError("");
  };

  const updateLegendEntry = (index, patch) => {
    setLegendEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };
  const removeLegendEntry = (index) => {
    setLegendEntries((prev) => prev.filter((_, i) => i !== index));
  };
  const addLegendEntry = () => {
    setLegendEntries((prev) => [...prev, { key: "", intent: "", implementation: "", dictionaryKey: "" }]);
  };

  const updateNodeDefEntry = (index, patch) => {
    setDictionaryNodeDefs((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };
  const removeNodeDefEntry = (index) => {
    setDictionaryNodeDefs((prev) => prev.filter((_, i) => i !== index));
  };
  const addNodeDefEntry = () => {
    setDictionaryNodeDefs((prev) => [...prev, { key: "", ref: "", source: "", version: "" }]);
  };

  const updateViewEntry = (index, patch) => {
    setDictionaryViews((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };
  const removeViewEntry = (index) => {
    setDictionaryViews((prev) => prev.filter((_, i) => i !== index));
  };
  const addViewEntry = () => {
    setDictionaryViews((prev) => [
      ...prev,
      { key: "", intent: "", payload: "", ref: "", source: "", version: "" }
    ]);
  };

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      variant="persistent"
      ModalProps={{ keepMounted: true }}
      PaperProps={{ sx: { width, overflow: "visible" } }}
    >
      <Box
        onMouseDown={beginResize}
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: 8,
          cursor: "ew-resize",
          zIndex: 5,
          ...(anchor === "left" ? { right: -4 } : { left: -4 })
        }}
        aria-label="Resize System Nodes panel"
      />
      <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">System Nodes</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Manifest, Legend, Dictionary, and validation
        </Typography>
        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <Tabs
            variant="scrollable"
            value={selectedSection}
            onChange={(event, value) => setSelectedSection(value)}
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              mb: 2
            }}
          >
            <Tab value="legend" label="Legend" />
            <Tab value="manifest" label="Manifest" />
            <Tab value="dictionary" label="Dictionary" />
            <Tab value="validation" label={`Validation (${totalIssues})`} />
          </Tabs>

          <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

            {selectedSection === "validation" ? (
              <Stack spacing={1.5} sx={{ pb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle1">Validation</Typography>
                  <Chip
                    size="small"
                    label={totalIssues === 0 ? "No issues" : `${totalIssues} issue${totalIssues === 1 ? "" : "s"}`}
                    color={totalIssues === 0 ? "success" : "warning"}
                    variant={totalIssues === 0 ? "outlined" : "filled"}
                  />
                  <Chip size="small" label={`${validationErrors.length} errors`} color="error" variant="outlined" />
                  <Chip size="small" label={`${validationWarnings.length} warnings`} color="warning" variant="outlined" />
                </Stack>
                {validationErrors.map((issue, index) => (
                  <Alert key={`validation-error-${index}`} severity="error" variant="outlined">
                    <Typography variant="body2">{issue?.message || "Unknown error"}</Typography>
                    {issue?.code ? (
                      <Typography variant="caption" color="text.secondary">
                        code: {issue.code}
                      </Typography>
                    ) : null}
                  </Alert>
                ))}
                {validationWarnings.map((issue, index) => (
                  <Alert key={`validation-warning-${index}`} severity="warning" variant="outlined">
                    <Typography variant="body2">{issue?.message || "Unknown warning"}</Typography>
                    {issue?.code ? (
                      <Typography variant="caption" color="text.secondary">
                        code: {issue.code}
                      </Typography>
                    ) : null}
                  </Alert>
                ))}
              </Stack>
            ) : null}

            {selectedSection === "manifest" ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Manifest</Typography>
                <TextField size="small" label="Name" value={manifestDraft.name} onChange={(e) => setManifestDraft((p) => ({ ...p, name: e.target.value }))} />
                <TextField size="small" label="Version" value={manifestDraft.version} onChange={(e) => setManifestDraft((p) => ({ ...p, version: e.target.value }))} />
                <TextField size="small" label="Description" value={manifestDraft.description} onChange={(e) => setManifestDraft((p) => ({ ...p, description: e.target.value }))} multiline minRows={2} />
                <TextField size="small" label="Document URL" value={manifestDraft.documentUrl} onChange={(e) => setManifestDraft((p) => ({ ...p, documentUrl: e.target.value }))} />
                <TextField size="small" label="Node types (csv)" value={manifestDraft.nodeTypesCsv} onChange={(e) => setManifestDraft((p) => ({ ...p, nodeTypesCsv: e.target.value }))} />
                <Button variant="outlined" size="small" onClick={applyManifest}>Apply Manifest</Button>
              </Stack>
            ) : null}

            {selectedSection === "legend" ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Legend</Typography>
                {legendEntries.map((entry, index) => (
                  <Paper key={`legend-${index}`} variant="outlined" sx={{ p: 1 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">Entry {index + 1}</Typography>
                        <IconButton size="small" onClick={() => removeLegendEntry(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <TextField size="small" label="key" value={entry.key} onChange={(e) => updateLegendEntry(index, { key: e.target.value })} />
                      <TextField size="small" label="intent" value={entry.intent} onChange={(e) => updateLegendEntry(index, { intent: e.target.value })} />
                      <TextField size="small" label="implementation" value={entry.implementation} onChange={(e) => updateLegendEntry(index, { implementation: e.target.value })} />
                      <TextField size="small" label="dictionaryKey" value={entry.dictionaryKey} onChange={(e) => updateLegendEntry(index, { dictionaryKey: e.target.value })} />
                    </Stack>
                  </Paper>
                ))}
                <Button variant="text" size="small" startIcon={<AddIcon />} onClick={addLegendEntry}>Add Legend Entry</Button>
                <Button variant="outlined" size="small" onClick={applyLegend}>Apply Legend</Button>
              </Stack>
            ) : null}

            {selectedSection === "dictionary" ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Dictionary: nodeDefs</Typography>
                {dictionaryNodeDefs.map((entry, index) => (
                  <Paper key={`nodeDef-${index}`} variant="outlined" sx={{ p: 1 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">nodeDef {index + 1}</Typography>
                        <IconButton size="small" onClick={() => removeNodeDefEntry(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <TextField size="small" label="key" value={entry.key} onChange={(e) => updateNodeDefEntry(index, { key: e.target.value })} />
                      <TextField size="small" label="ref" value={entry.ref} onChange={(e) => updateNodeDefEntry(index, { ref: e.target.value })} />
                      <TextField size="small" label="source" value={entry.source} onChange={(e) => updateNodeDefEntry(index, { source: e.target.value })} />
                      <TextField size="small" label="version" value={entry.version} onChange={(e) => updateNodeDefEntry(index, { version: e.target.value })} />
                    </Stack>
                  </Paper>
                ))}
                <Button variant="text" size="small" startIcon={<AddIcon />} onClick={addNodeDefEntry}>Add nodeDef</Button>

                <Typography variant="subtitle1">Dictionary: views</Typography>
                {dictionaryViews.map((entry, index) => (
                  <Paper key={`view-${index}`} variant="outlined" sx={{ p: 1 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">view {index + 1}</Typography>
                        <IconButton size="small" onClick={() => removeViewEntry(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <TextField size="small" label="key" value={entry.key} onChange={(e) => updateViewEntry(index, { key: e.target.value })} />
                      <TextField size="small" label="intent" value={entry.intent} onChange={(e) => updateViewEntry(index, { intent: e.target.value })} />
                      <TextField size="small" label="payload" value={entry.payload} onChange={(e) => updateViewEntry(index, { payload: e.target.value })} />
                      <TextField size="small" label="ref" value={entry.ref} onChange={(e) => updateViewEntry(index, { ref: e.target.value })} />
                      <TextField size="small" label="source" value={entry.source} onChange={(e) => updateViewEntry(index, { source: e.target.value })} />
                      <TextField size="small" label="version" value={entry.version} onChange={(e) => updateViewEntry(index, { version: e.target.value })} />
                    </Stack>
                  </Paper>
                ))}
                <Button variant="text" size="small" startIcon={<AddIcon />} onClick={addViewEntry}>Add view</Button>
                <Button variant="outlined" size="small" onClick={applyDictionary}>Apply Dictionary</Button>
              </Stack>
            ) : null}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
