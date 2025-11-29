(function () {
  if (typeof window === 'undefined') return;

  const ROW_GROUPS = {
    top: ['A', 'B', 'C', 'D', 'E'],
    bottom: ['F', 'G', 'H', 'I', 'J']
  };

  const DEFAULT_MIN_WIDTH = 18;
  const DEFAULT_MIN_HEIGHT = 24;
  const BODY_MARGIN = 14;
  const DEFAULT_INPUT_HANDLE_KEY = 'in';

  const PIN_PRESETS = {
    'io.breadboard.components:railTapPositive': {
      rail: { segmentPreference: 'rail-top-positive' },
      tap: { row: 'A', segment: 'top' }
    },
    'io.breadboard.components:railTapNegative': {
      rail: { segmentPreference: 'rail-bottom-negative' },
      tap: { row: 'J', segment: 'bottom' }
    },
    'io.breadboard.components:led': {
      anode: { row: 'E', segment: 'top' },
      cathode: { row: 'F', segment: 'bottom' }
    }
  };

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

  // ------------------------------------------------------------
  // BASIC HELPERS
  // ------------------------------------------------------------

  const isPlainObject = (value) =>
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.toString.call(value) === '[object Object]';

  const normalizeRow = (value, fallback) => {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toUpperCase();
    }
    return fallback || null;
  };

  const clamp = (value, min, max) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, Math.round(num)));
  };

  const toRowKey = (row, column) => `${row}${column}`;

  const getSocketPosition = (node) => {
    const pos = node?.position || {};
    return {
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0
    };
  };

  const getTypeVariants = (type) => {
    if (!type || typeof type !== 'string') return [];
    const trimmed = type.trim();
    if (!trimmed) return [];
    const namespace = 'io.breadboard.components';
    const short = trimmed.includes(':') ? trimmed.split(':').pop() : trimmed;
    const namespaced = `${namespace}:${short}`;
    return Array.from(new Set([trimmed, short, namespaced]));
  };

  const isSocketNode = (node) => node?.type === 'io.breadboard.sockets:socket';
  const isRailNode = (node) => node?.type === 'io.breadboard.sockets:railSocket';
  const isBusNode = (node) => node?.type === 'io.breadboard.bus';

  const isComponentNode = (node) => {
    if (!node || !node.type) return false;
    if (CONDUCTIVE_COMPONENTS[node.type]) return true;
    const t = String(node.type).toLowerCase();
    return (
      t.includes('resistor') ||
      t.includes('led') ||
      t.includes('tap') ||
      t.includes('jumper')
    );
  };

  const makeHandleNodeId = (nodeId, handleKey) =>
    `handle:${nodeId}:${handleKey || DEFAULT_INPUT_HANDLE_KEY}`;

  const toPromise = (value) => {
    if (value && typeof value.then === 'function') return value;
    return Promise.resolve(value);
  };

  // ------------------------------------------------------------
  // GRAPH SNAPSHOT
  // ------------------------------------------------------------

  const readGraphSnapshot = () => {
    const api =
    window.graphAPI ||
    window.parent?.graphAPI ||
    window.top?.graphAPI;
    if (!api) return { nodes: [], edges: [] };

    const nodesResult =
      (typeof api.readNode === 'function' && api.readNode()) ||
      (typeof api.getNodes === 'function' && { data: api.getNodes() }) ||
      null;

    const edgesResult =
      (typeof api.readEdge === 'function' && api.readEdge()) ||
      (typeof api.getEdges === 'function' && { data: api.getEdges() }) ||
      null;

    return {
      nodes: Array.isArray(nodesResult?.data) ? nodesResult.data : [],
      edges: Array.isArray(edgesResult?.data) ? edgesResult.data : []
    };
  };

  const findSkinSchema = (nodes) => {
    const skin = nodes.find(
      (n) => n?.type === 'io.breadboard.sockets:skin'
    );
    if (!skin) return null;
    return (
      skin.data?.breadboard?.schema ||
      skin.data?.schema ||
      null
    );
  };

  // ------------------------------------------------------------
  // BOARD LAYOUT (HOLES + RAILS + ROW POSITIONS)
  // ------------------------------------------------------------

  function buildBoardLayout(nodes) {
    const schema = findSkinSchema(nodes);
    if (!schema || typeof schema !== 'object') return null;

    const socketNodeById = new Map();
    const railNodeById = new Map();

    nodes.forEach((node) => {
      if (isSocketNode(node)) {
        socketNodeById.set(node.id, node);
      } else if (isRailNode(node)) {
        railNodeById.set(node.id, node);
      }
    });

    const holeMap = new Map(); // "A1" -> { row, column, nodeId, x, y }
    const railMap = new Map(); // "rail-top-positive::1" -> { nodeId, column, polarity, x, y, handle }

    const rowPositions = new Map(); // "A" -> avg y
    const columnCenters = new Map(); // col -> avg x

    let minColumn = Infinity;
    let maxColumn = -Infinity;

    // holes (schema.sockets)
    if (Array.isArray(schema.sockets)) {
      schema.sockets.forEach((hole) => {
        if (!hole) return;
        const row = normalizeRow(hole.row, null);
        const column = Number(hole.column);
        if (!row || !Number.isFinite(column)) return;

        const pos = hole.position || {};
        const x = Number(pos.x) || 0;
        const y = Number(pos.y) || 0;

        const idKey = `${row}${column}`;
        holeMap.set(idKey, {
          row,
          column,
          x,
          y,
          nodeId: null, // filled later when binding to socket nodes
          targetHandle: 'socket'
        });

        // row positions
        const stats = rowPositions.get(row) || { total: 0, count: 0 };
        stats.total += y;
        stats.count += 1;
        rowPositions.set(row, stats);

        // column centers (approx)
        const colStats = columnCenters.get(column) || { total: 0, count: 0 };
        colStats.total += x;
        colStats.count += 1;
        columnCenters.set(column, colStats);

        minColumn = Math.min(minColumn, column);
        maxColumn = Math.max(maxColumn, column);
      });
    }

    // finalize row + column averages
    const avgRowPositions = new Map();
    rowPositions.forEach((stats, row) => {
      if (stats.count > 0) {
        avgRowPositions.set(row, stats.total / stats.count);
      }
    });

    const avgColumnCenters = new Map();
    columnCenters.forEach((stats, col) => {
      if (stats.count > 0) {
        avgColumnCenters.set(col, stats.total / stats.count);
      }
    });

    // rails
    if (Array.isArray(schema.rails)) {
      schema.rails.forEach((rail) => {
        const polarity =
          rail.polarity === 'negative' ? 'negative' : 'positive';
        const handle = polarity === 'negative' ? 'negative' : 'positive';
        const chan = rail.channel || 'bus';
        const segId = `rail-${chan}-${polarity}`;

        const segments = Array.isArray(rail.segments)
          ? rail.segments
          : [];

        segments.forEach((seg) => {
          const column = Number(seg.column);
          if (!Number.isFinite(column)) return;

          const railNode = railNodeById.get(seg.nodeId);
          if (!railNode) return;

          const pos = seg.position || {};
          const x =
            Number(pos.x) ||
            getSocketPosition(railNode).x;
          const y =
            Number(pos.y) ||
            getSocketPosition(railNode).y;

          const key = `${segId}::${column}`;
          railMap.set(key, {
            nodeId: railNode.id,
            column,
            polarity,
            x,
            y,
            handle
          });

          minColumn = Math.min(minColumn, column);
          maxColumn = Math.max(maxColumn, column);

          const colStats = avgColumnCenters.get(column) || null;
          if (!colStats) {
            avgColumnCenters.set(column, x);
          }
        });
      });
    }

    if (!Number.isFinite(minColumn) || !Number.isFinite(maxColumn)) {
      return null;
    }

    // bind holes to nearest socket node by column
    socketNodeById.forEach((socketNode) => {
      const col = Number(socketNode.data?.column);
      if (!Number.isFinite(col)) return;
      const rows = Array.isArray(socketNode.data?.rows)
        ? socketNode.data.rows
        : [];
      rows.forEach((row) => {
        const r = normalizeRow(row, null);
        if (!r) return;
        const key = `${r}${col}`;
        const entry = holeMap.get(key);
        if (!entry) return;
        entry.nodeId = socketNode.id;
      });
    });

    return {
      holeMap,
      railMap,
      rowPositions: avgRowPositions,
      columnCenters: avgColumnCenters,
      minColumn,
      maxColumn
    };
  }

  const findClosestRow = (y, segment, layout) => {
    const group = segment === 'bottom' ? ROW_GROUPS.bottom : ROW_GROUPS.top;
    let bestRow = group[0];
    let bestDist = Infinity;
    group.forEach((row) => {
      const rowY =
        layout.rowPositions.get(row) ||
        layout.rowPositions.get(row.toUpperCase());
      if (!Number.isFinite(rowY)) return;
      const dist = Math.abs(y - rowY);
      if (dist < bestDist) {
        bestDist = dist;
        bestRow = row;
      }
    });
    return bestRow.toUpperCase();
  };

  const findNearestColumn = (x, columnCenters, minColumn, maxColumn) => {
    if (!(columnCenters instanceof Map)) return minColumn;
    let bestColumn = minColumn;
    let bestDist = Infinity;
    columnCenters.forEach((cx, col) => {
      const dist = Math.abs(cx - x);
      if (dist < bestDist) {
        bestDist = dist;
        bestColumn = col;
      }
    });
    return clamp(bestColumn, minColumn, maxColumn);
  };

  const getNodeCenter = (node) => {
    const pos = node?.position || {};
    return {
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0
    };
  };

  const resolveAnchor = (node, layout) => {
    const center = getNodeCenter(node);
    const y = center.y;

    let segment = 'top';
    const topRowY = layout.rowPositions.get('B');
    const bottomRowY = layout.rowPositions.get('H');

    if (Number.isFinite(topRowY) && Number.isFinite(bottomRowY)) {
      const mid = (topRowY + bottomRowY) / 2;
      segment = y >= mid ? 'bottom' : 'top';
    }

    const column = findNearestColumn(
      center.x,
      layout.columnCenters,
      layout.minColumn,
      layout.maxColumn
    );

    return { column, segment };
  };

  // ------------------------------------------------------------
  // PINS / PRESETS / ASSIGNMENTS
  // ------------------------------------------------------------

  const applyPinPresets = (node, pins) => {
    if (!node || !pins) return pins;
    const variants = getTypeVariants(node.type);
    const preset =
      variants.map((v) => PIN_PRESETS[v]).find(Boolean) || null;
    if (!preset) return pins;

    return pins.map((pin) => {
      if (!pin) return pin;
      const handle =
        pin.id || pin.handleKey || pin.key || pin.label;
      if (!handle || !preset[handle]) return pin;
      const overrides = preset[handle];
      return {
        ...pin,
        ...(overrides.row ? { row: overrides.row } : {}),
        ...(overrides.segment ? { segment: overrides.segment } : {}),
        ...(overrides.segmentPreference
          ? { segmentPreference: overrides.segmentPreference }
          : {})
      };
    });
  };

  const buildAssignmentsFromPins = (pins, layout) => {
    const assignments = [];
    if (!Array.isArray(pins) || !layout) return assignments;

    pins.forEach((pin) => {
      if (!pin) return;
      const handle =
        pin.id || pin.handleKey || pin.key || pin.label;
      if (!handle) return;

      let column = Number(pin.column);
      if (!Number.isFinite(column)) {
        const offset = Number(pin.columnOffset) || 0;
        column = clamp(
          layout.minColumn + offset,
          layout.minColumn,
          layout.maxColumn
        );
      } else {
        column = clamp(column, layout.minColumn, layout.maxColumn);
      }

      const rawPref = (pin.segmentPreference || pin.segment || '')
        .toString()
        .toLowerCase();

      // Rail pin
      if (rawPref.startsWith('rail-')) {
        const key = `${rawPref}::${column}`;
        const railTarget = layout.railMap.get(key);
        if (!railTarget) return;
        assignments.push({
          handle,
          target: {
            ...railTarget,
            column,
            row: railTarget.row || railTarget.polarity || 'V+',
            targetHandle: railTarget.handle
          }
        });
        return;
      }

      // Socket pin
      const segment =
        rawPref === 'bottom' ? 'bottom' : 'top';
      const row = normalizeRow(
        pin.row,
        segment === 'bottom' ? ROW_GROUPS.bottom[0] : ROW_GROUPS.top[0]
      );
      const key = toRowKey(row, column);
      const socketTarget = layout.holeMap.get(key);
      if (!socketTarget) return;

      assignments.push({
        handle,
        target: {
          ...socketTarget,
          targetHandle: 'socket'
        }
      });
    });

    // de-dupe by handle
    const byHandle = new Map();
    assignments.forEach((a) => {
      if (!a || !a.handle) return;
      if (!byHandle.has(a.handle)) {
        byHandle.set(a.handle, a);
      }
    });
    return Array.from(byHandle.values());
  };

  const applyAssignmentsToPins = (pins, assignments, fallbackSegment) => {
    const map = new Map();
    assignments.forEach((entry) => {
      if (!entry || !entry.handle || !entry.target) return;
      map.set(entry.handle, entry.target);
    });

    return pins.map((pin) => {
      const handle =
        pin.id || pin.handleKey || pin.key || pin.label;
      if (!handle || !map.has(handle)) return pin;
      const target = map.get(handle);
      const row = target.row || pin.row || ROW_GROUPS.top[0];
      const isRail =
        typeof target.segment === 'string' &&
        target.segment.startsWith('rail-');
      const segmentPref = isRail
        ? (target.segment ||
            target.segmentPreference ||
            pin.segmentPreference ||
            fallbackSegment)
        : fallbackSegment;

      return {
        ...pin,
        column: target.column,
        row,
        segment: segmentPref,
        segmentPreference: segmentPref
      };
    });
  };

  const computeBounds = (assignments) => {
    if (!assignments.length) return null;
    const xs = assignments.map((a) => a.target.x);
    const ys = assignments.map((a) => a.target.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(
      DEFAULT_MIN_WIDTH,
      maxX - minX + BODY_MARGIN
    );
    const height = Math.max(
      DEFAULT_MIN_HEIGHT,
      maxY - minY + BODY_MARGIN
    );
    const position = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
    return { position, width, height };
  };

  const buildPinState = (assignments) => {
    const state = {};
    assignments.forEach((assignment) => {
      state[assignment.handle] = {
        row: assignment.target.row,
        column: assignment.target.column,
        nodeId: assignment.target.nodeId,
        targetHandle: assignment.target.targetHandle
      };
    });
    return state;
  };

  // ------------------------------------------------------------
  // CONNECTIVITY SOLVER (BUS → RAIL → COMPONENTS)
  // ------------------------------------------------------------

  const connectAdjacency = (adjacency, a, b) => {
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };

  const solveConnectivity = (nodes = [], edges = []) => {
    const adjacency = new Map();

    edges.forEach((edge) => {
      if (!edge) return;
      const src = edge.source || edge.fromNodeId;
      const tgt = edge.target || edge.toNodeId;
      if (!src || !tgt) return;

      const sourceHandle =
        edge.sourceHandle || edge.fromHandle || DEFAULT_INPUT_HANDLE_KEY;
      const targetHandle =
        edge.targetHandle || edge.toHandle || null;

      const sourceId = makeHandleNodeId(src, sourceHandle);
      const targetId =
        targetHandle && targetHandle !== 'socket'
          ? makeHandleNodeId(tgt, targetHandle)
          : tgt;

      connectAdjacency(adjacency, sourceId, targetId);
      connectAdjacency(adjacency, targetId, sourceId);
    });

    nodes.forEach((node) => {
      const pairs = CONDUCTIVE_COMPONENTS[node?.type];
      if (!node || !Array.isArray(pairs)) return;
      pairs.forEach((pair) => {
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
        neighbors.forEach((nextId) => {
          if (visited.has(nextId)) return;
          visited.add(nextId);
          queue.push(nextId);
        });
      }
    };

    nodes.forEach((node) => {
      if (!isBusNode(node)) return;
      const positiveId = makeHandleNodeId(node.id, 'positive');
      const negativeId = makeHandleNodeId(node.id, 'negative');
      markReachable(positiveId, 'touchesVPlus');
      markReachable(negativeId, 'touchesGnd');
    });

    return nodeFlags;
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
      label: handle.label || handle.name || id
    };
  };

  const collectHandleKeys = (node) => {
    const keys = new Set();
    const sources = [
      node?.handles,
      node?.outputs,
      node?.inputs,
      node?.data?.handles,
      node?.data?.pins
    ];
    sources.forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((entry) => {
        const normalized = normalizeHandleEntry(entry);
        if (!normalized) return;
        if (normalized.id) keys.add(normalized.id);
        if (normalized.key) keys.add(normalized.key);
      });
    });
    return Array.from(keys);
  };

  const updateConnectivityStates = async (api, nodes, edges) => {
    const handleFlags = solveConnectivity(nodes, edges);

    for (const node of nodes) {
      if (!node || !node.id) continue;

      const existingPinState = isPlainObject(node.data?.breadboard?.pinState)
        ? node.data.breadboard.pinState
        : {};
      let changed = false;
      const nextPinState = { ...existingPinState };
      const pinKeys = collectHandleKeys(node);

      pinKeys.forEach((handleKey) => {
        if (!handleKey) return;
        const currentState = nextPinState[handleKey] || {};
        const flagEntry = handleFlags.get(
          makeHandleNodeId(node.id, handleKey)
        ) || {};
        const touchesVPlus = !!flagEntry.touchesVPlus;
        const touchesGnd = !!flagEntry.touchesGnd;
        nextPinState[handleKey] = {
          ...currentState,
          touchesVPlus,
          touchesGnd
        };
        if (
          (currentState.touchesVPlus || false) !== touchesVPlus ||
          (currentState.touchesGnd || false) !== touchesGnd
        ) {
          changed = true;
        }
      });

      if (!changed) continue;

      const payload = {
        data: {
          ...(node.data || {}),
          breadboard: {
            ...(isPlainObject(node.data?.breadboard)
              ? node.data.breadboard
              : {}),
            pinState: nextPinState
          }
        }
      };

      try {
        await toPromise(api.updateNode(node.id, payload));
      } catch (err) {
        console.warn(
          '[BreadboardAutoWire] Failed to update node pinState',
          node.id,
          err
        );
      }
    }
  };

  // ------------------------------------------------------------
  // REBUILD EDGES
  // ------------------------------------------------------------

  const rebuildEdges = async (api, nodeId, assignments, snapshot) => {
    if (!api) return;

    const existing = snapshot.edges.filter(
      (edge) => edge && (edge.source === nodeId || edge.fromNodeId === nodeId)
    );

    // delete existing
    await Promise.all(
      existing.map((edge) => {
        if (typeof api.deleteEdge === 'function') {
          return toPromise(api.deleteEdge(edge.id));
        }
        return Promise.resolve();
      })
    );

    // recreate
    for (const assignment of assignments) {
      const payload = {
        source: nodeId,
        sourceHandle: assignment.handle,
        target: assignment.target.nodeId,
        targetHandle: assignment.target.targetHandle,
        type: 'default'
      };
      if (typeof api.createEdge === 'function') {
        try {
          await toPromise(api.createEdge(payload));
        } catch (err) {
          console.warn(
            '[BreadboardAutoWire] Failed to create edge',
            payload,
            err
          );
        }
      }
    }
  };

  // ------------------------------------------------------------
  // MAIN PER-NODE AUTOWIRE
  // ------------------------------------------------------------

  const processNode = async (nodeId) => {
    const api =
    window.graphAPI ||
    window.parent?.graphAPI ||
    window.top?.graphAPI;

    if (!api) return;

    const snapshot = readGraphSnapshot();
    const layout = buildBoardLayout(snapshot.nodes);
    if (!layout) return;

    const node = snapshot.nodes.find((n) => n && n.id === nodeId);
    if (!node || !node.data) return;
    if (isSocketNode(node) || isRailNode(node)) return;
    if (!isComponentNode(node)) return;

    const anchor = resolveAnchor(node, layout);
    const basePins = Array.isArray(node.data.pins)
      ? node.data.pins.map((p) => ({ ...p }))
      : [];
    let pins = applyPinPresets(node, basePins);
    if (!pins.length) return;

    // If no explicit column on pins, build offsets from anchor
    pins = pins.map((pin, index) => {
      if (!Number.isFinite(Number(pin.column))) {
        pin.columnOffset =
          Number(pin.columnOffset) ??
          (Number.isFinite(pin.column) ? Number(pin.column) - layout.minColumn : index);
      }
      return pin;
    });

    let assignments = buildAssignmentsFromPins(pins, layout);
    if (!assignments.length) {
      // fallback: put two pins on same row, adjacent columns
      const center = getNodeCenter(node);
      const row = findClosestRow(center.y, anchor.segment, layout);
      const colA = clamp(anchor.column, layout.minColumn, layout.maxColumn - 1);
      const colB = clamp(colA + 1, layout.minColumn, layout.maxColumn);
      const keyA = toRowKey(row, colA);
      const keyB = toRowKey(row, colB);
      const left = layout.holeMap.get(keyA);
      const right = layout.holeMap.get(keyB);
      const handles = pins
        .map((p) => p.id || p.handleKey || p.key || p.label)
        .filter(Boolean);
      if (left && right && handles.length >= 2) {
        assignments = [
          {
            handle: handles[0],
            target: { ...left, targetHandle: 'socket' }
          },
          {
            handle: handles[1],
            target: { ...right, targetHandle: 'socket' }
          }
        ];
      }
    }

    if (!assignments.length) return;

    // update pins with final assignment positions
    pins = applyAssignmentsToPins(pins, assignments, anchor.segment);

    // snap body bounds
    const body = computeBounds(assignments);
    const pinState = buildPinState(assignments);

    const payload = {
      data: {
        ...(node.data || {}),
        pins,
        breadboard: {
          ...(node.data?.breadboard || {}),
          anchor,
          pinState
        }
      }
    };

    if (body) {
      payload.position = body.position;
      payload.width = body.width;
      payload.height = body.height;
    }

    try {
      await toPromise(api.updateNode(node.id, payload));
      await rebuildEdges(api, node.id, assignments, snapshot);
      // after wiring edges, recompute connectivity
      const fresh = readGraphSnapshot();
      await updateConnectivityStates(api, fresh.nodes, fresh.edges);
    } catch (err) {
      console.warn('[BreadboardAutoWire] Failed to process node', node.id, err);
    }
  };

  // ------------------------------------------------------------
  // EVENT WIRING + BOOTSTRAP (RETRY UNTIL graphAPI IS READY)
  // ------------------------------------------------------------

  const startAutoWire = () => {
    const api =
    window.graphAPI ||
    window.parent?.graphAPI ||
    window.top?.graphAPI;


    if (!api) {
      console.warn("[BreadboardAutoWire] graphAPI not ready, retrying…");
      setTimeout(startAutoWire, 50); // retry until graphAPI attaches
      return;
    }

    console.log("[BreadboardAutoWire] Initializing (plugin script node)");

    // handy for manual debugging
    window.__breadboardAutoWireProcessNode = processNode;

    const snapshot = readGraphSnapshot();
    snapshot.nodes.forEach((node) => {
      if (!node || !node.id) return;
      if (isSocketNode(node) || isRailNode(node)) return;
      if (!isComponentNode(node)) return;
      processNode(node.id);
    });

    const cleanups = [];
    const events = api.events;

    if (events && typeof events.on === "function") {
      const makeHandler = (label) => (evt) => {
        const id = evt?.nodeId || evt?.id || evt?.node?.id;
        if (!id) return;
        console.log("[BreadboardAutoWire] Event", label, "-> rewire node", id);
        processNode(id);
      };

      const offDrag =
        events.on("nodeDragEnd", makeHandler("nodeDragEnd")) || (() => {});
      const offAdd =
        events.on("nodeAdded", makeHandler("nodeAdded")) || (() => {});
      const offChange =
        events.on("nodeDataChanged", makeHandler("nodeDataChanged")) ||
        (() => {});

      cleanups.push(offDrag, offAdd, offChange);
    }

    window.__breadboardAutoWireCleanup = () => {
      console.log("[BreadboardAutoWire] Cleaning up listeners (plugin)");
      cleanups.forEach((off) => {
        try {
          off();
        } catch (err) {
          console.warn(
            "[BreadboardAutoWire] Failed to cleanup listener",
            err
          );
        }
      });
    };
  };

  // Retry bootstrap until both DOM and graphAPI are ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(startAutoWire, 50);
    }, { once: true });
  } else {
    setTimeout(startAutoWire, 50);
  }
})();
