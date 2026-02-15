"use client";

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { Snackbar, Alert, Backdrop, CircularProgress, Menu, MenuItem, Drawer, Box, IconButton, Typography } from '@mui/material';
import GraphRendererAdapter from './renderers/GraphRendererAdapter';
import Toolbar from './components/Toolbar';
import MobileFabToolbar from './components/MobileFabToolbar';
import MobileAddNodeSheet from './components/MobileAddNodeSheet';
import PropertiesPanel from './components/PropertiesPanel';
import NodePalettePanel from './components/NodePalettePanel';
import DocumentPropertiesDialog from './components/DocumentPropertiesDialog';
import NewTabPage from './components/NewTabPage';
import ScriptRunner from './Scripting/ScriptRunner';
import ScriptPanel from './Scripting/ScriptPanel';
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
import {
  useGraphEditorStateContext,
  useGraphEditorLayoutContext,
  useGraphEditorServicesContext,
  useGraphEditorHistoryContext,
  useGraphEditorRpcContext
} from './providers/GraphEditorContext';
import useIntentEmitter from './hooks/useIntentEmitter';
import EdgeLayoutPanel from './components/EdgeLayoutPanel';
import { summarizeContracts } from './contracts/contractManager';

const PANEL_WIDTHS = {
  entities: 320,
  layout: 380
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
  const [propertiesPanelWidth, setPropertiesPanelWidth] = useState(420);
  const [nodeContextMenu, setNodeContextMenu] = useState(null);
  const [nodeEditorPanel, setNodeEditorPanel] = useState({ open: false, nodeId: null });
  const [nodeEditorDirty, setNodeEditorDirty] = useState({ nodeId: null, dirty: false });
  const [nodeEditorCommitPending, setNodeEditorCommitPending] = useState(false);
  const [nodeEditorCommitError, setNodeEditorCommitError] = useState(null);
  const [viewDefinitions, setViewDefinitions] = useState({});
  const viewDefinitionsRef = useRef({});
  const isDraggingRef = useRef(false);

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
    handleOpenDocumentProperties,
    handleOpenMobileAddNode,
    handleCloseMobileAddNode,
    togglePropertiesPanel,
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
  const oppositeAnchor = panelAnchor === "left" ? "right" : "left";

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
    handleScriptRequest
  } = services || {};

  const { emitEdgeIntent } = useIntentEmitter();

  const {
    bgRef,
    handleHandshakeComplete
  } = rpc || {};

  const [editorThemeConfig, setEditorThemeConfig] = useState(null);
  const [editorWatermarkEnabled, setEditorWatermarkEnabled] = useState(true);
  const [editorWatermarkStrength, setEditorWatermarkStrength] = useState(100);
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
    if (typeof window === 'undefined') return;
    const settings = loadSettings();
    setEditorWatermarkEnabled(settings?.watermarkEnabled !== false);
    setEditorWatermarkStrength(
      typeof settings?.watermarkStrength === 'number'
        ? Math.max(0, Math.min(100, settings.watermarkStrength))
        : 100
    );
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

  const handleApplyLayout = useCallback(() => {
    emitEdgeIntent('applyLayout', { layoutType: modesHook.autoLayoutType });
    modesHook.applyAutoLayout();
  }, [emitEdgeIntent, modesHook.applyAutoLayout, modesHook.autoLayoutType]);

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
      return nodeTypeMetadata.map((meta) => ({
        value: meta.type,
        label: meta.label || meta.type
      }));
    }
    if (nodeTypes && typeof nodeTypes === "object") {
      return Object.keys(nodeTypes).map((type) => ({ value: type, label: type }));
    }
    return [];
  }, [nodeTypeMetadata, nodeTypes]);

  useEffect(() => {
    viewDefinitionsRef.current = viewDefinitions;
  }, [viewDefinitions]);

  const [resolvedDictionary, setResolvedDictionary] = useState(null);
  const definitionDictionaryCacheRef = useRef({});

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
      ? nodes.find((candidate) => candidate.type === 'dictionary' && clusterList.some((cluster) => cluster.id === nodeClusterId && Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)))
      : null;
    const rootDictionary = nodes.find((candidate) => candidate.type === 'dictionary' && !clusterList.some((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)));
    return (
      resolvedDictionary ||
      dictionaryInCluster ||
      rootDictionary ||
      nodes.find((candidate) => candidate.type === 'dictionary') ||
      implicitDictionaryRef.current
    );
  }, [nodes, groups, resolvedDictionary]);

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
        ? nodes.find((candidate) => candidate.type === 'dictionary' && clusterList.some((cluster) => cluster.id === manifestClusterId && Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)))
        : null;
      const rootDictionary = nodes.find((candidate) => candidate.type === 'dictionary' && !clusterList.some((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)));
      return (
        dictionaryInManifestCluster ||
        rootDictionary ||
        nodes.find((candidate) => candidate.type === 'dictionary') ||
        implicitDictionaryRef.current
      );
    })();

    if (!hostDictionary) {
      setResolvedDictionary(null);
      return undefined;
    }

    const hostData = hostDictionary.data || {};
    const hostNodeDefs = Array.isArray(hostData.nodeDefs) ? hostData.nodeDefs : [];
    const hostViews = Array.isArray(hostData.views) ? hostData.views : [];
    const hostSkills = Array.isArray(hostData.skills) ? hostData.skills : [];

    const refs = hostNodeDefs
      .map((entry) => entry?.ref || entry?.path || entry?.file)
      .filter(Boolean);

    const loadDefinitions = async () => {
      const importedNodeDefs = [];
      const importedViews = [];
      const importedSkills = [];
      const warnings = [];
      for (const ref of refs) {
        if (!ref) continue;
        if (!definitionDictionaryCacheRef.current[ref]) {
          try {
            let text = null;
            const publicPath = resolvePublicPath(ref);
            if (publicPath) {
              const hostResult = await readFileViaHost(publicPath);
              if (hostResult && !hostResult.error) {
                text = hostResult.text || '';
              }
            }
            if (text === null) {
              const response = await fetch(ref);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              text = await response.text();
            }
            const parsed = JSON.parse(text);
            const parsedNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
            const dictNode = parsedNodes.find((candidate) => candidate?.type === 'dictionary') || null;
            const requiresDictionary = parsedNodes
              .filter((candidate) => candidate?.type === 'manifest')
              .some((manifest) => manifest?.data?.requiresDictionary === true);
            definitionDictionaryCacheRef.current[ref] = dictNode?.data || null;
            if (!dictNode && requiresDictionary) {
              warnings.push(`Definition graph declares dictionary requirement but has none in ${ref}`);
            }
          } catch (err) {
            definitionDictionaryCacheRef.current[ref] = null;
            warnings.push(`Failed to load ${ref}`);
          }
        }
        const dictData = definitionDictionaryCacheRef.current[ref];
        if (!dictData) continue;
        if (Array.isArray(dictData.nodeDefs)) importedNodeDefs.push(...dictData.nodeDefs);
        if (Array.isArray(dictData.views)) importedViews.push(...dictData.views);
        if (Array.isArray(dictData.skills)) importedSkills.push(...dictData.skills);
      }

      if (!active) return;
      const mergedNodeDefs = mergeDictionaryEntries(hostNodeDefs, importedNodeDefs);
      const mergedViews = mergeDictionaryEntries(hostViews, importedViews);
      const mergedSkills = mergeDictionaryEntries(hostSkills, importedSkills);
      setResolvedDictionary({
        ...hostDictionary,
        data: {
          ...hostData,
          nodeDefs: mergedNodeDefs,
          views: mergedViews,
          skills: mergedSkills
        }
      });

      if (warnings.length > 0) {
        try {
          setSnackbar((prev) => ({
            ...prev,
            open: true,
            message: `Dictionary load: ${warnings[0]}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}`,
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
  }, [nodes, groups, mergeDictionaryEntries]);

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

  const resolveViewEntry = useCallback((node) => {
    if (!node) return null;
    const dictionary = resolveDictionaryForNode(node);
    const views = Array.isArray(dictionary?.data?.views) ? dictionary.data.views : [];
    const lookupKey = node?.data?.dictionaryKey || node?.data?.definitionKey || node?.type;
    const matches = views.filter((entry) => {
      if (!entry) return false;
      return entry.key === lookupKey || entry.nodeType === lookupKey || entry.type === lookupKey;
    });
    if (matches.length === 0) return null;
    const nodeView = matches.find((entry) => {
      const payload = entry.payload || entry.view || '';
      return entry.intent === 'node' || payload === 'node.web';
    });
    return nodeView || matches[0] || null;
  }, [resolveDictionaryForNode]);

  const resolveEditorViewEntry = useCallback((node) => {
    if (!node) return null;
    const dictionary = resolveDictionaryForNode(node);
    const views = Array.isArray(dictionary?.data?.views) ? dictionary.data.views : [];
    const lookupKey = node?.data?.dictionaryKey || node?.data?.definitionKey || node?.type;
    const matched = views.find((entry) => {
      if (!entry) return false;
      const keyMatches = entry.key === lookupKey || entry.nodeType === lookupKey || entry.type === lookupKey;
      if (!keyMatches) return false;
      const payload = entry.payload || entry.view || '';
      return entry.intent === 'editor' || payload === 'editor.web';
    }) || null;
    if (matched) return matched;

    const nodeEntry = resolveViewEntry(node);
    if (!nodeEntry?.ref) return null;
    const def = viewDefinitionsRef.current[nodeEntry.ref] || null;
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
  }, [resolveDictionaryForNode, resolveViewEntry]);

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

  const validateEditorFields = useCallback((viewNodes = [], ref = '') => {
    const warnings = [];
    const allowedTypes = new Set(['text', 'markdown', 'number', 'boolean']);
    viewNodes.forEach((viewNode) => {
      const viewData = viewNode?.data?.view || {};
      const payload = viewData.payload || '';
      const isEditor = viewData.intent === 'editor' || payload === 'editor.web';
      if (!isEditor) return;
      const editorWeb = viewNode?.data?.editor?.web || {};
      if (!('fields' in editorWeb)) return;
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
    });
    return warnings;
  }, []);

  const requestViewDefinition = useCallback((ref) => {
    if (!ref) return;
    const current = viewDefinitionsRef.current[ref];
    if (current && (current.status === 'loading' || current.status === 'ready')) return;
    setViewDefinitions((prev) => ({ ...prev, [ref]: { status: 'loading' } }));
    Promise.resolve()
      .then(async () => {
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
      })
      .then((text) => {
        const parsed = JSON.parse(text);
        const parsedNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
        const viewNodes = parsedNodes.filter((candidate) => candidate?.type === 'view');
        if (!viewNodes.length) {
          throw new Error('No view node found');
        }
        const editorWarnings = validateEditorFields(viewNodes, ref);
        setViewDefinitions((prev) => ({
          ...prev,
          [ref]: { status: 'ready', viewNodes }
        }));
        if (editorWarnings.length > 0) {
          try {
            setSnackbar((prev) => ({
              ...prev,
              open: true,
              message: `Editor schema: ${editorWarnings[0]}${editorWarnings.length > 1 ? ` (+${editorWarnings.length - 1} more)` : ''}`,
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
  }, [readFileViaHost, resolvePublicPath, validateEditorFields]);

  useEffect(() => {
    if (!Array.isArray(nodes)) return;
    const refs = new Set();
    nodes.forEach((node) => {
      if (!node || nodeTypes?.[node.type]) return;
      if (typeof node?.type === 'string' && node.type.includes(':')) return;
      const entry = resolveViewEntry(node);
      if (entry?.ref) refs.add(entry.ref);
    });
    refs.forEach((ref) => requestViewDefinition(ref));
  }, [nodes, nodeTypes, resolveViewEntry, requestViewDefinition]);

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
        if (nodeEditorCommitPending && nodeEditorPanel.open && nodeEditorPanel.nodeId === nodeId) {
          setNodeEditorPanel({ open: false, nodeId: null });
          setNodeEditorCommitPending(false);
        }
      } else if (error) {
        setNodeEditorCommitError(String(error));
        setNodeEditorCommitPending(false);
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
    () => (editorPanelNode ? resolveEditorViewEntry(editorPanelNode) : null),
    [editorPanelNode, resolveEditorViewEntry]
  );

  useEffect(() => {
    if (!nodeEditorPanel.open) return;
    if (editorPanelEntry?.ref) {
      requestViewDefinition(editorPanelEntry.ref);
    }
  }, [nodeEditorPanel.open, editorPanelEntry?.ref, requestViewDefinition]);

  const editorPanelDefinition = (() => {
    if (!editorPanelEntry?.ref) return null;
    const def = viewDefinitionsRef.current[editorPanelEntry.ref] || null;
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
  })();

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
  }, [editorPanelDirty, editorPanelNode?.id]);

  const handleCommitAndClose = useCallback(() => {
    if (!editorPanelNode?.id) return;
    setNodeEditorCommitPending(true);
    setNodeEditorCommitError(null);
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
        if (edgeSourceHandle !== sourcePort) return;
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
      if (oppositeAnchor === 'left') {
        offsets.left = Math.max(offsets.left, PANEL_WIDTHS.entities);
      } else if (oppositeAnchor === 'right') {
        offsets.right = Math.max(offsets.right, PANEL_WIDTHS.entities);
      }
    }
    if (showEdgePanel) {
      offsets.right = Math.max(offsets.right, PANEL_WIDTHS.layout);
    }
    return offsets;
  }, [oppositeAnchor, panelAnchor, propertiesPanelWidth, showEdgePanel, showEntitiesPanel, showPropertiesPanel]);
  const resolveDefinitionUrl = useCallback((nodeId) => {
    if (!nodeId) return null;
    const node = nodes?.find((candidate) => candidate.id === nodeId);
    if (!node) return null;

    const clusterList = Array.isArray(groups) ? groups : [];
    const nodeClusterId = clusterList.find((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(node.id))?.id || null;
    const dictionaryInCluster = nodeClusterId
      ? nodes?.find((candidate) => candidate.type === 'dictionary' && clusterList.some((cluster) => cluster.id === nodeClusterId && Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)))
      : null;
    const rootDictionary = nodes?.find((candidate) => candidate.type === 'dictionary' && !clusterList.some((cluster) => Array.isArray(cluster.nodeIds) && cluster.nodeIds.includes(candidate.id)));
    const dictionary = resolvedDictionary || dictionaryInCluster || rootDictionary || nodes?.find((candidate) => candidate.type === 'dictionary');

    const entries = Array.isArray(dictionary?.data?.nodeDefs) ? dictionary.data.nodeDefs : [];
    const match = entries.find((entry) => {
      if (!entry) return false;
      return entry.nodeType === node.type || entry.type === node.type || entry.key === node.type;
    });
    return match?.ref || match?.file || match?.path || null;
  }, [nodes, groups, resolvedDictionary]);

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
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    setNodeContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      nodeId
    });
  }, [setSelectedNodeIds, setSelectedEdgeIds, setSelectedGroupIds]);

  const handleNodeDoubleClickOpenProperties = useCallback((nodeId) => {
    if (!nodeId) return;
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    setShowPropertiesPanel(true);
  }, [setSelectedNodeIds, setSelectedEdgeIds, setSelectedGroupIds, setShowPropertiesPanel]);

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

  const createGraphRenderer = () => (
    <GraphRendererAdapter
      graphKey={graphRendererKey}
      nodeTypes={nodeTypes}
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

  useEffect(() => {
    const handleNodeDragEndIntent = () => {
      emitEdgeIntent('nodeDragEnd');
    };
    eventBus.on('nodeDragEnd', handleNodeDragEndIntent);
    return () => {
      eventBus.off('nodeDragEnd', handleNodeDragEndIntent);
    };
  }, [emitEdgeIntent]);

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
    const legendNode = createDefaultLegendNode();
    const dictionaryNode = createDefaultDictionaryNode();
    const nextNodes = [manifestNode, legendNode, dictionaryNode];
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
    setSelectedNodeIds([manifestNode.id]);
  }, [loadGraph, setNodes, nodesRef, setEdges, edgesRef, setGroups, historyHook, setSelectedNodeIds]);

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

  const handleSelectEdgeFromList = useCallback((edgeId) => {
    if (!edgeId) return;
    emitEdgeIntent('edgeListSelect', { edgeId });
    if (typeof setSelectedNodeIds === 'function') {
      setSelectedNodeIds([]);
    }
    if (typeof setSelectedEdgeIds === 'function') {
      setSelectedEdgeIds([edgeId]);
    }
    handlers?.handleEdgeFocus?.(edgeId);
    if (typeof setShowPropertiesPanel === 'function') {
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
    emitEdgeIntent('toggleEdgePanel', { open: !showEdgePanel });
    if (typeof setShowEdgePanel === 'function') {
      setShowEdgePanel(prev => !prev);
    }
  }, [emitEdgeIntent, showEdgePanel, setShowEdgePanel]);

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

  const handleEntitiesPanelSelectNode = useCallback(
    (nodeId) => {
      focusNodeFromEntities(nodeId);
    },
    [focusNodeFromEntities]
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

  const handleToggleScriptPanelIntent = useCallback(() => {
    emitEdgeIntent('toggleScriptPanel');
    eventBus.emit('toggleScriptPanel');
  }, [emitEdgeIntent]);

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
          defaultNodeColor={defaultNodeColor}
          defaultEdgeColor={defaultEdgeColor}
          isFreeUser={isFreeUser}
          showMinimap={showMinimap}
          onToggleMinimap={handleToggleMinimap}
          snapToGrid={snapToGrid}
          onToggleSnapToGrid={handleToggleSnapToGrid}
          gridSize={documentSettings.gridSize}
          edgeRouting={documentSettings.edgeRouting || 'auto'}
          onEdgeRoutingChange={handleEdgeRoutingChange}
          onRerouteEdges={handleRerouteEdges}
          githubSettings={documentSettings.github}
          onToggleProperties={handleTogglePropertiesPanelIntent}
          onToggleScriptPanel={handleToggleScriptPanelIntent}
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
          showEdgePanel={showEdgePanel}
          showPropertiesPanel={showPropertiesPanel}
          showEdgeList={showEdgeList}
        />
      )}

      {isMobile && <MobileFabToolbar />}

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
        edges={edges}
        nodeTypeOptions={nodeTypeOptions}
        onSelectNode={handleSelectNodeFromProperties}
          onUpdateNode={(id, updates, options) => {
            emitEdgeIntent('updateNode', {
              nodeId: id,
              changeCount: Object.keys(updates || {}).length,
              selectionCount: selectedNodeIds.length
            });
            setNodes(prev => {
            const enforceSingleRoot =
              updates?.isRoot === true ||
              updates?.data?.isRoot === true ||
              updates?.data?.root === true;
            const { data: nextDataPatch, replaceData, ...restUpdates } = updates || {};
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
                ? (replaceData || options?.replaceData)
                  ? nextDataPatch
                  : { ...n.data, ...nextDataPatch }
                : n.data;
              return { ...n, ...restUpdates, data: nextData };
            });
            nodesRef.current = next;
            // Only save to history if not explicitly skipped
            if (!options || options !== true) {
              try { historyHook.saveToHistory(next, edgesRef.current); } catch (err) {}
            }
            return next;
          });
            const hasHandler = handlers && typeof handlers.handleUpdateNodeData === 'function';
            if (!options || options !== true) {
              try {
                if (hasHandler) {
                  handlers.handleUpdateNodeData(id, updates, options);
                }
              } catch (err) {}
            }
            if (options === true || !hasHandler) {
              try {
                eventBus.emit('nodeUpdated', { id, patch: updates || {} });
              } catch (err) {
                // ignore event bus errors
              }
            }
          }}
          onUpdateEdge={(id, updates) => {
            emitEdgeIntent('updateEdge', { edgeId: id, changeCount: Object.keys(updates || {}).length });
            setEdges(prev => {
              const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
              edgesRef.current = next;
              try { historyHook.saveToHistory(nodesRef.current, next); } catch (err) {}
              return next;
            });
            if (updates?.sourcePort !== undefined || updates?.targetPort !== undefined) {
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
            } catch (err) {
              // ignore event bus errors
            }
          }}
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

          <EntitiesPanel
            open={showEntitiesPanel}
            anchor={oppositeAnchor}
            entityView={entityView}
            nodes={nodes}
            edges={edges}
            groups={groups}
            selectedNodeId={selectedNodeIds[0] || null}
            selectedEdgeId={selectedEdgeIds[0] || null}
            selectedGroupId={selectedGroupIds[0] || null}
            onSelectNode={handleEntitiesPanelSelectNode}
            onSelectEdge={handleSelectEdgeFromList}
            onSelectGroup={focusGroupFromEntities}
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
      {!isEmbedded && <ScriptPanel />}

      <DocumentPropertiesDialog
        open={showDocumentPropertiesDialog}
        onClose={() => setShowDocumentPropertiesDialog(false)}
        host={host}
        backgroundUrl={backgroundUrl}
        setBackgroundUrl={setBackgroundUrl}
        documentSettings={documentSettings}
        onDocumentSettingsChange={setDocumentSettings}
        projectMeta={projectMeta}
        onProjectMetaChange={handleUpdateProjectMeta}
        onResetProjectMeta={handleResetProjectMeta}
        graphStats={graphStats}
        recentSnapshots={recentSnapshots}
        storySnapshots={storySnapshots}
      />
      <EdgeLayoutPanel
        open={showEdgePanel}
        onClose={handleCloseEdgePanel}
        documentSettings={documentSettings}
        setDocumentSettings={setDocumentSettings}
        contractSummary={contractSummary}
        onApplyLayout={modesHook.applyAutoLayout}
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
