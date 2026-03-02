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
  Tab,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Checkbox,
  FormControlLabel
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import EditIcon from "@mui/icons-material/Edit";
import * as Icons from "@mui/icons-material";
import eventBus from "../../NodeGraph/eventBus";
import useAvailableNodeTypes from "../hooks/useAvailableNodeTypes";
import { validateDictionaryAgainstNodeClassContract } from "../utils/nodeClassContract";

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
  const [scripts, setScripts] = useState([]);
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [scriptName, setScriptName] = useState("");
  const [scriptTags, setScriptTags] = useState("");
  const [scriptRef, setScriptRef] = useState("");
  const [scriptSource, setScriptSource] = useState("");
  const [runningScript, setRunningScript] = useState(false);
  const [scriptResult, setScriptResult] = useState(null);
  const [legendExpanded, setLegendExpanded] = useState({});
  const [quickTypeKey, setQuickTypeKey] = useState("");
  const [quickTypeRef, setQuickTypeRef] = useState("");
  const [quickTypeSource, setQuickTypeSource] = useState("github");
  const [quickTypeVersion, setQuickTypeVersion] = useState(">=0.1.0");
  const [quickIncludeNodeView, setQuickIncludeNodeView] = useState(true);
  const [quickIncludeEditorView, setQuickIncludeEditorView] = useState(true);
  const resizeStateRef = useRef(null);
  const validationErrors = Array.isArray(validationReport?.errors) ? validationReport.errors : [];
  const validationWarnings = Array.isArray(validationReport?.warnings) ? validationReport.warnings : [];
  const totalIssues = validationErrors.length + validationWarnings.length;
  const { nodeTypeList } = useAvailableNodeTypes();

  const nodeTypeMetaByType = useMemo(() => {
    const map = new Map();
    (nodeTypeList || []).forEach((meta) => {
      const type = String(meta?.type || "").trim();
      if (!type) return;
      map.set(type, meta);
    });
    return map;
  }, [nodeTypeList]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readScripts = () => {
      try {
        const raw = window.localStorage.getItem("scripts");
        const parsed = raw ? JSON.parse(raw) : [];
        const next = Array.isArray(parsed) ? parsed : [];
        setScripts(next);
        if (!next.length) {
          setSelectedScriptId("");
          return;
        }
        setSelectedScriptId((prev) => (prev && next.some((item) => item?.id === prev) ? prev : next[0].id));
      } catch {
        setScripts([]);
        setSelectedScriptId("");
      }
    };
    readScripts();
    const onStorage = (event) => {
      if (event?.key === "scripts") readScripts();
    };
    const onScriptsChanged = () => readScripts();
    window.addEventListener("storage", onStorage);
    eventBus.on("scriptsChanged", onScriptsChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      eventBus.off("scriptsChanged", onScriptsChanged);
    };
  }, []);

  useEffect(() => {
    const selected = scripts.find((item) => item?.id === selectedScriptId) || null;
    setScriptName(selected?.name || "");
    setScriptTags(selected?.tags || "");
    setScriptRef(selected?.ref || "");
    setScriptSource(selected?.source || "");
  }, [scripts, selectedScriptId]);

  const persistScripts = (nextScripts) => {
    setScripts(nextScripts);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("scripts", JSON.stringify(nextScripts));
      }
    } catch {}
    eventBus.emit("scriptsChanged", { count: nextScripts.length });
  };

  const normalizeScriptRefUrl = (ref) => {
    if (!ref || typeof ref !== "string") return null;
    const trimmed = ref.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.startsWith("local://")) {
      const localPath = trimmed.slice("local://".length).trim();
      if (!localPath) return null;
      return localPath.startsWith("/") ? localPath : `/${localPath}`;
    }
    if (trimmed.startsWith("/")) return trimmed;
    return `/${trimmed.replace(/^\/+/, "")}`;
  };

  const normalizeDefinitionRef = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return { ref: "", sourceHint: "" };
    if (raw.startsWith("github://")) return { ref: raw, sourceHint: "github" };
    try {
      const url = new URL(raw);
      const host = (url.hostname || "").toLowerCase();
      const parts = url.pathname.split("/").filter(Boolean);
      // github.com/{owner}/{repo}/blob/{branch}/{path...}
      if (host === "github.com" && parts.length >= 5 && parts[2] === "blob") {
        const owner = parts[0];
        const repo = parts[1];
        const path = parts.slice(4).join("/");
        return { ref: `github://${owner}/${repo}/${path}`, sourceHint: "github" };
      }
      // raw.githubusercontent.com/{owner}/{repo}/{branch}/{path...}
      if (host === "raw.githubusercontent.com" && parts.length >= 4) {
        const owner = parts[0];
        const repo = parts[1];
        const path = parts.slice(3).join("/");
        return { ref: `github://${owner}/${repo}/${path}`, sourceHint: "github" };
      }
    } catch {
      // non-URL refs are valid as-is (local path / relative path)
    }
    return { ref: raw, sourceHint: "" };
  };

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
    if (!legendNode) {
      setLegendEntries([]);
      return;
    }
    const entries = Array.isArray(legendNode?.data?.entries) ? legendNode.data.entries : [];
    setLegendEntries(entries.map((entry) => ({
      key: entry?.key || "",
      intent: entry?.intent || "",
      implementation: entry?.implementation || "",
      dictionaryKey: entry?.dictionaryKey || ""
    })));
  }, [legendNode?.id]);

  useEffect(() => {
    if (!dictionaryNode) {
      setDictionaryNodeDefs([]);
      setDictionaryViews([]);
      return;
    }
    const nodeDefs = Array.isArray(dictionaryNode?.data?.nodeDefs) ? dictionaryNode.data.nodeDefs : [];
    const views = Array.isArray(dictionaryNode?.data?.views) ? dictionaryNode.data.views : [];
    setDictionaryNodeDefs(nodeDefs.map((entry) => ({
      key: entry?.key || "",
      ref: entry?.ref || "",
      source: entry?.source || "",
      version: entry?.version || "",
      legendVisible: entry?.legend?.visible !== false
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
    if (!legendNode) {
      setError("No explicit Legend node found. Legend is currently derived from Dictionary.");
      return;
    }
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
        version: String(entry?.version || "").trim(),
        legend: {
          visible: entry?.legendVisible !== false
        }
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
    const contractErrors = validateDictionaryAgainstNodeClassContract(nextNodeDefs, nextViews);
    if (contractErrors.length) {
      setError(`Dictionary NodeClass contract validation failed: ${contractErrors[0]}${contractErrors.length > 1 ? ` (+${contractErrors.length - 1} more)` : ""}`);
      return;
    }
    const nextData = {
      ...(dictionaryNode.data || {}),
      nodeDefs: nextNodeDefs,
      views: nextViews
    };
    onUpdateNode(dictionaryNode.id, { data: nextData }, { replaceData: true });
    setError("");
  };

  const addLegendEntry = () => {
    setLegendEntries((prev) => [...prev, { key: "", intent: "", implementation: "", dictionaryKey: "" }]);
  };

  const updateLegendOverrideByLookup = (lookupKey, patch) => {
    const safeLookup = String(lookupKey || "").trim();
    if (!safeLookup) return;
    setLegendEntries((prev) => {
      const idx = prev.findIndex((entry) => String(entry?.dictionaryKey || entry?.key || "").trim() === safeLookup);
      if (idx >= 0) {
        return prev.map((entry, i) => (i === idx ? { ...entry, ...patch } : entry));
      }
      return [...prev, { key: safeLookup, dictionaryKey: safeLookup, intent: "", implementation: "node", ...patch }];
    });
  };

  const handleSpawnLegendNode = (entry) => {
    const typeKey = String(entry?.dictionaryKey || entry?.key || "").trim();
    if (!typeKey) {
      setError("Legend entry needs a key or dictionaryKey to add a node.");
      return;
    }
    setError("");
    eventBus.emit("addNode", { type: typeKey });
  };

  const getIconComponent = (iconName) => {
    if (!iconName || typeof iconName !== "string") return Icons.Extension;
    return Icons[iconName] || Icons.Extension;
  };

  const updateNodeDefEntry = (index, patch) => {
    setDictionaryNodeDefs((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };
  const removeNodeDefEntry = (index) => {
    setDictionaryNodeDefs((prev) => prev.filter((_, i) => i !== index));
  };
  const addNodeDefEntry = () => {
    setDictionaryNodeDefs((prev) => [...prev, { key: "", ref: "", source: "", version: "", legendVisible: true }]);
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

  const handleQuickAddNodeType = () => {
    const key = String(quickTypeKey || "").trim();
    const normalized = normalizeDefinitionRef(quickTypeRef);
    const ref = normalized.ref;
    const resolvedSource = normalized.sourceHint || quickTypeSource;
    if (!key || !ref) {
      setError("Quick add requires both key and ref.");
      return;
    }

    const nodeDefExists = dictionaryNodeDefs.some((entry) => String(entry?.key || "").trim() === key);
    const nextNodeDefs = nodeDefExists
      ? dictionaryNodeDefs
      : [...dictionaryNodeDefs, { key, ref, source: resolvedSource, version: quickTypeVersion, legendVisible: true }];

    const hasView = (intent, payload) => dictionaryViews.some((entry) => (
      String(entry?.key || "").trim() === key &&
      String(entry?.intent || "").trim() === intent &&
      String(entry?.payload || "").trim() === payload
    ));

    const nextViews = [...dictionaryViews];
    if (quickIncludeNodeView && !hasView("node", "node.web")) {
      nextViews.push({ key, intent: "node", payload: "node.web", ref, source: resolvedSource, version: quickTypeVersion });
    }
    if (quickIncludeEditorView && !hasView("editor", "editor.web")) {
      nextViews.push({ key, intent: "editor", payload: "editor.web", ref, source: resolvedSource, version: quickTypeVersion });
    }

    setDictionaryNodeDefs(nextNodeDefs);
    setDictionaryViews(nextViews);
    if (normalized.ref !== String(quickTypeRef || "").trim()) {
      setQuickTypeRef(normalized.ref);
    }
    if (normalized.sourceHint && normalized.sourceHint !== quickTypeSource) {
      setQuickTypeSource(normalized.sourceHint);
    }

    if (dictionaryNode?.id) {
      onUpdateNode(
        dictionaryNode.id,
        {
          data: {
            ...(dictionaryNode.data || {}),
            nodeDefs: nextNodeDefs,
            views: nextViews
          }
        },
        { replaceData: true }
      );
    }
    setError("");
  };

  const effectiveLegendEntries = useMemo(() => {
    const explicitEntries = Array.isArray(legendEntries) ? legendEntries : [];
    const explicitByLookup = new Map();
    explicitEntries.forEach((entry) => {
      const lookup = String(entry?.dictionaryKey || entry?.key || "").trim();
      if (!lookup) return;
      explicitByLookup.set(lookup, entry);
    });

    const dictionaryKeys = new Set();
    const derived = (Array.isArray(dictionaryNodeDefs) ? dictionaryNodeDefs : [])
      .filter((entry) => entry?.legendVisible !== false)
      .map((entry) => {
        const key = String(entry?.key || "").trim();
        if (!key) return null;
        dictionaryKeys.add(key);
        const override = explicitByLookup.get(key);
        return {
          key: String(override?.key || key),
          dictionaryKey: key,
          intent: String(override?.intent || ""),
          implementation: String(override?.implementation || "node"),
          _lookupKey: key,
          _derived: true
        };
      })
      .filter(Boolean);

    const extras = explicitEntries
      .map((entry) => {
        const lookup = String(entry?.dictionaryKey || entry?.key || "").trim();
        if (!lookup || dictionaryKeys.has(lookup)) return null;
        return {
          key: String(entry?.key || ""),
          dictionaryKey: String(entry?.dictionaryKey || ""),
          intent: String(entry?.intent || ""),
          implementation: String(entry?.implementation || ""),
          _lookupKey: lookup,
          _derived: false
        };
      })
      .filter(Boolean);

    return [...derived, ...extras];
  }, [dictionaryNodeDefs, legendEntries]);

  const handleCreateScript = () => {
    const id = `script_${Date.now()}`;
    const next = [
      {
        id,
        name: "New Script",
        tags: "",
        ref: "",
        source: ""
      },
      ...scripts
    ];
    persistScripts(next);
    setSelectedScriptId(id);
  };

  const handleSaveScript = () => {
    if (!selectedScriptId) return;
    const next = scripts.map((item) => (
      item.id === selectedScriptId
        ? { ...item, name: scriptName || "Untitled", tags: scriptTags, ref: scriptRef, source: scriptSource }
        : item
    ));
    persistScripts(next);
  };

  const handleDeleteScript = () => {
    if (!selectedScriptId) return;
    const next = scripts.filter((item) => item.id !== selectedScriptId);
    persistScripts(next);
    setSelectedScriptId(next[0]?.id || "");
  };

  const handleRunScript = async () => {
    if (typeof window === "undefined" || !window.__scriptRunner) {
      setScriptResult({ success: false, error: "Script runner not available" });
      return;
    }
    setRunningScript(true);
    setScriptResult(null);
    try {
      let sourceForRun = scriptSource;
      if (!sourceForRun.trim() && scriptRef.trim()) {
        const url = normalizeScriptRefUrl(scriptRef);
        if (!url) throw new Error("Invalid script ref");
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`Failed to load script ref: ${url} (${response.status})`);
        sourceForRun = await response.text();
      }
      if (!sourceForRun.trim()) throw new Error("Script source is empty");
      const res = await window.__scriptRunner.run(sourceForRun, { dry: false, allowMutations: true });
      setScriptResult(res);
    } catch (err) {
      setScriptResult({ success: false, error: String(err) });
    } finally {
      setRunningScript(false);
    }
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
        aria-label="Resize Legend panel"
      />
      <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Legend</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Manifest, Legend, Dictionary, Scripts, and validation
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
            <Tab value="scripts" label="Scripts" />
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
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">Legend</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {effectiveLegendEntries.length} entries
                  </Typography>
                </Stack>
                {effectiveLegendEntries.map((entry, index) => (
                  <Paper key={`legend-${index}`} variant="outlined" sx={{ p: 0.75 }}>
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.5}>
                        {(() => {
                          const key = String(entry?.dictionaryKey || entry?.key || "").trim();
                          const meta = key ? nodeTypeMetaByType.get(key) : null;
                          const Icon = getIconComponent(meta?.icon);
                          return (
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                              <Icon sx={{ fontSize: 16 }} />
                              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                                {String(entry?.key || "").trim() || `Entry ${index + 1}`}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ ml: 0.5, lineHeight: 1.3, position: "relative", top: "2px" }}
                              >
                                {String(entry?.intent || "").trim() || "No intent"}
                              </Typography>
                            </Stack>
                          );
                        })()}
                        <Tooltip title="Add node from this legend entry">
                          <IconButton size="small" onClick={() => handleSpawnLegendNode(entry)}>
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit entry">
                          <IconButton
                            size="small"
                            onClick={() => setLegendExpanded((prev) => ({ ...prev, [index]: !prev[index] }))}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      {legendExpanded[index] ? (
                        <>
                          <Stack direction={{ xs: "column", md: "row" }} spacing={0.75}>
                            <TextField size="small" label="key" value={entry.key} onChange={(e) => updateLegendOverrideByLookup(entry?._lookupKey, { key: e.target.value })} />
                            <TextField size="small" label="dictionaryKey" value={entry.dictionaryKey} onChange={(e) => updateLegendOverrideByLookup(entry?._lookupKey, { dictionaryKey: e.target.value })} />
                          </Stack>
                          <Stack direction={{ xs: "column", md: "row" }} spacing={0.75}>
                            <TextField size="small" label="intent" value={entry.intent} onChange={(e) => updateLegendOverrideByLookup(entry?._lookupKey, { intent: e.target.value })} />
                            <TextField size="small" label="implementation" value={entry.implementation} onChange={(e) => updateLegendOverrideByLookup(entry?._lookupKey, { implementation: e.target.value })} />
                          </Stack>
                        </>
                      ) : null}
                    </Stack>
                  </Paper>
                ))}
                <Stack direction="row" spacing={1}>
                  <Button variant="text" size="small" startIcon={<AddIcon />} onClick={addLegendEntry}>Add Legend Entry</Button>
                  <Button variant="outlined" size="small" onClick={applyLegend}>Apply Legend</Button>
                </Stack>
              </Stack>
            ) : null}

            {selectedSection === "dictionary" ? (
              <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: 1 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Quick Add Node Type</Typography>
                    <TextField size="small" label="key" value={quickTypeKey} onChange={(e) => setQuickTypeKey(e.target.value)} />
                    <TextField size="small" label="ref" value={quickTypeRef} onChange={(e) => setQuickTypeRef(e.target.value)} placeholder="github://owner/repo/file.node-class.node" />
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <TextField size="small" label="source" value={quickTypeSource} onChange={(e) => setQuickTypeSource(e.target.value)} />
                      <TextField size="small" label="version" value={quickTypeVersion} onChange={(e) => setQuickTypeVersion(e.target.value)} />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant={quickIncludeNodeView ? "contained" : "outlined"}
                        size="small"
                        onClick={() => setQuickIncludeNodeView((prev) => !prev)}
                      >
                        node.web
                      </Button>
                      <Button
                        variant={quickIncludeEditorView ? "contained" : "outlined"}
                        size="small"
                        onClick={() => setQuickIncludeEditorView((prev) => !prev)}
                      >
                        editor.web
                      </Button>
                      <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleQuickAddNodeType}>
                        Add Type
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>

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
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={entry.legendVisible !== false}
                            onChange={(e) => updateNodeDefEntry(index, { legendVisible: e.target.checked })}
                          />
                        }
                        label="Show in legend"
                      />
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
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" size="small" onClick={applyDictionary}>Apply Dictionary</Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => eventBus.emit("refreshDefinitions")}
                  >
                    Refresh Definitions
                  </Button>
                </Stack>
              </Stack>
            ) : null}

            {selectedSection === "scripts" ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Scripts</Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ minHeight: 420 }}>
                  <Paper variant="outlined" sx={{ width: { xs: "100%", md: 240 }, display: "flex", flexDirection: "column", minHeight: 280 }}>
                    <Box sx={{ p: 1 }}>
                      <Button fullWidth size="small" variant="contained" startIcon={<AddIcon />} onClick={handleCreateScript}>
                        New Script
                      </Button>
                    </Box>
                    <Divider />
                    <List dense sx={{ p: 0, overflowY: "auto", flex: 1 }}>
                      {scripts.length === 0 ? (
                        <Box sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">No scripts yet.</Typography>
                        </Box>
                      ) : scripts.map((item) => (
                        <ListItemButton key={item.id} selected={item.id === selectedScriptId} onClick={() => setSelectedScriptId(item.id)}>
                          <ListItemText primary={item.name || item.id} secondary={item.tags || ""} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>

                  <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                    {!selectedScriptId ? (
                      <Alert severity="info" variant="outlined">Select or create a script.</Alert>
                    ) : (
                      <>
                        <TextField size="small" label="Script Name" value={scriptName} onChange={(e) => setScriptName(e.target.value)} />
                        <TextField size="small" label="Tags" value={scriptTags} onChange={(e) => setScriptTags(e.target.value)} />
                        <TextField size="small" label="Script Ref (optional)" value={scriptRef} onChange={(e) => setScriptRef(e.target.value)} placeholder="/scripts/my-script.js or https://..." />
                        <TextField
                          label="Script Source"
                          multiline
                          minRows={10}
                          value={scriptSource}
                          onChange={(e) => setScriptSource(e.target.value)}
                          placeholder="Optional if Script Ref is provided"
                          sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.85rem" } }}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button variant="contained" size="small" startIcon={<PlayArrowIcon />} onClick={handleRunScript} disabled={runningScript || (!scriptSource.trim() && !scriptRef.trim())}>
                            {runningScript ? "Running..." : "Run"}
                          </Button>
                          <Button variant="outlined" size="small" onClick={handleSaveScript} disabled={!scriptSource.trim() && !scriptRef.trim()}>
                            Save
                          </Button>
                          <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />} onClick={handleDeleteScript}>
                            Delete
                          </Button>
                        </Stack>
                        {scriptResult ? (
                          <Alert severity={scriptResult?.success === false ? "error" : "success"} variant="outlined">
                            <Typography variant="body2">
                              {scriptResult?.success === false ? (scriptResult?.error || "Script error") : "Script executed"}
                            </Typography>
                          </Alert>
                        ) : null}
                      </>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            ) : null}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
