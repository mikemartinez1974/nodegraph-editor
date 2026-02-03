"use client";

import { useEffect, useRef, useMemo, useCallback } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import { emitIntent } from '../core/graphCore';
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

  const skills = useMemo(() => [autoLayoutSkill, rerouteSkill], [autoLayoutSkill, rerouteSkill]);

  const processIntent = useCallback(async (intent, token) => {
    if (token.aborted) {
      emitTelemetry('canceled', intent);
      return;
    }

    emitTelemetry('received', intent);
    emitTelemetry('flow_control', intent, { tokenId: token.id });

    for (const skill of skills) {
      if (token.aborted) {
        emitTelemetry('canceled', intent);
        return;
      }
      if (!skill.matches(intent)) continue;
      emitTelemetry('skill_start', intent, { skill: skill.id });
      try {
        await skill.handle(intent, token);
      } catch (err) {
        console.warn(`[Interpreter] skill ${skill.id} failed:`, err);
      }
      emitTelemetry('skill_finish', intent, { skill: skill.id });
    }

    if (token.aborted) {
      emitTelemetry('canceled', intent);
      return;
    }

    const isDraftMode = () => {
      if (typeof window === 'undefined') return false;
      if (window.__Twilite_DRAFT__ === true || window.__TWILITE_DRAFT__ === true) return true;
      try {
        return new URLSearchParams(window.location.search).get('draft') === '1';
      } catch (err) {
        return false;
      }
    };

    if (isDraftMode()) {
      emitTelemetry('validator', intent, { skipped: true, reason: 'draft' });
      const contractSummary = summarizeContracts({ nodes, edges, documentSettings });
      emitTelemetry('contractSummary', intent, contractSummary);
      emitTelemetry('commit', intent);
      emitTelemetry('done', intent);
      return;
    }

    emitTelemetry('validator', intent);
    const validation = validateGraphInvariants({
      nodes,
      edges,
      edgeRoutes,
      clusters: groups,
      mode: 'mutation',
      resolvedDictionary: resolvedDictionaryRef.current
    });
    if (!validation.ok) {
      setSnackbar({
        open: true,
        message: 'Validation failed: ' + validation.errors.map((err) => err.message).join('; '),
        severity: 'error'
      });
      emitTelemetry('blocked', intent, { errors: validation.errors });
      return;
    }

    const contractSummary = summarizeContracts({ nodes, edges, documentSettings });
    emitTelemetry('contractSummary', intent, contractSummary);

    emitTelemetry('commit', intent);
    emitTelemetry('done', intent);
  }, [skills, nodes, edges, edgeRoutes, setSnackbar]);

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
