"use client";

import { useEffect, useRef, useMemo, useCallback } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import { emitIntent } from '../core/graphCore';
import { createExecutionSpine } from '../core/executionSpine';
import { createGraphExecutionRuntime } from '../core/graphExecutionRuntime';
import { placeNodesIncrementally } from '../utils/growthPlacement';
import { validateGraphInvariants } from '../validators/validateGraphInvariants';
import { summarizeContracts } from '../contracts/contractManager';

const REROUTE_INTENT_TRIGGERS = new Set([
  'toolbarReroute',
  'edgeRoutingChange',
  'layoutSettingChange',
  'elkSettingChange'
]);

const emitTelemetry = (stage, intent, info = {}) => {
  try {
    eventBus.emit('interpreterTelemetry', { stage, intent, info });
  } catch (err) {
    console.warn('[Interpreter] telemetry emit failed', err);
  }
};

export default function useInterpreterLayer({
  nodes = [],
  edges = [],
  edgeRoutes = {},
  groups = [],
  lockedNodes = new Set(),
  documentSettings = {},
  modesHook = {},
  setNodes = () => {},
  setEdgeRoutes = () => {},
  setSnackbar = () => {},
  lastPointerRef
}) {
  const { applyAutoLayout, rerouteEdges, mode } = modesHook;
  const pendingAutoLayoutRef = useRef(false);
  const pendingAutoLayoutPayloadRef = useRef(null);
  const currentTokenRef = useRef(null);
  const resolvedDictionaryRef = useRef(null);

  useEffect(() => {
    const handleDictionaryResolved = (payload = {}) => {
      resolvedDictionaryRef.current = payload?.dictionary || null;
    };
    eventBus.on('dictionaryResolved', handleDictionaryResolved);
    return () => eventBus.off('dictionaryResolved', handleDictionaryResolved);
  }, []);

  const handleAutoLayoutRequested = useCallback((payload) => {
    pendingAutoLayoutRef.current = true;
    pendingAutoLayoutPayloadRef.current = payload && typeof payload === 'object' ? payload : null;
  }, []);

  useEffect(() => {
    eventBus.on('layout:autoOnMissingPositions', handleAutoLayoutRequested);
    return () => eventBus.off('layout:autoOnMissingPositions', handleAutoLayoutRequested);
  }, [handleAutoLayoutRequested]);

  const runReroute = useCallback(async () => {
    if (typeof rerouteEdges !== 'function') return;
    await rerouteEdges();
    // Intentionally silent: edge reroute is noisy for users.
  }, [rerouteEdges, setSnackbar]);

  const autoLayoutSkill = useMemo(() => ({
    id: 'autoLayout',
    matches: (intent) => {
      if (intent.type === 'applyLayout') return true;
      if (intent.type === 'nodeDragEnd' && mode === 'auto') return true;
      return false;
    },
    handle: async (intent, token) => {
      if (token.aborted) return;
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout(intent?.payload?.layoutType);
        emitTelemetry('skill', intent, { skill: 'autoLayout' });
      }
    }
  }), [mode, applyAutoLayout]);

  const rerouteSkill = useMemo(() => ({
    id: 'edgeRouting',
    matches: (intent) => {
      if (REROUTE_INTENT_TRIGGERS.has(intent.type)) return true;
      if (intent.type === 'nodeDragEnd' && mode !== 'auto') return true;
      return false;
    },
    handle: async (intent, token) => {
      if (token.aborted) return;
      emitTelemetry('skill', intent, { skill: 'edgeRouting' });
      await runReroute();
    }
  }), [mode, runReroute]);

  const proposalsSkill = useMemo(() => ({
    id: 'scriptProposals',
    matches: (intent) =>
      Array.isArray(intent?.payload?.proposals) ||
      Boolean(intent?.payload?.proposal),
    handle: async (intent) => {
      const proposalsRaw = intent?.payload?.proposals ?? intent?.payload?.proposal ?? [];
      const proposals = Array.isArray(proposalsRaw) ? proposalsRaw : [proposalsRaw];
      return proposals.flatMap((proposal) => {
        if (!proposal || typeof proposal !== 'object') return [];
        const action = proposal.action || proposal.type;
        switch (action) {
          case 'createNode':
            return [{ op: 'createNode', data: proposal.node || proposal.data || proposal.payload || {} }];
          case 'createNodes': {
            const nodes = proposal.nodes || proposal.data || [];
            return [{ op: 'createNodes', data: Array.isArray(nodes) ? nodes : [nodes] }];
          }
          case 'updateNode': {
            const id = proposal.id || proposal.nodeId || proposal.node?.id;
            const patch = proposal.patch || proposal.updates || proposal.node || proposal.data || {};
            if (!id) return [];
            return [{ op: 'updateNode', id, patch }];
          }
          case 'updateNodes': {
            const ids = proposal.ids || proposal.nodeIds || [];
            const patch = proposal.patch || proposal.updates || proposal.data || {};
            return [{ op: 'updateNodes', ids: Array.isArray(ids) ? ids : [ids], patch }];
          }
          case 'deleteNode': {
            const id = proposal.id || proposal.nodeId;
            if (!id) return [];
            return [{ op: 'deleteNode', id }];
          }
          case 'deleteNodes': {
            const ids = proposal.ids || proposal.nodeIds || [];
            return [{ op: 'deleteNodes', ids: Array.isArray(ids) ? ids : [ids] }];
          }
          case 'createEdge':
            return [{ op: 'createEdge', data: proposal.edge || proposal.data || proposal.payload || {} }];
          case 'createEdges': {
            const edges = proposal.edges || proposal.data || [];
            return [{ op: 'createEdges', data: Array.isArray(edges) ? edges : [edges] }];
          }
          case 'updateEdge': {
            const id = proposal.id || proposal.edgeId || proposal.edge?.id;
            const patch = proposal.patch || proposal.updates || proposal.edge || proposal.data || {};
            if (!id) return [];
            return [{ op: 'updateEdge', id, patch }];
          }
          case 'updateEdges': {
            const ids = proposal.ids || proposal.edgeIds || [];
            const patch = proposal.patch || proposal.updates || proposal.data || {};
            return [{ op: 'updateEdges', ids: Array.isArray(ids) ? ids : [ids], patch }];
          }
          case 'deleteEdge': {
            const id = proposal.id || proposal.edgeId;
            if (!id) return [];
            return [{ op: 'deleteEdge', id }];
          }
          case 'deleteEdges': {
            const ids = proposal.ids || proposal.edgeIds || [];
            const list = Array.isArray(ids) ? ids : [ids];
            return list.map((id) => ({ op: 'deleteEdge', id })).filter((d) => d.id);
          }
          case 'translateNodes': {
            const ids = proposal.ids || proposal.nodeIds || [];
            const delta = proposal.delta || proposal.data || {};
            return [{ op: 'translateNodes', ids: Array.isArray(ids) ? ids : [ids], delta }];
          }
          case 'createGroups': {
            const groups = proposal.groups || proposal.data || [];
            return [{ op: 'createGroups', data: Array.isArray(groups) ? groups : [groups] }];
          }
          case 'updateGroup': {
            const id = proposal.id || proposal.groupId;
            const patch = proposal.patch || proposal.updates || proposal.data || {};
            if (!id) return [];
            return [{ op: 'updateGroup', id, patch }];
          }
          case 'updateGroups': {
            const ids = proposal.ids || proposal.groupIds || [];
            const patch = proposal.patch || proposal.updates || proposal.data || {};
            return [{ op: 'updateGroups', ids: Array.isArray(ids) ? ids : [ids], patch }];
          }
          case 'deleteGroup': {
            const id = proposal.id || proposal.groupId;
            if (!id) return [];
            return [{ op: 'deleteGroup', id }];
          }
          case 'addNodesToGroup': {
            const id = proposal.id || proposal.groupId;
            const nodeIds = proposal.nodeIds || proposal.nodes || [];
            if (!id) return [];
            return [{ op: 'addNodesToGroup', id, nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds] }];
          }
          case 'removeNodesFromGroup': {
            const id = proposal.id || proposal.groupId;
            const nodeIds = proposal.nodeIds || proposal.nodes || [];
            if (!id) return [];
            return [{ op: 'removeNodesFromGroup', id, nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds] }];
          }
          case 'setGroupNodes': {
            const id = proposal.id || proposal.groupId;
            const nodeIds = proposal.nodeIds || proposal.nodes || [];
            if (!id) return [];
            return [{ op: 'setGroupNodes', id, nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds] }];
          }
          case 'translateGroups': {
            const ids = proposal.ids || proposal.groupIds || [];
            const delta = proposal.delta || proposal.data || {};
            return [{ op: 'translateGroups', ids: Array.isArray(ids) ? ids : [ids], delta }];
          }
          default:
            return [];
        }
      });
    }
  }), []);

  const executionRuntime = useMemo(() => {
    return createGraphExecutionRuntime({
      getNodes: () => nodes,
      getEdges: () => edges
    });
  }, [nodes, edges]);

  const graphExecutionSkill = useMemo(() => ({
    id: 'graphExecution',
    matches: (intent) => {
      if (intent?.payload?.executeGraph || intent?.payload?.executeNodes) return true;
      const proposals = intent?.payload?.proposals || intent?.proposals || [];
      return Array.isArray(proposals) && proposals.some((p) => p?.action === 'executeGraph' || p?.action === 'executeNodes');
    },
    handle: async (intent) => {
      const payload = intent?.payload || intent || {};
      if (payload.executeGraph) {
        return executionRuntime.executeGraph(payload.executeGraph);
      }
      if (payload.executeNodes) {
        return executionRuntime.executeNodes(payload.executeNodes);
      }
      const proposals = payload.proposals || [];
      proposals.forEach((proposal) => {
        if (!proposal || typeof proposal !== 'object') return;
        if (proposal.action === 'executeGraph') {
          executionRuntime.executeGraph(proposal.payload || proposal.data || proposal);
        } else if (proposal.action === 'executeNodes') {
          executionRuntime.executeNodes(proposal.payload || proposal.data || proposal);
        }
      });
      return { success: true };
    }
  }), [executionRuntime]);

  const skills = useMemo(
    () => [autoLayoutSkill, rerouteSkill, graphExecutionSkill, proposalsSkill],
    [autoLayoutSkill, rerouteSkill, graphExecutionSkill, proposalsSkill]
  );

  const isDraftMode = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (window.__Twilite_DRAFT__ === true || window.__TWILITE_DRAFT__ === true) return true;
    try {
      return new URLSearchParams(window.location.search).get('draft') === '1';
    } catch (err) {
      return false;
    }
  }, []);

  const spine = useMemo(() => {
    return createExecutionSpine({
      listeners: skills,
      emitTelemetry,
      isDraftMode,
      getAuthorityContext: () => ({
        nodes,
        edges,
        edgeRoutes,
        groups,
        documentSettings,
        resolvedDictionary: resolvedDictionaryRef.current
      }),
      validateGraph: ({ context }) => {
        return validateGraphInvariants({
          nodes: context.nodes,
          edges: context.edges,
          edgeRoutes: context.edgeRoutes,
          clusters: context.groups,
          mode: 'mutation',
          resolvedDictionary: context.resolvedDictionary
        });
      },
      normalizeDeltas: (deltas) => (Array.isArray(deltas) ? deltas.filter(Boolean) : []),
      commitDeltas: async (deltas) => {
        if (!Array.isArray(deltas) || deltas.length === 0) return;
        const api = typeof window !== 'undefined'
          ? window.graphAPI?._raw || window.graphAPIRaw || window.graphAPI
          : null;
        if (!api) return;
        if (typeof api.applyDeltas === 'function') {
          const routeDeltas = deltas.filter(d => d && d.op === 'setEdgeRoutes' && d.routes);
          if (routeDeltas.length && typeof setEdgeRoutes === 'function') {
            routeDeltas.forEach(d => setEdgeRoutes(d.routes));
          }
          const graphDeltas = deltas.filter(d => d && d.op !== 'setEdgeRoutes');
          if (graphDeltas.length) {
            api.applyDeltas(graphDeltas, { batchHistory: true });
          }
          return;
        }
        deltas.forEach((delta) => {
          if (!delta || !delta.op) return;
          switch (delta.op) {
            case 'createNode':
              api.createNode?.(delta.data || {});
              break;
            case 'createNodes':
              api.createNodes?.(delta.data || delta.nodes || []);
              break;
            case 'updateNode':
              if (delta.id) api.updateNode?.(delta.id, delta.patch || {});
              break;
            case 'updateNodes':
              api.updateNodes?.(delta.ids || [], delta.patch || {});
              break;
            case 'deleteNode':
              if (delta.id) api.deleteNode?.(delta.id);
              break;
            case 'deleteNodes':
              (delta.ids || []).forEach((id) => api.deleteNode?.(id));
              break;
            case 'createEdge':
              api.createEdge?.(delta.data || {});
              break;
            case 'createEdges':
              api.createEdges?.(delta.data || delta.edges || []);
              break;
            case 'updateEdge':
              if (delta.id) api.updateEdge?.(delta.id, delta.patch || {});
              break;
            case 'updateEdges':
              api.updateEdges?.(delta.ids || [], delta.patch || {});
              break;
            case 'deleteEdge':
              if (delta.id) api.deleteEdge?.(delta.id);
              break;
            case 'translateNodes':
              api.translateNodes?.(delta.ids || [], delta.delta || delta);
              break;
            case 'translateGroups':
              api.translateGroups?.(delta.ids || [], delta.delta || delta);
              break;
            case 'createGroups':
              api.createGroups?.(delta.data || delta.groups || []);
              break;
            case 'updateGroup':
              api.updateGroup?.(delta.id, delta.patch || {});
              break;
            case 'updateGroups':
              api.updateGroups?.(delta.ids || [], delta.patch || {});
              break;
            case 'deleteGroup':
              api.deleteGroup?.(delta.id);
              break;
            case 'addNodesToGroup':
              api.addNodesToGroup?.(delta.id, delta.nodeIds || []);
              break;
            case 'removeNodesFromGroup':
              api.removeNodesFromGroup?.(delta.id, delta.nodeIds || []);
              break;
            case 'setGroupNodes':
              api.setGroupNodes?.(delta.id, delta.nodeIds || []);
              break;
            case 'setEdgeRoutes':
              if (delta.routes && typeof setEdgeRoutes === 'function') {
                setEdgeRoutes(delta.routes);
              }
              break;
            default:
              break;
          }
        });
      },
      onCommit: ({ intent, context }) => {
        const contractSummary = summarizeContracts({
          nodes: context.nodes,
          edges: context.edges,
          documentSettings: context.documentSettings
        });
        emitTelemetry('contractSummary', intent, contractSummary);
        emitTelemetry('commit', intent);
      },
      onReject: ({ intent, errors }) => {
        setSnackbar({
          open: true,
          message: 'Validation failed: ' + errors.map((err) => err.message).join('; '),
          severity: 'error'
        });
        emitTelemetry('blocked', intent, { errors });
      }
    });
  }, [
    skills,
    isDraftMode,
    nodes,
    edges,
    edgeRoutes,
    groups,
    documentSettings,
    setSnackbar
  ]);

  const processIntent = useCallback(async (intent, token) => {
    await spine.executeIntent(intent, token);
  }, [spine]);

  const handleIntent = useCallback((payload = {}) => {
    const intentType = payload?.trigger || 'unknown';
    const normalizedIntent = {
      type: intentType,
      payload,
      metadata: {
        timestamp: payload?.timestamp || new Date().toISOString(),
        source: payload?.source || 'ui'
      }
    };

    emitIntent({
      type: normalizedIntent.type,
      metadata: normalizedIntent.metadata
    });

    const token = { id: Date.now().toString(36), aborted: false };
    if (currentTokenRef.current) {
      currentTokenRef.current.aborted = true;
    }
    currentTokenRef.current = token;

    processIntent(normalizedIntent, token);
  }, [processIntent]);

  useEffect(() => {
    eventBus.on('edgeIntentCaptured', handleIntent);
    return () => eventBus.off('edgeIntentCaptured', handleIntent);
  }, [handleIntent]);

  useEffect(() => {
    eventBus.on('executionIntent', handleIntent);
    return () => eventBus.off('executionIntent', handleIntent);
  }, [handleIntent]);

  useEffect(() => {
    if (!pendingAutoLayoutRef.current) return;
    pendingAutoLayoutRef.current = false;
    const layoutMode = documentSettings?.layout?.mode || 'autoOnMissingPositions';
    if (layoutMode === 'manual') return;
    const payload = pendingAutoLayoutPayloadRef.current;
    pendingAutoLayoutPayloadRef.current = null;
    const nodeIdsRaw = Array.isArray(payload?.nodeIds) ? payload.nodeIds.filter(Boolean) : [];
    const nodeIds = lockedNodes instanceof Set
      ? nodeIdsRaw.filter((id) => !lockedNodes.has(id))
      : nodeIdsRaw;
    const shouldTreatAsGrowth =
      nodeIds.length > 0 && Array.isArray(nodes) && nodes.length > nodeIds.length;

    if (shouldTreatAsGrowth) {
      try {
        const result = placeNodesIncrementally({
          nodes,
          edges,
          groups,
          lockedNodeIds: lockedNodes,
          nodeIdsToPlace: nodeIds,
          pointer: lastPointerRef?.current,
          direction: documentSettings?.layout?.direction,
          paddingPx: 60,
          gapPx: 80,
          stepPx: (documentSettings?.gridSize || 20) * 2
        });
        setNodes(result.nodes);
        if (typeof setEdgeRoutes === 'function') setEdgeRoutes({});
        Promise.resolve(rerouteEdges?.())
          .then(() => {
            // Intentionally silent: edge reroute is noisy for users.
          })
          .catch(() => {
            setSnackbar({ open: true, message: 'Placed new nodes (reroute failed)', severity: 'warning' });
          });
      } catch (err) {
        setSnackbar({
          open: true,
          message: 'Incremental placement failed (falling back to auto-layout)',
          severity: 'warning'
        });
        try {
          applyAutoLayout?.();
          setSnackbar({ open: true, message: 'Auto-layout applied', severity: 'success' });
        } catch (err2) {
          setSnackbar({
            open: true,
            message: 'Auto-layout failed',
            severity: 'error',
            copyToClipboard: true
          });
        }
      }
      return;
    }

    try {
      applyAutoLayout?.();
      setSnackbar({ open: true, message: 'Auto-layout applied', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Auto-layout failed',
        severity: 'error',
        copyToClipboard: true
      });
    }
  }, [
    documentSettings?.layout?.mode,
    documentSettings?.layout?.direction,
    documentSettings?.gridSize,
    nodes,
    edges,
    groups,
    lockedNodes,
    applyAutoLayout,
    rerouteEdges,
    setEdgeRoutes,
    setNodes,
    setSnackbar,
    lastPointerRef
  ]);
}
