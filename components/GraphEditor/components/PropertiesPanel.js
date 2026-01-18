"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Drawer,
  Box,
  Stack,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  IconButton,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  TextField,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MarkdownRenderer from "./MarkdownRenderer";
import edgeTypes from "../edgeTypes";

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

const detectType = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const toDisplayString = (value) => {
  if (value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const parseValueFromString = (text, type) => {
  if (type === "number") {
    const num = Number(text);
    return Number.isNaN(num) ? text : num;
  }
  if (type === "boolean") {
    if (text === "true") return true;
    if (text === "false") return false;
  }
  if (type === "null") {
    return text === "" || text === "null" ? null : text;
  }
  if (type === "array" || type === "object") {
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch {
      return text;
    }
  }
  return text;
};

const buildConnectedEdges = (selectedNode, edges = []) => {
  if (!selectedNode) return [];
  return edges.filter((edge) => edge && (edge.source === selectedNode.id || edge.target === selectedNode.id));
};

const copyToClipboard = async (text) => {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn("[PropertiesPanel] clipboard copy failed", err);
  }
};

const DEFAULT_EXPANDED_SECTIONS = {
  node: "data",
  edge: "details",
  group: "members"
};
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 720;

export default function PropertiesPanel({
  open = false,
  onClose = () => {},
  selectedNode,
  selectedEdge,
  selectedGroup,
  nodes = [],
  edges = [],
  onUpdateNode = () => {},
  onUpdateEdge = () => {},
  onUpdateGroup = () => {},
  onSelectEdge,
  onSelectNode,
  onSelectGroup,
  nodeTypeOptions = [],
  theme = {},
  anchor = "right",
  onResize
}) {
  const [payloadView, setPayloadView] = useState("friendly");
  const [preset, setPreset] = useState("default");
  const [dataEntries, setDataEntries] = useState([]);
  const [markdownPreviewMode, setMarkdownPreviewMode] = useState({});
  const [expandedSections, setExpandedSections] = useState({ ...DEFAULT_EXPANDED_SECTIONS });
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [jsonViewRevision, setJsonViewRevision] = useState(0);
  const [dataEntriesRevision, setDataEntriesRevision] = useState(0);
  const resizeStateRef = useRef(null);
  const dataEntriesRef = useRef([]);
  const pendingJsonPersistRef = useRef(false);
  const jsonDraftRef = useRef({ keys: {}, values: {} });
  const friendlyDraftRef = useRef({});

  const activeSelection = selectedNode || selectedEdge || selectedGroup;
  const selectionStyle = selectedNode?.style || selectedEdge?.style || {};
  const connectedEdges = useMemo(() => buildConnectedEdges(selectedNode, edges), [selectedNode, edges]);
  const edgeSourceNode = useMemo(() => (selectedEdge ? nodes.find((node) => node.id === selectedEdge.source) : null), [nodes, selectedEdge]);
  const edgeTargetNode = useMemo(() => (selectedEdge ? nodes.find((node) => node.id === selectedEdge.target) : null), [nodes, selectedEdge]);
  const edgeConnectedNodes = useMemo(() => {
    if (!selectedEdge) return [];
    const list = [];
    if (edgeSourceNode) list.push({ role: "source", node: edgeSourceNode });
    if (edgeTargetNode) list.push({ role: "target", node: edgeTargetNode });
    if (!edgeSourceNode && selectedEdge.source) {
      list.push({ role: "source", node: { id: selectedEdge.source, label: selectedEdge.source } });
    }
    if (!edgeTargetNode && selectedEdge.target) {
      list.push({ role: "target", node: { id: selectedEdge.target, label: selectedEdge.target } });
    }
    return list;
  }, [edgeSourceNode, edgeTargetNode, selectedEdge]);
  const groupMemberNodes = useMemo(() => {
    if (!selectedGroup?.nodeIds?.length) return [];
    return selectedGroup.nodeIds.map((nodeId) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (node) return node;
      return { id: nodeId, label: `Node ${nodeId}`, type: "unknown" };
    });
  }, [selectedGroup, nodes]);
  const selectedPreset = STYLE_PRESETS.find((option) => option.value === preset) || STYLE_PRESETS[0];
  const isNodeSelected = Boolean(selectedNode);
  const isEdgeSelected = Boolean(selectedEdge) && !isNodeSelected;
  const isGroupSelected = Boolean(selectedGroup) && !isNodeSelected && !isEdgeSelected;
  const activeSelectionId = activeSelection?.id;
  const selectionLabel = selectedNode?.label || selectedEdge?.label || selectedGroup?.label || "Properties";
  const selectionType = isNodeSelected ? "Node" : isEdgeSelected ? "Edge" : isGroupSelected ? "Group" : "Item";
  const activeView = isNodeSelected ? "node" : isEdgeSelected ? "edge" : isGroupSelected ? "group" : null;
  const [styleJsonText, setStyleJsonText] = useState(() => JSON.stringify(selectionStyle, null, 2));
  const payloadJson = useMemo(() => {
    const data = {};
    dataEntries.forEach((entry) => {
      if (entry.key) {
        data[entry.key] = entry.value;
      }
    });
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return "{}";
    }
  }, [dataEntries]);
  const selectedType = selectedNode?.type || "";

  const handleResizeMove = useCallback(
    (event) => {
      if (!resizeStateRef.current) return;
      const clientX = event.clientX ?? 0;
      const { startX, startWidth } = resizeStateRef.current;
      const delta = clientX - startX;
      const direction = anchor === "right" ? -1 : 1;
      const nextWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + direction * delta));
      setPanelWidth(nextWidth);
    },
    [anchor]
  );

  const handleResizeEnd = useCallback(() => {
    resizeStateRef.current = null;
    window.removeEventListener("pointermove", handleResizeMove);
    window.removeEventListener("pointerup", handleResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleResizeMove]);

  const handleResizeStart = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      resizeStateRef.current = {
        startX: event.clientX ?? 0,
        startWidth: panelWidth
      };
      window.addEventListener("pointermove", handleResizeMove);
      window.addEventListener("pointerup", handleResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [handleResizeEnd, handleResizeMove, panelWidth]
  );

  useEffect(() => () => handleResizeEnd(), [handleResizeEnd]);

  useEffect(() => {
    if (isNodeSelected && selectedNode) {
      const entries = Object.entries(selectedNode.data || {}).map(([key, value]) => ({
        key,
        value,
        type: detectType(value),
        rawValue: toDisplayString(value)
      }));
      setDataEntries(entries);
      setJsonViewRevision((prev) => prev + 1);
      setDataEntriesRevision((prev) => prev + 1);
    } else {
      setDataEntries([]);
      setJsonViewRevision((prev) => prev + 1);
      setDataEntriesRevision((prev) => prev + 1);
    }
  }, [isNodeSelected, selectedNode]);

  useEffect(() => {
    if (typeof onResize === "function") {
      onResize(panelWidth);
    }
  }, [onResize, panelWidth]);

  useEffect(() => {
    dataEntriesRef.current = dataEntries;
  }, [dataEntries]);

  useEffect(() => {
    jsonDraftRef.current = { keys: {}, values: {} };
  }, [activeSelectionId]);

  useEffect(() => {
    friendlyDraftRef.current = {};
  }, [activeSelectionId]);

  useEffect(() => {
    friendlyDraftRef.current = {};
  }, [dataEntriesRevision]);

  const nodeTypeDerivedOptions = useMemo(() => {
    const dataOptions =
      selectedNode?.data?.nodeTypeOptions ||
      selectedNode?.data?.typeOptions ||
      selectedNode?.data?.types ||
      selectedNode?.data?.typeChoices;
    if (!Array.isArray(dataOptions)) {
      return [];
    }
    return dataOptions
      .map((option) => {
        if (!option) return null;
        if (typeof option === "string") {
          return { value: option, label: option };
        }
        if (typeof option === "object" && option.value) {
          return option;
        }
        return null;
      })
      .filter(Boolean);
  }, [selectedNode]);
const availableNodeTypeOptions =
  nodeTypeDerivedOptions.length > 0 ? nodeTypeDerivedOptions : nodeTypeOptions;

  const edgeTypeOptions = useMemo(
    () =>
      Object.entries(edgeTypes).map(([value, meta]) => ({
        value,
        label: meta?.label || value,
        description: meta?.description || ""
      })),
    []
  );

  useEffect(() => {
    setStyleJsonText(JSON.stringify(selectionStyle || {}, null, 2));
  }, [selectionStyle]);

  const handleAccordionChange = useCallback(
    (view, panel) => (event, isExpanded) => {
      setExpandedSections((prev) => ({ ...prev, [view]: isExpanded ? panel : "" }));
    },
    []
  );

  const applyStylePatch = useCallback(
    (patch) => {
      const nextStyle = { ...selectionStyle, ...patch };
      if (patch.borderColor || patch.borderStyle || patch.borderWidth) {
        delete nextStyle.border;
      }
      if (isNodeSelected && selectedNode) {
        onUpdateNode(selectedNode.id, { style: nextStyle });
      } else if (isEdgeSelected && selectedEdge) {
        onUpdateEdge(selectedEdge.id, { style: nextStyle });
      }
    },
    [selectionStyle, selectedEdge, selectedNode, isEdgeSelected, isNodeSelected, onUpdateEdge, onUpdateNode]
  );

  const handlePresetChange = useCallback(
    (value) => {
      setPreset(value);
      if (!isNodeSelected || !selectedNode) return;
      const presetStyle = STYLE_PRESETS.find((option) => option.value === value)?.style || {};
      applyStylePatch(presetStyle);
    },
    [applyStylePatch, isNodeSelected, selectedNode]
  );

  const handleApplyStyleJson = useCallback(() => {
    if (!selectedNode && !selectedEdge) return;
    try {
      const parsed = JSON.parse(styleJsonText || "{}");
      applyStylePatch(parsed);
    } catch (err) {
      // ignore invalid JSON for now
    }
  }, [applyStylePatch, styleJsonText, selectedNode, selectedEdge]);

  const handleResetStyle = useCallback(() => {
    if (isNodeSelected && selectedNode) {
      onUpdateNode(selectedNode.id, { style: undefined });
    } else if (isEdgeSelected && selectedEdge) {
      onUpdateEdge(selectedEdge.id, { style: undefined });
    }
  }, [isEdgeSelected, isNodeSelected, onUpdateEdge, onUpdateNode, selectedEdge, selectedNode]);

  const handleNodeTypeChange = useCallback(
    (value) => {
      if (!isNodeSelected || !selectedNode) return;
      onUpdateNode(selectedNode.id, { type: value });
    },
    [isNodeSelected, onUpdateNode, selectedNode]
  );

  const buildDataObject = useCallback((entries) => {
    const data = {};
    entries.forEach((entry) => {
      if (entry.key) {
        data[entry.key] = entry.value;
      }
    });
    return data;
  }, []);

  const pendingPersistRef = useRef(false);
  const updateDataEntries = useCallback((updater) => {
    setDataEntries((prev) => updater(prev));
    pendingPersistRef.current = true;
  }, []);

  const updateDataEntriesLocal = useCallback((updater) => {
    setDataEntries((prev) => {
      const next = updater(prev);
      dataEntriesRef.current = next;
      return next;
    });
    pendingJsonPersistRef.current = true;
  }, []);

  useEffect(() => {
    if (!pendingPersistRef.current) return;
    pendingPersistRef.current = false;
    if (!isNodeSelected || !selectedNode) return;
    const data = buildDataObject(dataEntries);
    onUpdateNode(selectedNode.id, { data, replaceData: true });
  }, [dataEntries, isNodeSelected, selectedNode, onUpdateNode, buildDataObject]);

  const persistJsonEntries = useCallback(() => {
    if (!pendingJsonPersistRef.current) return;
    pendingJsonPersistRef.current = false;
    if (!isNodeSelected || !selectedNode) return;
    const data = buildDataObject(dataEntriesRef.current);
    onUpdateNode(selectedNode.id, { data, replaceData: true });
  }, [buildDataObject, isNodeSelected, onUpdateNode, selectedNode]);

  const handleFriendlyValueChange = useCallback(
    (index, rawValue) => {
      updateDataEntries((prev) => {
        const next = [...prev];
        const entry = next[index];
        const parsed = parseValueFromString(rawValue, entry.type);
        next[index] = {
          ...entry,
          rawValue,
          value: parsed,
          type: detectType(parsed)
        };
        return next;
      });
    },
    [updateDataEntries]
  );

  const handleFriendlyDraftChange = useCallback((index, value) => {
    friendlyDraftRef.current[index] = value;
  }, []);

  const handleFriendlyDraftBlur = useCallback(
    (index) => {
      const draftValue = friendlyDraftRef.current[index];
      if (draftValue === undefined) return;
      handleFriendlyValueChange(index, draftValue);
      delete friendlyDraftRef.current[index];
    },
    [handleFriendlyValueChange]
  );

  const handleAddJsonField = useCallback(() => {
    updateDataEntries((prev) => {
      const existingKeys = new Set(prev.map((entry) => entry.key).filter(Boolean));
      let index = 1;
      let candidate = `field${index}`;
      while (existingKeys.has(candidate)) {
        index += 1;
        candidate = `field${index}`;
      }
      return [
        ...prev,
        { key: candidate, value: "", rawValue: "", type: "string" }
      ];
    });
  }, [updateDataEntries]);

  const handleJsonKeyDraftChange = useCallback((index, value) => {
    jsonDraftRef.current.keys[index] = value;
  }, []);

  const handleJsonValueDraftChange = useCallback((index, value) => {
    jsonDraftRef.current.values[index] = value;
  }, []);

  const handleJsonDraftBlur = useCallback(
    (index) => {
      const keyDraft = jsonDraftRef.current.keys[index];
      const valueDraft = jsonDraftRef.current.values[index];
      if (keyDraft === undefined && valueDraft === undefined) return;
      updateDataEntriesLocal((prev) => {
        const next = [...prev];
        const entry = next[index];
        if (!entry) return prev;
        const nextKey = keyDraft !== undefined ? keyDraft : entry.key;
        const nextRawValue = valueDraft !== undefined ? valueDraft : entry.rawValue;
        const nextValue =
          valueDraft !== undefined ? parseValueFromString(nextRawValue, entry.type) : entry.value;
        const nextType =
          valueDraft !== undefined ? detectType(nextValue) : entry.type;
        next[index] = {
          ...entry,
          key: nextKey,
          rawValue: nextRawValue,
          value: nextValue,
          type: nextType
        };
        return next;
      });
      delete jsonDraftRef.current.keys[index];
      delete jsonDraftRef.current.values[index];
      persistJsonEntries();
    },
    [persistJsonEntries, updateDataEntriesLocal]
  );

  const handleRemoveJsonField = useCallback(
    (index) => {
      updateDataEntries((prev) => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
    },
    [updateDataEntries]
  );

  const handleToggleGroupCollapsed = useCallback(() => {
    if (!selectedGroup) return;
    onUpdateGroup(selectedGroup.id, { collapsed: !selectedGroup.collapsed });
  }, [onUpdateGroup, selectedGroup]);

  const handleToggleGroupLock = useCallback(() => {
    if (!selectedGroup) return;
    onUpdateGroup(selectedGroup.id, { locked: !selectedGroup.locked });
  }, [onUpdateGroup, selectedGroup]);

  const applyGroupStylePatch = useCallback(
    (patch) => {
      if (!selectedGroup) return;
      const nextStyle = { ...(selectedGroup.style || {}), ...patch };
      onUpdateGroup(selectedGroup.id, { style: nextStyle });
    },
    [onUpdateGroup, selectedGroup]
  );

  const renderPayloadSection = () => (
    <Section
      title="Data"
      value="data"
      expanded={expandedSections.node === "data"}
      onToggle={handleAccordionChange("node", "data")}
      disabled={!isNodeSelected}
    >
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <Button size="small" variant={payloadView === "friendly" ? "contained" : "outlined"} onClick={() => setPayloadView("friendly")}>
          Friendly view
        </Button>
        <Button size="small" variant={payloadView === "json" ? "contained" : "outlined"} onClick={() => setPayloadView("json")}>
          JSON
        </Button>
        <Tooltip title="Copy payload JSON">
          <IconButton size="small" onClick={() => copyToClipboard(payloadJson)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {payloadView === "friendly" ? (
        dataEntries.length ? (
          <Stack spacing={1}>
            {dataEntries.map((entry, index) => {
                const isMarkdownField =
                  entry.type === "string" &&
                  ((entry.key && entry.key.toLowerCase().includes("markdown")) ||
                    entry.rawValue?.includes("\n"));
                const previewMode = markdownPreviewMode[index] ?? false;
                return (
                  <Paper key={entry.key || index} variant="outlined" sx={{ p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.5}>
                      <Typography variant="subtitle2">{entry.key || "(unnamed)"}</Typography>
                      {isMarkdownField && (
                        <Stack direction="row" alignItems="center" spacing={0.25}>
                          <Typography variant="caption" color="text.secondary">
                            {previewMode ? "Preview" : "Edit"}
                          </Typography>
                          <Switch
                            size="small"
                            checked={previewMode}
                            onChange={(event) =>
                              setMarkdownPreviewMode((prev) => ({ ...prev, [index]: event.target.checked }))
                            }
                          />
                        </Stack>
                      )}
                      <Chip size="small" label={entry.type} />
                    </Stack>
                    {isMarkdownField && previewMode && (
                      <Box
                        sx={{
                          mt: 1,
                          p: 1,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          minHeight: 160,
                          maxHeight: 320,
                          overflowY: "auto",
                          bgcolor: "background.default"
                        }}
                      >
                        <MarkdownRenderer content={entry.rawValue || ""} />
                      </Box>
                    )}
                    {(!isMarkdownField || !previewMode) && (
                      <TextField
                        key={`friendly-edit-${activeSelectionId || "none"}-${dataEntriesRevision}-${index}`}
                        label="Value"
                        size="small"
                        fullWidth
                        multiline={isMarkdownField}
                        minRows={isMarkdownField ? 4 : 1}
                        defaultValue={entry.rawValue}
                        onChange={(event) => handleFriendlyDraftChange(index, event.target.value)}
                        onBlur={() => handleFriendlyDraftBlur(index)}
                      />
                    )}
                  </Paper>
                );
              })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No payload data to show.
          </Typography>
        )
      ) : (
        <Box key={`json-view-${activeSelectionId || "none"}-${jsonViewRevision}`}>
              <Paper
                variant="outlined"
                sx={{ p: 2, fontFamily: "Monospace", whiteSpace: "pre-wrap", mb: 1, maxWidth: "100%", overflowX: "auto" }}
              >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2">Serialized JSON</Typography>
              <Tooltip title="Copy current JSON">
                <IconButton size="small" onClick={() => copyToClipboard(payloadJson)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box display="flex" justifyContent="flex-end" mb={1}>
              <Button size="small" variant="outlined" onClick={handleAddJsonField}>
                Add field
              </Button>
            </Box>
              <Box component="pre" sx={{ fontFamily: "monospace", p: 0, m: 0 }}>
                {"{\n"}
                {dataEntries.map((entry, idx) => {
                  const isMarkdownField =
                    entry.type === "string" &&
                    ((entry.key && entry.key.toLowerCase().includes("markdown")) ||
                      entry.rawValue?.includes("\n"));
                  const displayKey = entry.key || (isMarkdownField ? "markdown" : "field");
                  const rawValue =
                    typeof entry.value === "string"
                      ? entry.value
                      : JSON.stringify(entry.value);
                  const previewValue = rawValue.split("\n")[0];
                  const displayValue =
                    previewValue.length > 60 ? `${previewValue.slice(0, 60)}…` : previewValue;
                  return (
                    <Box key={`json-pre-${idx}`} component="div" sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                      <Typography variant="body2" component="span">
                        "
                      </Typography>
                      <TextField
                        key={`json-key-${activeSelectionId || "none"}-${idx}`}
                        variant="standard"
                        defaultValue={entry.key}
                        placeholder={displayKey}
                        onChange={(event) => handleJsonKeyDraftChange(idx, event.target.value)}
                        onBlur={() => handleJsonDraftBlur(idx)}
                        InputProps={{
                          disableUnderline: true,
                          sx: {
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                            width: 110,
                            minWidth: 80
                          }
                        }}
                      />
                      <Typography variant="body2" component="span">
                        ": "
                      </Typography>
                      <TextField
                        key={`json-value-${activeSelectionId || "none"}-${idx}`}
                        variant="standard"
                        defaultValue={entry.rawValue}
                        placeholder={displayValue}
                        onChange={(event) => handleJsonValueDraftChange(idx, event.target.value)}
                        onBlur={() => handleJsonDraftBlur(idx)}
                        InputProps={{
                          disableUnderline: true,
                          sx: {
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                            width: 180,
                            minWidth: 100
                          }
                        }}
                      />
                      <Typography variant="body2" component="span">
                        "
                        {idx < dataEntries.length - 1 ? "," : ""}
                      </Typography>
                      <IconButton size="small" onClick={() => handleRemoveJsonField(idx)}>
                        <CloseIcon fontSize="inherit" />
                      </IconButton>
                    </Box>
                  );
                })}
                {"}"}
              </Box>
          </Paper>
        </Box>
      )}
    </Section>
  );

  const renderNodeEdgesSection = () => (
    <Section
      title="Connected edges"
      value="edges"
      expanded={expandedSections.node === "edges"}
      onToggle={handleAccordionChange("node", "edges")}
      disabled={!isNodeSelected}
    >
      {selectedNode ? (
        connectedEdges.length ? (
          <List dense>
            {connectedEdges.map((edge) => (
              <ListItem key={edge.id} divider disablePadding>
                <ListItemButton onClick={() => onSelectEdge?.(edge.id)}>
                  <ListItemText
                    primary={`${edge.label || edge.type || edge.id}`}
                    secondary={`handles ${edge.sourceHandle || "out"} → ${edge.targetHandle || "in"}`}
                  />
                </ListItemButton>
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
  );

  const renderFormattingSection = () => (
    <Section
      title="Formatting"
      value="formatting"
      expanded={expandedSections.node === "formatting"}
      onToggle={handleAccordionChange("node", "formatting")}
      disabled={!isNodeSelected}
    >
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
          <Typography variant="body2">{activeSelection ? activeSelection.label || activeSelection.id : "No selection"}</Typography>
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
  );

  const renderStyleSection = () => {
    const opacityPercent = Number.isFinite(Number(selectionStyle.opacity)) ? Math.min(Math.max(Math.round(Number(selectionStyle.opacity) * 100), 0), 100) : 100;
    return (
      <Section
        title="Style"
        value="style"
        expanded={expandedSections.node === "style"}
        onToggle={handleAccordionChange("node", "style")}
        disabled={!isNodeSelected}
      >
        <Stack spacing={1}>
          {[
            {
              label: "Background color",
              helper: "Color that fills the node canvas.",
              value: selectionStyle.background || "#ffffff",
              type: "color",
              onChange: (value) => applyStylePatch({ background: value })
            },
            {
              label: "Text color",
              helper: "Applied to node text.",
              value: selectionStyle.color || "#000000",
              type: "color",
              onChange: (value) => applyStylePatch({ color: value })
            },
            {
              label: "Border color",
              helper: "Hue of the stroke.",
              value: selectionStyle.borderColor || "#000000",
              type: "color",
              onChange: (value) => applyStylePatch({ borderColor: value })
            },
            {
              label: "Border width (px)",
              helper: "Thickness of the stroke.",
              type: "number",
              value: selectionStyle.borderWidth ?? 0,
              onChange: (value) => applyStylePatch({ borderWidth: Number(value) })
            },
            {
              label: "Border radius (px)",
              helper: "Rounded corners.",
              type: "number",
              value: selectionStyle.borderRadius ?? 0,
              onChange: (value) => applyStylePatch({ borderRadius: Number(value) })
            }
          ].map((config) => (
            <Stack key={config.label} spacing={0.5}>
              <Typography variant="caption">{config.label}</Typography>
              <TextField
                type={config.type}
                fullWidth
                size="small"
                value={config.value}
                onChange={(event) => config.onChange(event.target.value)}
                disabled={!activeSelectionId}
                sx={{ "& input": { height: 40 } }}
              />
              <Typography variant="caption" color="text.secondary">
                {config.helper}
              </Typography>
            </Stack>
          ))}
          <FormControl fullWidth size="small">
            <InputLabel>Border style</InputLabel>
            <Select
              value={selectionStyle.borderStyle || "solid"}
              label="Border style"
              onChange={(event) => applyStylePatch({ borderStyle: event.target.value })}
              disabled={!activeSelectionId}
            >
              {["solid", "dashed", "dotted", "double", "groove"].map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Font weight</InputLabel>
            <Select
              value={selectionStyle.fontWeight || "normal"}
              label="Font weight"
              onChange={(event) => applyStylePatch({ fontWeight: event.target.value })}
              disabled={!activeSelectionId}
            >
              {["normal", "bold", "bolder", "lighter"].map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Font size"
            placeholder="e.g. 14px"
            fullWidth
            size="small"
            value={selectionStyle.fontSize || ""}
            onChange={(event) => applyStylePatch({ fontSize: event.target.value })}
            disabled={!activeSelectionId}
          />
          <TextField
            label="Box shadow"
            placeholder="e.g. 0px 4px 16px rgba(0,0,0,0.2)"
            fullWidth
            size="small"
            value={selectionStyle.boxShadow || ""}
            onChange={(event) => applyStylePatch({ boxShadow: event.target.value })}
            disabled={!activeSelectionId}
          />
          <Box>
            <Typography variant="subtitle2">Opacity</Typography>
            <Slider
              value={opacityPercent}
              min={0}
              max={100}
              onChange={(_, value) => {
                if (Array.isArray(value)) return;
                applyStylePatch({ opacity: Number(value) / 100 });
              }}
              disabled={!activeSelectionId}
            />
          </Box>
          <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Button size="small" variant="outlined" onClick={() => setStyleJsonText(JSON.stringify(selectionStyle || {}, null, 2))} disabled={!activeSelectionId}>
              Sync JSON
            </Button>
            <Button size="small" variant="outlined" onClick={handleApplyStyleJson} disabled={!activeSelectionId}>
              Apply JSON
            </Button>
            <Button size="small" variant="outlined" onClick={handleResetStyle} disabled={!activeSelectionId}>
              Reset style
            </Button>
          </Box>
        </Stack>
      </Section>
    );
  };

  const renderNodeView = () => (
    <>
      {renderPayloadSection()}
      {availableNodeTypeOptions.length > 0 && isNodeSelected && (
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="properties-node-type-label">Node Type</InputLabel>
            <Select
              labelId="properties-node-type-label"
              label="Node Type"
              value={selectedType}
              onChange={(event) => handleNodeTypeChange(event.target.value)}
            >
              {availableNodeTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label || option.value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}
      {renderNodeEdgesSection()}
      {renderFormattingSection()}
      {renderStyleSection()}
    </>
  );

  const renderEdgeView = () => (
    <>
          <Section
            title="Edge details"
            value="details"
            expanded={expandedSections.edge === "details"}
            onToggle={handleAccordionChange("edge", "details")}
            disabled={!isEdgeSelected}
          >
            <Stack spacing={1}>
              <FormControl fullWidth size="small">
                <InputLabel id="properties-edge-type-label">Edge type</InputLabel>
                <Select
                  labelId="properties-edge-type-label"
                  label="Edge type"
                  value={selectedEdge?.type || ""}
                  onChange={(event) => selectedEdge && onUpdateEdge(selectedEdge.id, { type: event.target.value })}
                >
                  {edgeTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2">{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption">Connection</Typography>
              <Typography variant="body2">
                {edgeSourceNode?.label || edgeSourceNode?.id || selectedEdge?.source} →{" "}
                {edgeTargetNode?.label || edgeTargetNode?.id || selectedEdge?.target}
              </Typography>
          <Typography variant="caption">Handles</Typography>
          <Typography variant="body2">
            {selectedEdge?.sourceHandle || "out"} → {selectedEdge?.targetHandle || "in"}
          </Typography>
          <TextField
            label="Label"
            size="small"
            fullWidth
            value={selectedEdge?.label || ""}
            onChange={(event) => selectedEdge && onUpdateEdge(selectedEdge.id, { label: event.target.value })}
          />
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="text" onClick={() => onSelectEdge?.(selectedEdge.id)}>
              Focus edge
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                if (edgeSourceNode) onSelectNode?.(edgeSourceNode.id);
              }}
            >
              Focus source
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                if (edgeTargetNode) onSelectNode?.(edgeTargetNode.id);
              }}
            >
              Focus target
            </Button>
          </Stack>
        </Stack>
      </Section>
      <Section
        title="Connected nodes"
        value="nodes"
        expanded={expandedSections.edge === "nodes"}
        onToggle={handleAccordionChange("edge", "nodes")}
        disabled={!isEdgeSelected}
      >
        {edgeConnectedNodes.length ? (
          <List dense>
            {edgeConnectedNodes.map(({ role, node }) => (
              <ListItem key={node.id} disablePadding divider>
                <ListItemButton onClick={() => onSelectNode?.(node.id)}>
                  <ListItemText primary={node.label || node.id} secondary={role} />
                </ListItemButton>
                <ListItemSecondaryAction>
                  <Chip label={role} size="small" />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No nodes associated with this edge.
          </Typography>
        )}
      </Section>
    </>
  );

  const renderGroupView = () => (
    <>
      <Section
        title="Group details"
        value="details"
        expanded={expandedSections.group === "details"}
        onToggle={handleAccordionChange("group", "details")}
        disabled={!isGroupSelected}
      >
        <Stack spacing={1}>
          <Typography variant="caption">Members</Typography>
          <Typography variant="body2">{selectedGroup?.nodeIds?.length || 0} nodes</Typography>
          <Typography variant="caption">Collapsed</Typography>
          <Typography variant="body2">{selectedGroup?.collapsed ? "Yes" : "No"}</Typography>
          <Typography variant="caption">Locked</Typography>
          <Typography variant="body2">{selectedGroup?.locked ? "Locked" : "Unlocked"}</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={handleToggleGroupCollapsed}>
              Toggle collapse
            </Button>
            <Button size="small" variant="outlined" onClick={handleToggleGroupLock}>
              Toggle lock
            </Button>
          </Stack>
        </Stack>
      </Section>
      <Section
        title="Members"
        value="members"
        expanded={expandedSections.group === "members"}
        onToggle={handleAccordionChange("group", "members")}
        disabled={!isGroupSelected}
      >
        {groupMemberNodes.length ? (
          <List dense>
            {groupMemberNodes.map((node) => (
              <ListItem key={node.id} divider disablePadding>
                <ListItemButton onClick={() => onSelectNode?.(node.id)}>
                  <ListItemText
                    primary={
                      node.label ||
                      node.data?.label ||
                      (node.type ? `${node.type}` : `Node ${node.id}`) ||
                      `Node ${node.id}`
                    }
                    secondary={
                      node.type
                        ? `${node.type} · ${node.id}`
                        : node.id
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No nodes in this group.
          </Typography>
        )}
      </Section>
      <Section
        title="Style"
        value="style"
        expanded={expandedSections.group === "style"}
        onToggle={handleAccordionChange("group", "style")}
        disabled={!isGroupSelected}
      >
        <Stack spacing={1}>
          <TextField
            label="Background color"
            size="small"
            fullWidth
            value={selectionStyle.backgroundColor || ""}
            onChange={(event) => applyGroupStylePatch({ backgroundColor: event.target.value })}
          />
          <TextField
            label="Border color"
            size="small"
            fullWidth
            value={selectionStyle.borderColor || ""}
            onChange={(event) => applyGroupStylePatch({ borderColor: event.target.value })}
          />
        </Stack>
      </Section>
    </>
  );

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      variant="persistent"
      ModalProps={{ keepMounted: true }}
      BackdropProps={{ invisible: true }}
      PaperProps={{
        sx: {
          width: panelWidth,
          position: "relative",
          height: "100vh"
        }
      }}
    >
      <Box
        onPointerDown={handleResizeStart}
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: 8,
          cursor: "col-resize",
          zIndex: 2,
          ...(anchor === "right" ? { left: 0 } : { right: 0 }),
          "&:hover": { backgroundColor: "action.hover" }
        }}
      />
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          bgcolor: "background.paper",
          p: 2
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h6">{selectionLabel}</Typography>
            {activeSelectionId && (
              <Typography variant="caption" color="text.secondary">
                {activeSelectionId}
              </Typography>
            )}
          </Box>
          <Chip size="small" label={selectionType} sx={{ textTransform: "capitalize" }} />
          <IconButton onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ flex: "1 1 auto", overflowY: "auto" }}>
          {activeView === "node" && renderNodeView()}
          {activeView === "edge" && renderEdgeView()}
          {activeView === "group" && renderGroupView()}
          {!activeView && (
            <Typography variant="body2" color="text.secondary">
              Select a node, edge, or group to see its properties.
            </Typography>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

function Section({ title, children, expanded = false, onToggle = () => {}, disabled = false }) {
  return (
    <Accordion expanded={expanded} onChange={onToggle} disabled={disabled} disableGutters sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ padding: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}
