"use client";

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { Snackbar, Alert, Backdrop, CircularProgress, Menu, MenuItem, Drawer, Box, IconButton, Typography, Button } from '@mui/material';
import GraphRendererAdapter from './renderers/GraphRendererAdapter';
import Toolbar from './components/Toolbar';
import MobileFabToolbar from './components/MobileFabToolbar';
import MobileAddNodeSheet from './components/MobileAddNodeSheet';
import PropertiesPanel from './components/PropertiesPanel';
import SystemNodesPanel from './components/SystemNodesPanel';
import NodePalettePanel from './components/NodePalettePanel';
import DocumentPropertiesDialog from './components/DocumentPropertiesDialog';
import NewTabPage from './components/NewTabPage';
import ScriptRunner from './Scripting/ScriptRunner';
import BackgroundFrame from './components/BackgroundFrame';
import EdgeTypes from './edgeTypes';
import EntitiesPanel from './components/EntitiesPanel';
import DynamicViewNode from './Nodes/DynamicViewNode';
import eventBus from '../NodeGraph/eventBus';
import { loadSettings } from './settingsManager';
import { createThemeFromConfig } from './utils/themeUtils';
import {
  createDefaultManifestNode,
  createDefaultLegendNode,
  createDefaultDictionaryNode
} from './utils/systemNodeDefaults';

const DEFINITION_CACHE_TTL_MS = 5 * 60 * 1000;
import {
  useGraphEditorStateContext,
  useGraphEditorLayoutContext,
  useGraphEditorServicesContext,
  useGraphEditorHistoryContext,
  useGraphEditorRpcContext
} from './providers/GraphEditorContext';
import useIntentEmitter from './hooks/useIntentEmitter';
import { summarizeContracts } from './contracts/contractManager';
import { validateGraphInvariants } from './validators/validateGraphInvariants';
import { shouldShowInTypeSelectors } from './constants/nodeTypeSelectorConfig';
import { validateDictionaryAgainstNodeClassContract } from './utils/nodeClassContract';
import { endpointToUrl } from './utils/portEndpoint';

const DENSITY_OPTIONS = ['comfortable', 'compact', 'dense'];
const normalizeUiDensity = (value) => (DENSITY_OPTIONS.includes(value) ? value : 'comfortable');
const PANEL_WIDTHS_BY_DENSITY = {
  comfortable: { entities: 320, layout: 380, properties: 420, system: 760 },
  compact: { entities: 290, layout: 350, properties: 380, system: 680 },
  dense: { entities: 260, layout: 320, properties: 340, system: 620 }
};

const postHostMessage = (payload) => {
  if (typeof window === 'undefined') return;
  if (typeof window.__Twilite_POST_MESSAGE__ === 'function') {
    window.__Twilite_POST_MESSAGE__(payload);
    return;
  }
  try {
    window.parent?.postMessage(payload, '*');
  } catch {}
};

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const deepMergeData = (base, patch) => {
  if (!isPlainObject(base)) {
    if (!isPlainObject(patch)) return patch;
    return Object.keys(patch).reduce((acc, key) => {
      acc[key] = deepMergeData(undefined, patch[key]);
      return acc;
    }, {});
  }
  if (!isPlainObject(patch)) return patch;
  const out = { ...base };
  Object.keys(patch).forEach((key) => {
    const prev = out[key];
    const next = patch[key];
    if (isPlainObject(prev) && isPlainObject(next)) {
      out[key] = deepMergeData(prev, next);
      return;
    }
    out[key] = next;
  });
  return out;
};

