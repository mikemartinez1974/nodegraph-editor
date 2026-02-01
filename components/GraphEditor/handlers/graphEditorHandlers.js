// ============================================
// 2. GraphEditor/graphEditorHandlers.js
// All handler functions consolidated
// ============================================
import eventBus from '../../NodeGraph/eventBus.js';
import { generateUUID, ensureUniqueNodeIds, deduplicateNodes } from '../utils/idUtils.js';
import { validateNodes, validateEdges, validateGroups, summarizeValidationErrors } from './validation.js';
import { convertHandlesObjectToArray } from '../utils/handleUtils.js';

// Debounce guard for delete operations (must be outside function to persist)
let deleteInProgress = false;

export function createGraphEditorHandlers({
  graphAPI,
  state,
  historyHook,
  groupManagerHook,
  selectionHook,
  modesHook,
  lastPointerRef,
  breadboardTargets = [],
  backgroundRpc, // RPC function for calling iframe methods
  backgroundRpcReady // boolean or function returning boolean indicating RPC readiness
}) {
  const {
    nodes, setNodes, nodesRef,
    edges, setEdges, edgesRef,
    groups, setGroups,
    loadGraph,
    pan, zoom,
    selectedNodeIds, setSelectedNodeIds,
    selectedEdgeIds, setSelectedEdgeIds,
    selectedGroupIds, setSelectedGroupIds,
    groupManager,
    setSnackbar, setLoading
  } = state;
  
  const { saveToHistory } = historyHook;
  
  const normalizeEdgeSchema = (edge, defaultDirection = 'output') => {
    if (!edge || typeof edge !== 'object') return edge;
    const normalized = { ...edge };
    if (normalized.source && typeof normalized.source === 'object') {
      const sourceObj = normalized.source;
      normalized.sourceHandle = normalized.sourceHandle || sourceObj.handleKey;
      normalized.source = sourceObj.nodeId ?? sourceObj.id ?? normalized.source;
    }
    if (normalized.target && typeof normalized.target === 'object') {
      const targetObj = normalized.target;
      normalized.targetHandle = normalized.targetHandle || targetObj.handleKey;
      normalized.target = targetObj.nodeId ?? targetObj.id ?? normalized.target;
    }
    normalized.state = normalized.state && typeof normalized.state === 'object' ? { ...normalized.state } : undefined;
    normalized.logic = normalized.logic && typeof normalized.logic === 'object' ? { ...normalized.logic } : undefined;
    normalized.routing = normalized.routing && typeof normalized.routing === 'object' ? { ...normalized.routing } : undefined;
    normalized.extensions = normalized.extensions && typeof normalized.extensions === 'object' ? { ...normalized.extensions } : undefined;
    return normalized;
  };

  const ensureUnifiedHandles = (node) => {
    if (!node || typeof node !== 'object') return node;
    const hydrateHandlesFromLegacy = () => {
      const unified = [];
      if (Array.isArray(node.inputs)) {
        node.inputs.forEach((handle, index) => {
          if (!handle) return;
          const id = handle.id || handle.key || handle.name || `input-${index}`;
          unified.push({
            id,
            label: handle.label || id,
            direction: 'input',
            dataType: handle.dataType || handle.type || 'value'
          });
        });
      }
      if (Array.isArray(node.outputs)) {
        node.outputs.forEach((handle, index) => {
          if (!handle) return;
          const id = handle.id || handle.key || handle.name || `output-${index}`;
          unified.push({
            id,
            label: handle.label || id,
            direction: 'output',
            dataType: handle.dataType || handle.type || 'value'
          });
        });
      }
      return unified;
    };

    const handles =
      Array.isArray(node.handles) && node.handles.length > 0
        ? node.handles
        : hydrateHandlesFromLegacy();

    const normalizedHandles = handles.map((handle, index) => {
      if (!handle) return null;
      const id = handle.id || handle.key || handle.name || `handle-${index}`;
      if (!id) return null;
      return {
        id,
        label: handle.label || id,
        direction:
          handle.direction ||
          (handle.type === 'input' ? 'input' : handle.type === 'output' ? 'output' : 'output'),
        dataType: handle.dataType || handle.type || 'value',
        allowedEdgeTypes: Array.isArray(handle.allowedEdgeTypes) ? [...handle.allowedEdgeTypes] : undefined,
        position: handle.position ? { ...handle.position } : undefined,
        metadata: handle.metadata ? { ...handle.metadata } : undefined
      };
    }).filter(Boolean);

    return {
      ...node,
      handles: normalizedHandles,
      state: node.state && typeof node.state === 'object' ? { ...node.state } : undefined,
      extensions: node.extensions && typeof node.extensions === 'object' ? { ...node.extensions } : undefined,
      style: node.style && typeof node.style === 'object' ? { ...node.style } : undefined,
      data: node.data && typeof node.data === 'object' ? { ...node.data } : {}
    };
  };
  
  // ===== NODE HANDLERS =====
  const handleAddNode = (type = 'default', options = {}) => {
    const { width = 200, height = 120, meta } = options;
    const resolvedWidth =
      typeof meta?.defaultWidth === 'number' && !Number.isNaN(meta.defaultWidth)
        ? meta.defaultWidth
        : width;
    const resolvedHeight =
      typeof meta?.defaultHeight === 'number' && !Number.isNaN(meta.defaultHeight)
        ? meta.defaultHeight
        : height;
    
    const pointer = lastPointerRef && lastPointerRef.current;
    const now = Date.now();
    const POINTER_MAX_AGE_MS = 5000;
    const pointerIsFresh = pointer && (now - (pointer.ts || 0) <= POINTER_MAX_AGE_MS);
    const hasPointer =
      pointerIsFresh &&
      pointer?.inside === true &&
      Number.isFinite(pointer.x) &&
      Number.isFinite(pointer.y);

    const fallbackX = (window.innerWidth / 2 - pan.x) / zoom;
    const fallbackY = (window.innerHeight / 2 - pan.y) / zoom;

    const boardCenter = (() => {
      if (!Array.isArray(breadboardTargets) || breadboardTargets.length === 0) {
        return null;
      }
      let sumX = 0;
      let sumY = 0;
      breadboardTargets.forEach((t) => {
        sumX += Number(t.x) || 0;
        sumY += Number(t.y) || 0;
      });
      const count = breadboardTargets.length;
      return { x: sumX / count, y: sumY / count };
    })();

    // If we have breadboard targets pick the nearest to pointer (or viewport center) so placement stays on the board.
    const pickFromTargets = (pt) => {
      if (!Array.isArray(breadboardTargets) || breadboardTargets.length === 0) return pt;
      let best = null;
      let bestDist = Infinity;
      breadboardTargets.forEach((target) => {
        if (!target) return;
        const dx = (target.x || 0) - pt.x;
        const dy = (target.y || 0) - pt.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = target;
        }
      });
      if (best) return { x: best.x, y: best.y };
      return pt;
    };

    const isBreadboardComponent =
      typeof type === 'string' && type.startsWith('io.breadboard.components:');

    // For breadboard components, always seed from board center (then snap to nearest target)
    let basePoint;
    if (isBreadboardComponent && boardCenter) {
      basePoint = { ...boardCenter };
    } else if (hasPointer) {
      basePoint = { x: pointer.x, y: pointer.y };
    } else {
      basePoint = boardCenter || { x: fallbackX, y: fallbackY };
    }
    basePoint = pickFromTargets(basePoint);

    const centerX = basePoint.x;
    const centerY = basePoint.y;
    // console.log('[handleAddNode] placement debug', { hasPointer, pointer, fallbackX, fallbackY, basePoint });
    let api = graphAPI && graphAPI.current ? graphAPI.current : (typeof window !== 'undefined' && window.graphAPI ? window.graphAPI : null);
    if (!api || typeof api.createNode !== 'function') {
      console.error('graphAPI is not available or createNode is not a function');
      return;
    }
    const defaultData =
      meta && meta.defaultData && typeof meta.defaultData === 'object'
        ? { ...meta.defaultData }
        : {};

    // Normalize breadboard pins to be relative so placement can snap on drop
    if (isBreadboardComponent && Array.isArray(defaultData.pins)) {
      defaultData.pins = defaultData.pins.map((pin, index) => {
        if (!pin || typeof pin !== 'object') return pin;
        const columnOffset =
          Number.isFinite(pin.columnOffset) ? pin.columnOffset : index;
        return {
          ...pin,
          column: null,
          columnOffset
        };
      });
    }

    // pendingPlacement stays true until drag/drop autowire clears it
    const initialData = {
      memo: '',
      link: '',
      ...defaultData
    };
    if (isBreadboardComponent) {
      initialData.breadboard = {
        ...(defaultData?.breadboard || {}),
        pendingPlacement: true
      };
    }
    const extensionsFromMeta =
      meta && meta.extensions && typeof meta.extensions === 'object'
        ? { ...meta.extensions }
        : undefined;
    const pluginExtension =
      meta && meta.pluginId
        ? {
            plugin: {
              id: meta.pluginId,
              nodeType: meta.pluginNodeType,
              manifestUrl: meta.pluginManifestUrl,
              entry: meta.entry || meta.runtimeDefinition?.entry || undefined,
              rendererEntry:
                meta.rendererEntry ||
                meta.runtimeDefinition?.renderer?.entry ||
                undefined
            }
          }
        : undefined;
    const mergedExtensions =
      extensionsFromMeta || pluginExtension
        ? { ...(extensionsFromMeta || {}), ...(pluginExtension || {}) }
        : undefined;
    const derivedHandlesFromPins = Array.isArray(meta?.defaultData?.pins)
      ? meta.defaultData.pins
          .map((pin, index) => {
            if (!pin) return null;
            const id = pin.id || pin.key || pin.handleKey || pin.label || `pin-${index}`;
            if (!id) return null;
            return {
              id,
              label: pin.label || id,
              direction: 'output',
              dataType: 'value'
            };
          })
          .filter(Boolean)
      : undefined;

    const normalizedHandles =
      Array.isArray(meta?.handles)
        ? meta.handles
        : convertHandlesObjectToArray(meta?.handles) || derivedHandlesFromPins;

    const normalizedOutputs =
      Array.isArray(meta?.outputs)
        ? meta.outputs
        : Array.isArray(meta?.handles?.outputs)
        ? meta.handles.outputs
        : derivedHandlesFromPins
        ? derivedHandlesFromPins.map(handle => ({
            key: handle.id,
            label: handle.label || handle.id,
            type: handle.dataType || 'value'
          }))
        : undefined;

    const normalizedInputs =
      Array.isArray(meta?.inputs)
        ? meta.inputs
        : Array.isArray(meta?.handles?.inputs)
        ? meta.handles.inputs
        : undefined;

    const payload = {
      type: type,
      label:
        typeof meta?.label === 'string' && meta.label.trim().length > 0
          ? meta.label
          : 'New Node',
      data: initialData,
      position: (() => {
        // Phase 4: avoid dropping new nodes directly on top of existing content.
        const size = {
          width: Number.isFinite(Number(resolvedWidth)) ? Number(resolvedWidth) : 200,
          height: Number.isFinite(Number(resolvedHeight)) ? Number(resolvedHeight) : 120
        };
        const rectsOverlap = (a, b) =>
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;

        const obstacles = [];
        (nodesRef?.current || nodes || []).forEach((n) => {
          if (!n?.position) return;
          const w = Number(n.width) || 200;
          const h = Number(n.height) || 120;
          obstacles.push({ x: n.position.x, y: n.position.y, width: w, height: h });
        });
        (groups || []).forEach((g) => {
          const b = g?.bounds;
          if (!b) return;
          const w = Number(b.width) || 0;
          const h = Number(b.height) || 0;
          if (w <= 1 || h <= 1) return;
          obstacles.push({ x: Number(b.x) || 0, y: Number(b.y) || 0, width: w, height: h });
        });

        const start = { x: centerX, y: centerY };
        const candidateRect = (pt) => ({
          x: pt.x,
          y: pt.y,
          width: size.width,
          height: size.height
        });
        const collides = (pt) => {
          const r = candidateRect(pt);
          return obstacles.some((o) => rectsOverlap(r, o));
        };

        if (!collides(start)) return start;

        const step = 40;
        const maxR = 20;
        for (let r = 1; r <= maxR; r += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            for (let dy = -r; dy <= r; dy += 1) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              const pt = { x: start.x + dx * step, y: start.y + dy * step };
              if (!collides(pt)) return pt;
            }
          }
        }

        return { x: start.x + maxR * step, y: start.y + maxR * step };
      })(),
      width: resolvedWidth,
      height: resolvedHeight,
      resizable: true,
      handlePosition: 'center',
      showLabel: true,
      inputs: normalizedInputs,
      outputs: normalizedOutputs,
      handles: normalizedHandles,
      state:
        meta && meta.state && typeof meta.state === 'object'
          ? { ...meta.state }
          : undefined,
      extensions: mergedExtensions
    };
    const result = api.createNode({ ...payload });

    if (result && result.success === false) {
      console.error('Failed to create node:', result.error);
      return;
    }

    const newId =
      result?.id ||
      result?.nodeId ||
      result?.data?.id ||
      payload?.id ||
      '(unknown)';

    console.info(
      '[Breadboard] created',
      type,
      'id:',
      newId,
      'at',
      `(${centerX.toFixed(1)}, ${centerY.toFixed(1)})`
    );
  };
  
  // Simplified update handler: directly call graphAPI when available, otherwise fail fast.
  function handleUpdateNodeData(nodeId, updates) {
    if (!graphAPI || !graphAPI.current) {
      // graphAPI not ready; return failure without noisy logging
      return { success: false, error: 'graphAPI unavailable' };
    }

    try {
      const result = graphAPI.current.updateNode(nodeId, updates);
      return result;
    } catch (err) {
      // Log real errors
      console.error('Failed to update node via graphAPI:', err);
      return { success: false, error: err.message };
    }
  }
  
  const handleNodeListSelect = (nodeId, isMultiSelect = false) => {
    if (isMultiSelect) {
      selectionHook.handleNodeSelection(nodeId, true);
    } else {
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeIds([]);
    }
  };

  const handleNodeFocus = (nodeId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      const nodeWidth = node.width || 160;
      const nodeHeight = node.height || 100;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      const nodeCenterY = node.position.y + nodeHeight / 2;
      state.setPan({
        x: window.innerWidth / 2 - nodeCenterX * zoom,
        y: window.innerHeight / 2 - nodeCenterY * zoom
      });
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeIds([]);
    }
  };

  const handleNodeDoubleClick = (nodeId) => {
    eventBus.emit('openNodeProperties');
  };
  
  // ===== EDGE HANDLERS =====
  const handleUpdateEdge = (edgeId, updates) => {
    let api = graphAPI && graphAPI.current ? graphAPI.current : (typeof window !== 'undefined' && window.graphAPI ? window.graphAPI : null);
    if (!api || typeof api.updateEdge !== 'function') {
      console.error('graphAPI is not available or updateEdge is not a function');
      return;
    }
    const result = api.updateEdge(edgeId, updates);
    if (!result.success) {
      console.error('Failed to update edge:', result.error);
    }
  };
  
  const handleEdgeDoubleClick = (edgeId) => {
    eventBus.emit('openEdgeProperties');
  };
  
  // ===== DELETE HANDLERS =====
  const handleDeleteSelected = () => {
    // Debounce guard to prevent double-execution
    if (deleteInProgress) {
      // console.log('DELETE: Already in progress, ignoring duplicate call');
      return;
    }
    
    // Early return if nothing is selected
    const hasSelection = 
      (selectedNodeIds && selectedNodeIds.length > 0) ||
      (selectedEdgeIds && selectedEdgeIds.length > 0) ||
      (selectedGroupIds && selectedGroupIds.length > 0);
    
    if (!hasSelection) {
      // console.log('DELETE: No selection, ignoring');
      return;
    }
    
    deleteInProgress = true;
    
    // console.log('DELETE DEBUG:', {
    //   selectedNodeIds,
    //   selectedEdgeIds,
    //   selectedGroupIds,
    //   edgesFromState: edges.map(e => ({ id: e.id, type: e.type, source: e.source, target: e.target })),
    //   edgesFromRef: edgesRef.current.map(e => ({ id: e.id, type: e.type, source: e.source, target: e.target }))
    // });
    
    if (selectedNodeIds && selectedNodeIds.length > 0) {
      // Use refs as source of truth for consistent deletion
      const deletedNodeIds = [...selectedNodeIds];
      const affectedEdges = edgesRef.current.filter(e =>
        deletedNodeIds.includes(e.source) || deletedNodeIds.includes(e.target)
      );
      
      // console.log('DELETING NODE:', deletedNodeId, 'WILL REMOVE EDGES:', affectedEdges.map(e => ({ id: e.id, type: e.type, label: e.label })));
      
      const newNodes = nodesRef.current.filter(n => !selectedNodeIds.includes(n.id));
      const newEdges = edgesRef.current.filter(e => 
        !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
      );
      
      // console.log('AFTER DELETE - Nodes:', newNodes.length, 'Edges:', newEdges.length);
      
      nodesRef.current = newNodes;
      edgesRef.current = newEdges;
      setNodes(newNodes);
      setEdges(newEdges);
      setSelectedNodeIds([]);
      saveToHistory(newNodes, newEdges);
      
      // Force canvas redraw
      try {
        eventBus.emit('forceRedraw');
      } catch (e) {
        console.warn('Failed to emit forceRedraw:', e);
      }
      try {
        deletedNodeIds.forEach((id) => eventBus.emit('nodeDeleted', { id }));
        affectedEdges.forEach((edge) => eventBus.emit('edgeDeleted', { id: edge.id }));
      } catch (e) {
        // ignore event bus errors
      }
    } else if (selectedEdgeIds && selectedEdgeIds.length > 0) {
      // Use ref as source of truth, update both ref and state atomically
      // console.log('DELETING EDGES:', selectedEdgeIds, 'FROM:', edgesRef.current.map(e => e.id));
      const newEdges = edgesRef.current.filter(e => !selectedEdgeIds.includes(e.id));
      // console.log('AFTER FILTER - New edges:', newEdges.map(e => e.id));
      edgesRef.current = newEdges;
      setEdges(newEdges);
      setSelectedEdgeIds([]);
      saveToHistory(nodesRef.current, newEdges);
      
      // Force canvas redraw to show edge removal immediately
      try {
        eventBus.emit('forceRedraw');
      } catch (e) {
        console.warn('Failed to emit forceRedraw:', e);
      }
      try {
        selectedEdgeIds.forEach((id) => eventBus.emit('edgeDeleted', { id }));
      } catch (e) {
        // ignore event bus errors
      }
    } else if (selectedGroupIds && selectedGroupIds.length > 0) {
      const deletedGroupIds = [...selectedGroupIds];
      selectedGroupIds.forEach(groupId => {
        groupManager.current.removeGroup(groupId);
      });
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds([]);
      saveToHistory(nodesRef.current, edgesRef.current);
      try {
        deletedGroupIds.forEach((id) => eventBus.emit('groupDeleted', { id }));
      } catch (e) {
        // ignore event bus errors
      }
    }
    
    // Reset debounce guard after a short delay
    setTimeout(() => {
      deleteInProgress = false;
    }, 100);
  };
  
  const handleClearGraph = () => {
    const prevNodes = nodesRef.current || [];
    const prevEdges = edgesRef.current || [];
    const prevGroups = groups || [];
    const newNodes = [], newEdges = [], newGroups = [];
    // Use loadGraph to bypass manifest validation for explicit clears.
    if (typeof loadGraph === 'function') {
      loadGraph(newNodes, newEdges, newGroups);
    } else {
      setNodes(newNodes);
      setEdges(newEdges);
      setGroups(newGroups);
    }
    // Update refs after state to ensure consistency
    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    groupManager.current?.clear?.();
    saveToHistory(newNodes, newEdges, newGroups);
    try {
      prevNodes.forEach((node) => node?.id && eventBus.emit('nodeDeleted', { id: node.id }));
      prevEdges.forEach((edge) => edge?.id && eventBus.emit('edgeDeleted', { id: edge.id }));
      prevGroups.forEach((group) => group?.id && eventBus.emit('groupDeleted', { id: group.id }));
    } catch (e) {
      // ignore event bus errors
    }
  };
  
  // ===== LOAD/SAVE HANDLERS =====
  const handleLoadGraph = (loadedNodes, loadedEdges, loadedGroups = []) => {
    const nextNodes = Array.isArray(loadedNodes) ? loadedNodes : [];
    const nextEdges = Array.isArray(loadedEdges) ? loadedEdges : [];
    const nextGroups = Array.isArray(loadedGroups) ? loadedGroups : [];
    if (nextNodes.length === 0 && nextEdges.length === 0 && nextGroups.length === 0) {
      handleClearGraph();
      return;
    }
    const edgeMap = new Map();
    nextEdges.forEach(edge => {
      const normalized = normalizeEdgeSchema(edge);
      if (!normalized || !normalized.id) return;
      const previous = edgeMap.get(normalized.id);
      if (!previous) {
        edgeMap.set(normalized.id, normalized);
        return;
      }
      const takeNew =
        (!previous.sourceHandle && normalized.sourceHandle) ||
        (!previous.targetHandle && normalized.targetHandle) ||
        (!previous.handleMeta && normalized.handleMeta);
      if (takeNew) {
        edgeMap.set(normalized.id, normalized);
      }
    });
    const normalizedEdges = Array.from(edgeMap.values());

    if (typeof loadGraph === 'function') {
      loadGraph(nextNodes, normalizedEdges, nextGroups);
      nodesRef.current = nextNodes;
      edgesRef.current = normalizedEdges;
    } else {
      setNodes(prev => {
        nodesRef.current = nextNodes;
        return nextNodes;
      });
      setEdges(prev => {
        edgesRef.current = normalizedEdges;
        return normalizedEdges;
      });
      setGroups(nextGroups);
    }
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedGroupIds([]);
    saveToHistory(nextNodes, normalizedEdges);

    if (nextNodes.length > 0) {
      const firstNode = nextNodes[0];
      state.setPan({
        x: window.innerWidth / 2 - firstNode.position.x * zoom,
        y: window.innerHeight / 2 - firstNode.position.y * zoom
      });
      // Do not auto-select or open the properties panel after loading a file
    }
  };
  
  // ===== GROUP HANDLERS =====
  const handleGroupListSelect = (groupId, isMultiSelect = false) => {
    selectionHook.handleGroupSelection(groupId, isMultiSelect);
  };

  const handleGroupFocus = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (group?.bounds) {
      state.setPan({
        x: window.innerWidth / 2 - (group.bounds.x + group.bounds.width / 2) * zoom,
        y: window.innerHeight / 2 - (group.bounds.y + group.bounds.height / 2) * zoom
      });
      setSelectedGroupIds([groupId]);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
    }
  };

  const handleEdgeFocus = (edgeId) => {
    const edge = edges.find((candidate) => candidate.id === edgeId);
    if (!edge) return;
    const sourceNode = nodesRef.current.find((n) => n.id === edge.source);
    const targetNode = nodesRef.current.find((n) => n.id === edge.target);
    if (sourceNode && targetNode) {
      const centerX = (sourceNode.position.x + targetNode.position.x) / 2;
      const centerY = (sourceNode.position.y + targetNode.position.y) / 2;
      state.setPan({
        x: window.innerWidth / 2 - centerX * zoom,
        y: window.innerHeight / 2 - centerY * zoom
      });
    }
    setSelectedEdgeIds([edgeId]);
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
  };

  const handleGroupDoubleClickFromList = (groupId) => {
    state.setShowGroupProperties(true);
  };

  const handleGroupToggleVisibility = (groupId) => {
    const updatedGroups = groups.map(g =>
      g.id === groupId ? { ...g, visible: g.visible !== true } : g
    );
    setGroups(updatedGroups);
    saveToHistory(nodes, edges);
    const updatedGroup = updatedGroups.find(g => g.id === groupId);
    if (updatedGroup) {
      try {
        eventBus.emit('groupUpdated', { id: groupId, patch: { visible: updatedGroup.visible }, group: updatedGroup });
      } catch (err) {
        // ignore event bus errors
      }
    }
  };

  const handleGroupDelete = (groupId) => {
    const result = groupManager.current.removeGroup(groupId);
    if (result.success) {
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
      saveToHistory(nodes, edges);
      try {
        eventBus.emit('groupDeleted', { id: groupId });
      } catch (err) {
        // ignore event bus errors
      }
    }
  };

  const handleUpdateGroup = (groupId, updates) => {
    const updatedGroups = groups.map(g =>
      g.id === groupId ? { ...g, ...updates } : g
    );
    setGroups(updatedGroups);
    saveToHistory(nodes, edges);
    const updatedGroup = updatedGroups.find(g => g.id === groupId);
    if (updatedGroup) {
      try {
        eventBus.emit('groupUpdated', { id: groupId, patch: updates, group: updatedGroup });
      } catch (err) {
        // ignore event bus errors
      }
    }
  };

  const handleAddNodesToGroup = (groupId, nodeIds) => {
    const result = groupManager.current.addNodesToGroup(groupId, nodeIds);
    if (result.success) {
      setGroups(groupManager.current.getAllGroups());
      saveToHistory(nodes, edges);
      const updatedGroup = result.data;
      if (updatedGroup) {
        try {
          eventBus.emit('groupUpdated', { id: groupId, patch: { nodeIds: updatedGroup.nodeIds }, group: updatedGroup });
        } catch (err) {
          // ignore event bus errors
        }
      }
    }
  };

  const handleRemoveNodesFromGroup = (groupId, nodeIds) => {
    const result = groupManager.current.removeNodesFromGroup(groupId, nodeIds);
    if (result.success) {
      setGroups(groupManager.current.getAllGroups());
      saveToHistory(nodes, edges);
      const updatedGroup = result.data;
      if (updatedGroup) {
        try {
          eventBus.emit('groupUpdated', { id: groupId, patch: { nodeIds: updatedGroup.nodeIds }, group: updatedGroup });
        } catch (err) {
          // ignore event bus errors
        }
      }
    }
  };
  
  const handleCreateGroupWrapper = () => {
    if (selectedNodeIds.length < 2) return;
    const result = groupManager.current.createGroup(selectedNodeIds, {
      nodes: nodes,
      label: `Cluster ${groups.length + 1}`
    });
    if (result.success) {
      setGroups([...groups, result.data]);
      setSelectedNodeIds([]);
      setSelectedGroupIds([result.data.id]);
      saveToHistory(nodes, edges);
      try {
        eventBus.emit('groupAdded', { group: result.data });
      } catch (err) {
        // ignore event bus errors
      }
    }
  };

  const handleUngroupSelectedWrapper = () => {
    if (selectedGroupIds.length === 0) return;
    let updated = false;
    selectedGroupIds.forEach(groupId => {
      if (groupManager.current.removeGroup(groupId).success) {
        updated = true;
        try {
          eventBus.emit('groupDeleted', { id: groupId });
        } catch (err) {
          // ignore event bus errors
        }
      }
    });
    if (updated) {
      setGroups(groupManager.current.getAllGroups());
      setSelectedGroupIds([]);
      saveToHistory(nodes, edges);
    }
  };
  
  // ===== PASTE HANDLER =====
  const handlePasteGraphData = async (pastedData) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      let pastedNodes = [], pastedEdges = [], pastedGroups = [];
      let shouldAutoLayout = false;

      if (!pastedData) return;

      // Parse input format
      if (Array.isArray(pastedData)) {
        if (pastedData[0]?.position && pastedData[0]?.id) pastedNodes = pastedData;
        else if (pastedData[0]?.source && pastedData[0]?.target) pastedEdges = pastedData;
        else if (pastedData[0]?.nodeIds) pastedGroups = pastedData;
      } else if (pastedData.nodes || pastedData.edges || pastedData.groups) {
        pastedNodes = pastedData.nodes || [];
        pastedEdges = pastedData.edges || [];
        pastedGroups = pastedData.groups || [];
      } else if (pastedData.id && pastedData.position) {
        pastedNodes = [pastedData];
      } else if (pastedData.id && pastedData.source && pastedData.target) {
        pastedEdges = [pastedData];
      } else if (pastedData.id && pastedData.nodeIds) {
        pastedGroups = [pastedData];
      }

      // Allow nodegraph-data payloads to omit positions (Phase 2/3 policy).
      // We hydrate positions for validation/storage, and separately track whether positions were omitted.
      if (Array.isArray(pastedNodes) && pastedNodes.length > 0) {
        shouldAutoLayout = pastedNodes.every(
          (node) => node && !Object.prototype.hasOwnProperty.call(node, 'position')
        );
        pastedNodes = pastedNodes.map((node, index) => {
          const safe = node && typeof node === 'object' ? node : {};
          const x = 120 + (index % 4) * 260;
          const y = 120 + Math.floor(index / 4) * 160;
          return {
            ...safe,
            // ValidationGuard requires id + position; keep caller-provided values when present.
            id: safe.id || `node_${Date.now()}_${index}`,
            label: safe.label || `Node ${index + 1}`,
            position: safe.position || { x, y },
            width: Number.isFinite(Number(safe.width)) ? safe.width : safe.width ?? 160,
            height: Number.isFinite(Number(safe.height)) ? safe.height : safe.height ?? 80
          };
        });
      }

      const sanitizeGroups = (groupsArray, availableNodeIdSet) => {
        return groupsArray.map(g => {
          const nodeIds = Array.isArray(g.nodeIds) ? g.nodeIds.filter(id => availableNodeIdSet.has(id)) : [];
          return {
            ...g,
            nodeIds,
            bounds: g.bounds && typeof g.bounds === 'object' ? { ...g.bounds } : { x: 0, y: 0, width: 0, height: 0 },
            style: g.style && typeof g.style === 'object' ? { ...g.style } : {},
            extensions: g.extensions && typeof g.extensions === 'object' ? { ...g.extensions } : undefined
          };
        }).filter(g => g.nodeIds?.length >= 2);
      };

      const nodeValidation = validateNodes(pastedNodes);
      const edgeValidation = validateEdges(pastedEdges, nodeValidation.valid);
      const groupValidation = validateGroups(pastedGroups);
      pastedNodes = nodeValidation.valid.map(ensureUnifiedHandles);
      pastedEdges = edgeValidation.valid.map(normalizeEdgeSchema);
      pastedGroups = groupValidation.valid;
      const validationErrors = [...nodeValidation.errors, ...edgeValidation.errors, ...groupValidation.errors];
      if (validationErrors.length) {
        const summary = summarizeValidationErrors(validationErrors);
        console.warn('[handlePasteGraphData] Skipping invalid items:', validationErrors);
        setSnackbar?.({ open: true, message: summary, severity: 'warning' });
      }

  
      let action = pastedData.action || 'add';

      if (action === 'replace') {
        const nodeIdSet = new Set(pastedNodes.map(n => n.id));
        const groupsSanitized = sanitizeGroups(pastedGroups, nodeIdSet);
        
        setNodes(prev => {
          nodesRef.current = pastedNodes;
          return pastedNodes;
        });
        setEdges(prev => {
          edgesRef.current = pastedEdges;
          return pastedEdges;
        });
        setGroups([]);
        groupManager.current?.clear?.();
        setGroups(groupsSanitized);
        
        groupsSanitized.forEach(g => {
          groupManager.current.groups.set(g.id, g);
          g.nodeIds?.forEach(nodeId => groupManager.current.nodeToGroup.set(nodeId, g.id));
        });
        
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        setSelectedGroupIds([]);
        saveToHistory(pastedNodes, pastedEdges, groupsSanitized);

        if (shouldAutoLayout && pastedNodes.length > 0) {
          try {
            eventBus.emit('layout:autoOnMissingPositions', {
              reason: 'pasteGraphData',
              action: 'replace',
              nodeIds: pastedNodes.map((n) => n.id)
            });
          } catch (err) {
            // ignore
          }
        }
      } else if (action === 'add') {
        const existingNodeIds = new Set(nodesRef.current.map(n => n.id));
        const existingEdgeIds = new Set(edgesRef.current.map(e => e.id));
        const existingGroupIds = new Set(groups.map(g => g.id));

        const nodesToAdd = pastedNodes.filter(n => !existingNodeIds.has(n.id));
        const edgesToAdd = pastedEdges.filter(e => !existingEdgeIds.has(e.id));
        const combinedNodeIds = new Set([...nodesRef.current.map(n => n.id), ...nodesToAdd.map(n => n.id)]);
        const groupsToAdd = sanitizeGroups(
          pastedGroups.filter(g => !existingGroupIds.has(g.id)),
          combinedNodeIds
        );

        const newNodes = [...nodesRef.current, ...nodesToAdd];
        const newEdges = [...edgesRef.current, ...edgesToAdd];
        const newGroups = [...groups, ...groupsToAdd];

        setNodes(prev => {
          nodesRef.current = newNodes;
          return newNodes;
        });
        setEdges(prev => {
          edgesRef.current = newEdges;
          return newEdges;
        });
        setGroups(newGroups);

        groupsToAdd.forEach(g => {
          groupManager.current.groups.set(g.id, g);
          g.nodeIds?.forEach(nodeId => groupManager.current.nodeToGroup.set(nodeId, g.id));
        });

        saveToHistory(newNodes, newEdges, newGroups);

        if (shouldAutoLayout && nodesToAdd.length > 0) {
          try {
            eventBus.emit('layout:autoOnMissingPositions', {
              reason: 'pasteGraphData',
              action: 'add',
              nodeIds: nodesToAdd.map((n) => n.id)
            });
          } catch (err) {
            // ignore
          }
        }
      }
    } catch (err) {
      console.error('Error in handlePasteGraphData:', err);
      setSnackbar({ open: true, message: 'Error importing graph', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  // Example: Add a handler that can call iframe RPC
  const handleCallBackgroundMethod = async (method, args) => {
    const ready =
      typeof backgroundRpcReady === 'function'
        ? backgroundRpcReady()
        : Boolean(backgroundRpcReady);
    if (!ready) {
      console.warn('[Handlers] Background RPC not ready');
      setSnackbar?.({ open: true, message: 'Background not ready', severity: 'warning' });
      return { success: false, error: 'RPC not ready' };
    }
    
    try {
      const result = await backgroundRpc?.(method, args);
      return { success: true, result };
    } catch (err) {
      console.error('[Handlers] RPC error:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    // Node
    handleAddNode,
    handleUpdateNodeData,
    handleNodeListSelect,
    handleNodeFocus,
    handleNodeDoubleClick,
    
    // Edge
    handleUpdateEdge,
    handleEdgeDoubleClick,
    
    // Delete
    handleDeleteSelected,
    handleClearGraph,
    
    // Load/Save
    handleLoadGraph,
    handlePasteGraphData,
    
    // Group
    handleGroupListSelect,
    handleGroupFocus,
    handleEdgeFocus,
    handleGroupDoubleClickFromList,
    handleGroupToggleVisibility,
    handleGroupDelete,
    handleUpdateGroup,
    handleAddNodesToGroup,
    handleRemoveNodesFromGroup,
    handleCreateGroupWrapper,
    handleUngroupSelectedWrapper,

    // RPC
    handleCallBackgroundMethod
  };
}

// Local helper: add a node directly to state (fallback path). Renamed to avoid clashing with exported handler.
let addNodeGuard = false;
export function handleAddNodeLocal({ nodesRef, setNodes, pan, zoom, defaultNodeColor = '#1976d2', nodeType = 'default' }) {
  if (addNodeGuard) return;
  addNodeGuard = true;
  setTimeout(() => { addNodeGuard = false; }, 100);

  setNodes(prev => {
    const existingIds = new Set(prev.map(n => n.id));
    const id = generateUUID(existingIds);
    const centerX = (window.innerWidth / 2 - (pan?.x || 0)) / (zoom || 1);
    const centerY = (window.innerHeight / 2 - (pan?.y || 0)) / (zoom || 1);

    const newNode = {
      id,
      label: 'New Node',
      type: nodeType,
      position: { x: centerX, y: centerY },
      width: 120,
      height: 60,
      color: defaultNodeColor,
      data: {}
    };

    // Deduplicate and add
    const next = deduplicateNodes([...prev, newNode]);
    console.log('handleAddNodeLocal: added', id);
    return next;
  });
}

// Import helper to merge imported nodes safely
export function handleImportNodes({ nodesRef, setNodes, importedNodes = [] }) {
  setNodes(prev => {
    const unique = ensureUniqueNodeIds(importedNodes, prev);
    const next = deduplicateNodes([...prev, ...unique]);
    console.log('handleImportNodes: setNodes ->', next.map(n => n.id));
    return next;
  });
}

// Helper for pasting nodes programmatically (used by external paste handlers)
export function handlePasteGraph({ nodesRef, setNodes, pastedNodes = [] }) {
  setNodes(prev => {
    const unique = ensureUniqueNodeIds(pastedNodes, prev);
    const next = deduplicateNodes([...prev, ...unique]);
    console.log('handlePasteGraph: setNodes ->', next.map(n => n.id));
    return next;
  });
}

