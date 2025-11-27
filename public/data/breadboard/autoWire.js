
import {
  isPlainObject,
  normalizeRowName,
  normalizeSegmentName,
  normalizeSegmentPreference,
  resolveSegmentPreference,
  isRailSegment,
  getRailRowLabel,
  getSocketPosition,
  quantizeValue,
  makeSegmentColumnKey,
  clampColumn,
  findNearestColumn
} from './utils.js';

import {
  buildLayoutFromSchema,
  buildSocketLayout,
  buildRowPositionMap
} from './layout.js';

import {
  computeConnectionsForComponent,
  buildEdgeCommands
} from './connectivity.js';

import {
  computeSnappedPosition,
  applySnappedPosition
} from './placement.js';

import {
  rebuildEdgesForComponent
} from './edges.js';




(async function () {
  if (typeof window === 'undefined') return;

  console.log('[BreadboardAutoWire] script loaded');

  // NOTE: use a script-specific cleanup hook so we don't fight with any
  // other BreadboardAutoWire helper in the host app.
  if (typeof window.__breadboardScriptAutoWireCleanup === 'function') {
    try {
      window.__breadboardScriptAutoWireCleanup();
    } catch (err) {
      console.warn('[BreadboardAutoWire] Failed to clean up previous script instance:', err);
    }
  }
  window.__breadboardScriptAutoWireCleanup = null;

  const ROW_SEGMENT_TOP = 'top';
  const ROW_SEGMENT_BOTTOM = 'bottom';
  const SEGMENT_ROW_FALLBACK = {
    [ROW_SEGMENT_TOP]: 'A',
    [ROW_SEGMENT_BOTTOM]: 'F'
  };
  const MIN_BODY_WIDTH = 16;
  const MIN_BODY_HEIGHT = 24;
  const BODY_MARGIN = 12;

  const SNAP_OFFSET_X = 0;
  const DEFAULT_INPUT_HANDLE_KEY = 'in';
  const makeHandleNodeId = (nodeId, handleKey) => `handle:${nodeId}:${handleKey || DEFAULT_INPUT_HANDLE_KEY}`;
  const CONDUCTIVE_COMPONENTS = {
    'io.breadboard.components:resistor': [['pinA', 'pinB']],
    'io.breadboard.components:railTapPositive': [['rail', 'tap']],
    'io.breadboard.components:railTapNegative': [['rail', 'tap']],
    'io.breadboard.components:jumper': [['wireA', 'wireB']],
    'io.breadboard.sockets:railSocket': [
      ['vplus', 'positive'],
      ['gnd', 'negative']
    ]
  };

  const resolvePinSegment = (node, pinInfo, baseSegment) => {
    const handleKey = pinInfo?.handleKey || pinInfo?.originalPin?.id;
    if (node?.type === 'io.breadboard.components:railTapNegative') {
      if (handleKey === 'tap') {
        return ROW_SEGMENT_BOTTOM;
      }
      if (handleKey === 'rail') {
        return 'rail-bottom-negative';
      }
    }
    if (node?.type === 'io.breadboard.components:railTapPositive') {
      if (handleKey === 'tap') {
        return ROW_SEGMENT_TOP;
      }
      if (handleKey === 'rail') {
        return 'rail-top-positive';
      }
    }
    return resolveSegmentPreference(pinInfo?.segmentPreference, baseSegment);
  };

  const coerceRailTarget = (currentEntry, currentSegment, column, node, handleKey, layout) => {
    if (!node || handleKey !== 'rail') {
      return { entry: currentEntry, segment: currentSegment };
    }
    const type = node.type || '';
    let fallbackSegment = null;
    if (type === 'io.breadboard.components:railTapNegative') {
      fallbackSegment = 'rail-bottom-negative';
    } else if (type === 'io.breadboard.components:railTapPositive') {
      fallbackSegment = 'rail-top-positive';
    }
    if (!fallbackSegment) {
      return { entry: currentEntry, segment: currentSegment };
    }
    if (
      currentEntry &&
      currentEntry.segmentType === 'rail' &&
      currentEntry.railInfo &&
      ((fallbackSegment.includes('negative') && currentEntry.railInfo.polarity === 'negative') ||
        (fallbackSegment.includes('positive') && currentEntry.railInfo.polarity === 'positive'))
    ) {
      return { entry: currentEntry, segment: currentSegment };
    }
    const fallbackKey = makeSegmentColumnKey(fallbackSegment, column);
    const fallbackEntry = layout?.targetsBySegmentColumn?.get(fallbackKey);
    if (fallbackEntry) {
      return { entry: fallbackEntry, segment: fallbackSegment };
    }
    return { entry: currentEntry, segment: currentSegment };
  };
 
  

  const determineAnchor = (node, layout) => {
    const fallback = {
      segment: ROW_SEGMENT_TOP,
      column: layout?.minColumn || 1
    };
    if (!node || !layout) return fallback;
    const pos = node.position || {};
    const x = typeof pos.x === 'number' ? pos.x : null;
    const y = typeof pos.y === 'number' ? pos.y : null;

    const anchorColumn = clampColumn(
      Number.isFinite(x) ? findNearestColumn(x, layout.columnCenters) ?? fallback.column : fallback.column,
      layout.minColumn,
      layout.maxColumn
    );

    let anchorSegment = ROW_SEGMENT_TOP;
    if (Number.isFinite(y)) {
      const topSocketEntry = layout.targetsBySegmentColumn.get(makeSegmentColumnKey(ROW_SEGMENT_TOP, anchorColumn));
      const bottomSocketEntry = layout.targetsBySegmentColumn.get(makeSegmentColumnKey(ROW_SEGMENT_BOTTOM, anchorColumn));
      const topSocket = topSocketEntry?.node;
      const bottomSocket = bottomSocketEntry?.node;
      const topY = topSocket ? getSocketPosition(topSocket).y : null;
      const bottomY = bottomSocket ? getSocketPosition(bottomSocket).y : null;
      if (topY !== null && bottomY !== null) {
        const distTop = Math.abs(y - topY);
        const distBottom = Math.abs(y - bottomY);
        anchorSegment = distBottom < distTop ? ROW_SEGMENT_BOTTOM : ROW_SEGMENT_TOP;
      } else if (topY !== null) {
        anchorSegment = y >= topY ? ROW_SEGMENT_BOTTOM : ROW_SEGMENT_TOP;
      } else if (bottomY !== null) {
        anchorSegment = y >= bottomY ? ROW_SEGMENT_BOTTOM : ROW_SEGMENT_TOP;
      } else if (Number.isFinite(layout.boardMidY)) {
        anchorSegment = y >= layout.boardMidY ? ROW_SEGMENT_BOTTOM : ROW_SEGMENT_TOP;
      }
    }

    return {
      segment: anchorSegment,
      column: anchorColumn
    };
  };

  const normalizePinsForNode = (pins = []) => {
    if (!Array.isArray(pins) || pins.length === 0) return [];
    let baseColumn = null;
    pins.forEach(pin => {
      if (baseColumn !== null) return;
      const col = Number(pin?.column);
      if (Number.isFinite(col)) baseColumn = col;
    });
    if (baseColumn === null) baseColumn = 1;

    return pins.map((pin, index) => {
      const columnOffset = Number.isFinite(pin?.columnOffset)
        ? Number(pin.columnOffset)
        : Number.isFinite(pin?.column)
        ? Number(pin.column) - baseColumn
        : index;
      const preferenceSource =
        pin?.segmentPreference !== undefined
          ? pin.segmentPreference
          : pin?.segment !== undefined
          ? pin.segment
          : null;
      const segmentPreference = normalizeSegmentPreference(preferenceSource || 'same');
      const handleKey = pin?.handleKey || pin?.key || pin?.id || pin?.label;
      return {
        columnOffset,
        segmentPreference,
        handleKey,
        originalPin: pin || {},
        index
      };
    });
  };

  const deriveSocketKey = (socket, rowHint) => {
    if (!socket) return null;
    const column = socket?.data?.column;
    const rows = Array.isArray(socket?.data?.rows) ? socket.data.rows : [];
    const row = rowHint || rows[0];
    if (row && Number.isFinite(column)) {
      return `${String(row).trim().toUpperCase()}${column}`;
    }
    return socket.id || null;
  };

  const chooseSocketRow = (socket, segment, rowPositions, preferredRow) => {
    if (isRailSegment(segment)) {
      const normalizedPreferred = normalizeRowName(preferredRow);
      if (normalizedPreferred) return normalizedPreferred;
      return getRailRowLabel(segment) || SEGMENT_ROW_FALLBACK[ROW_SEGMENT_TOP];
    }
    const normalizedPreferred = normalizeRowName(preferredRow);
    if (normalizedPreferred) {
      if (rowPositions?.has(normalizedPreferred)) {
        return normalizedPreferred;
      }
      const availableRows = Array.isArray(socket?.data?.rows)
        ? socket.data.rows.map(normalizeRowName)
        : [];
      if (availableRows.includes(normalizedPreferred)) {
        return normalizedPreferred;
      }
    }
    if (rowPositions && rowPositions.size > 0) {
      const iterator = rowPositions.keys().next();
      if (!iterator.done) return iterator.value;
    }
    const rows = Array.isArray(socket?.data?.rows) ? socket.data.rows : [];
    if (rows.length > 0) return normalizeRowName(rows[0]) || rows[0];
    return SEGMENT_ROW_FALLBACK[segment] || SEGMENT_ROW_FALLBACK[ROW_SEGMENT_TOP];
  };

  const normalizeHandleEntry = (handle) => {
    if (!handle) return null;
    if (typeof handle === 'string') {
      return { id: handle, key: handle, label: handle };
    }
    if (typeof handle !== 'object') return null;
    const id = handle.id || handle.key || handle.name || handle.handleKey;
    if (!id) return null;
    return {
      id,
      key: handle.key || id,
      label: handle.label || handle.name || id,
      type: handle.type || handle.dataType || handle.handleType || 'value'
    };
  };

  const hasHandleOnNode = (node, handleKey) => {
    if (!node || !handleKey) return null;
    const sources = [node.handles, node.outputs, node.inputs, node.data?.handles];
    const normalized = [];
    sources.forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(entry => {
        const normalizedEntry = normalizeHandleEntry(entry);
        if (normalizedEntry) normalized.push(normalizedEntry);
      });
    });
    return normalized.find(handle => handle.id === handleKey || handle.key === handleKey) || null;
  };

  const pickInputHandleKey = (node, preferredKeys = []) => {
    if (!node) return null;
    const collected = [];
    const seen = new Set();

    const addEntries = (entries, forceInput = false) => {
      if (!Array.isArray(entries)) return;
      entries.forEach(entry => {
        if (!entry) return;
        const normalized = normalizeHandleEntry(entry);
        if (!normalized) return;
        const rawDirection = (entry.direction || entry.handleDirection || entry.type || '').toString().toLowerCase();
        const isInputLike =
          forceInput ||
          !rawDirection ||
          rawDirection === 'input' ||
          rawDirection === 'bidirectional';
        if (!isInputLike) return;
        const key = normalized.key || normalized.id;
        if (!key || seen.has(key)) return;
        seen.add(key);
        collected.push(key);
      });
    };

    addEntries(node.inputs, true);
    addEntries(node.handles, false);
    if (node.data && Array.isArray(node.data.handles)) {
      addEntries(node.data.handles, false);
    }

    for (const preferred of preferredKeys) {
      if (!preferred) continue;
      const exact = collected.find(key => key === preferred);
      if (exact) return exact;
      const caseInsensitive = collected.find(key => key.toLowerCase() === String(preferred).toLowerCase());
      if (caseInsensitive) return caseInsensitive;
    }

    if (collected.length > 0) {
      return collected[0];
    }

    return DEFAULT_INPUT_HANDLE_KEY;
  };

  const extractNodeIds = (payload) => {
    if (!payload || typeof payload !== 'object') return [];
    const arraysToCheck = [payload.nodeIds, payload.nodes, payload.details && payload.details.nodeIds];
    for (const arr of arraysToCheck) {
      if (Array.isArray(arr)) {
        return arr
          .map(item => {
            if (typeof item === 'string' || typeof item === 'number') return String(item);
            if (item && typeof item === 'object' && (item.id || item.nodeId)) {
              return String(item.id || item.nodeId);
            }
            return null;
          })
          .filter(Boolean);
      }
    }
    const candidates = [payload.nodeId, payload.id, payload.details && payload.details.nodeId, payload.node && payload.node.id];
    return candidates
      .filter(value => typeof value === 'string' || typeof value === 'number')
      .map(value => String(value));
  };

  const pendingDragEndNodeIds = new Set();
  let dragEndProcessingScheduled = false;
  const scheduleDragEndProcessing = (processFn) => {
    if (dragEndProcessingScheduled) return;
    dragEndProcessingScheduled = true;
    const flush = () => {
      dragEndProcessingScheduled = false;
      if (pendingDragEndNodeIds.size === 0) return;
      const ids = Array.from(pendingDragEndNodeIds);
      pendingDragEndNodeIds.clear();
      try {
        const maybePromise = processFn(ids);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch(err => console.error('[BreadboardAutoWire] Failed to process drag end queue:', err));
        }
      } catch (err) {
        console.error('[BreadboardAutoWire] Failed to process drag end queue:', err);
      }
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(flush);
      });
    } else {
      setTimeout(flush, 0);
    }
  };

  const readInitialDebugPreference = () => {
    if (typeof window.__breadboardAutoWireDebug === 'boolean') {
      return window.__breadboardAutoWireDebug;
    }
    if (window.__breadboardAutoWireDebug !== undefined) {
      return Boolean(window.__breadboardAutoWireDebug);
    }
    try {
      const stored = window.localStorage?.getItem('breadboardAutoWireDebug');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (err) {
      /* ignore */
    }
    return false;
  };

  const initialDebugPreference = readInitialDebugPreference();
  const isDebugEnabled = () => {
    if (typeof window.__breadboardAutoWireDebug === 'boolean') {
      return window.__breadboardAutoWireDebug;
    }
    if (window.__breadboardAutoWireDebug !== undefined) {
      return Boolean(window.__breadboardAutoWireDebug);
    }
    return initialDebugPreference;
  };

  const debugLog = (...args) => {
    if (!isDebugEnabled()) return;
    console.info('[BreadboardAutoWire]', ...args);
  };

  const setDebugPreference = (value) => {
    const normalized = Boolean(value);
    window.__breadboardAutoWireDebug = normalized;
    try {
      window.localStorage?.setItem('breadboardAutoWireDebug', normalized ? 'true' : 'false');
    } catch (err) {
      /* ignore */
    }
    console.info('[BreadboardAutoWire]', `Debug logging ${normalized ? 'enabled' : 'disabled'}`);
  };

  window.breadboardAutoWire = window.breadboardAutoWire || {};
  if (typeof window.breadboardAutoWire.setDebug !== 'function') {
    window.breadboardAutoWire.setDebug = setDebugPreference;
  }

  const connectAdjacency = (adjacency, a, b) => {
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };

  const solveConnectivity = (nodes = [], edges = []) => {
    const adjacency = new Map();

    edges.forEach(edge => {
      if (!edge || !edge.source || !edge.target) return;
      const sourceHandle = edge.sourceHandle || DEFAULT_INPUT_HANDLE_KEY;
      const sourceId = makeHandleNodeId(edge.source, sourceHandle);
      const targetId =
        edge.targetHandle && edge.targetHandle !== 'socket'
          ? makeHandleNodeId(edge.target, edge.targetHandle)
          : edge.target;
      connectAdjacency(adjacency, sourceId, targetId);
      connectAdjacency(adjacency, targetId, sourceId);
    });

    nodes.forEach(node => {
      const pairs = CONDUCTIVE_COMPONENTS[node?.type];
      if (!node || !Array.isArray(pairs)) return;
      pairs.forEach(pair => {
        if (!Array.isArray(pair) || pair.length < 2) return;
        const [fromKey, toKey] = pair;
        const fromId = makeHandleNodeId(node.id, fromKey);
        const toId = makeHandleNodeId(node.id, toKey);
        connectAdjacency(adjacency, fromId, toId);
        connectAdjacency(adjacency, toId, fromId);
      });
    });

    const nodeFlags = new Map();
    const markReachable = (startId, flagKey) => {
      if (!startId) return;
      const visited = new Set();
      const queue = [startId];
      visited.add(startId);
      while (queue.length > 0) {
        const current = queue.shift();
        if (!nodeFlags.has(current)) nodeFlags.set(current, {});
        nodeFlags.get(current)[flagKey] = true;
        const neighbors = adjacency.get(current);
        if (!neighbors) continue;
        neighbors.forEach(nextId => {
          if (visited.has(nextId)) return;
          visited.add(nextId);
          queue.push(nextId);
        });
      }
    };

    nodes.forEach(node => {
      if (!node || node.type !== 'io.breadboard.bus') return;
      const positiveId = makeHandleNodeId(node.id, 'positive');
      const negativeId = makeHandleNodeId(node.id, 'negative');
      markReachable(positiveId, 'touchesVPlus');
      markReachable(negativeId, 'touchesGnd');
    });

    return nodeFlags;
  };

  const waitForGraphSettled = () =>
    new Promise(resolve => {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      } else {
        setTimeout(resolve, 16);
      }
    });

  const toPromise = (value) => {
    if (value && typeof value.then === 'function') {
      return value;
    }
    return Promise.resolve(value);
  };

  const readGraphSnapshot = (api) => {
    const nodesResult = api.readNode?.();
    const edgesResult = api.readEdge?.();
    return {
      nodes: Array.isArray(nodesResult?.data) ? nodesResult.data : [],
      edges: Array.isArray(edgesResult?.data) ? edgesResult.data : []
    };
  };

  const readBoardSchemaFromNodes = (nodes = []) => {
    if (typeof window !== 'undefined' && isPlainObject(window.__breadboardSchema)) {
      return window.__breadboardSchema;
    }
    if (!Array.isArray(nodes)) return null;
    const skinNode = nodes.find(node => node?.type === 'io.breadboard.sockets:skin');
    const schema =
      (skinNode?.data && skinNode.data.schema) ||
      (skinNode?.data?.breadboard && skinNode.data.breadboard.schema);
    if (isPlainObject(schema)) {
      if (typeof window !== 'undefined') {
        window.__breadboardSchema = schema;
      }
      return schema;
    }
    return null;
  };

  const attemptAttach = () => {
    console.log('[BreadboardAutoWire] attemptAttach called');

    const eventBus = window.eventBus;
    const api = window.graphAPI;

    if (!eventBus || !api || typeof api.readNode !== 'function' || typeof api.updateNode !== 'function') {
      console.log('[BreadboardAutoWire] eventBus or graphAPI not ready yet, retrying in 500ms');
      setTimeout(attemptAttach, 500);
      return;
    }

    if (attemptAttach._attached) {
      console.log('[BreadboardAutoWire] already attached, skipping');
      return;
    }

    console.log('[BreadboardAutoWire] found eventBus + graphAPI, attaching listeners');
    attemptAttach._attached = true;

    const cleanupCallbacks = [];
    const registerCleanup = (fn) => {
      if (typeof fn === 'function') cleanupCallbacks.push(fn);
    };

    const collectHandleKeys = (node) => {
      const keys = new Set();
      if (Array.isArray(node?.handles)) {
        node.handles.forEach(handle => {
          if (handle?.id) keys.add(handle.id);
        });
      }
      if (Array.isArray(node?.outputs)) {
        node.outputs.forEach(handle => {
          if (handle?.key) keys.add(handle.key);
        });
      }
      if (Array.isArray(node?.inputs)) {
        node.inputs.forEach(handle => {
          if (handle?.key) keys.add(handle.key);
        });
      }
      if (Array.isArray(node?.data?.pins)) {
        node.data.pins.forEach(pin => {
          if (pin?.id) keys.add(pin.id);
        });
      }
      return Array.from(keys);
    };

    const updateConnectivityStates = async () => {
      const snapshot = readGraphSnapshot(api);
      if (!snapshot) return;
      const handleFlags = solveConnectivity(snapshot.nodes, snapshot.edges);
      for (const node of snapshot.nodes) {
        const existingPinState = isPlainObject(node.data?.breadboard?.pinState)
          ? node.data.breadboard.pinState
          : {};
        let changed = false;
        const nextPinState = { ...existingPinState };
        const pinKeys = collectHandleKeys(node);
        pinKeys.forEach(handleKey => {
          if (!handleKey) return;
          const currentState = nextPinState[handleKey] || {};
          const flagEntry = handleFlags.get(makeHandleNodeId(node.id, handleKey)) || {};
          const touchesVPlus = Boolean(flagEntry.touchesVPlus);
          const touchesGnd = Boolean(flagEntry.touchesGnd);
          nextPinState[handleKey] = {
            ...currentState,
            touchesVPlus,
            touchesGnd
          };
          if ((currentState.touchesVPlus || false) !== touchesVPlus || (currentState.touchesGnd || false) !== touchesGnd) {
            changed = true;
          }
        });
        if (!changed) continue;
        const payload = {
          data: {
            ...node.data,
            breadboard: {
              ...(isPlainObject(node.data?.breadboard) ? node.data.breadboard : {}),
              pinState: nextPinState
            }
          }
        };
        try {
          await toPromise(api.updateNode(node.id, payload));
          if (eventBus && typeof eventBus.emit === 'function') {
            eventBus.emit('breadboard.pinStateChanged', {
              nodeId: node.id,
              pinState: nextPinState,
              source: 'breadboard-auto-wire'
            });
          }
        } catch (err) {
          console.warn('[BreadboardAutoWire]', 'Failed to update node with connectivity state:', node.id, err);
        }
      }
    };

    const handleNodeDragStart = () => {};

    const processNodeDragEnd = async (queuedNodeIds = []) => {
      if (!Array.isArray(queuedNodeIds) || queuedNodeIds.length === 0) return;

      const { nodes, edges: edgesSnapshot } = readGraphSnapshot(api);
      const socketNodes = nodes.filter(node => node?.type === 'io.breadboard.sockets:socket');
      const railNodes = nodes.filter(node => node?.type === 'io.breadboard.sockets:railSocket');
      if (socketNodes.length === 0 && railNodes.length === 0) return;

      const boardSchema = readBoardSchemaFromNodes(nodes);
      const layout = buildSocketLayout(socketNodes, railNodes, boardSchema);
      if (!layout) return;

      componentsToAttach.forEach(componentNode => {
        // compute where each pin should go
        const connections = computeConnectionsForComponent(componentNode, layout);
        if (!connections || connections.length === 0) return;
      
        // placement
        const snapped = computeSnappedPosition(componentNode, connections);
        if (snapped) {
          applySnappedPosition(api, componentNode, snapped);
        }

        // 3. convert to edges (still produces lightweight specs)
        const edges = buildEdgeCommands(componentNode, connections);

        // 4. rebuild edges (remove old + add new)
        const cmds = rebuildEdgesForComponent(componentNode.id, edgesSnapshot, edges);

        // 5. queue them
        pendingEdgeAdds.push(...cmds);

      });

      await legacyHandleNodeDrop({
        queuedNodeIds,
        nodes,
        layout,
        api
      });
      
    };

    const handleNodeDragEnd = (payload = {}) => {
      const nodeIds = extractNodeIds(payload);
      debugLog('handleNodeDragEnd resolved nodeIds:', nodeIds, 'from payload:', payload);
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;
      nodeIds.forEach(id => pendingDragEndNodeIds.add(id));
      scheduleDragEndProcessing(processNodeDragEnd);
    };

    const dragStartEventNames = ['nodeDragStart', 'node:dragstart'];
    const dragEndEventNames = ['nodeDragEnd', 'node:dragend'];
    const normalizedDragStartNames = new Set(dragStartEventNames.map(name => String(name || '').toLowerCase()));
    const normalizedDragEndNames = new Set(dragEndEventNames.map(name => String(name || '').toLowerCase()));
    const normalizeEventName = (name) => (typeof name === 'string' ? name.toLowerCase() : '');

    const subscribeEvents = (eventNames, handler) => {
      if (!eventBus?.on || !Array.isArray(eventNames)) return;
      eventNames.forEach(eventName => {
        if (typeof eventName === 'string') {
          eventBus.on(eventName, handler);
          registerCleanup(() => eventBus.off(eventName, handler));
        }
      });
    };

    subscribeEvents(dragStartEventNames, handleNodeDragStart);
    subscribeEvents(dragEndEventNames, handleNodeDragEnd);
    console.info('[BreadboardAutoWire] Registered drag handlers for events:', dragStartEventNames.concat(dragEndEventNames));

    const shouldHandleRelayMessages = !eventBus?.on;
    const relayListener = (event) => {
      if (!shouldHandleRelayMessages) return;
      const payload = event?.data;
      if (!payload || payload.type !== 'breadboard:relayNodeDrag') return;
      const { eventName, details } = payload;
      const normalizedName = normalizeEventName(eventName);
      if (normalizedDragStartNames.has(normalizedName)) {
        handleNodeDragStart(details || {});
      } else if (normalizedDragEndNames.has(normalizedName)) {
        handleNodeDragEnd(details || {});
      }
    };
    if (shouldHandleRelayMessages) {
      window.addEventListener('message', relayListener);
      registerCleanup(() => window.removeEventListener('message', relayListener));
    }

    console.info('[BreadboardAutoWire] Registered nodeDragEnd handler (public script).');

    const detach = () => {
      cleanupCallbacks.forEach(fn => {
        try {
          fn();
        } catch (err) {
          console.warn('[BreadboardAutoWire] Cleanup callback failed:', err);
        }
      });
      cleanupCallbacks.length = 0;
      attemptAttach._attached = false;
    };

    const primeAutoWire = () => {
      const snapshot = readGraphSnapshot(api);
      if (!snapshot?.nodes) return;
      snapshot.nodes.forEach(node => {
        if (!node?.id) return;
        pendingDragEndNodeIds.add(node.id);
      });
      scheduleDragEndProcessing(processNodeDragEnd);
    };

    primeAutoWire();

    // IMPORTANT: use a script-specific global so we don't clobber any
    // host-level helper that also uses __breadboardAutoWireCleanup.
    window.__breadboardScriptAutoWireCleanup = detach;
    return detach;
  };

  attemptAttach();
})();
