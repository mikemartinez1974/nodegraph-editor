(function (runtimeApi) {
  if (!runtimeApi) {
    console.warn('[BreadboardAutoWire] runtime API unavailable; aborting bootstrap');
    return;
  }

  console.log('[BreadboardAutoWire] build marker 2025-03-05');

  const SCRIPT_RUNTIME_API = runtimeApi && typeof runtimeApi === 'object' ? runtimeApi : null;
  const FALLBACK_POLL_INTERVAL = 750;

  const FALLBACK_METADATA = {
    rowGroups: {
      top: ['A', 'B', 'C', 'D', 'E'],
      bottom: ['F', 'G', 'H', 'I', 'J']
    },
    pinPresets: {
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
    },
    conductiveComponents: {
      'io.breadboard.components:resistor': [['pinA', 'pinB']],
      'io.breadboard.components:railTapPositive': [['rail', 'tap']],
      'io.breadboard.components:railTapNegative': [['rail', 'tap']],
      'io.breadboard.components:jumper': [['wireA', 'wireB']],
      'io.breadboard.sockets:railSocket': [
        ['vplus', 'positive'],
        ['gnd', 'negative']
      ]
    },
    defaults: {
      minWidth: 18,
      minHeight: 24,
      bodyMargin: 14,
      inputHandleKey: 'in'
    }
  };

  let runtimeMetadata = null;

  // ------------------------------------------------------------
  // BASIC HELPERS
  // ------------------------------------------------------------

  const isPlainObject = (value) =>
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.toString.call(value) === '[object Object]';

  const normalizeMetadata = (metadata) => {
    const source = isPlainObject(metadata) ? metadata : {};
    const mergeRows = (key) => {
      const rows = Array.isArray(source?.rowGroups?.[key])
        ? source.rowGroups[key]
        : null;
      const fallbackRows = FALLBACK_METADATA.rowGroups[key];
      return (rows && rows.length ? rows : fallbackRows).map((row) =>
        String(row || '').toUpperCase()
      );
    };

    const buildPinPresets = () => {
      const merged = { ...FALLBACK_METADATA.pinPresets };
      if (isPlainObject(source.pinPresets)) {
        Object.entries(source.pinPresets).forEach(([key, value]) => {
          if (isPlainObject(value)) {
            merged[key] = { ...value };
          }
        });
      }
      return merged;
    };

    const buildConductiveMap = () => {
      const merged = {
        ...FALLBACK_METADATA.conductiveComponents,
        ...(isPlainObject(source.conductiveComponents)
          ? source.conductiveComponents
          : {})
      };
      const normalized = {};
      Object.entries(merged).forEach(([key, pairs]) => {
        if (!Array.isArray(pairs)) return;
        const cleaned = pairs
          .map((pair) =>
            Array.isArray(pair) && pair.length >= 2
              ? [pair[0], pair[1]]
              : null
          )
          .filter(Boolean);
        if (cleaned.length) {
          normalized[key] = cleaned;
        }
      });
      return normalized;
    };

    const defaultsSource = isPlainObject(source.defaults)
      ? source.defaults
      : {};

    return {
      rowGroups: {
        top: mergeRows('top'),
        bottom: mergeRows('bottom')
      },
      pinPresets: buildPinPresets(),
      conductiveComponents: buildConductiveMap(),
      defaults: {
        minWidth:
          Number(defaultsSource.minWidth) ||
          FALLBACK_METADATA.defaults.minWidth,
        minHeight:
          Number(defaultsSource.minHeight) ||
          FALLBACK_METADATA.defaults.minHeight,
        bodyMargin:
          Number(defaultsSource.bodyMargin) ||
          FALLBACK_METADATA.defaults.bodyMargin,
        inputHandleKey:
          defaultsSource.inputHandleKey ||
          FALLBACK_METADATA.defaults.inputHandleKey
      }
    };
  };

  const ensureMetadata = () => {
    if (!runtimeMetadata) {
      runtimeMetadata = normalizeMetadata(FALLBACK_METADATA);
    }
    return runtimeMetadata;
  };

  const updateRuntimeMetadata = (metadata) => {
    runtimeMetadata = normalizeMetadata(metadata || FALLBACK_METADATA);
  };

  const getRowGroupForSegment = (segment = 'top') => {
    const meta = ensureMetadata();
    const top = meta.rowGroups.top;
    const bottom = meta.rowGroups.bottom;
    return segment === 'bottom' ? bottom : top;
  };

  const getDefaultTopRow = () => {
    const meta = ensureMetadata();
    return (
      meta.rowGroups.top[0] ||
      meta.rowGroups.bottom[0] ||
      'A'
    );
  };

  const getDefaultRowForSegment = (segment = 'top') => {
    const group = getRowGroupForSegment(segment);
    return group[0] || getDefaultTopRow();
  };

  const getDefaults = () => ensureMetadata().defaults;
  const getDefaultHandleKey = () =>
    getDefaults().inputHandleKey || 'in';
  const getDefaultMinWidth = () =>
    Number(getDefaults().minWidth) || 18;
  const getDefaultMinHeight = () =>
    Number(getDefaults().minHeight) || 24;
  const getBodyMargin = () =>
    Number(getDefaults().bodyMargin) || 14;

  const getPinPresetMap = () => ensureMetadata().pinPresets;
  const getConductiveMap = () =>
    ensureMetadata().conductiveComponents;

  updateRuntimeMetadata(FALLBACK_METADATA);

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
    const conductive = getConductiveMap();
    if (conductive[node.type]) return true;
    const t = String(node.type).toLowerCase();
    return (
      t.includes('resistor') ||
      t.includes('led') ||
      t.includes('tap') ||
      t.includes('jumper')
    );
  };

  const makeHandleNodeId = (nodeId, handleKey) =>
    `handle:${nodeId}:${handleKey || getDefaultHandleKey()}`;

  const toPromise = (value) => {
    if (value && typeof value.then === 'function') return value;
    return Promise.resolve(value);
  };

  // ------------------------------------------------------------
  // GRAPH SNAPSHOT
  // ------------------------------------------------------------

  const getGraphAPI = () => SCRIPT_RUNTIME_API || null;

  const readGraphSnapshot = async () => {
    const api = getGraphAPI();
    if (!api) return { nodes: [], edges: [] };

    const resolveNodes = async () => {
      if (typeof api.readNode === 'function') {
        const result = await toPromise(api.readNode());
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result)) return result;
      }
      if (typeof api.getNodes === 'function') {
        const result = await toPromise(api.getNodes());
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result)) return result;
      }
      return [];
    };

    const resolveEdges = async () => {
      if (typeof api.readEdge === 'function') {
        const result = await toPromise(api.readEdge());
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result)) return result;
      }
      if (typeof api.getEdges === 'function') {
        const result = await toPromise(api.getEdges());
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result)) return result;
      }
      return [];
    };

    const [nodes, edges] = await Promise.all([resolveNodes(), resolveEdges()]);

    return { nodes, edges };
  };

  const buildSnapshotContext = async () => {
    const snapshot = await readGraphSnapshot();
    const layout = buildBoardLayout(snapshot.nodes);
    if (!layout) return null;
    const metadata = findSkinMetadata(snapshot.nodes);
    updateRuntimeMetadata(metadata);
    return { snapshot, layout, metadata: ensureMetadata() };
  };

  const findSkinNode = (nodes) =>
    nodes.find((n) => n?.type === 'io.breadboard.sockets:skin') ||
    null;

  const findSkinSchema = (nodes) => {
    const skin = findSkinNode(nodes);
    if (!skin) return null;
    return (
      skin.data?.breadboard?.schema ||
      skin.data?.schema ||
      null
    );
  };

  const findSkinMetadata = (nodes) => {
    const skin = findSkinNode(nodes);
    if (!skin) return null;
    return (
      skin.data?.breadboard?.metadata ||
      skin.data?.metadata ||
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
    const group = getRowGroupForSegment(segment);
    let bestRow = group[0] || getDefaultTopRow();
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

  const getAnchorColumn = (anchor, layout) => {
    if (!layout) return 0;
    return clamp(
      anchor?.column,
      layout.minColumn,
      layout.maxColumn
    );
  };

  const getPinColumnValue = (pin, layout) => {
    if (!pin || !layout) return null;
    const explicit = Number(pin.column);
    if (Number.isFinite(explicit)) {
      return clamp(explicit, layout.minColumn, layout.maxColumn);
    }
    const offset = Number(pin.columnOffset);
    if (Number.isFinite(offset)) {
      return clamp(
        layout.minColumn + offset,
        layout.minColumn,
        layout.maxColumn
      );
    }
    return null;
  };

  const alignPinsToAnchor = (pins, anchor, layout) => {
    if (!Array.isArray(pins) || !pins.length || !layout) {
      return pins;
    }
    const anchorColumn = getAnchorColumn(anchor, layout);
    const derivedColumns = pins.map((pin) =>
      getPinColumnValue(pin, layout)
    );
    const finiteColumns = derivedColumns.filter((col) =>
      Number.isFinite(col)
    );
    if (!finiteColumns.length) return pins;
    const baseColumn = Math.min(...finiteColumns);
    const delta = anchorColumn - baseColumn;
    if (delta === 0) return pins;
    return pins.map((pin, index) => {
      const col = derivedColumns[index];
      if (!Number.isFinite(col)) return pin;
      return {
        ...pin,
        column: clamp(col + delta, layout.minColumn, layout.maxColumn)
      };
    });
  };

  // ------------------------------------------------------------
  // PINS / PRESETS / ASSIGNMENTS
  // ------------------------------------------------------------

  const applyPinPresets = (node, pins) => {
    if (!node || !pins) return pins;
    const variants = getTypeVariants(node.type);
    const presetMap = getPinPresetMap();
    const preset =
      variants.map((v) => presetMap[v]).find(Boolean) || null;
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

  const buildAssignmentsFromPins = (pins, layout, anchorColumn) => {
    const assignments = [];
    if (!Array.isArray(pins) || !layout) return assignments;
    const fallbackColumn = Number.isFinite(anchorColumn)
      ? clamp(anchorColumn, layout.minColumn, layout.maxColumn)
      : layout.minColumn;

    pins.forEach((pin) => {
      if (!pin) return;
      const handle =
        pin.id || pin.handleKey || pin.key || pin.label;
      if (!handle) return;

      let column = Number(pin.column);
      if (!Number.isFinite(column)) {
        const offset = Number(pin.columnOffset) || 0;
        column = clamp(
          fallbackColumn + offset,
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
        getDefaultRowForSegment(segment)
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
      const row = target.row || pin.row || getDefaultTopRow();
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
    const margin = getBodyMargin();
    const width = Math.max(
      getDefaultMinWidth(),
      maxX - minX + margin
    );
    const height = Math.max(
      getDefaultMinHeight(),
      maxY - minY + margin
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
        edge.sourceHandle || edge.fromHandle || getDefaultHandleKey();
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

    const conductive = getConductiveMap();
    nodes.forEach((node) => {
      const pairs = conductive[node?.type];
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

  const processNode = async (nodeId, context = {}) => {
    const api = getGraphAPI();

    if (!api) {
      console.log('[BreadboardAutoWire] processNode skipped, no api', nodeId);
      return;
    }

    const {
      snapshot: providedSnapshot,
      layout: providedLayout,
      nodeOverride,
      allowPending
    } = context || {};

    let snapshot = providedSnapshot;
    let layout = providedLayout;
    if (!snapshot || !layout) {
      const freshContext = await buildSnapshotContext();
      if (!freshContext) {
        console.log('[BreadboardAutoWire] processNode no snapshot/layout', nodeId);
        return;
      }
      snapshot = freshContext.snapshot;
      layout = freshContext.layout;
    }
    if (!layout) {
      console.log('[BreadboardAutoWire] processNode layout missing', nodeId);
      return;
    }

    let nodeIndex = snapshot.nodes.findIndex((n) => n && n.id === nodeId);
    let node = nodeIndex >= 0 ? snapshot.nodes[nodeIndex] : null;

    if (nodeOverride && nodeOverride.id === nodeId) {
      const merged = {
        ...(node || {}),
        ...nodeOverride,
        data: {
          ...(node?.data || {}),
          ...(nodeOverride.data || {}),
          breadboard: {
            ...(node?.data?.breadboard || {}),
            ...(nodeOverride.data?.breadboard || {})
          }
        },
        position: {
          ...(node?.position || {}),
          ...(nodeOverride.position || {})
        }
      };
      node = merged;
      if (nodeIndex >= 0) {
        snapshot.nodes[nodeIndex] = merged;
      } else {
        snapshot.nodes.push(merged);
        nodeIndex = snapshot.nodes.length - 1;
      }
    }

    console.log('[BreadboardAutoWire] processNode snapshot lookup', nodeId, !!node);
    if (!node || !node.data) return;

    if (node.data?.breadboard?.pendingPlacement && allowPending !== true) {
      console.log('[BreadboardAutoWire] Node still pending placement, skipping', nodeId);
      return;
    }
    if (isSocketNode(node) || isRailNode(node)) return;
    if (!isComponentNode(node)) return;

    console.log('[BreadboardAutoWire] start wiring', nodeId, {
      position: node.position,
      pins: node.data?.pins,
      layoutBounds: {
        minColumn: layout.minColumn,
        maxColumn: layout.maxColumn
      }
    });

    const anchor = resolveAnchor(node, layout);
    const basePins = Array.isArray(node.data.pins)
      ? node.data.pins.map((p) => ({ ...p }))
      : [];
    let pins = applyPinPresets(node, basePins);
    pins = alignPinsToAnchor(pins, anchor, layout);
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

    let assignments = buildAssignmentsFromPins(
      pins,
      layout,
      getAnchorColumn(anchor, layout)
    );
    console.log('[BreadboardAutoWire] assignments from pins', nodeId, assignments);
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

    if (!assignments.length) {
      console.log('[BreadboardAutoWire] no assignments computed', nodeId);
      return;
    }

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
          pinState,
          pendingPlacement: false
        }
      }
    };
    console.log('[BreadboardAutoWire] final payload', nodeId, payload);

    if (body) {
      payload.position = body.position;
      payload.width = body.width;
      payload.height = body.height;
    }

    try {
      await toPromise(api.updateNode(node.id, payload));
      await rebuildEdges(api, node.id, assignments, snapshot);
      // after wiring edges, recompute connectivity
      const fresh = await readGraphSnapshot();
      await updateConnectivityStates(api, fresh.nodes, fresh.edges);
    } catch (err) {
      console.warn('[BreadboardAutoWire] Failed to process node', node.id, err);
    }
  };

  const processAllComponentNodes = async () => {
    const context = await buildSnapshotContext();
    if (!context) return;
    for (const node of context.snapshot.nodes) {
      if (!node || !node.id) continue;
      if (isSocketNode(node) || isRailNode(node)) continue;
      if (!isComponentNode(node)) continue;
      try {
        await processNode(node.id, context);
      } catch (err) {
        console.warn('[BreadboardAutoWire] Failed to process node during full sweep', node.id, err);
      }
    }
  };

  // ------------------------------------------------------------
  // EVENT WIRING + BOOTSTRAP (RETRY UNTIL graphAPI IS READY)
  // ------------------------------------------------------------

  const startAutoWire = async () => {
    const api = getGraphAPI();

    if (!api) {
      console.warn('[BreadboardAutoWire] runtime API not ready; aborting');
      return;
    }

    console.log('[BreadboardAutoWire] Initializing (plugin script node)');

    await processAllComponentNodes();

    const cleanups = [];
    const events = api.events;

    const getNodesArray = async () => {
      if (!api) return [];
      const methods = ['getNodes', 'readNode'];
      for (const method of methods) {
        if (typeof api[method] === 'function') {
          try {
            const result = await toPromise(api[method]());
            if (Array.isArray(result?.data)) return result.data;
            if (Array.isArray(result)) return result;
          } catch (err) {
            /* ignore */
          }
        }
      }
      return [];
    };

    const getNodeById = async (nodeId) => {
      if (!nodeId) return null;
      const methods = ['getNode', 'readNode'];
      for (const method of methods) {
        if (typeof api[method] === 'function') {
          try {
            const result = await toPromise(api[method](nodeId));
            if (result?.success && result.data) return result.data;
            if (result && typeof result === 'object' && result.id) return result;
          } catch (err) {
            /* ignore */
          }
        }
      }
      const nodes = await getNodesArray();
      return nodes.find((node) => node && node.id === nodeId) || null;
    };

    const shouldProcessSnapshot = (node, options = {}) => {
      if (!node || !node.id) return false;
      if (!isComponentNode(node)) return false;
      if (node.data?.breadboard?.pendingPlacement && options.allowPending !== true) {
        return false;
      }
      return true;
    };

    const processNodeSnapshot = async (node, label = 'event', options = {}) => {
      const pending = node?.data?.breadboard?.pendingPlacement === true;
      const allowPending = options.allowPending === true || (pending && label === 'nodeDragEnd');
      if (!shouldProcessSnapshot(node, { allowPending })) return;
      try {
        await processNode(node.id, {
          nodeOverride: node,
          allowPending
        });
      } catch (err) {
        console.warn(
          '[BreadboardAutoWire] Failed to process node from',
          label,
          node.id,
          err
        );
      }
    };

    const processById = async (id, label, options = {}) => {
      if (!id) return;
      const node = await getNodeById(id);
      if (node) {
        await processNodeSnapshot(node, label, options);
      }
    };

    const extractEventNodes = (evt = {}) => {
      if (!evt || typeof evt !== 'object') return [];
      const rawNodes = Array.isArray(evt.nodes) ? evt.nodes : [];
      return rawNodes
        .map((node) => (node && typeof node === 'object' ? node : null))
        .filter((node) => node && node.id);
    };

    const handleNodeAdded = async (evt = {}) => {
      if (evt?.node) {
        await processNodeSnapshot(evt.node, 'nodeAdded');
        return;
      }
      const id = evt?.nodeId || evt?.id;
      if (id) {
        await processById(id, 'nodeAdded');
      }
    };

    const handleNodeDragEnd = async (evt = {}) => {
      const eventNodes = extractEventNodes(evt);
      if (eventNodes.length) {
        await Promise.all(
          eventNodes.map((node) => processNodeSnapshot(node, 'nodeDragEnd', { allowPending: true }))
        );
        return;
      }
      const ids = Array.isArray(evt?.nodeIds) ? evt.nodeIds : [];
      await Promise.all(ids.map((id) => processById(id, 'nodeDragEnd', { allowPending: true })));
    };

    const handleNodeDataChanged = async (evt = {}) => {
      if (evt?.node) {
        await processNodeSnapshot(evt.node, 'nodeDataChanged');
        return;
      }
      const id = evt?.nodeId || evt?.id;
      if (id) {
        await processById(id, 'nodeDataChanged');
      }
    };

    if (events && typeof events.on === 'function') {
      const wrapAsyncHandler = (fn, label) => (payload) => {
        Promise.resolve(fn(payload)).catch((err) => {
          console.warn(`[BreadboardAutoWire] ${label} handler failed`, err);
        });
      };

      const makeCleanup = (eventName, handler, label) => {
        const wrapped = wrapAsyncHandler(handler, label);
        const off = events.on(eventName, wrapped);
        if (typeof off === 'function') {
          return off;
        }
        return () => {
          if (typeof events.off === 'function') {
            events.off(eventName, wrapped);
          }
        };
      };

      cleanups.push(
        makeCleanup('nodeAdded', handleNodeAdded, 'nodeAdded'),
        makeCleanup('nodeDragEnd', handleNodeDragEnd, 'nodeDragEnd'),
        makeCleanup('nodeDataChanged', handleNodeDataChanged, 'nodeDataChanged')
      );
    } else {
      console.warn(
        '[BreadboardAutoWire] runtime API has no event bus; auto-wire will not react to interactive placement'
      );
    }

  };

  startAutoWire().catch((err) => {
    console.error('[BreadboardAutoWire] Failed to initialize runtime', err);
  });
})(typeof api !== 'undefined' ? api : undefined);