const GraphEditorContent = () => {
  const theme = useTheme();
  const state = useGraphEditorStateContext();
  const layout = useGraphEditorLayoutContext();
  const services = useGraphEditorServicesContext();
  const historyHook = useGraphEditorHistoryContext();
  const rpc = useGraphEditorRpcContext();
  const isEmbedded = typeof window !== 'undefined' && window.__Twilite_EMBED__ === true;
  const host = typeof window !== 'undefined'
    ? (window.__Twilite_HOST__ || new URLSearchParams(window.location.search).get('host') || 'browser')
    : 'browser';
  const [propertiesPanelWidth, setPropertiesPanelWidth] = useState(PANEL_WIDTHS_BY_DENSITY.comfortable.properties);
  const [systemNodesPanelWidth, setSystemNodesPanelWidth] = useState(PANEL_WIDTHS_BY_DENSITY.comfortable.system);
  const [nodeContextMenu, setNodeContextMenu] = useState(null);
  const [nodeEditorPanel, setNodeEditorPanel] = useState({ open: false, nodeId: null });
  const [nodeEditorDirty, setNodeEditorDirty] = useState({ nodeId: null, dirty: false });
  const [nodeEditorCommitPending, setNodeEditorCommitPending] = useState(false);
  const [nodeEditorCommitError, setNodeEditorCommitError] = useState(null);
  const [viewDefinitions, setViewDefinitions] = useState({});
  const viewDefinitionsRef = useRef({});
  const isDraggingRef = useRef(false);
  const nodeEditorCommitTargetRef = useRef(null);

  const {
    nodes,
    setNodes,
    nodesRef,
    edges,
    setEdges,
    edgesRef,
    groups,
    setGroups,
    loadGraph,
    pan,
    setPan,
    zoom,
    setZoom,
    selectedNodeIds,
    setSelectedNodeIds,
    focusedNodeId,
    setFocusedNodeId,
    focusedFragmentId,
    interactionMode,
    setInteractionMode,
    selectedEdgeIds,
    setSelectedEdgeIds,
    selectedGroupIds,
    setSelectedGroupIds,
    hoveredEdgeId,
    setHoveredEdgeId,
    hoveredNodeId,
    snackbar,
    setSnackbar,
    manifestStatus,
    loading,
    nodePanelAnchor,
    defaultNodeColor,
    defaultEdgeColor,
    edgeRoutes,
    setEdgeRoutes,
    groupManager
  } = state || {};

  const {
    showMinimap,
    snapToGrid,
    setSnapToGrid,
    showGrid,
    lockedNodes,
    setLockedNodes,
    lockedEdges,
    setLockedEdges,
    showAllEdgeLabels,
    showEdgePanel,
    setShowEdgePanel,
    showPropertiesPanel,
    setShowPropertiesPanel,
    showSystemNodesPanel,
    setShowSystemNodesPanel,
    graphRenderKey,
    mobileAddNodeOpen,
    mobileAddNodeSearch,
    setMobileAddNodeSearch,
    memoAutoExpandToken,
    documentSettings,
    setDocumentSettings,
    documentTheme,
    documentBackgroundImage,
    projectMeta,
    backgroundUrl,
    setBackgroundUrl,
    backgroundInteractive,
    showDocumentPropertiesDialog,
    setShowDocumentPropertiesDialog,
    showNodePalette,
    setShowNodePalette,
    showNodeList,
    setShowNodeList,
    showGroupList,
    setShowGroupList,
    showEdgeList,
    setShowEdgeList,
    showEntitiesPanel,
    setShowEntitiesPanel,
    entityView,
    setEntityView,
    handleOpenDocumentProperties,
    handleOpenMobileAddNode,
    handleCloseMobileAddNode,
    togglePropertiesPanel,
    toggleSystemNodesPanel,
    toggleNodePalette,
    toggleNodeList,
    toggleGroupList,
    toggleEdgeList,
    handlePropertiesPanelAnchorChange,
    graphStats,
    recentSnapshots,
    storySnapshots,
    handleUpdateProjectMeta,
    handleResetProjectMeta,
    isMobile,
    isSmallScreen,
    isPortrait,
    isLandscape,
    addressBarHeight,
    backgroundImage,
    isFreeUser
  } = layout || {};

  const panelAnchor = nodePanelAnchor || "left";
  const entitiesAnchor = "right";
  const normalizedUiDensity = normalizeUiDensity(documentSettings?.uiDensity);
  const panelWidths = PANEL_WIDTHS_BY_DENSITY[normalizedUiDensity] || PANEL_WIDTHS_BY_DENSITY.comfortable;

  const {
    handlers,
    graphAPI,
    graphCRUD,
    handleLoadGraph,
    handleFitToNodes,
    handleAlignSelection,
    handleDistributeSelection,
    modesHook,
    nodeTypes,
    nodeTypeMetadata,
    handleScriptRequest,
    scriptDiagnostics
  } = services || {};

  const { emitEdgeIntent } = useIntentEmitter();

  const {
    bgRef,
    handleHandshakeComplete
  } = rpc || {};

  const [editorThemeConfig, setEditorThemeConfig] = useState(null);
  const [editorWatermarkEnabled, setEditorWatermarkEnabled] = useState(true);
  const [editorWatermarkStrength, setEditorWatermarkStrength] = useState(100);
  const [editorFocusIndicatorEnabled, setEditorFocusIndicatorEnabled] = useState(false);
  const [hostLoadReady, setHostLoadReady] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (window.__Twilite_HOST__ !== 'vscode' || !window.__Twilite_EMBED__) return true;
    return Boolean(window.__Twilite_HOST_GRAPH_READY__) && !Boolean(window.__Twilite_WAITING_FOR_FULL_TEXT__);
  });
  const [documentAccess, setDocumentAccess] = useState(() => ({
    writable: true,
    mode: 'writable',
    sourceType: host === 'vscode' ? 'vscode-document' : 'session',
    target: host === 'vscode' ? 'Active VS Code document' : 'Current session'
  }));
  const readOnlyNoticeShownRef = useRef(false);

  useEffect(() => {
    setPropertiesPanelWidth(panelWidths.properties);
    setSystemNodesPanelWidth(panelWidths.system);
    eventBus.emit('uiDensityChanged', { uiDensity: normalizedUiDensity });
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('twilite.uiDensity', normalizedUiDensity);
      }
    } catch {}
  }, [normalizedUiDensity, panelWidths.properties, panelWidths.system]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const settings = loadSettings();
    setEditorWatermarkEnabled(settings?.watermarkEnabled !== false);
    setEditorWatermarkStrength(
      typeof settings?.watermarkStrength === 'number'
        ? Math.max(0, Math.min(100, settings.watermarkStrength))
        : 100
    );
    setEditorFocusIndicatorEnabled(settings?.showFocusIndicator === true);
    if (host !== 'vscode') return;
    if (settings?.theme) {
      setEditorThemeConfig(settings.theme);
    }
  }, [host]);

  useEffect(() => {
    if (host !== 'vscode') {
      setDocumentAccess({
        writable: true,
        mode: 'writable',
        sourceType: 'session',
        target: 'Current session'
      });
      return;
    }
    setDocumentAccess({
      writable: true,
      mode: 'writable',
      sourceType: 'vscode-document',
      target: 'Active VS Code document'
    });
  }, [host]);

  useEffect(() => {
    const handleAccessChange = (payload = {}) => {
      if (host === 'vscode' && payload?.writable === false) {
        // In plugin local-file mode we keep editing writable; navigation is already restricted.
        return;
      }
      setDocumentAccess((prev) => ({
        ...prev,
        ...payload,
        writable: payload.writable ?? prev.writable,
        mode: payload.mode || (payload.writable === false ? 'read-only' : 'writable')
      }));
      if (payload.writable !== false) {
        readOnlyNoticeShownRef.current = false;
      }
    };
    const handleAccessPromoteWritable = () => {
      setDocumentAccess((prev) => ({
        ...prev,
        writable: true,
        mode: 'writable',
        target: 'Active VS Code document'
      }));
      readOnlyNoticeShownRef.current = false;
      if (typeof setSnackbar === 'function') {
        setSnackbar({
          open: true,
          message: 'Save target rebound to the active VS Code document.',
          severity: 'info'
        });
      }
    };
    eventBus.on('documentAccessChanged', handleAccessChange);
    eventBus.on('documentAccessPromoteWritable', handleAccessPromoteWritable);
    return () => {
      eventBus.off('documentAccessChanged', handleAccessChange);
      eventBus.off('documentAccessPromoteWritable', handleAccessPromoteWritable);
    };
  }, [host, setSnackbar]);

  useEffect(() => {
    if (host !== 'vscode') return;
    if (documentAccess?.writable) return;
    const events = [
      'nodeAdded',
      'nodeUpdated',
      'nodeDeleted',
      'edgeAdded',
      'edgeUpdated',
      'edgeDeleted',
      'groupAdded',
      'groupUpdated',
      'groupDeleted'
    ];
    const notifyReadOnly = () => {
      if (readOnlyNoticeShownRef.current) return;
      readOnlyNoticeShownRef.current = true;
      if (typeof setSnackbar === 'function') {
        setSnackbar({
          open: true,
          message: 'Read-only graph: changes will not save until you bind a save target.',
          severity: 'warning'
        });
      }
    };
    events.forEach((eventName) => eventBus.on(eventName, notifyReadOnly));
    return () => {
      events.forEach((eventName) => eventBus.off(eventName, notifyReadOnly));
    };
  }, [documentAccess?.writable, host, setSnackbar]);

  const mergeThemeConfigs = useCallback((baseConfig, overrideConfig) => {
    if (!baseConfig && !overrideConfig) return null;
    if (!baseConfig) return overrideConfig;
    if (!overrideConfig) return baseConfig;
    return {
      ...baseConfig,
      ...overrideConfig,
      primary: { ...(baseConfig.primary || {}), ...(overrideConfig.primary || {}) },
      secondary: { ...(baseConfig.secondary || {}), ...(overrideConfig.secondary || {}) },
      background: { ...(baseConfig.background || {}), ...(overrideConfig.background || {}) },
      text: { ...(baseConfig.text || {}), ...(overrideConfig.text || {}) },
      divider: overrideConfig.divider ?? baseConfig.divider,
      mode: overrideConfig.mode ?? baseConfig.mode
    };
  }, []);

  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const memoizedEdges = useMemo(() => edges, [edges]);
  const memoizedGroups = useMemo(() => groups, [groups]);
  const memoizedSelectedNodeIds = useMemo(() => selectedNodeIds, [selectedNodeIds]);
  const memoizedSelectedEdgeIds = useMemo(() => selectedEdgeIds, [selectedEdgeIds]);
  const memoizedSelectedGroupIds = useMemo(() => selectedGroupIds, [selectedGroupIds]);

  const memoizedSetNodes = useCallback(setNodes, [setNodes]);
  const memoizedSetEdges = useCallback(setEdges, [setEdges]);
  const memoizedSetGroups = useCallback(setGroups, [setGroups]);
  const memoizedSetSelectedNodeIds = useCallback(setSelectedNodeIds, [setSelectedNodeIds]);
  const memoizedSetSelectedEdgeIds = useCallback(setSelectedEdgeIds, [setSelectedEdgeIds]);
  const memoizedSetPan = useCallback(setPan, [setPan]);
  const memoizedSetZoom = useCallback(setZoom, [setZoom]);

  const handleEdgeRoutingChange = useCallback((value) => {
    emitEdgeIntent('edgeRoutingChange', { value });
    if (typeof setDocumentSettings === 'function') {
      setDocumentSettings((prev) => ({ ...prev, edgeRouting: value }));
    }
  }, [emitEdgeIntent, setDocumentSettings]);

  const handleRerouteEdges = useCallback(() => {
    emitEdgeIntent('toolbarReroute');
  }, [emitEdgeIntent]);

  const handleApplyLayout = useCallback((layoutType) => {
    const resolvedLayoutType = layoutType || modesHook.autoLayoutType;
    emitEdgeIntent('applyLayout', { layoutType: resolvedLayoutType });
    modesHook.applyAutoLayout(resolvedLayoutType);
  }, [emitEdgeIntent, modesHook.applyAutoLayout, modesHook.autoLayoutType]);

  const handleInteractionModeChange = useCallback((nextMode) => {
    const normalized = String(nextMode || '').trim().toLowerCase();
    if (normalized !== 'browse' && normalized !== 'edit') return;
    setInteractionMode?.(normalized);
    try {
      eventBus.emit('setInteractionMode', { mode: normalized, source: 'toolbar' });
    } catch {
      // ignore event bus errors
    }
  }, [setInteractionMode]);

  const effectiveThemeConfig = useMemo(() => {
    return mergeThemeConfigs(editorThemeConfig, documentTheme || null);
  }, [mergeThemeConfigs, editorThemeConfig, documentTheme]);

  const documentMuiTheme = useMemo(() => {
    if (effectiveThemeConfig) {
      return createThemeFromConfig(effectiveThemeConfig);
    }
    return null;
  }, [effectiveThemeConfig]);

  const contractSummary = useMemo(
    () => summarizeContracts({ nodes, edges, documentSettings }),
    [nodes, edges, documentSettings]
  );
  const nodeTypeOptions = useMemo(() => {
    if (Array.isArray(nodeTypeMetadata) && nodeTypeMetadata.length) {
      return nodeTypeMetadata
        .filter((meta) => shouldShowInTypeSelectors(meta?.type))
        .map((meta) => ({
        value: meta.type,
        label: meta.label || meta.type
      }));
    }
    if (nodeTypes && typeof nodeTypes === "object") {
      return Object.keys(nodeTypes)
        .filter((type) => shouldShowInTypeSelectors(type))
        .map((type) => ({ value: type, label: type }));
    }
    return [];
  }, [nodeTypeMetadata, nodeTypes]);

  useEffect(() => {
    viewDefinitionsRef.current = viewDefinitions;
  }, [viewDefinitions]);

  const [resolvedDictionary, setResolvedDictionary] = useState(null);
  const [dictionaryContractIssues, setDictionaryContractIssues] = useState([]);
  const [definitionsRefreshToken, setDefinitionsRefreshToken] = useState(0);
  const definitionDictionaryCacheRef = useRef({});
  const invariantReport = useMemo(() => {
    const base = validateGraphInvariants({
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
      edgeRoutes: edgeRoutes && typeof edgeRoutes === 'object' ? edgeRoutes : {},
      clusters: Array.isArray(groups) ? groups : [],
      mode: 'load',
      resolvedDictionary
    });
    const warnings = Array.isArray(base?.warnings) ? [...base.warnings] : [];
    (Array.isArray(dictionaryContractIssues) ? dictionaryContractIssues : []).forEach((message) => {
      warnings.push({
        code: 'NODECLASS_CONTRACT',
        message
      });
    });
    const runtimeErrors = [];
    const runtimeWarnings = [];
    (Array.isArray(scriptDiagnostics) ? scriptDiagnostics : []).forEach((issue) => {
      const entry = {
        code: issue?.code || 'SCRIPT_RUNTIME',
        message: issue?.message || 'Script error',
        nodeId: issue?.nodeId || undefined,
        edgeId: issue?.edgeId || undefined,
        groupId: issue?.groupId || undefined
      };
      if (issue?.severity === 'warning') runtimeWarnings.push(entry);
      else runtimeErrors.push(entry);
    });
    return {
      ...base,
      errors: [...(Array.isArray(base?.errors) ? base.errors : []), ...runtimeErrors],
      warnings: [...warnings, ...runtimeWarnings]
    };
  }, [nodes, edges, edgeRoutes, groups, resolvedDictionary, dictionaryContractIssues, scriptDiagnostics]);

  const resolvePublicPath = useCallback((ref) => {
    if (!ref || typeof ref !== 'string') return null;
    if (ref.startsWith('/')) return ref;
    // Treat bare workspace-style paths as public-relative.
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref)) {
      return `/${ref.replace(/^\/+/, '')}`;
    }
    try {
      const parsed = new URL(ref);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const isSameOrigin = origin && parsed.origin === origin;
      const isWebviewScheme = parsed.protocol === 'vscode-webview:' || parsed.protocol === 'vscode-resource:';
      const isTwiliteHost =
        parsed.protocol.startsWith('http') &&
        ['twilite.zone', 'www.twilite.zone'].includes((parsed.hostname || '').toLowerCase());
      if ((isSameOrigin || isWebviewScheme || isTwiliteHost) && parsed.pathname) {
        return parsed.pathname;
      }
    } catch {}
    return null;
  }, []);

  const parseGithubRef = useCallback((ref) => {
    if (typeof ref !== 'string' || !ref.startsWith('github://')) return null;
    const raw = ref.slice('github://'.length);
    const [owner = '', repo = '', ...pathParts] = raw.split('/');
    if (!owner || !repo) return null;
    let path = pathParts.join('/').replace(/^\/+/, '');
    if (!path || path.endsWith('/')) {
      path = `${path}root.node`.replace(/^\/+/, '');
    }
    return { owner, repo, path };
  }, []);

  const fetchGithubRefText = useCallback(async ({ owner, repo, path, branch }) => {
    const token = (() => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return '';
        return window.localStorage.getItem('githubPat') || '';
      } catch {
        return '';
      }
    })();
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }
    const safePath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}?ref=${encodeURIComponent(branch)}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || `GitHub HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload || payload.type !== 'file' || !payload.content) {
      throw new Error('GitHub response did not include file content.');
    }
    const decoded = typeof window !== 'undefined'
      ? decodeURIComponent(escape(window.atob(String(payload.content).replace(/\n/g, ''))))
      : '';
    return decoded;
  }, []);

  const readFileViaHost = useCallback((refPath) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (window.__Twilite_HOST__ !== 'vscode') return Promise.resolve(null);
    if (typeof window.__Twilite_POST_MESSAGE__ !== 'function') return Promise.resolve(null);
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const normalized = String(refPath || '').replace(/^\/+/, '');
    return new Promise((resolve) => {
      let finished = false;
      const timeoutId = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        window.removeEventListener('Twilite-readFile', handler);
        resolve({ text: '', error: 'timeout' });
      }, 3000);
      const handler = (event) => {
        const detail = event?.detail;
        if (!detail || detail.requestId !== requestId) return;
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener('Twilite-readFile', handler);
        resolve(detail);
      };
      window.addEventListener('Twilite-readFile', handler);
      window.__Twilite_POST_MESSAGE__({
        type: 'readFile',
        requestId,
        path: normalized
      });
    });
  }, []);

  const fetchRefText = useCallback(async (ref) => {
    const githubRef = parseGithubRef(ref);
    if (githubRef) {
      const branch = (documentSettings?.github?.branch || 'main').trim() || 'main';
      return fetchGithubRefText({ ...githubRef, branch });
    }

    const publicPath = resolvePublicPath(ref);
    if (publicPath) {
      const hostResult = await readFileViaHost(publicPath);
      if (hostResult && !hostResult.error) {
        return hostResult.text || '';
      }
    }

    const response = await fetch(ref);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  }, [parseGithubRef, documentSettings?.github?.branch, fetchGithubRefText, resolvePublicPath, readFileViaHost]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__Twilite_HOST__ !== 'vscode') return;
    if (window.__Twilite_fetchPatched__) return;
    if (typeof window.fetch !== 'function') return;

    const originalFetch = window.fetch.bind(window);
    window.__Twilite_fetchPatched__ = true;
    window.__Twilite_fetchOriginal__ = originalFetch;

    window.fetch = async (input, init) => {
      const urlStr = typeof input === 'string' ? input : input?.url;
    const publicPath = resolvePublicPath(urlStr);
      if (!publicPath) {
        return originalFetch(input, init);
      }
      const hostResult = await readFileViaHost(publicPath);
      if (hostResult && !hostResult.error) {
        return new Response(hostResult.text || '', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      return new Response('', { status: 404 });
    };

    return () => {
      if (window.__Twilite_fetchOriginal__) {
        window.fetch = window.__Twilite_fetchOriginal__;
        window.__Twilite_fetchPatched__ = false;
      }
    };
  }, [readFileViaHost, resolvePublicPath]);

  const getDictionaryEntryKey = useCallback((entry) => {
    if (!entry) return null;
    const baseKey = entry.key || entry.nodeType || entry.type || entry.view || null;
    if (!baseKey) return null;
    const intent = entry.intent || '';
    const payload = entry.payload || entry.view || '';
    if (intent || payload) {
      return `${baseKey}::${intent}::${payload}`;
    }
    return baseKey;
  }, []);

  const mergeDictionaryEntries = useCallback((hostEntries = [], importedEntries = []) => {
    const merged = new Map();
    importedEntries.forEach((entry) => {
      const key = getDictionaryEntryKey(entry);
      if (!key) return;
      merged.set(key, entry);
    });
    hostEntries.forEach((entry) => {
      const key = getDictionaryEntryKey(entry);
      if (!key) return;
      merged.set(key, entry);
    });
    return Array.from(merged.values());
  }, [getDictionaryEntryKey]);

  const normalizeDefinitionRef = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('github://')) {
      const withoutScheme = raw.slice('github://'.length);
      const parts = withoutScheme.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const [owner, repo, ...pathParts] = parts;
        const path = pathParts.length ? pathParts.join('/') : 'root.node';
        return `github://${owner}/${repo}/${path}`;
      }
      return raw;
    }
    if (raw.startsWith('local://')) {
      const localPath = raw.slice('local://'.length).trim();
      if (!localPath) return '';
      return localPath.startsWith('/') ? localPath : `/${localPath}`;
    }
    try {
      const parsed = new URL(raw);
      const host = (parsed.hostname || '').toLowerCase();
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (host === 'github.com' && parts.length >= 5 && parts[2] === 'blob') {
        return `github://${parts[0]}/${parts[1]}/${parts.slice(4).join('/')}`;
      }
      if (host === 'raw.githubusercontent.com' && parts.length >= 4) {
        return `github://${parts[0]}/${parts[1]}/${parts.slice(3).join('/')}`;
      }
      return raw;
    } catch {
      // non-URL
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
    return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
  }, []);

  const inferSourceFromRef = useCallback((ref) => {
    const normalized = String(ref || '').trim();
    if (!normalized) return 'external';
    if (normalized.startsWith('github://')) return 'github';
    if (normalized.startsWith('tlz://')) return 'tlz';
    if (normalized.startsWith('http://')) return 'http';
    if (normalized.startsWith('https://')) return 'https';
    if (normalized.startsWith('/')) return 'local';
    return 'external';
  }, []);

  const normalizeDictionaryNodeDef = useCallback((entry) => {
    const key = String(entry?.key || entry?.nodeType || entry?.type || '').trim();
    const ref = normalizeDefinitionRef(entry?.ref || entry?.path || entry?.file || '');
    const source = String(entry?.source || '').trim() || inferSourceFromRef(ref);
    const version = String(entry?.version || '').trim();
    return { ...entry, key, ref, source, version };
  }, [inferSourceFromRef, normalizeDefinitionRef]);

  const normalizeDictionaryView = useCallback((entry, nodeDefByKey) => {
    const key = String(entry?.key || entry?.nodeType || entry?.type || '').trim();
    const fallbackNodeDef = key ? nodeDefByKey.get(key) : null;
    const intent = String(entry?.intent || '').trim();
    const payload = String(entry?.payload || entry?.view || '').trim();
    const ref = normalizeDefinitionRef(entry?.ref || entry?.path || entry?.file || fallbackNodeDef?.ref || '');
    const source = String(entry?.source || '').trim() || fallbackNodeDef?.source || inferSourceFromRef(ref);
    const version = String(entry?.version || '').trim() || String(fallbackNodeDef?.version || '').trim();
    return {
      ...entry,
      key,
      intent: intent || (payload === 'editor.web' ? 'editor' : 'node'),
      payload: payload || (intent === 'editor' ? 'editor.web' : 'node.web'),
      ref,
      source,
      version
    };
  }, [inferSourceFromRef, normalizeDefinitionRef]);

  const normalizeResolvedDictionaryData = useCallback((data = {}) => {
    const normalizedNodeDefs = (Array.isArray(data?.nodeDefs) ? data.nodeDefs : [])
      .map((entry) => normalizeDictionaryNodeDef(entry))
      .filter((entry) => entry.key);
    const nodeDefByKey = new Map();
    normalizedNodeDefs.forEach((entry) => {
      if (!nodeDefByKey.has(entry.key)) nodeDefByKey.set(entry.key, entry);
    });
    const normalizedViews = (Array.isArray(data?.views) ? data.views : [])
      .map((entry) => normalizeDictionaryView(entry, nodeDefByKey))
      .filter((entry) => entry.key);
    return {
      ...data,
      nodeDefs: normalizedNodeDefs,
      views: normalizedViews
    };
  }, [normalizeDictionaryNodeDef, normalizeDictionaryView]);

  const getExpansionScopeKey = useCallback((node) => {
    if (!node || typeof node !== 'object') return '';
    return String(
      node?.data?._expansion?.expansionId ||
      node?.data?._origin?.instanceId ||
      ''
    ).trim();
  }, []);

  const semanticScopeState = useMemo(() => {
    const nodesList = Array.isArray(nodes) ? nodes : [];
    const edgesList = Array.isArray(edges) ? edges : [];
    const nodeById = new Map(nodesList.map((node) => [node?.id, node]));
    const adjacency = new Map();
    const ensureScope = (scope) => {
      const key = String(scope || '').trim();
      if (!adjacency.has(key)) adjacency.set(key, new Set());
      return key;
    };
    ensureScope('');
    edgesList.forEach((edge) => {
      if (edge?.type !== 'expands-to') return;
      const sourceNode = nodeById.get(edge?.source);
      const targetNode = nodeById.get(edge?.target);
      const sourceScope = ensureScope(getExpansionScopeKey(sourceNode));
      const targetScope = ensureScope(getExpansionScopeKey(targetNode));
      if (sourceScope === targetScope) return;
      adjacency.get(sourceScope).add(targetScope);
      adjacency.get(targetScope).add(sourceScope);
    });

    const activeFocusedNodeId = focusedNodeId || null;
    const focusedNode = activeFocusedNodeId ? nodeById.get(activeFocusedNodeId) || null : null;
    const focusedScope = getExpansionScopeKey(focusedNode);
    const scopeDepth = new Map([[focusedScope, 0]]);
    const queue = [focusedScope];
    while (queue.length > 0) {
      const current = queue.shift();
      const currentDepth = scopeDepth.get(current) || 0;
      if (currentDepth >= 2) continue;
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      neighbors.forEach((neighbor) => {
        if (scopeDepth.has(neighbor)) return;
        scopeDepth.set(neighbor, currentDepth + 1);
        queue.push(neighbor);
      });
    }

    return {
      focusedNodeId: activeFocusedNodeId,
      focusedScope,
      scopeDepth
    };
  }, [nodes, edges, focusedNodeId, getExpansionScopeKey]);

  const getNodeSemanticLevel = useCallback((node) => {
    const scopeKey = getExpansionScopeKey(node);
    const depth = semanticScopeState.scopeDepth.get(scopeKey);
    if (depth === 0) return 'detail';
    if (depth === 1) return 'summary';
    if (depth >= 2) return 'icon';
    return 'icon';
  }, [getExpansionScopeKey, semanticScopeState.scopeDepth]);

  const isEdgeInSemanticBullseye = useCallback((edge) => {
    if (!edge || !Array.isArray(nodes)) return false;
    const sourceNode = nodes.find((node) => node?.id === edge?.source) || null;
    const targetNode = nodes.find((node) => node?.id === edge?.target) || null;
    if (!sourceNode || !targetNode) return false;
    const sourceScope = getExpansionScopeKey(sourceNode);
    const targetScope = getExpansionScopeKey(targetNode);
    const sourceDepth = semanticScopeState.scopeDepth.get(sourceScope);
    const targetDepth = semanticScopeState.scopeDepth.get(targetScope);
    return sourceDepth === 0 && targetDepth === 0;
  }, [getExpansionScopeKey, nodes, semanticScopeState.scopeDepth]);

  const isScopedDictionaryNode = useCallback((node) => {
    if (!node || node.type !== 'dictionary') return false;
    return node?.data?._contextScope?.dictionaryScope === 'scoped-fallback';
  }, []);

  const buildScopedDictionaryForNode = useCallback((node, hostDictionary) => {
    const scopeKey = getExpansionScopeKey(node);
    if (!scopeKey || !Array.isArray(nodes)) return hostDictionary || null;
    const scopeDepth = semanticScopeState.scopeDepth.get(scopeKey);
    if (scopeDepth !== 0 && scopeDepth !== 1 && scopeDepth !== 2) {
      return hostDictionary || null;
    }
    const scopedDictionaryNode = nodes.find((candidate) => {
      if (candidate?.type !== 'dictionary') return false;
      if (!isScopedDictionaryNode(candidate)) return false;
      return getExpansionScopeKey(candidate) === scopeKey;
    }) || null;
    if (!scopedDictionaryNode) return hostDictionary || null;

    const hostData = normalizeResolvedDictionaryData(hostDictionary?.data || {});
    const scopedData = normalizeResolvedDictionaryData(scopedDictionaryNode?.data || {});
    const mergedNodeDefs = mergeDictionaryEntries(
      Array.isArray(hostData.nodeDefs) ? hostData.nodeDefs : [],
      Array.isArray(scopedData.nodeDefs) ? scopedData.nodeDefs : []
    );
    const mergedViews = mergeDictionaryEntries(
      Array.isArray(hostData.views) ? hostData.views : [],
      Array.isArray(scopedData.views) ? scopedData.views : []
    );
    const mergedSkills = mergeDictionaryEntries(
      Array.isArray(hostData.skills) ? hostData.skills : [],
      Array.isArray(scopedData.skills) ? scopedData.skills : []
    );

    return {
      ...scopedDictionaryNode,
      data: {
        ...hostData,
        ...scopedData,
        nodeDefs: mergedNodeDefs,
        views: mergedViews,
        skills: mergedSkills,
        _contextScope: {
          ...(hostData._contextScope || {}),
          ...(scopedData._contextScope || {}),
          dictionaryScope: 'scoped-fallback',
          scopeKey,
          ringDepth: scopeDepth ?? null
        }
      }
    };
  }, [getExpansionScopeKey, isScopedDictionaryNode, mergeDictionaryEntries, nodes, normalizeResolvedDictionaryData, semanticScopeState.scopeDepth]);

  const implicitManifestRef = useRef(null);
  const implicitLegendRef = useRef(null);
  const implicitDictionaryRef = useRef(null);
  if (!implicitManifestRef.current) {
    implicitManifestRef.current = createDefaultManifestNode({ kind: 'fragment' });
  }
  if (!implicitLegendRef.current) {
    implicitLegendRef.current = createDefaultLegendNode();
  }
  if (!implicitDictionaryRef.current) {
    implicitDictionaryRef.current = createDefaultDictionaryNode();
  }

  const resolveDictionaryForNode = useCallback((node) => {
    if (!node || !Array.isArray(nodes)) return null;
    const clusterList = Array.isArray(groups) ? groups : [];
    const nodeClusterId = clusterList.find((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(node.id))?.id || null;
    const dictionaryInCluster = nodeClusterId
      ? nodes.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate) && clusterList.some((cluster) => cluster.id === nodeClusterId && Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)))
      : null;
    const rootDictionary = nodes.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate) && !clusterList.some((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)));
    const hostDictionary = (
      resolvedDictionary ||
      dictionaryInCluster ||
      rootDictionary ||
      nodes.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate)) ||
      implicitDictionaryRef.current
    );
    return buildScopedDictionaryForNode(node, hostDictionary);
  }, [nodes, groups, resolvedDictionary, isScopedDictionaryNode, buildScopedDictionaryForNode]);

  useEffect(() => {
    const handleRefreshDefinitions = () => {
      definitionDictionaryCacheRef.current = {};
      setViewDefinitions({});
      setDefinitionsRefreshToken((value) => value + 1);
      try {
        setSnackbar({
          open: true,
          message: 'Definition cache cleared. Reloading dictionary/view refs...',
          severity: 'info'
        });
      } catch {}
    };
    eventBus.on('refreshDefinitions', handleRefreshDefinitions);
    return () => {
      eventBus.off('refreshDefinitions', handleRefreshDefinitions);
    };
  }, [setSnackbar]);

  useEffect(() => {
    let active = true;
    const hostDictionary = (() => {
      if (!Array.isArray(nodes)) return null;
      const clusterList = Array.isArray(groups) ? groups : [];
      const manifestNode = nodes.find((candidate) => candidate?.type === 'manifest');
      const manifestClusterId = manifestNode
        ? clusterList.find((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(manifestNode.id))?.id || null
        : null;
      const dictionaryInManifestCluster = manifestClusterId
        ? nodes.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate) && clusterList.some((cluster) => cluster.id === manifestClusterId && Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)))
        : null;
      const rootDictionary = nodes.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate) && !clusterList.some((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)));
      return (
        dictionaryInManifestCluster ||
        rootDictionary ||
        nodes.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate)) ||
        implicitDictionaryRef.current
      );
    })();

    if (!hostDictionary) {
      setResolvedDictionary(null);
      setDictionaryContractIssues([]);
      return undefined;
    }

    const hostData = hostDictionary.data || {};
    const hostNodeDefs = (Array.isArray(hostData.nodeDefs) ? hostData.nodeDefs : [])
      .map((entry) => normalizeDictionaryNodeDef(entry))
      .filter((entry) => entry.key);
    const nodeDefByKey = new Map();
    hostNodeDefs.forEach((entry) => {
      if (!nodeDefByKey.has(entry.key)) nodeDefByKey.set(entry.key, entry);
    });
    const hostViews = (Array.isArray(hostData.views) ? hostData.views : [])
      .map((entry) => normalizeDictionaryView(entry, nodeDefByKey))
      .filter((entry) => entry.key);
    const hostSkills = Array.isArray(hostData.skills) ? hostData.skills : [];

    const refs = hostNodeDefs
      .map((entry) => entry?.ref)
      .filter(Boolean);

    const loadDefinitions = async () => {
      const importedNodeDefs = [];
      const importedViews = [];
      const importedSkills = [];
      const warnings = [];
      for (const ref of refs) {
        if (!ref) continue;
        const cached = definitionDictionaryCacheRef.current[ref];
        const isFresh =
          cached &&
          typeof cached.loadedAt === 'number' &&
          Date.now() - cached.loadedAt < DEFINITION_CACHE_TTL_MS;
        if (!isFresh) {
          try {
            const text = await fetchRefText(ref);
            const parsed = JSON.parse(text);
            const parsedNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
            const dictNode = parsedNodes.find((candidate) => candidate?.type === 'dictionary') || null;
            const requiresDictionary = parsedNodes
              .filter((candidate) => candidate?.type === 'manifest')
              .some((manifest) => manifest?.data?.requiresDictionary === true);
            definitionDictionaryCacheRef.current[ref] = {
              loadedAt: Date.now(),
              data: dictNode?.data || null
            };
            if (!dictNode && requiresDictionary) {
              warnings.push(`Definition graph declares dictionary requirement but has none in ${ref}`);
            }
          } catch (err) {
            definitionDictionaryCacheRef.current[ref] = {
              loadedAt: Date.now(),
              data: null
            };
            warnings.push(`Failed to load ${ref}`);
          }
        }
        const dictData = definitionDictionaryCacheRef.current[ref]?.data || null;
        if (!dictData) continue;
        if (Array.isArray(dictData.nodeDefs)) importedNodeDefs.push(...dictData.nodeDefs);
        if (Array.isArray(dictData.views)) importedViews.push(...dictData.views);
        if (Array.isArray(dictData.skills)) importedSkills.push(...dictData.skills);
      }

      if (!active) return;
      const mergedNodeDefs = mergeDictionaryEntries(hostNodeDefs, importedNodeDefs);
      const mergedViews = mergeDictionaryEntries(hostViews, importedViews);
      const mergedSkills = mergeDictionaryEntries(hostSkills, importedSkills);
      const normalizedData = normalizeResolvedDictionaryData({
        ...hostData,
        nodeDefs: mergedNodeDefs,
        views: mergedViews,
        skills: mergedSkills
      });
      const contractIssues = validateDictionaryAgainstNodeClassContract(
        normalizedData.nodeDefs,
        normalizedData.views
      );
      setDictionaryContractIssues(contractIssues);
      setResolvedDictionary({
        ...hostDictionary,
        data: normalizedData
      });

      const combinedWarnings = [
        ...warnings,
        ...(contractIssues.length ? [
          `NodeClass contract: ${contractIssues[0]}${contractIssues.length > 1 ? ` (+${contractIssues.length - 1} more)` : ''}`
        ] : [])
      ];

      if (combinedWarnings.length > 0) {
        try {
          setSnackbar((prev) => ({
            ...prev,
            open: true,
            message: `Dictionary load: ${combinedWarnings[0]}${combinedWarnings.length > 1 ? ` (+${combinedWarnings.length - 1} more)` : ''}`,
            severity: 'warning'
          }));
        } catch (err) {
          // ignore snackbar failures
        }
      }
    };

    loadDefinitions();
    return () => {
      active = false;
    };
  }, [nodes, groups, mergeDictionaryEntries, fetchRefText, definitionsRefreshToken, normalizeResolvedDictionaryData, normalizeDictionaryNodeDef, normalizeDictionaryView, isScopedDictionaryNode]);

  useEffect(() => {
    try {
      eventBus.emit('dictionaryResolved', { dictionary: resolvedDictionary || null });
    } catch (err) {
      // ignore event bus errors
    }
  }, [resolvedDictionary]);

  useEffect(() => {
    const handleDictionaryRequest = () => {
      try {
        eventBus.emit('dictionaryResolved', { dictionary: resolvedDictionary || null });
      } catch (err) {
        // ignore event bus errors
      }
    };
    eventBus.on('dictionaryRequest', handleDictionaryRequest);
    return () => {
      eventBus.off('dictionaryRequest', handleDictionaryRequest);
    };
  }, [resolvedDictionary]);

  const resolveNodeClassContract = useCallback((node) => {
    if (!node) return null;
    const dictionary = resolveDictionaryForNode(node);
    const dictionaryData = normalizeResolvedDictionaryData(dictionary?.data || {});
    const nodeDefs = Array.isArray(dictionaryData.nodeDefs) ? dictionaryData.nodeDefs : [];
    const views = Array.isArray(dictionaryData.views) ? dictionaryData.views : [];
    const lookupKey = String(node?.data?.dictionaryKey || node?.data?.definitionKey || node?.type || '').trim();
    if (!lookupKey) return null;
    const semanticLevel = getNodeSemanticLevel(node);

    const nodeDef = nodeDefs.find((entry) => {
      const key = String(entry?.key || entry?.nodeType || entry?.type || '').trim();
      return key === lookupKey;
    }) || null;

    const matchingViews = views.filter((entry) => {
      const key = String(entry?.key || entry?.nodeType || entry?.type || '').trim();
      return key === lookupKey;
    });
    const normalizeViewEntryRef = (entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const ref = String(entry?.ref || '').trim();
      if (ref) return entry;
      const source = String(entry?.source || '').trim();
      if (!source) return entry;
      return { ...entry, ref: source };
    };
    const normalizedMatchingViews = matchingViews.map(normalizeViewEntryRef);

    const preferredPayloads =
      semanticLevel === 'icon'
        ? ['node.web.icon', 'icon.web', 'node.web.summary', 'summary.web', 'node.web.detail', 'node.web']
        : semanticLevel === 'summary'
        ? ['node.web.summary', 'summary.web', 'node.web.detail', 'node.web', 'node.web.icon', 'icon.web']
        : ['node.web.detail', 'node.web', 'node.web.summary', 'summary.web', 'node.web.icon', 'icon.web'];

    let nodeView = null;
    for (const preferredPayload of preferredPayloads) {
      nodeView = normalizedMatchingViews.find((entry) => {
        const intent = String(entry?.intent || '').trim();
        const payload = String(entry?.payload || entry?.view || '').trim();
        if (payload === preferredPayload) return true;
        if (preferredPayload === 'node.web' && intent === 'node' && !payload) return true;
        return false;
      }) || null;
      if (nodeView) break;
    }

    if (!nodeView) {
      nodeView = normalizedMatchingViews.find((entry) => String(entry?.intent || '').trim() === 'node') || null;
    }

    nodeView = nodeView || (nodeDef?.ref ? {
      key: lookupKey,
      intent: 'node',
      payload: 'node.web',
      ref: String(nodeDef.ref || '').trim(),
      source: String(nodeDef.source || inferSourceFromRef(nodeDef.ref)).trim(),
      version: String(nodeDef.version || '').trim()
    } : null);

    const editorView = normalizedMatchingViews.find((entry) => {
      const intent = String(entry?.intent || '').trim();
      const payload = String(entry?.payload || entry?.view || '').trim();
      return intent === 'editor' || payload === 'editor.web';
    }) || null;

    return {
      key: lookupKey,
      nodeDef,
      views: normalizedMatchingViews,
      nodeView,
      editorView,
      semanticLevel
    };
  }, [resolveDictionaryForNode, normalizeResolvedDictionaryData, inferSourceFromRef, getNodeSemanticLevel]);

  const lifecycleRunningRef = useRef(new Set());
  const lifecycleLastRunRef = useRef(new Map());
  const lifecycleLoadedRef = useRef(new Set());

  const resolveLifecycleHookSpec = useCallback((nodeDef, hookName) => {
    if (!nodeDef || !hookName) return null;
    const lifecycle = nodeDef?.lifecycle && typeof nodeDef.lifecycle === 'object' ? nodeDef.lifecycle : {};
    const hooks = lifecycle?.hooks && typeof lifecycle.hooks === 'object'
      ? lifecycle.hooks
      : (nodeDef?.hooks && typeof nodeDef.hooks === 'object' ? nodeDef.hooks : {});
    const raw = hooks?.[hookName] ?? lifecycle?.[hookName] ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') {
      return {
        kind: 'script',
        ref: raw.trim(),
        timeoutMs: 2000
      };
    }
    if (typeof raw === 'object') {
      const kind = String(raw.kind || 'script').trim().toLowerCase();
      const ref = String(raw.ref || raw.id || '').trim();
      const timeoutMs = Number(raw.timeoutMs);
      return {
        kind: kind || 'script',
        ref,
        timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000
      };
    }
    return null;
  }, []);

  const loadScriptLibrary = useCallback(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem('scripts');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const resolveLifecycleScriptSource = useCallback(async (hookSpec) => {
    if (!hookSpec?.ref) return '';
    const ref = String(hookSpec.ref || '').trim();
    if (!ref) return '';
    if (ref.startsWith('script://')) {
      const scriptId = ref.slice('script://'.length).trim();
      if (!scriptId) return '';
      const scripts = loadScriptLibrary();
      const match = scripts.find((item) => {
        const id = String(item?.id || '').trim();
        const name = String(item?.name || '').trim();
        return id === scriptId || name === scriptId;
      }) || null;
      if (!match) return '';
      const inlineSource = String(match?.source || '').trim();
      if (inlineSource) return inlineSource;
      const nestedRef = String(match?.ref || '').trim();
      if (nestedRef) return fetchRefText(nestedRef);
      return '';
    }
    if (
      ref.startsWith('github://') ||
      ref.startsWith('local://') ||
      ref.startsWith('tlz://') ||
      ref.startsWith('/') ||
      ref.startsWith('http://') ||
      ref.startsWith('https://')
    ) {
      return fetchRefText(ref);
    }
    // Allow inline source as fallback for quick prototyping.
    return ref;
  }, [fetchRefText, loadScriptLibrary]);

  const runNodeLifecycleHook = useCallback(async (node, hookName, context = {}) => {
    if (!node?.id || !hookName) return;
    const contract = resolveNodeClassContract(node);
    const nodeDef = contract?.nodeDef || null;
    const hookSpec = resolveLifecycleHookSpec(nodeDef, hookName);
    if (!hookSpec) return;

    const guardKey = `${node.id}:${hookName}`;
    if (lifecycleRunningRef.current.has(guardKey)) return;
    const now = Date.now();
    const lastRun = lifecycleLastRunRef.current.get(guardKey) || 0;
    if (now - lastRun < 120) return;
    lifecycleLastRunRef.current.set(guardKey, now);

    if (hookSpec.kind !== 'script') {
      try {
        setSnackbar((prev) => ({
          ...prev,
          open: true,
          message: `Lifecycle hook kind "${hookSpec.kind}" not supported yet (${hookName}).`,
          severity: 'warning'
        }));
      } catch {}
      return;
    }

    if (typeof window === 'undefined' || !window.__scriptRunner) return;

    lifecycleRunningRef.current.add(guardKey);
    try {
      const source = await resolveLifecycleScriptSource(hookSpec);
      if (!String(source || '').trim()) return;
      const result = await window.__scriptRunner.run(source, {
        dry: false,
        allowMutations: true,
        timeoutMs: hookSpec.timeoutMs,
        lifecycle: true,
        hook: hookName,
        nodeId: node.id,
        nodeType: node.type,
        context
      });
      try {
        eventBus.emit('nodeLifecycleHookResult', {
          nodeId: node.id,
          nodeType: node.type,
          hook: hookName,
          success: Boolean(result?.success),
          result
        });
      } catch {}
    } catch (err) {
      try {
        eventBus.emit('nodeLifecycleHookResult', {
          nodeId: node.id,
          nodeType: node.type,
          hook: hookName,
          success: false,
          error: String(err)
        });
      } catch {}
      try {
        setSnackbar((prev) => ({
          ...prev,
          open: true,
          message: `Lifecycle ${hookName} failed for "${node.label || node.id}": ${String(err)}`,
          severity: 'warning'
        }));
      } catch {}
    } finally {
      lifecycleRunningRef.current.delete(guardKey);
    }
  }, [resolveNodeClassContract, resolveLifecycleHookSpec, resolveLifecycleScriptSource, setSnackbar]);

  useEffect(() => {
    const handleNodeAdded = ({ node, id } = {}) => {
      const resolvedNode = node || nodesRef.current?.find((candidate) => candidate.id === id) || null;
      if (!resolvedNode) return;
      runNodeLifecycleHook(resolvedNode, 'onCreate', { trigger: 'nodeAdded' });
    };
    const handleNodeBeforeUpdate = ({ node, id, patch } = {}) => {
      const resolvedNode = node || nodesRef.current?.find((candidate) => candidate.id === id) || null;
      if (!resolvedNode) return;
      runNodeLifecycleHook(resolvedNode, 'onBeforeUpdate', { trigger: 'nodeBeforeUpdate', patch });
    };
    const handleNodeUpdated = ({ id, node, patch } = {}) => {
      const resolvedNode = node || nodesRef.current?.find((candidate) => candidate.id === id) || null;
      if (!resolvedNode) return;
      runNodeLifecycleHook(resolvedNode, 'onAfterUpdate', { trigger: 'nodeUpdated', patch });
    };
    const handleNodeBeforeDelete = ({ node, id } = {}) => {
      const resolvedNode = node || nodesRef.current?.find((candidate) => candidate.id === id) || null;
      if (!resolvedNode) return;
      runNodeLifecycleHook(resolvedNode, 'onDelete', { trigger: 'nodeBeforeDelete' });
    };
    eventBus.on('nodeAdded', handleNodeAdded);
    eventBus.on('nodeBeforeUpdate', handleNodeBeforeUpdate);
    eventBus.on('nodeUpdated', handleNodeUpdated);
    eventBus.on('nodeBeforeDelete', handleNodeBeforeDelete);
    return () => {
      eventBus.off('nodeAdded', handleNodeAdded);
      eventBus.off('nodeBeforeUpdate', handleNodeBeforeUpdate);
      eventBus.off('nodeUpdated', handleNodeUpdated);
      eventBus.off('nodeBeforeDelete', handleNodeBeforeDelete);
    };
  }, [nodesRef, runNodeLifecycleHook]);

  useEffect(() => {
    const activeNodeIds = new Set((Array.isArray(nodes) ? nodes : []).map((node) => node?.id).filter(Boolean));
    Array.from(lifecycleLoadedRef.current).forEach((key) => {
      const nodeId = String(key).split('::')[0];
      if (!activeNodeIds.has(nodeId)) {
        lifecycleLoadedRef.current.delete(key);
      }
    });
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      if (!node?.id) return;
      const contract = resolveNodeClassContract(node);
      if (!contract?.nodeDef) return;
      const signature = `${node.id}::${node.type}::${contract?.nodeDef?.ref || ''}::${contract?.nodeDef?.version || ''}`;
      if (lifecycleLoadedRef.current.has(signature)) return;
      lifecycleLoadedRef.current.add(signature);
      runNodeLifecycleHook(node, 'onLoad', { trigger: 'dictionaryResolved' });
    });
  }, [nodes, resolvedDictionary, resolveNodeClassContract, runNodeLifecycleHook]);

  const resolveViewEntry = useCallback((node) => {
    if (!node) return null;
    const contract = resolveNodeClassContract(node);
    if (!contract) return null;
    return contract.nodeView || contract.views?.[0] || null;
  }, [resolveNodeClassContract]);

  const resolveEditorViewEntry = useCallback((node) => {
    if (!node) return null;
    const contract = resolveNodeClassContract(node);
    const lookupKey = contract?.key || node?.data?.dictionaryKey || node?.data?.definitionKey || node?.type;
    const matched = contract?.editorView || null;
    if (matched) return matched;

    const nodeEntry = resolveViewEntry(node);
    if (!nodeEntry?.ref) return null;
    const def = viewDefinitions[nodeEntry.ref] || null;
    const viewNodes = Array.isArray(def?.viewNodes) ? def.viewNodes : [];
    const editorViewNode = viewNodes.find((candidate) => {
      const viewData = candidate?.data?.view || {};
      const payload = viewData.payload || '';
      return viewData.intent === 'editor' || payload === 'editor.web';
    }) || null;
    if (!editorViewNode) return null;
    const viewData = editorViewNode?.data?.view || {};
    return {
      key: lookupKey,
      intent: viewData.intent || 'editor',
      payload: viewData.payload || 'editor.web',
      ref: nodeEntry.ref,
      source: 'definition'
    };
  }, [resolveNodeClassContract, resolveViewEntry, viewDefinitions]);

  const buildBuiltinEditorDefinition = useCallback((node) => {
    if (!node?.type) return null;
    const type = String(node.type).trim();
    if (type !== 'port' && type !== 'graph-reference') return null;
    const portTargetPath = (field) => (type === 'port' ? `data.target.${field}` : `data.${field}`);
    const modeOptions =
      type === 'graph-reference'
        ? [
            { label: 'Preview', value: 'preview' },
            { label: 'Interactive', value: 'interactive' },
            { label: 'Expand Fragment', value: 'expand' }
          ]
        : [
            { label: 'Navigate', value: 'navigate' },
            { label: 'Expand Fragment', value: 'expand' },
            { label: 'Bridge', value: 'bridge' }
          ];
    const fields = [
      { key: 'ref', label: 'Reference', type: 'text', path: portTargetPath('ref'), placeholder: 'github://owner/repo/path/file.node' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', path: portTargetPath('endpoint'), placeholder: 'root.node:root' },
      { key: 'url', label: 'URL', type: 'text', path: portTargetPath('url'), placeholder: 'https://example.com/file.node' },
      { key: 'mode', label: 'Mode', type: 'select', options: modeOptions, path: portTargetPath('mode'), placeholder: type === 'graph-reference' ? 'preview' : 'navigate' },
      { key: 'graphId', label: 'Target graphId', type: 'text', path: type === 'port' ? 'data.target.graphId' : 'data.graphId' },
      { key: 'nodeId', label: 'Target nodeId', type: 'text', path: type === 'port' ? 'data.target.nodeId' : 'data.nodeId' },
      { key: 'portId', label: 'Target portId', type: 'text', path: type === 'port' ? 'data.target.portId' : 'data.portId', placeholder: 'root' },
      { key: 'label', label: 'Target label', type: 'text', path: type === 'port' ? 'data.target.label' : 'data.label' },
      { key: 'intent', label: 'Intent', type: 'text', path: 'data.intent' },
      {
        key: 'security',
        label: 'Security',
        type: 'select',
        options: [
          { label: 'Prompt', value: 'prompt' },
          { label: 'Allow', value: 'allow' },
          { label: 'Deny', value: 'deny' }
        ],
        path: 'data.security',
        placeholder: 'prompt'
      }
    ];
    if (type === 'graph-reference') {
      fields.push({ key: 'maxDepth', label: 'Max depth', type: 'number', path: 'data.maxDepth' });
    }
    return {
      status: 'ready',
      viewNode: {
        id: `builtin-editor-${type}`,
        type: 'view',
        data: {
          view: {
            intent: 'editor',
            payload: 'editor.web',
            showEditButton: true
          },
          editor: {
            web: {
              fields
            }
          }
        }
      }
    };
  }, []);

  const manifestNode = useMemo(
    () => (Array.isArray(nodes) ? nodes.find((candidate) => candidate?.type === 'manifest') || null : null),
    [nodes]
  );

  const policyAllowsEdit = useMemo(() => {
    const mutation = manifestNode?.data?.authority?.mutation || {};
    const allowUpdate = mutation.allowUpdate ?? true;
    const appendOnly = mutation.appendOnly ?? false;
    return Boolean(allowUpdate) && !appendOnly;
  }, [manifestNode]);

  const validateViewSchema = useCallback((viewNodes = [], ref = '') => {
    const warnings = [];
    const allowedTypes = new Set(['text', 'markdown', 'number', 'boolean']);
    const allowedControlTypes = new Set(['button', 'toggle']);
    const allowedControlActions = new Set(['openEditor', 'navigate', 'emit', 'toggle', 'setData']);
    const allowedControlVariants = new Set(['outlined', 'contained', 'text', 'soft']);
    const allowedControlPriorityWords = new Set(['highest', 'high', 'normal', 'medium', 'low', 'lowest']);
    viewNodes.forEach((viewNode) => {
      const viewData = viewNode?.data?.view || {};
      const payload = viewData.payload || '';
      const isEditor = viewData.intent === 'editor' || payload === 'editor.web';
      if (isEditor) {
        const editorWeb = viewNode?.data?.editor?.web || {};
        if ('fields' in editorWeb) {
          if (!Array.isArray(editorWeb.fields)) {
            warnings.push(`Editor view fields must be an array (${ref || 'view'})`);
            return;
          }
          editorWeb.fields.forEach((field, index) => {
            if (!field || typeof field !== 'object') {
              warnings.push(`Editor field #${index + 1} must be an object (${ref || 'view'})`);
              return;
            }
            const key = field.key || field.path;
            if (typeof key !== 'string' || !key.trim()) {
              warnings.push(`Editor field #${index + 1} missing key/path (${ref || 'view'})`);
            }
            if (field.type && (!allowedTypes.has(field.type))) {
              warnings.push(`Editor field "${key || index + 1}" has invalid type "${field.type}" (${ref || 'view'})`);
            }
            if (field.rows !== undefined && !(typeof field.rows === 'number' && Number.isFinite(field.rows))) {
              warnings.push(`Editor field "${key || index + 1}" rows must be a number (${ref || 'view'})`);
            }
          });
        }
      }

      const nodeWeb = viewNode?.data?.node?.web || {};
      const rawControls = viewData?.controls !== undefined ? viewData.controls : nodeWeb.controls;
      if (rawControls === undefined) return;
      if (!Array.isArray(rawControls)) {
        warnings.push(`Node view controls must be an array (${ref || 'view'})`);
        return;
      }
      rawControls.forEach((control, index) => {
        if (!control || typeof control !== 'object') {
          warnings.push(`Control #${index + 1} must be an object (${ref || 'view'})`);
          return;
        }
        const controlId = typeof control.id === 'string' && control.id.trim()
          ? control.id.trim()
          : `#${index + 1}`;
        const controlType = String(control.type || 'button');
        const action = String(control.action || (controlType === 'toggle' ? 'toggle' : '')).trim();
        if (control.type && !allowedControlTypes.has(controlType)) {
          warnings.push(`Control "${controlId}" has unsupported type "${control.type}" (${ref || 'view'})`);
        }
        if (action && !allowedControlActions.has(action)) {
          warnings.push(`Control "${controlId}" has unsupported action "${action}" (${ref || 'view'})`);
        }
        if (control.icon !== undefined && (typeof control.icon !== 'string' || !control.icon.trim())) {
          warnings.push(`Control "${controlId}" icon must be a non-empty string (${ref || 'view'})`);
        }
        if (control.variant !== undefined) {
          const variant = String(control.variant).trim().toLowerCase();
          if (!allowedControlVariants.has(variant)) {
            warnings.push(`Control "${controlId}" has unsupported variant "${control.variant}" (${ref || 'view'})`);
          }
        }
        if (control.priority !== undefined) {
          const priorityType = typeof control.priority;
          if (priorityType === 'number') {
            if (!Number.isFinite(control.priority)) {
              warnings.push(`Control "${controlId}" priority must be finite (${ref || 'view'})`);
            }
          } else if (priorityType === 'string') {
            const normalized = control.priority.trim().toLowerCase();
            const numeric = Number(normalized);
            if (!allowedControlPriorityWords.has(normalized) && !Number.isFinite(numeric)) {
              warnings.push(`Control "${controlId}" priority must be numeric or one of high/normal/low (${ref || 'view'})`);
            }
          } else {
            warnings.push(`Control "${controlId}" priority must be number or string (${ref || 'view'})`);
          }
        }
        if (action === 'navigate') {
          const hasTarget = Boolean(control.href || control.url || control.hrefPath || control.bind || control.path);
          if (!hasTarget) {
            warnings.push(`Control "${controlId}" navigate action needs href/url/hrefPath/bind (${ref || 'view'})`);
          }
        }
        if (action === 'emit') {
          if (typeof control.event !== 'string' || !control.event.trim()) {
            warnings.push(`Control "${controlId}" emit action needs event (${ref || 'view'})`);
          }
        }
        if (action === 'toggle' || action === 'setData') {
          const hasBind = Boolean(control.bind || control.path);
          if (!hasBind) {
            warnings.push(`Control "${controlId}" ${action} action needs bind/path (${ref || 'view'})`);
          }
        }
        if (action === 'setData' && !('value' in control)) {
          warnings.push(`Control "${controlId}" setData action needs value (${ref || 'view'})`);
        }
      });
    });
    return warnings;
  }, []);

  const requestViewDefinition = useCallback((ref) => {
    if (!ref) return;
    const current = viewDefinitionsRef.current[ref];
    const isFresh =
      current &&
      current.status === 'ready' &&
      typeof current.loadedAt === 'number' &&
      Date.now() - current.loadedAt < DEFINITION_CACHE_TTL_MS;
    if (current?.status === 'loading' || isFresh) return;
    setViewDefinitions((prev) => ({ ...prev, [ref]: { status: 'loading' } }));
    Promise.resolve()
      .then(async () => {
        return fetchRefText(ref);
      })
      .then((text) => {
        const parsed = JSON.parse(text);
        const parsedNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
        const viewNodes = parsedNodes.filter((candidate) => candidate?.type === 'view');
        if (!viewNodes.length) {
          throw new Error('No view node found');
        }
        const schemaWarnings = validateViewSchema(viewNodes, ref);
        setViewDefinitions((prev) => ({
          ...prev,
          [ref]: { status: 'ready', viewNodes, loadedAt: Date.now() }
        }));
        if (schemaWarnings.length > 0) {
          try {
            setSnackbar((prev) => ({
              ...prev,
              open: true,
              message: `View schema: ${schemaWarnings[0]}${schemaWarnings.length > 1 ? ` (+${schemaWarnings.length - 1} more)` : ''}`,
              severity: 'warning'
            }));
          } catch (err) {
            // ignore snackbar failures
          }
        }
      })
      .catch((err) => {
        setViewDefinitions((prev) => ({
          ...prev,
          [ref]: { status: 'error', error: err?.message || 'Failed to load view' }
        }));
      });
  }, [fetchRefText, validateViewSchema]);

  useEffect(() => {
    if (!Array.isArray(nodes)) return;
    const refs = new Set();
    nodes.forEach((node) => {
      if (!node || nodeTypes?.[node.type]) return;
      if (typeof node?.type === 'string' && node.type.includes(':')) return;
      const contract = resolveNodeClassContract(node);
      const nodeRef = contract?.nodeView?.ref;
      const editorRef = contract?.editorView?.ref;
      if (nodeRef) refs.add(nodeRef);
      if (editorRef) refs.add(editorRef);
    });
    refs.forEach((ref) => requestViewDefinition(ref));
  }, [nodes, nodeTypes, resolveNodeClassContract, requestViewDefinition]);

  useEffect(() => {
    const handleTogglePanel = ({ nodeId, source } = {}) => {
      if (!nodeId) return;
      setNodeEditorPanel((prev) => {
        const shouldClose = prev.open && prev.nodeId === nodeId;
        const next = shouldClose ? { open: false, nodeId: null } : { open: true, nodeId };
        try {
          if (next.open) {
            eventBus.emit('nodeEditorPanelOpen', { nodeId, source: source || 'edit-button', at: Date.now() });
          } else {
            eventBus.emit('nodeEditorPanelClose', { nodeId, source: source || 'edit-button', at: Date.now() });
          }
        } catch (err) {
          // ignore telemetry errors
        }
        return next;
      });
    };
    eventBus.on('toggleNodeEditorPanel', handleTogglePanel);
    return () => eventBus.off('toggleNodeEditorPanel', handleTogglePanel);
  }, []);

  useEffect(() => {
    const handleDirtyChange = ({ nodeId, dirty } = {}) => {
      if (!nodeId) return;
      setNodeEditorDirty((prev) => {
        if (prev.nodeId === nodeId && prev.dirty === Boolean(dirty)) return prev;
        return { nodeId, dirty: Boolean(dirty) };
      });
    };
    const handleCommitResult = ({ nodeId, success, error } = {}) => {
      if (!nodeId) return;
      if (success) {
        setNodeEditorCommitError(null);
        if (nodeEditorCommitTargetRef.current === nodeId && nodeEditorPanel.open && nodeEditorPanel.nodeId === nodeId) {
          setNodeEditorPanel({ open: false, nodeId: null });
          setNodeEditorCommitPending(false);
          nodeEditorCommitTargetRef.current = null;
        }
      } else if (error) {
        setNodeEditorCommitError(String(error));
        setNodeEditorCommitPending(false);
        nodeEditorCommitTargetRef.current = null;
      }
    };
    eventBus.on('nodeEditorDirtyChange', handleDirtyChange);
    eventBus.on('nodeEditorCommitResult', handleCommitResult);
    return () => {
      eventBus.off('nodeEditorDirtyChange', handleDirtyChange);
      eventBus.off('nodeEditorCommitResult', handleCommitResult);
    };
  }, [nodeEditorCommitPending, nodeEditorPanel.open, nodeEditorPanel.nodeId]);

  const resolveNodeComponent = useCallback((node) => {
    if (!node || nodeTypes?.[node.type]) return null;
    if (typeof node?.type === 'string' && node.type.includes(':')) return null;
    const entry = resolveViewEntry(node);
    if (!entry || !entry.ref) return null;
    const viewDefinition = viewDefinitionsRef.current[entry.ref] || null;
    const viewNodes = Array.isArray(viewDefinition?.viewNodes) ? viewDefinition.viewNodes : [];
    const entryIntent = entry.intent || '';
    const entryPayload = entry.payload || entry.view || '';
    const selectedViewNode = viewNodes.find((candidate) => {
      const viewData = candidate?.data?.view || {};
      if (entryIntent && viewData.intent && entryIntent !== viewData.intent) return false;
      if (entryPayload && viewData.payload && entryPayload !== viewData.payload) return false;
      return true;
    }) || viewNodes.find((candidate) => {
      const viewData = candidate?.data?.view || {};
      return !entryIntent || !viewData.intent || entryIntent === viewData.intent;
    }) || viewNodes[0] || null;
    const resolvedDefinition = selectedViewNode
      ? { status: viewDefinition?.status || 'ready', viewNode: selectedViewNode }
      : viewDefinition;
    const editorEntry = resolveEditorViewEntry(node);
    const viewWantsEditButton = selectedViewNode?.data?.view?.showEditButton
      ?? selectedViewNode?.data?.node?.web?.showEditButton;
    const nodeEditableFlag = node?.data?.editable;
    const nodeAllowsEdit = nodeEditableFlag !== false;
    const allowEditButton = viewWantsEditButton !== false
      && (Boolean(editorEntry) || viewWantsEditButton === true)
      && nodeAllowsEdit
      && policyAllowsEdit;
    return {
      component: DynamicViewNode,
      props: {
        viewEntry: entry,
        viewDefinition: resolvedDefinition,
        showEditButton: allowEditButton,
        editLocked: !policyAllowsEdit || !nodeAllowsEdit
      }
    };
  }, [nodeTypes, resolveViewEntry, resolveEditorViewEntry, policyAllowsEdit]);

  const editorPanelNode = useMemo(() => {
    if (!nodeEditorPanel.open || !nodeEditorPanel.nodeId) return null;
    return nodes?.find((candidate) => candidate.id === nodeEditorPanel.nodeId) || null;
  }, [nodes, nodeEditorPanel]);

  useEffect(() => {
    if (!nodeEditorPanel.open || !nodeEditorPanel.nodeId) return;
    setNodeEditorDirty({ nodeId: nodeEditorPanel.nodeId, dirty: false });
    setNodeEditorCommitPending(false);
    setNodeEditorCommitError(null);
  }, [nodeEditorPanel.open, nodeEditorPanel.nodeId]);

  const editorPanelEntry = useMemo(
    () => {
      if (!editorPanelNode) return null;
      const resolved = resolveEditorViewEntry(editorPanelNode);
      if (resolved) return resolved;
      const builtin = buildBuiltinEditorDefinition(editorPanelNode);
      if (!builtin?.viewNode) return null;
      return {
        key: editorPanelNode.type,
        intent: 'editor',
        payload: 'editor.web',
        source: 'builtin'
      };
    },
    [buildBuiltinEditorDefinition, editorPanelNode, resolveEditorViewEntry]
  );

  useEffect(() => {
    if (!nodeEditorPanel.open) return;
    if (editorPanelEntry?.ref) {
      requestViewDefinition(editorPanelEntry.ref);
    }
  }, [nodeEditorPanel.open, editorPanelEntry?.ref, requestViewDefinition]);

  const editorPanelDefinition = useMemo(() => {
    if (editorPanelEntry?.source === 'builtin' && editorPanelNode) {
      return buildBuiltinEditorDefinition(editorPanelNode);
    }
    if (!editorPanelEntry?.ref) return null;
    const def = viewDefinitions[editorPanelEntry.ref] || null;
    const viewNodes = Array.isArray(def?.viewNodes) ? def.viewNodes : [];
    const entryIntent = editorPanelEntry.intent || '';
    const entryPayload = editorPanelEntry.payload || editorPanelEntry.view || '';
    const selectedViewNode = viewNodes.find((candidate) => {
      const viewData = candidate?.data?.view || {};
      if (entryIntent && viewData.intent && entryIntent !== viewData.intent) return false;
      if (entryPayload && viewData.payload && entryPayload !== viewData.payload) return false;
      return true;
    }) || viewNodes[0] || null;
    return selectedViewNode
      ? { status: def?.status || 'ready', viewNode: selectedViewNode }
      : def;
  }, [buildBuiltinEditorDefinition, editorPanelEntry, editorPanelNode, viewDefinitions]);

  const editorPanelDirty = Boolean(editorPanelNode?.id && nodeEditorDirty.nodeId === editorPanelNode.id && nodeEditorDirty.dirty);

  const handleCloseEditorPanel = useCallback((force = false) => {
    if (editorPanelDirty && !force) {
      const confirmed = window.confirm('You have unsaved changes. Close without saving?');
      if (!confirmed) return;
      try {
        eventBus.emit('nodeEditorReset', { nodeId: editorPanelNode?.id });
      } catch (err) {
        // ignore reset errors
      }
    }
    setNodeEditorPanel({ open: false, nodeId: null });
    setNodeEditorCommitPending(false);
    setNodeEditorCommitError(null);
    nodeEditorCommitTargetRef.current = null;
  }, [editorPanelDirty, editorPanelNode?.id]);

  const handleCommitAndClose = useCallback(() => {
    if (!editorPanelNode?.id) return;
    setNodeEditorCommitPending(true);
    setNodeEditorCommitError(null);
    nodeEditorCommitTargetRef.current = editorPanelNode.id;
    eventBus.emit('nodeEditorCommit', { nodeId: editorPanelNode.id });
  }, [editorPanelNode?.id]);

  const handleResetEditor = useCallback(() => {
    if (!editorPanelNode?.id) return;
    eventBus.emit('nodeEditorReset', { nodeId: editorPanelNode.id });
    setNodeEditorCommitError(null);
  }, [editorPanelNode?.id]);

  const handleToggleMinimap = useCallback(() => {
    emitEdgeIntent('toggleMinimap', { enabled: !showMinimap });
    eventBus.emit('toggleMinimap');
  }, [emitEdgeIntent, showMinimap]);

  useEffect(() => {
    const handleNodeOutput = ({ nodeId, outputName, value } = {}) => {
      if (!nodeId) return;
      const sourcePort = outputName || 'root';
      const currentEdges = edgesRef?.current || [];
      currentEdges.forEach((edge) => {
        if (!edge) return;
        if (edge.source !== nodeId) return;
        const edgeSourceHandle = edge.sourcePort || 'root';
        // Treat root as a wildcard source so simple graphs still propagate outputs.
        if (edgeSourceHandle !== 'root' && edgeSourceHandle !== sourcePort) return;
        const targetPort = edge.targetPort || 'root';
        eventBus.emit('nodeInput', {
          targetNodeId: edge.target,
          handleId: targetPort,
          inputName: targetPort,
          value,
          source: 'edge',
          meta: {
            edgeId: edge.id,
            sourceNodeId: nodeId,
            sourcePort: edgeSourceHandle
          }
        });
      });
    };
    eventBus.on('nodeOutput', handleNodeOutput);
    return () => eventBus.off('nodeOutput', handleNodeOutput);
  }, [edgesRef]);

  const graphRendererKey = `${backgroundUrl || 'no-background'}-${graphRenderKey}`;
  const minimapOffset = useMemo(() => {
    const offsets = { left: 0, right: 0, top: 0, bottom: 0 };
    if (showPropertiesPanel) {
      if (panelAnchor === 'left') {
        offsets.left = Math.max(offsets.left, propertiesPanelWidth);
      } else if (panelAnchor === 'right') {
        offsets.right = Math.max(offsets.right, propertiesPanelWidth);
      }
    }
    if (showEntitiesPanel) {
      if (entitiesAnchor === 'left') {
        offsets.left = Math.max(offsets.left, panelWidths.entities);
      } else if (entitiesAnchor === 'right') {
        offsets.right = Math.max(offsets.right, panelWidths.entities);
      }
    }
    if (showEdgePanel) {
      offsets.right = Math.max(offsets.right, panelWidths.layout);
    }
    return offsets;
  }, [entitiesAnchor, panelAnchor, panelWidths.entities, panelWidths.layout, propertiesPanelWidth, showEdgePanel, showEntitiesPanel, showPropertiesPanel]);
  const resolveDefinitionUrl = useCallback((nodeId) => {
    if (!nodeId) return null;
    const node = nodes?.find((candidate) => candidate.id === nodeId);
    if (!node) return null;

    const clusterList = Array.isArray(groups) ? groups : [];
    const nodeClusterId = clusterList.find((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(node.id))?.id || null;
    const dictionaryInCluster = nodeClusterId
      ? nodes?.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate) && clusterList.some((cluster) => cluster.id === nodeClusterId && Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)))
      : null;
    const rootDictionary = nodes?.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate) && !clusterList.some((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)));
    const hostDictionary = resolvedDictionary || dictionaryInCluster || rootDictionary || nodes?.find((candidate) => candidate.type === 'dictionary' && !isScopedDictionaryNode(candidate));
    const dictionary = buildScopedDictionaryForNode(node, hostDictionary);

    const entries = Array.isArray(dictionary?.data?.nodeDefs) ? dictionary.data.nodeDefs : [];
    const match = entries.find((entry) => {
      if (!entry) return false;
      return entry.nodeType === node.type || entry.type === node.type || entry.key === node.type;
    });
    return match?.ref || match?.file || match?.path || null;
  }, [nodes, groups, resolvedDictionary, isScopedDictionaryNode, buildScopedDictionaryForNode]);

  const isNodeExecutable = useCallback((node) => {
    if (!node) return false;
    if (Array.isArray(nodeTypeMetadata) && nodeTypeMetadata.length) {
      const meta = nodeTypeMetadata.find((entry) => entry.type === node.type);
      if (meta && meta.executable) return true;
    }
    return ['script', 'api', 'backgroundRpc'].includes(node.type);
  }, [nodeTypeMetadata]);

  const handleNodeContextMenu = useCallback((nodeId, event) => {
    if (!nodeId || !event) return;
    setFocusedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    setNodeContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      nodeId
    });
  }, [setFocusedNodeId, setSelectedNodeIds, setSelectedEdgeIds, setSelectedGroupIds]);

  const handleNodeDoubleClickOpenProperties = useCallback((nodeId) => {
    if (!nodeId) return;
    setFocusedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    setShowPropertiesPanel(true);
  }, [setFocusedNodeId, setSelectedNodeIds, setSelectedEdgeIds, setSelectedGroupIds, setShowPropertiesPanel]);

  const handleEdgeDoubleClickOpenProperties = useCallback((edgeId) => {
    if (!edgeId) return;
    setSelectedEdgeIds([edgeId]);
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
    setShowPropertiesPanel(true);
  }, [setSelectedEdgeIds, setSelectedNodeIds, setSelectedGroupIds, setShowPropertiesPanel]);

  const handleGroupDoubleClickOpenProperties = useCallback((groupId) => {
    if (!groupId) return;
    setSelectedGroupIds([groupId]);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setShowPropertiesPanel(true);
  }, [setSelectedGroupIds, setSelectedNodeIds, setSelectedEdgeIds, setShowPropertiesPanel]);

  const handleUpdateNodeFromPanels = useCallback((id, updates, options) => {
    emitEdgeIntent('updateNode', {
      nodeId: id,
      changeCount: Object.keys(updates || {}).length,
      selectionCount: selectedNodeIds.length
    });
    let outboundPatch = updates || {};
    setNodes(prev => {
      const enforceSingleRoot =
        updates?.isRoot === true ||
        updates?.data?.isRoot === true ||
        updates?.data?.root === true;
      const targetNode = prev.find((candidate) => candidate.id === id) || null;
      const contract = targetNode ? resolveNodeClassContract(targetNode) : null;
      const overrides = contract?.nodeDef?.overrides && typeof contract.nodeDef.overrides === 'object'
        ? contract.nodeDef.overrides
        : null;
      const policy = {
        allowLabel: overrides?.allowLabel !== false,
        allowSize: overrides?.allowSize !== false,
        allowColor: overrides?.allowColor !== false,
        allowPorts: overrides?.allowPorts !== false,
        allowData: overrides?.allowData !== false,
        dataMode: ['replace', 'merge-shallow', 'merge-deep'].includes(String(overrides?.dataMode || ''))
          ? String(overrides.dataMode)
          : 'merge-deep'
      };
      const filteredUpdates = { ...(updates || {}) };
      if (!policy.allowLabel) delete filteredUpdates.label;
      if (!policy.allowSize) {
        delete filteredUpdates.width;
        delete filteredUpdates.height;
      }
      if (!policy.allowColor) delete filteredUpdates.color;
      if (!policy.allowPorts) {
        delete filteredUpdates.ports;
        delete filteredUpdates.inputs;
        delete filteredUpdates.outputs;
        delete filteredUpdates.handles;
      }
      if (!policy.allowData) {
        delete filteredUpdates.data;
      } else if (filteredUpdates.data && typeof filteredUpdates.data === 'object') {
        filteredUpdates.__twiliteDataMode = policy.dataMode;
      }
      const { data: nextDataPatch, replaceData, __twiliteDataMode, ...restUpdates } = filteredUpdates || {};
      outboundPatch = filteredUpdates || {};
      if (targetNode) {
        try {
          eventBus.emit('nodeBeforeUpdate', {
            id,
            node: { ...targetNode },
            patch: outboundPatch
          });
        } catch (err) {
          // ignore lifecycle emit failures
        }
      }
      const next = prev.map(n => {
        if (n.id !== id) {
          if (!enforceSingleRoot) return n;
          return {
            ...n,
            isRoot: false,
            data: {
              ...(n.data || {}),
              isRoot: false,
              root: false
            }
          };
        }
        const nextData = nextDataPatch
          ? (replaceData || options?.replaceData || __twiliteDataMode === 'replace')
            ? nextDataPatch
            : (__twiliteDataMode === 'merge-deep'
                ? deepMergeData(n.data || {}, nextDataPatch)
                : { ...n.data, ...nextDataPatch })
          : n.data;
        return { ...n, ...restUpdates, data: nextData };
      });
      nodesRef.current = next;
      if (!options || options !== true) {
        try { historyHook.saveToHistory(next, edgesRef.current); } catch (err) {}
      }
      return next;
    });
    const hasHandler = handlers && typeof handlers.handleUpdateNodeData === 'function';
    if (!options || options !== true) {
      try {
        if (hasHandler) {
          handlers.handleUpdateNodeData(id, outboundPatch, options);
        }
      } catch (err) {}
    }
    if (options === true || !hasHandler) {
      try {
        eventBus.emit('nodeUpdated', { id, patch: outboundPatch || {} });
      } catch (err) {}
    }
  }, [emitEdgeIntent, selectedNodeIds.length, setNodes, nodesRef, historyHook, edgesRef, handlers, resolveNodeClassContract]);

  const handleUpdateEdgeFromPanels = useCallback((id, updates) => {
    emitEdgeIntent('updateEdge', { edgeId: id, changeCount: Object.keys(updates || {}).length });
    setEdges(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
      edgesRef.current = next;
      try { historyHook.saveToHistory(nodesRef.current, next); } catch (err) {}
      return next;
    });
    const stylePatch = updates?.style && typeof updates.style === 'object' ? updates.style : null;
    const routingStyleChanged = Boolean(
      stylePatch &&
      (
        stylePatch.curved !== undefined ||
        stylePatch.orthogonal !== undefined ||
        stylePatch.route !== undefined ||
        stylePatch.routing !== undefined ||
        stylePatch.router !== undefined
      )
    );
    if (updates?.sourcePort !== undefined || updates?.targetPort !== undefined || routingStyleChanged) {
      if (typeof setEdgeRoutes === 'function') {
        setEdgeRoutes((prev) => {
          if (!prev || !prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
    try {
      eventBus.emit('edgeUpdated', { id, patch: updates || {} });
    } catch (err) {}
  }, [emitEdgeIntent, setEdges, edgesRef, historyHook, nodesRef, setEdgeRoutes]);

  const createGraphRenderer = () => (
    <GraphRendererAdapter
      graphKey={graphRendererKey}
      nodeTypes={nodeTypes}
      getNodeSemanticLevel={getNodeSemanticLevel}
      isEdgeInSemanticBullseye={isEdgeInSemanticBullseye}
      resolveNodeComponent={resolveNodeComponent}
      edgeTypes={EdgeTypes}
      edgeRoutes={edgeRoutes}
      mode={modesHook.mode}
      backgroundUrl={backgroundUrl}
      backgroundInteractive={backgroundInteractive}
      backgroundImage={documentBackgroundImage}
      setSnackbar={setSnackbar}
      showMinimap={showMinimap}
      minimapOffset={minimapOffset}
      showPorts={interactionMode === 'edit'}
      snapToGrid={snapToGrid}
      showGrid={showGrid}
      gridSize={documentSettings.gridSize}
      defaultEdgeRouting={documentSettings.edgeRouting}
      edgeLaneGapPx={documentSettings.layout?.edgeLaneGapPx}
      watermarkEnabled={editorWatermarkEnabled}
      watermarkStrength={editorWatermarkStrength}
      lockedNodes={lockedNodes}
      lockedEdges={lockedEdges}
      onNodeDoubleClick={handleNodeDoubleClickOpenProperties}
      onEdgeDoubleClick={handleEdgeDoubleClickOpenProperties}
      onGroupDoubleClick={handleGroupDoubleClickOpenProperties}
      onEdgeClick={undefined}
      onEdgeHover={undefined}
      onNodeContextMenu={handleNodeContextMenu}
      hoveredEdgeId={hoveredEdgeId}
      showAllEdgeLabels={showAllEdgeLabels}
      onBackgroundClick={handleCanvasBackgroundClick}
    />
  );

  const focusDebugBottomOffset = showMinimap ? 208 : 16;
  const focusDebugRightOffset = Math.max(16, (minimapOffset?.right || 0) + 16);
  const focusDebugFocusedScope = semanticScopeState?.focusedScope || 'root';
  const focusDebugFocusedLevel = focusedNodeId
    ? getNodeSemanticLevel(nodes?.find((candidate) => candidate?.id === focusedNodeId) || null)
    : 'detail';
  const focusedFragmentUrl = useMemo(() => {
    const focusedNode = Array.isArray(nodes)
      ? nodes.find((candidate) => candidate?.id === focusedNodeId) || null
      : null;
    const rawRef = typeof focusedNode?.data?._origin?.ref === 'string' && focusedNode.data._origin.ref.trim()
      ? focusedNode.data._origin.ref.trim()
      : (typeof focusedNode?.data?._expansion?.sourceRef === 'string' ? focusedNode.data._expansion.sourceRef.trim() : '');
    return rawRef ? endpointToUrl(rawRef) : '';
  }, [focusedNodeId, nodes]);

  useEffect(() => {
    if (focusedFragmentUrl) {
      eventBus.emit('setAddressPreview', { url: focusedFragmentUrl });
      return;
    }
    eventBus.emit('clearAddressPreview');
  }, [focusedFragmentUrl]);

  useEffect(() => {
    eventBus.emit('viewportInfoChanged', {
      pan: {
        x: Math.round(pan?.x || 0),
        y: Math.round(pan?.y || 0)
      },
      zoom: Number(zoom || 1)
    });
  }, [pan?.x, pan?.y, zoom]);

  useEffect(() => {
    const handleNodeDragEndIntent = () => {
      emitEdgeIntent('nodeDragEnd');
    };
    eventBus.on('nodeDragEnd', handleNodeDragEndIntent);
    return () => {
      eventBus.off('nodeDragEnd', handleNodeDragEndIntent);
    };
  }, [emitEdgeIntent]);

  useEffect(() => {
    const handleFocusNodeEvent = ({ nodeId } = {}) => {
      if (!nodeId) return;
      try {
        handlers?.handleNodeFocus?.(nodeId);
      } catch (err) {
        // ignore focus routing failures
      }
    };
    eventBus.on('focusNode', handleFocusNodeEvent);
    return () => {
      eventBus.off('focusNode', handleFocusNodeEvent);
    };
  }, [handlers]);

  const handleToggleSnapToGrid = useCallback(() => {
    setSnapToGrid(prev => {
      const next = !prev;
      emitEdgeIntent('toggleSnapToGrid', { enabled: next });
      return next;
    });
  }, [setSnapToGrid, emitEdgeIntent]);

  const showSnackbar = useCallback((message, severity = 'info', options = {}) => {
    setSnackbar({ open: true, message, severity, ...options });
  }, [setSnackbar]);

  const lastClipboardMessageRef = useRef('');
  const wasSnackbarOpenRef = useRef(false);
  const lastManifestNoticeRef = useRef('');

  useEffect(() => {
    const isOpen = Boolean(snackbar?.open);
    if (!isOpen) {
      wasSnackbarOpenRef.current = false;
      return;
    }
    if (!snackbar?.copyToClipboard) {
      wasSnackbarOpenRef.current = true;
      return;
    }
    const message = snackbar?.message ? String(snackbar.message) : '';
    const shouldCopy = !wasSnackbarOpenRef.current || message !== lastClipboardMessageRef.current;
    wasSnackbarOpenRef.current = true;
    if (!message || !shouldCopy) return;
    lastClipboardMessageRef.current = message;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(message).catch((err) => {
      console.warn('[Snackbar] Failed to copy message to clipboard', err);
    });
  }, [snackbar?.open, snackbar?.message, snackbar?.copyToClipboard]);

  useEffect(() => {
    const isDraftMode = () => {
      if (typeof window === 'undefined') return false;
      if (window.__Twilite_DRAFT__ === true || window.__TWILITE_DRAFT__ === true) return true;
      try {
        return new URLSearchParams(window.location.search).get('draft') === '1';
      } catch (err) {
        return false;
      }
    };
    if (isDraftMode()) return;
    if (!manifestStatus) return;
    if (manifestStatus.ok) {
      lastManifestNoticeRef.current = '';
      if (snackbar?.manifestNotice) {
        setSnackbar({ ...snackbar, open: false, manifestNotice: false });
      }
      return;
    }
    const firstError = Array.isArray(manifestStatus.errors) && manifestStatus.errors.length
      ? manifestStatus.errors[0]
      : 'Missing or invalid Manifest';
    const message = `Read-only: ${firstError}`;
    if (message === lastManifestNoticeRef.current) return;
    if (snackbar?.open && !snackbar?.manifestNotice) return;
    lastManifestNoticeRef.current = message;
    setSnackbar({
      open: true,
      message,
      severity: 'warning',
      manifestNotice: true
    });
  }, [manifestStatus, snackbar, setSnackbar]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyGraph = (data) => {
      if (!data || typeof data !== 'object') return;
      setHostLoadReady(true);
      const nodesToLoad = Array.isArray(data.nodes) ? data.nodes : [];
      const edgesToLoad = Array.isArray(data.edges) ? data.edges : [];
      const groupsToLoad = Array.isArray(data.clusters) ? data.clusters : [];

      if (typeof handleLoadGraph === 'function') {
        handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
        const settings = loadSettings();
        if (settings?.theme) {
          setEditorThemeConfig(settings.theme);
        }
        setEditorWatermarkEnabled(settings?.watermarkEnabled !== false);
        setEditorWatermarkStrength(
          typeof settings?.watermarkStrength === 'number'
            ? Math.max(0, Math.min(100, settings.watermarkStrength))
            : 100
        );
        setEditorFocusIndicatorEnabled(settings?.showFocusIndicator === true);
        return;
      }

      if (typeof loadGraph === 'function') {
        loadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
        const settings = loadSettings();
        if (settings?.theme) {
          setEditorThemeConfig(settings.theme);
        }
        setEditorWatermarkEnabled(settings?.watermarkEnabled !== false);
        setEditorWatermarkStrength(
          typeof settings?.watermarkStrength === 'number'
            ? Math.max(0, Math.min(100, settings.watermarkStrength))
            : 100
        );
        setEditorFocusIndicatorEnabled(settings?.showFocusIndicator === true);
        if (nodesRef) nodesRef.current = nodesToLoad;
        if (edgesRef) edgesRef.current = edgesToLoad;
        return;
      }

      if (typeof setNodes === 'function') {
        setNodes(nodesToLoad);
        if (nodesRef) nodesRef.current = nodesToLoad;
      }
      if (typeof setEdges === 'function') {
        setEdges(edgesToLoad);
        if (edgesRef) edgesRef.current = edgesToLoad;
      }
      if (typeof setGroups === 'function') {
        setGroups(groupsToLoad);
      }
    };

    window.__Twilite_APPLY_GRAPH__ = applyGraph;
    window.TwiliteApplyGraph = applyGraph;
    if (window.__Twilite_PENDING_GRAPH__) {
      const pending = window.__Twilite_PENDING_GRAPH__;
      window.__Twilite_PENDING_GRAPH__ = null;
      applyGraph(pending);
    }
    try {
      window.dispatchEvent(new CustomEvent('Twilite-ready'));
    } catch {}

    return () => {
      if (window.__Twilite_APPLY_GRAPH__ === applyGraph) {
        delete window.__Twilite_APPLY_GRAPH__;
      }
      if (window.TwiliteApplyGraph === applyGraph) {
        delete window.TwiliteApplyGraph;
      }
    };
  }, [handleLoadGraph, setNodes, setEdges, setGroups, nodesRef, edgesRef]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (themeConfig) => {
      if (!themeConfig) return;
      setEditorThemeConfig(themeConfig);
    };
    eventBus.on('updateEditorTheme', handler);
    return () => eventBus.off('updateEditorTheme', handler);
  }, [host]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = ({ enabled, strength } = {}) => {
      if (typeof enabled === 'boolean') {
        setEditorWatermarkEnabled(enabled);
      }
      if (typeof strength === 'number' && Number.isFinite(strength)) {
        setEditorWatermarkStrength(Math.max(0, Math.min(100, strength)));
      }
    };
    eventBus.on('updateEditorWatermark', handler);
    return () => eventBus.off('updateEditorWatermark', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = ({ enabled } = {}) => {
      if (typeof enabled === 'boolean') {
        setEditorFocusIndicatorEnabled(enabled);
      }
    };
    eventBus.on('updateEditorFocusIndicator', handler);
    return () => eventBus.off('updateEditorFocusIndicator', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (host !== 'vscode' || !window.__Twilite_EMBED__) {
      setHostLoadReady(true);
      return;
    }
    const sync = (event) => {
      if (event?.detail && typeof event.detail === 'object') {
        const waiting = Boolean(event.detail.waitingForFullText);
        const ready = Boolean(event.detail.hostGraphReady);
        setHostLoadReady(ready && !waiting);
        return;
      }
      setHostLoadReady(
        Boolean(window.__Twilite_HOST_GRAPH_READY__) && !Boolean(window.__Twilite_WAITING_FOR_FULL_TEXT__)
      );
    };
    sync();
    window.addEventListener('Twilite-hostLoadState', sync);
    return () => window.removeEventListener('Twilite-hostLoadState', sync);
  }, [host]);

  useEffect(() => {
    if (host !== 'vscode') return undefined;
    if (hostLoadReady) return undefined;
    const timer = setTimeout(() => {
      setHostLoadReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [host, hostLoadReady]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.__Twilite_EMBED__) return;
    let pending = null;
    const emitDirty = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        try {
          window.__Twilite_DIRTY__ = true;
        } catch {}
        postHostMessage({ type: 'graphDirty' });
      }, 50);
    };
    const events = [
      'nodeAdded',
      'nodeUpdated',
      'nodeDeleted',
      'edgeAdded',
      'edgeUpdated',
      'edgeDeleted',
      'groupUpdated',
      'groupDeleted',
      'groupAdded',
      'layoutApplied'
    ];
    events.forEach((eventName) => eventBus.on(eventName, emitDirty));
    return () => {
      events.forEach((eventName) => eventBus.off(eventName, emitDirty));
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.__Twilite_EMBED__ || host !== 'vscode') return;
    let timer = null;
    let lastSentHash = null;
    const flushGraphUpdate = () => {
      if (!window.__Twilite_HOST_GRAPH_READY__) return;
      if (window.__Twilite_WAITING_FOR_FULL_TEXT__) return;
      if (window.__Twilite_SYNCING__) return;
      if (isDraggingRef.current) return;
      if (!documentAccess?.writable) return;
      const exporter = window.__Twilite_EXPORT_GRAPH__;
      if (typeof exporter !== 'function') return;
      try {
        const payload = exporter();
        const hash = JSON.stringify({
          nodes: payload?.nodes || [],
          edges: payload?.edges || [],
          clusters: payload?.clusters || []
        });
        if (hash === lastSentHash) return;
        lastSentHash = hash;
        const text = JSON.stringify(payload, null, 2);
        const uri = typeof window !== 'undefined' ? (window.__Twilite_ACTIVE_URI__ || null) : null;
        const panelId = typeof window !== 'undefined' ? (window.__Twilite_PANEL_ID__ || null) : null;
        postHostMessage({ type: 'graphUpdated', text, uri, panelId });
      } catch (err) {
        // ignore serialize errors
      }
    };
    const startDrag = () => { isDraggingRef.current = true; };
    const endDrag = () => { isDraggingRef.current = false; };
    eventBus.on('nodeDragStart', startDrag);
    eventBus.on('nodeDragEnd', endDrag);
    eventBus.on('groupDragStart', startDrag);
    eventBus.on('groupDragEnd', endDrag);
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        flushGraphUpdate();
      }, 200);
    };
    schedule();
    const handleWindowBlur = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flushGraphUpdate();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        flushGraphUpdate();
      }
    };
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      eventBus.off('nodeDragStart', startDrag);
      eventBus.off('nodeDragEnd', endDrag);
      eventBus.off('groupDragStart', startDrag);
      eventBus.off('groupDragEnd', endDrag);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    host,
    documentAccess?.writable,
    nodes,
    edges,
    groups,
    documentSettings,
    documentTheme,
    documentBackgroundImage,
    backgroundUrl,
    defaultNodeColor,
    defaultEdgeColor,
    snapToGrid
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.__Twilite_EMBED__ || host !== 'vscode') return;
    const handleSaveGraph = () => {
      if (!documentAccess?.writable) return;
      if (window.__Twilite_SYNCING__) return;
      const exporter = window.__Twilite_EXPORT_GRAPH__;
      if (typeof exporter !== 'function') return;
      try {
        const payload = exporter();
        const text = JSON.stringify(payload, null, 2);
        const uri = window.__Twilite_ACTIVE_URI__ || null;
        const panelId = window.__Twilite_PANEL_ID__ || null;
        postHostMessage({ type: 'saveFile', text, uri, panelId });
      } catch (err) {
        // ignore serialize errors
      }
    };
    eventBus.on('saveGraph', handleSaveGraph);
    return () => eventBus.off('saveGraph', handleSaveGraph);
  }, [host, documentAccess?.writable]);

  const isGraphEmpty = (!nodes || nodes.length === 0) && (!edges || edges.length === 0) && (!groups || groups.length === 0);
  // The gallery/new-tab surface now appears only when explicitly requested.
  const showNewTabPage = false;

  const handleCreateBlankGraph = useCallback(() => {
    const manifestNode = createDefaultManifestNode({ kind: 'graph' });
    const dictionaryNode = createDefaultDictionaryNode();
    const nextNodes = [manifestNode, dictionaryNode];
    if (typeof loadGraph === 'function') {
      loadGraph(nextNodes, [], []);
    } else {
      setNodes(() => {
        nodesRef.current = nextNodes;
        return nextNodes;
      });
      setEdges(() => {
        const next = [];
        edgesRef.current = next;
        return next;
      });
      setGroups(() => []);
    }
    historyHook.saveToHistory(nextNodes, []);
    setFocusedNodeId(manifestNode.id);
    setSelectedNodeIds([manifestNode.id]);
  }, [loadGraph, setNodes, nodesRef, setEdges, edgesRef, setGroups, historyHook, setFocusedNodeId, setSelectedNodeIds]);

  const handleImportGraph = useCallback((nodesToLoad, edgesToLoad, groupsToLoad) => {
    emitEdgeIntent('loadGraph', {
      nodes: Array.isArray(nodesToLoad) ? nodesToLoad.length : 0,
      edges: Array.isArray(edgesToLoad) ? edgesToLoad.length : 0,
      clusters: Array.isArray(groupsToLoad) ? groupsToLoad.length : 0
    });
    if (typeof handleLoadGraph === 'function') {
      handleLoadGraph(nodesToLoad, edgesToLoad, groupsToLoad);
    }
  }, [handleLoadGraph, emitEdgeIntent]);

  const handleDeleteSelectedIntent = useCallback(() => {
    emitEdgeIntent('deleteSelection', {
      selectedNodeCount: selectedNodeIds?.length || 0,
      selectedEdgeCount: selectedEdgeIds?.length || 0
    });
    handlers?.handleDeleteSelected?.();
  }, [emitEdgeIntent, handlers, selectedNodeIds, selectedEdgeIds]);

  const handleClearGraphIntent = useCallback(() => {
    emitEdgeIntent('clearGraph');
    handlers?.handleClearGraph?.();
  }, [emitEdgeIntent, handlers]);

  const handleUndoIntent = useCallback(() => {
    emitEdgeIntent('undo');
    historyHook.handleUndo();
  }, [emitEdgeIntent, historyHook.handleUndo]);

  const handleRedoIntent = useCallback(() => {
    emitEdgeIntent('redo');
    historyHook.handleRedo();
  }, [emitEdgeIntent, historyHook.handleRedo]);

  const handleTogglePropertiesPanelIntent = useCallback(() => {
    emitEdgeIntent('togglePropertiesPanel', { open: !showPropertiesPanel });
    togglePropertiesPanel?.();
  }, [emitEdgeIntent, togglePropertiesPanel, showPropertiesPanel]);

  const handleToggleNodeListIntent = useCallback(() => {
    emitEdgeIntent('toggleNodeList', { open: !showNodeList });
    toggleNodeList?.();
  }, [emitEdgeIntent, toggleNodeList, showNodeList]);

  const handleToggleGroupListIntent = useCallback(() => {
    emitEdgeIntent('toggleGroupList', { open: !showGroupList });
    toggleGroupList?.();
  }, [emitEdgeIntent, toggleGroupList, showGroupList]);

  const handleToggleEdgeListIntent = useCallback(() => {
    emitEdgeIntent('toggleEdgeList', { open: !showEdgeList });
    toggleEdgeList?.();
  }, [emitEdgeIntent, toggleEdgeList, showEdgeList]);

  const handleSelectEdgeFromList = useCallback((edgeId, openProperties = false) => {
    if (!edgeId) return;
    emitEdgeIntent('edgeListSelect', { edgeId });
    if (typeof setSelectedNodeIds === 'function') {
      setSelectedNodeIds([]);
    }
    if (typeof setSelectedEdgeIds === 'function') {
      setSelectedEdgeIds([edgeId]);
    }
    handlers?.handleEdgeFocus?.(edgeId);
    if (openProperties && typeof setShowPropertiesPanel === 'function') {
      setShowPropertiesPanel(true);
    }
  }, [emitEdgeIntent, setSelectedEdgeIds, setSelectedNodeIds, setShowPropertiesPanel, handlers]);

  const handleCloseEntitiesPanel = useCallback(() => {
    if (typeof setShowEntitiesPanel === 'function') {
      setShowEntitiesPanel(false);
    }
  }, [setShowEntitiesPanel]);

  const handleToggleNodePaletteIntent = useCallback(() => {
    emitEdgeIntent('toggleNodePalette', { open: !showNodePalette });
    toggleNodePalette?.();
  }, [emitEdgeIntent, toggleNodePalette, showNodePalette]);

const skipPropertiesCloseRef = useRef(false);

  const handleToggleEdgePanelIntent = useCallback(() => {
    emitEdgeIntent('openDocumentPropertiesTab', { tab: 'layout' });
    if (typeof setShowDocumentPropertiesDialog === 'function') {
      setShowDocumentPropertiesDialog(true);
    }
    eventBus.emit('openDocumentPropertiesTab', { tab: 'layout' });
  }, [emitEdgeIntent, setShowDocumentPropertiesDialog]);

  const focusNodeFromEntities = useCallback(
    (nodeId) => {
      emitEdgeIntent('nodeListSelect', { nodeId, multiSelect: false });
      handlers?.handleNodeListSelect?.(nodeId, false);
      handlers?.handleNodeFocus?.(nodeId);
    },
    [emitEdgeIntent, handlers]
  );

  const focusGroupFromEntities = useCallback(
    (clusterId) => {
      emitEdgeIntent('groupListSelect', { clusterId, multiSelect: false });
      handlers?.handleGroupListSelect?.(clusterId, false);
      handlers?.handleGroupFocus?.(clusterId);
    },
    [emitEdgeIntent, handlers]
  );

  const handleEntitiesPanelSelectGroup = useCallback(
    (clusterId, openProperties = false) => {
      focusGroupFromEntities(clusterId);
      if (openProperties && typeof setShowPropertiesPanel === 'function') {
        setShowPropertiesPanel(true);
      }
    },
    [focusGroupFromEntities, setShowPropertiesPanel]
  );

  const handleEntitiesPanelSelectNode = useCallback(
    (nodeId, openProperties = false) => {
      focusNodeFromEntities(nodeId);
      if (openProperties && typeof setShowPropertiesPanel === 'function') {
        setShowPropertiesPanel(true);
      }
    },
    [focusNodeFromEntities, setShowPropertiesPanel]
  );

  const handleSelectEdgeFromProperties = useCallback((edgeId) => {
    if (!edgeId) return;
    emitEdgeIntent('selectEdgeFromProperties', { edgeId });
    skipPropertiesCloseRef.current = true;
    if (typeof setSelectedEdgeIds === 'function') {
      setSelectedEdgeIds([edgeId]);
    }
    if (typeof setSelectedNodeIds === 'function') {
      setSelectedNodeIds([]);
    }
    if (typeof setShowPropertiesPanel === 'function') {
      setShowPropertiesPanel(true);
    }
  }, [emitEdgeIntent, setSelectedEdgeIds, setSelectedNodeIds, setShowPropertiesPanel]);

  const handleSelectNodeFromProperties = useCallback(
    (nodeId) => {
      emitEdgeIntent('selectNodeFromProperties', { nodeId });
      focusNodeFromEntities(nodeId);
      if (typeof setShowPropertiesPanel === 'function') {
        setShowPropertiesPanel(true);
      }
    },
    [emitEdgeIntent, focusNodeFromEntities, setShowPropertiesPanel]
  );

  const handleCanvasBackgroundClick = useCallback(() => {
    if (typeof setShowPropertiesPanel === 'function' && showPropertiesPanel) {
      setShowPropertiesPanel(false);
    }
    if (showEntitiesPanel) {
      handleCloseEntitiesPanel();
    }
  }, [setShowPropertiesPanel, showPropertiesPanel, showEntitiesPanel, handleCloseEntitiesPanel]);

  const handleCloseEdgePanel = useCallback(() => {
    if (typeof setShowEdgePanel === 'function') {
      setShowEdgePanel(false);
    }
  }, [setShowEdgePanel]);

  const handleOpenDocumentPropertiesIntent = useCallback(() => {
    emitEdgeIntent('openDocumentProperties');
    handleOpenDocumentProperties?.();
  }, [emitEdgeIntent, handleOpenDocumentProperties]);

  useEffect(() => {
    const handleOpenDocumentPropertiesEvent = () => {
      handleOpenDocumentPropertiesIntent();
    };
    eventBus.on('openDocumentProperties', handleOpenDocumentPropertiesEvent);
    return () => {
      eventBus.off('openDocumentProperties', handleOpenDocumentPropertiesEvent);
    };
  }, [handleOpenDocumentPropertiesIntent]);

  useEffect(() => {
    const selectionCount =
      (selectedNodeIds.length || 0) +
      (selectedEdgeIds.length || 0) +
      (selectedGroupIds.length || 0);
    if (selectionCount === 0 && showPropertiesPanel) {
      if (!skipPropertiesCloseRef.current) {
        setShowPropertiesPanel(false);
      }
    } else if (selectionCount > 0) {
      skipPropertiesCloseRef.current = false;
    }
  }, [selectedNodeIds, selectedEdgeIds, selectedGroupIds, showPropertiesPanel, setShowPropertiesPanel]);

  const handleNodeListFocusIntent = useCallback((nodeId) => {
    emitEdgeIntent('nodeListFocus', { nodeId });
    handlers?.handleNodeFocus?.(nodeId);
  }, [emitEdgeIntent, handlers]);

  const handleNodeListCloseIntent = useCallback(() => {
    emitEdgeIntent('closeNodeList');
    setShowNodeList(false);
  }, [emitEdgeIntent]);

  const handleGroupListSelectIntent = useCallback((clusterId, multiSelect) => {
    emitEdgeIntent('groupListSelect', { clusterId, multiSelect });
    handlers?.handleGroupListSelect?.(clusterId, multiSelect);
  }, [emitEdgeIntent, handlers]);

  const handleGroupListFocusIntent = useCallback((clusterId) => {
    emitEdgeIntent('groupListFocus', { clusterId });
    handlers?.handleGroupFocus?.(clusterId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupListDoubleClickIntent = useCallback((clusterId) => {
    emitEdgeIntent('groupListDoubleClick', { clusterId });
    handlers?.handleGroupDoubleClickFromList?.(clusterId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupToggleVisibilityIntent = useCallback((clusterId) => {
    emitEdgeIntent('groupToggleVisibility', { clusterId });
    handlers?.handleGroupToggleVisibility?.(clusterId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupDeleteIntent = useCallback((clusterId) => {
    emitEdgeIntent('groupDelete', { clusterId });
    handlers?.handleGroupDelete?.(clusterId);
  }, [emitEdgeIntent, handlers]);

  const handleGroupListCloseIntent = useCallback(() => {
    emitEdgeIntent('closeGroupList');
    setShowGroupList(false);
  }, [emitEdgeIntent]);

  const content = (
    <div
      id="graph-editor-background"
      role="application"
      aria-label="Node graph editor"
      style={{
        minHeight: '100vh',
        minWidth: '100vw',
        backgroundColor: theme.palette.background.default,
        backgroundImage: backgroundImage ? `url('/background art/${backgroundImage}')` : undefined,
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative'
      }}
    >
      {backgroundUrl && (
        <BackgroundFrame
          ref={bgRef}
          url={backgroundUrl}
          interactive={backgroundInteractive}
          onHandshakeComplete={handleHandshakeComplete}
        />
      )}

      {!isMobile && (
        <Toolbar
          host={host}
          uiTheme={documentMuiTheme}
          documentAccess={documentAccess}
          onToggleNodeList={handleToggleNodeListIntent}
          showNodeList={showNodeList}
          onToggleGroupList={handleToggleGroupListIntent}
          showGroupList={showGroupList}
          onToggleEdgeList={handleToggleEdgeListIntent}
          showEdgeList={showEdgeList}
          onToggleNodePalette={handleToggleNodePaletteIntent}
          nodes={nodes}
          edges={edges}
          groups={groups}
          onLoadGraph={handleImportGraph}
          onCreateBlankGraph={handleCreateBlankGraph}
          onDeleteSelected={handleDeleteSelectedIntent}
          onClearGraph={handleClearGraphIntent}
          onUndo={handleUndoIntent}
          onRedo={handleRedoIntent}
          selectedNodeId={selectedNodeIds[0] || null}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeId={selectedEdgeIds[0] || null}
          canUndo={historyHook.canUndo}
          canRedo={historyHook.canRedo}
          mode={modesHook.mode}
          autoLayoutType={modesHook.autoLayoutType}
          onModeChange={modesHook.handleModeChange}
          interactionMode={interactionMode}
          onInteractionModeChange={handleInteractionModeChange}
          onAutoLayoutChange={modesHook.setAutoLayoutType}
          onApplyLayout={handleApplyLayout}
          onAlignSelection={handleAlignSelection}
          onDistributeSelection={handleDistributeSelection}
          onShowMessage={showSnackbar}
          pan={pan}
          zoom={zoom}
          setNodes={setNodes}
          setEdges={setEdges}
          setGroups={setGroups}
          nodesRef={nodesRef}
          edgesRef={edgesRef}
          saveToHistory={historyHook.saveToHistory}
          graphCRUD={graphCRUD}
          currentTheme={theme.palette.mode}
          backgroundImage={backgroundImage}
          backgroundUrl={backgroundUrl}
          setBackgroundUrl={setBackgroundUrl}
          focusedFragmentId={focusedFragmentId}
          defaultNodeColor={defaultNodeColor}
          defaultEdgeColor={defaultEdgeColor}
          isFreeUser={isFreeUser}
          showMinimap={showMinimap}
          onToggleMinimap={handleToggleMinimap}
          snapToGrid={snapToGrid}
          showPorts={interactionMode === 'edit'}
          onToggleSnapToGrid={handleToggleSnapToGrid}
          gridSize={documentSettings.gridSize}
          edgeRouting={documentSettings.edgeRouting || 'auto'}
          onEdgeRoutingChange={handleEdgeRoutingChange}
          onRerouteEdges={handleRerouteEdges}
          githubSettings={documentSettings.github}
          onToggleProperties={handleTogglePropertiesPanelIntent}
          onOpenDocumentProperties={handleOpenDocumentPropertiesIntent}
          documentTheme={documentTheme}
          addressBarHeight={addressBarHeight}
          isMobile={isMobile}
          isSmallScreen={isSmallScreen}
          isPortrait={isPortrait}
          isLandscape={isLandscape}
          onToggleLayoutPanel={handleToggleEdgePanelIntent}
          onTogglePropertiesPanel={handleTogglePropertiesPanelIntent}
          onToggleEdgeList={handleToggleEdgeListIntent}
          onToggleSystemNodesPanel={toggleSystemNodesPanel}
          showEdgePanel={showEdgePanel}
          showPropertiesPanel={showPropertiesPanel}
          showSystemNodesPanel={showSystemNodesPanel}
          showEdgeList={showEdgeList}
          dockInBrowserBar={false}
          uiDensity={normalizedUiDensity}
        />
      )}

      {isMobile && <MobileFabToolbar />}

      {!isMobile && editorFocusIndicatorEnabled && (
        <Box
          sx={{
            position: 'fixed',
            right: `${focusDebugRightOffset}px`,
            bottom: `${focusDebugBottomOffset}px`,
            zIndex: (theme) => theme.zIndex.drawer + 1,
            px: 1,
            py: 0.75,
            borderRadius: 1,
            bgcolor: 'rgba(18, 18, 18, 0.82)',
            color: 'common.white',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 3,
            minWidth: 180,
            pointerEvents: 'none'
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.3 }}>
            Focus
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
            mode: {interactionMode || 'browse'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
            level: {focusDebugFocusedLevel}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
            node: {focusedNodeId || '-'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
            fragment: {focusedFragmentId || focusDebugFocusedScope}
          </Typography>
        </Box>
      )}

      {!isMobile && (
        <Button
          variant="contained"
          size="small"
          onClick={toggleSystemNodesPanel}
          sx={{
            position: 'fixed',
            left: showSystemNodesPanel ? Math.max(0, systemNodesPanelWidth - 1) : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: (theme) => theme.zIndex.drawer + 1,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
            minWidth: 0,
            px: 0.8,
            py: 1.2,
            bgcolor: showSystemNodesPanel ? 'secondary.main' : 'primary.main',
            color: showSystemNodesPanel ? 'secondary.contrastText' : 'primary.contrastText',
            '&:hover': {
              bgcolor: showSystemNodesPanel ? 'secondary.dark' : 'primary.dark'
            }
          }}
          aria-label={showSystemNodesPanel ? "Close Legend" : "Open Legend"}
        >
          Legend
        </Button>
      )}

      {!isMobile && (
        <Button
          variant="contained"
          size="small"
          onClick={() => {
            if (showEntitiesPanel) {
              setShowEntitiesPanel?.(false);
              return;
            }
            if (typeof setEntityView === 'function' && !entityView) {
              setEntityView('nodes');
            }
            setShowEntitiesPanel?.(true);
          }}
          sx={{
            position: 'fixed',
            right: showEntitiesPanel ? Math.max(0, panelWidths.entities - 1) : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: (theme) => theme.zIndex.drawer + 1,
            writingMode: 'vertical-lr',
            textOrientation: 'mixed',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
            minWidth: 0,
            px: 0.8,
            py: 1.2,
            bgcolor: showEntitiesPanel ? 'secondary.main' : 'primary.main',
            color: showEntitiesPanel ? 'secondary.contrastText' : 'primary.contrastText',
            '&:hover': {
              bgcolor: showEntitiesPanel ? 'secondary.dark' : 'primary.dark'
            }
          }}
          aria-label={showEntitiesPanel ? "Close Elements" : "Open Elements"}
        >
          Elements
        </Button>
      )}

      <MobileAddNodeSheet
        open={Boolean(isMobile && mobileAddNodeOpen)}
        onClose={handleCloseMobileAddNode}
        search={mobileAddNodeSearch}
        onSearchChange={setMobileAddNodeSearch}
      />

      <PropertiesPanel
        open={showPropertiesPanel}
        selectedNode={selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : null}
        selectedEdge={selectedEdgeIds.length === 1 ? edges.find(e => e.id === selectedEdgeIds[0]) : null}
        selectedGroup={selectedGroupIds.length === 1 ? groups.find(g => g.id === selectedGroupIds[0]) : null}
        nodes={nodes}
        edges={edges}
        nodeTypeOptions={nodeTypeOptions}
        onSelectNode={handleSelectNodeFromProperties}
          onUpdateNode={handleUpdateNodeFromPanels}
          onUpdateEdge={handleUpdateEdgeFromPanels}
          onUpdateGroup={(id, updates) => {
            emitEdgeIntent('updateGroup', { clusterId: id, changeCount: Object.keys(updates || {}).length });
            setGroups(prev => {
              const next = prev.map(g => g.id === id ? { ...g, ...updates } : g);
              const updatedGroup = next.find(g => g.id === id);
              if (updatedGroup) {
                try {
          eventBus.emit('groupUpdated', { id, patch: updates || {}, group: updatedGroup });
        } catch (err) {
          // ignore event bus errors
        }
      }
      return next;
    });
  }}
          onSelectEdge={handleSelectEdgeFromProperties}
          theme={theme}
          defaultNodeColor={defaultNodeColor}
          defaultEdgeColor={defaultEdgeColor}
          lockedNodes={lockedNodes}
          lockedEdges={lockedEdges}
          lockedGroups={groupManager?.lockedGroups}
          onToggleNodeLock={(nodeId) => {
            setLockedNodes(prev => {
              const newSet = new Set(prev);
              if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
              } else {
                newSet.add(nodeId);
              }
              return newSet;
            });
          }}
          onToggleEdgeLock={(edgeId) => {
            setLockedEdges(prev => {
              const newSet = new Set(prev);
              if (newSet.has(edgeId)) {
                newSet.delete(edgeId);
              } else {
                newSet.add(edgeId);
              }
              return newSet;
            });
          }}
          onToggleGroupLock={groupManager?.toggleGroupLock}
          onClose={() => setShowPropertiesPanel(false)}
          anchor={panelAnchor}
          onAnchorChange={handlePropertiesPanelAnchorChange}
          isMobile={isMobile}
          onResize={setPropertiesPanelWidth}
        memoAutoExpandToken={memoAutoExpandToken}
      />

      <SystemNodesPanel
        open={showSystemNodesPanel}
        anchor="left"
        nodes={nodes}
        validationReport={invariantReport}
        onValidationItemFocus={({ type, id } = {}) => {
          if (!id) return;
          if (type === 'edge') {
            handleSelectEdgeFromList(id, false);
            return;
          }
          if (type === 'group') {
            handleEntitiesPanelSelectGroup(id, false);
            return;
          }
          handleEntitiesPanelSelectNode(id, false);
        }}
        onValidationItemOpen={({ type, id } = {}) => {
          if (!id) return;
          if (type === 'edge') {
            handleSelectEdgeFromList(id, true);
            return;
          }
          if (type === 'group') {
            handleEntitiesPanelSelectGroup(id, true);
            return;
          }
          handleEntitiesPanelSelectNode(id, true);
        }}
        width={systemNodesPanelWidth}
        onWidthChange={setSystemNodesPanelWidth}
        onUpdateNode={handleUpdateNodeFromPanels}
        onClose={() => setShowSystemNodesPanel?.(false)}
        uiDensity={normalizedUiDensity}
      />

          <EntitiesPanel
            open={showEntitiesPanel}
            anchor={entitiesAnchor}
            width={panelWidths.entities}
            uiDensity={normalizedUiDensity}
            entityView={entityView}
            nodes={nodes}
            edges={edges}
            groups={groups}
            selectedNodeId={selectedNodeIds[0] || null}
            selectedEdgeId={selectedEdgeIds[0] || null}
            selectedGroupId={selectedGroupIds[0] || null}
            onSelectNode={handleEntitiesPanelSelectNode}
            onSelectEdge={handleSelectEdgeFromList}
            onSelectGroup={handleEntitiesPanelSelectGroup}
            onEntityViewChange={(view) => setEntityView?.(view)}
            onClose={handleCloseEntitiesPanel}
          />

      <NodePalettePanel
        open={showNodePalette}
        onClose={() => setShowNodePalette(false)}
      />
      {showNewTabPage ? (
        <NewTabPage
          onCreateBlank={handleCreateBlankGraph}
          onImportGraph={handleImportGraph}
          onShowMessage={showSnackbar}
          recentSnapshots={recentSnapshots}
          isFreeUser={isFreeUser}
        />
      ) : !hostLoadReady ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: theme.palette.background.default,
            zIndex: 0
          }}
        />
      ) : (
        createGraphRenderer()
      )}

      {!isEmbedded && <ScriptRunner onRequest={handleScriptRequest} />}
      <DocumentPropertiesDialog
        open={showDocumentPropertiesDialog}
        onClose={() => setShowDocumentPropertiesDialog(false)}
        host={host}
        backgroundUrl={backgroundUrl}
        setBackgroundUrl={setBackgroundUrl}
        documentSettings={documentSettings}
        onDocumentSettingsChange={setDocumentSettings}
        onApplyLayout={handleApplyLayout}
        projectMeta={projectMeta}
        onProjectMetaChange={handleUpdateProjectMeta}
        onResetProjectMeta={handleResetProjectMeta}
        graphStats={graphStats}
        recentSnapshots={recentSnapshots}
        storySnapshots={storySnapshots}
      />
      <Drawer
        anchor="bottom"
        open={nodeEditorPanel.open}
        onClose={() => handleCloseEditorPanel()}
        PaperProps={{
          sx: {
            height: '40vh',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1">
                {editorPanelNode?.label || editorPanelNode?.type || 'Editor'}
              </Typography>
              {editorPanelDirty && (
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: theme.palette.warning.main }} />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {editorPanelDirty ? 'Unsaved changes' : 'No pending changes'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {nodeEditorCommitError && (
              <Typography variant="caption" sx={{ color: theme.palette.error.main, maxWidth: 220 }} title={nodeEditorCommitError}>
                {nodeEditorCommitError}
              </Typography>
            )}
            <button
              type="button"
              onClick={handleResetEditor}
              disabled={!editorPanelDirty}
              style={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                color: theme.palette.text.primary,
                background: theme.palette.background.paper,
                cursor: editorPanelDirty ? 'pointer' : 'not-allowed',
                opacity: editorPanelDirty ? 1 : 0.5
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommitAndClose}
              disabled={!editorPanelDirty || nodeEditorCommitPending}
              style={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                color: theme.palette.text.primary,
                background: theme.palette.background.paper,
                cursor: !editorPanelDirty || nodeEditorCommitPending ? 'not-allowed' : 'pointer',
                opacity: !editorPanelDirty || nodeEditorCommitPending ? 0.5 : 1
              }}
            >
              Done
            </button>
            <IconButton
              size="small"
              onClick={() => handleCloseEditorPanel()}
              aria-label="Close editor"
            >
              ×
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {editorPanelNode && editorPanelEntry ? (
            <DynamicViewNode
              node={editorPanelNode}
              viewEntry={editorPanelEntry}
              viewDefinition={editorPanelDefinition}
              renderInPanel={true}
            />
          ) : (
            <Box sx={{ p: 2, color: theme.palette.text.secondary }}>
              No editor view defined for this node.
            </Box>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.autoHideDuration ?? 6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity || 'info'}
          action={snackbar.action || null}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      <Menu
        open={Boolean(nodeContextMenu)}
        onClose={() => setNodeContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          nodeContextMenu
            ? { top: nodeContextMenu.mouseY, left: nodeContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            const node = nodes?.find((candidate) => candidate.id === nodeContextMenu?.nodeId);
            if (!node) {
              showSnackbar('No node selected.', 'warning');
              setNodeContextMenu(null);
              return;
            }
            if (!isNodeExecutable(node)) {
              showSnackbar('This node type is not executable.', 'warning');
              setNodeContextMenu(null);
              return;
            }
            const result = graphCRUD?.executeNode?.(node.id, { source: 'context-menu' });
            if (!result || result.success === false) {
              showSnackbar(result?.error || 'Failed to run node.', 'error');
            } else {
              showSnackbar('Node execution requested.', 'success');
            }
            setNodeContextMenu(null);
          }}
        >
          Run Node
        </MenuItem>
        <MenuItem
          onClick={() => {
            const definitionUrl = resolveDefinitionUrl(nodeContextMenu?.nodeId);
            if (!definitionUrl) {
              showSnackbar('No definition found for this node type.', 'warning');
              setNodeContextMenu(null);
              return;
            }
            eventBus.emit('fetchUrl', { url: definitionUrl, source: 'node-definition' });
            setNodeContextMenu(null);
          }}
        >
          Open Definition
        </MenuItem>
      </Menu>

      <Backdrop sx={{ color: '#fff', zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1 }} open={Boolean(loading)}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );

  return documentMuiTheme ? (
    <MuiThemeProvider theme={documentMuiTheme}>
      {content}
    </MuiThemeProvider>
  ) : content;
};

export default GraphEditorContent;
