(function () {
  if (typeof window === 'undefined') return;

  if (typeof window.__breadboardAutoWireCleanup === 'function') {
    try {
      window.__breadboardAutoWireCleanup();
    } catch (err) {
      console.warn('[BreadboardAutoWire] Failed to clean up previous instance:', err);
    }
  }
  window.__breadboardAutoWireCleanup = null;

  const isPlainObject = (value) =>
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.toString.call(value) === '[object Object]';

  const pinOffsetCache = new Map();

  const BREADBOARD_ROWS = ['A','B','C','D','E','F','G','H','I','J'];
  const rowToIndex = (row) => {
    if (!row) return null;
    const normalized = String(row).trim().toUpperCase();
    const idx = BREADBOARD_ROWS.indexOf(normalized);
    return idx === -1 ? null : idx;
  };
  const indexToRow = (idx) => {
    if (typeof idx !== 'number' || Number.isNaN(idx)) return null;
    const clamped = Math.max(0, Math.min(BREADBOARD_ROWS.length - 1, Math.round(idx)));
    return BREADBOARD_ROWS[clamped];
  };

  const normalizeSocketKey = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value.trim().toUpperCase();
    if (typeof value === 'number') return String(value);
    return null;
  };

  const buildSocketRowColumnKey = (row, column) => {
    if (row === undefined || row === null) return null;
    const normalizedRow = typeof row === 'string' ? row.trim().toUpperCase() : String(row).toUpperCase();
    const numericColumn = Number(column);
    if (!Number.isFinite(numericColumn)) return null;
    return `${normalizedRow}${numericColumn}`;
  };

  const deriveSocketKey = (socket, rowHint) => {
    if (!socket) return null;
    const column = socket?.data?.column;
    let row = rowHint ? String(rowHint).trim().toUpperCase() : null;
    const rows = Array.isArray(socket?.data?.rows) ? socket.data.rows : null;
    if (!row && rows && rows.length > 0) {
      row = rows[0];
    }
    if (row && column !== undefined) {
      return `${row}${column}`;
    }
    return socket?.id || null;
  };

  const getSocketPosition = (socket) => {
    const pos = socket?.position || {};
    return {
      x: typeof pos.x === 'number' ? pos.x : 0,
      y: typeof pos.y === 'number' ? pos.y : 0
    };
  };

  const findNearestSocketForPin = ({ targetX, targetY, rowHint, directoryEntries }) => {
    if (!Array.isArray(directoryEntries) || directoryEntries.length === 0) return null;
    let best = null;
    let bestDist = Infinity;
    const normalizedRow = rowHint ? String(rowHint).trim().toUpperCase() : null;
    for (const [key, socket] of directoryEntries) {
      const rows = Array.isArray(socket?.data?.rows) ? socket.data.rows : null;
      if (normalizedRow && rows && !rows.includes(normalizedRow)) continue;
      const pos = getSocketPosition(socket);
      const dx = pos.x - targetX;
      const dy = pos.y - targetY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        best = { key, socket };
        bestDist = dist;
      }
    }
    return best;
  };

  const findNearestAvailableSocket = (params = {}, usedSocketIds) => {
    const entries = Array.isArray(params.directoryEntries) ? params.directoryEntries : [];
    const filteredEntries =
      usedSocketIds && usedSocketIds.size > 0
        ? entries.filter(([, socket]) => socket && !usedSocketIds.has(socket.id))
        : entries;
    if (filteredEntries.length === 0) return null;
    return findNearestSocketForPin({ ...params, directoryEntries: filteredEntries });
  };

  const chooseSocketRow = (socket, preferredRow) => {
    const rows = Array.isArray(socket?.data?.rows)
      ? socket.data.rows.map(row => String(row).trim().toUpperCase())
      : [];
    if (preferredRow) {
      const normalized = String(preferredRow).trim().toUpperCase();
      if (rows.includes(normalized)) return normalized;
    }
    return rows[0] || (preferredRow ? String(preferredRow).trim().toUpperCase() : null);
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
      // Ignore storage access issues (e.g., sandboxed iframes).
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

  const registerPinOffset = (nodeType, handleKey, offset) => {
    if (!nodeType || !handleKey || !offset) return;
    const entry = pinOffsetCache.get(nodeType) || {};
    const existing = entry[handleKey];
    if (existing) {
      entry[handleKey] = {
        x: (existing.x + offset.x) / 2,
        y: (existing.y + offset.y) / 2
      };
    } else {
      entry[handleKey] = { x: offset.x, y: offset.y };
    }
    pinOffsetCache.set(nodeType, entry);
  };

  const isComponentNode = (node) =>
    typeof node?.type === 'string' && node.type.startsWith('io.breadboard.components:');

  const bootstrapPinOffsets = (nodes = [], edges = [], socketsById = new Map()) => {
    if (!Array.isArray(nodes) || !Array.isArray(edges) || socketsById.size === 0) return;
    const nodesById = new Map(nodes.map(node => [node.id, node]));
    edges.forEach(edge => {
      if (!edge) return;
      const sourceNode = nodesById.get(edge.source);
      const targetNode = nodesById.get(edge.target);
      if (!sourceNode || !targetNode) return;
      const sourceIsSocket = socketsById.has(sourceNode.id);
      const targetIsSocket = socketsById.has(targetNode.id);

      if (isComponentNode(sourceNode) && targetIsSocket) {
        const socket = socketsById.get(targetNode.id);
        const socketPos = getSocketPosition(socket);
        const nodePos = sourceNode.position || {};
        const offset = {
          x: socketPos.x - (typeof nodePos.x === 'number' ? nodePos.x : 0),
          y: socketPos.y - (typeof nodePos.y === 'number' ? nodePos.y : 0)
        };
        const handleKey =
          edge.sourceHandle || edge.handleMeta?.source?.key || edge.handleMeta?.source?.id;
        if (handleKey) {
          registerPinOffset(sourceNode.type, handleKey, offset);
        }
      } else if (isComponentNode(targetNode) && sourceIsSocket) {
        const socket = socketsById.get(sourceNode.id);
        const socketPos = getSocketPosition(socket);
        const nodePos = targetNode.position || {};
        const offset = {
          x: socketPos.x - (typeof nodePos.x === 'number' ? nodePos.x : 0),
          y: socketPos.y - (typeof nodePos.y === 'number' ? nodePos.y : 0)
        };
        const handleKey =
          edge.targetHandle || edge.handleMeta?.target?.key || edge.handleMeta?.target?.id;
        if (handleKey) {
          registerPinOffset(targetNode.type, handleKey, offset);
        }
      }
    });
  };

  const setDebugPreference = (value) => {
    const normalized = Boolean(value);
    window.__breadboardAutoWireDebug = normalized;
    try {
      window.localStorage?.setItem('breadboardAutoWireDebug', normalized ? 'true' : 'false');
    } catch (err) {
      // Ignore storage access issues (e.g., sandboxed iframes).
    }
    console.info('[BreadboardAutoWire]', `Debug logging ${normalized ? 'enabled' : 'disabled'}`);
  };

  window.breadboardAutoWire = window.breadboardAutoWire || {};
  if (typeof window.breadboardAutoWire.setDebug !== 'function') {
    window.breadboardAutoWire.setDebug = setDebugPreference;
  }

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
      type: handle.type || handle.dataType || handle.handleType || 'value',
      source: handle.__source || 'unknown'
    };
  };

  const hasHandleOnNode = (node, handleKey) => {
    if (!node || !handleKey) return false;
    const sources = [
      { list: node.handles, name: 'handles' },
      { list: node.outputs, name: 'outputs' },
      { list: node.inputs, name: 'inputs' },
      { list: node.data?.handles, name: 'data.handles' }
    ];
    const normalized = [];
    for (const { list, name } of sources) {
      if (!Array.isArray(list)) continue;
      list.forEach(entry => {
        const normalizedEntry = normalizeHandleEntry(entry);
        if (normalizedEntry) {
          normalizedEntry.__source = name;
          normalized.push(normalizedEntry);
        }
      });
    }
    const match = normalized.find(handle => handle.id === handleKey || handle.key === handleKey);
    return match ? { match, normalized } : null;
  };

  const extractNodeIds = (payload) => {
    if (!payload || typeof payload !== 'object') return [];
    const arraysToCheck = [
      payload.nodeIds,
      payload.nodes,
      payload.details && payload.details.nodeIds
    ];
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
    const candidates = [
      payload.nodeId,
      payload.id,
      payload.details && payload.details.nodeId,
      payload.node && payload.node.id
    ];
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
      processFn(ids);
    };
    if (typeof window?.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(flush);
      });
    } else {
      setTimeout(flush, 0);
    }
  };

  const attemptAttach = () => {
    const eventBus = window.eventBus;
    const api = window.graphAPI;
    if (!eventBus || !api || typeof api.readNode !== 'function') {
      setTimeout(attemptAttach, 500);
      return;
    }
    if (attemptAttach._attached) return;
    attemptAttach._attached = true;

    const cleanupCallbacks = [];
    const registerCleanup = (fn) => {
      if (typeof fn === 'function') {
        cleanupCallbacks.push(fn);
      }
    };

    const hasDirectEventAccess = Boolean(eventBus?.on);
    const shouldHandleRelayMessages = !hasDirectEventAccess;

    const dragStartEventNames = ['nodeDragStart', 'node:dragstart'];
    const dragEndEventNames = ['nodeDragEnd', 'node:dragend'];
    const normalizedDragStartNames = new Set(dragStartEventNames.map(name => String(name || '').toLowerCase()));
    const normalizedDragEndNames = new Set(dragEndEventNames.map(name => String(name || '').toLowerCase()));
    const normalizeEventName = (name) => (typeof name === 'string' ? name.toLowerCase() : '');

    const handleNodeDragStart = (payload = {}) => {
      const nodeIds = extractNodeIds(payload);
      debugLog('handleNodeDragStart resolved nodeIds:', nodeIds, 'from payload:', payload);
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;

      const nodesResult = api.readNode?.();
      const edgesResult = api.readEdge?.();
      const allNodes = Array.isArray(nodesResult?.data) ? nodesResult.data : [];
      const allEdges = Array.isArray(edgesResult?.data) ? edgesResult.data : [];
      const socketNodes = allNodes.filter(node => node?.type === 'io.breadboard.sockets:socket');
      const socketNodeIds = new Set(socketNodes.map(socket => socket.id).filter(Boolean));
      nodeIds.forEach(nodeId => {
        const node = allNodes.find(n => n.id === nodeId);
        if (!node) return;
        const relevantEdges = allEdges.filter(edge => {
          if (!edge) return false;
          const isSource = edge.source === node.id && socketNodeIds.has(edge.target);
          const isTarget = edge.target === node.id && socketNodeIds.has(edge.source);
          return isSource || isTarget;
        });
        const deleted = [];
        relevantEdges.forEach(edge => {
          if (!edge || !edge.id) return;
          if (typeof api.deleteEdge === 'function') {
            const result = api.deleteEdge(edge.id);
            if (result?.success) {
              deleted.push(edge.id);
            }
          }
        });
        if (deleted.length > 0) {
          debugLog(`Deleted ${deleted.length} edge(s) for node ${node.id}:`, deleted);
        }
      });
    };

    const processNodeDragEnd = (queuedNodeIds = []) => {
      if (!Array.isArray(queuedNodeIds) || queuedNodeIds.length === 0) return;

      const nodesResult = api.readNode?.();
      const edgesResult = api.readEdge?.();
      const allNodes = Array.isArray(nodesResult?.data) ? nodesResult.data : [];
      const allEdges = Array.isArray(edgesResult?.data) ? edgesResult.data : [];

      const socketNodes = allNodes.filter(node => node?.type === 'io.breadboard.sockets:socket');
      debugLog('Found socket nodes:', socketNodes.length);
      if (socketNodes.length === 0) return;

      const socketNodeIds = new Set();
      const directory = new Map();
      const socketById = new Map();
      socketNodes.forEach(socket => {
        if (!socket?.id) return;
        socketNodeIds.add(socket.id);
        socketById.set(socket.id, socket);
        const data = socket.data || {};
        if (Array.isArray(data.sockets)) {
          data.sockets.forEach(label => {
            const key = normalizeSocketKey(label);
            if (key) directory.set(key, socket);
          });
        }
        if (Array.isArray(data.rows) && data.column !== undefined) {
          data.rows.forEach(row => {
            const key = buildSocketRowColumnKey(row, data.column);
            if (key) directory.set(key, socket);
          });
        }
      });
      debugLog('Directory keys:', Array.from(directory.keys()));
      if (directory.size === 0) return;
      const directoryEntries = Array.from(directory.entries());

      const workingEdges = [...allEdges];
      bootstrapPinOffsets(allNodes, allEdges, socketById);

      queuedNodeIds.forEach(nodeId => {
        const node = allNodes.find(n => n.id === nodeId);
        if (!node || node.type === 'io.breadboard.sockets:socket') return;

        const pins = Array.isArray(node.data?.pins) ? node.data.pins.map(pin => ({ ...pin })) : [];
        const dropLabel = node.label || node.id;
        debugLog('Node', nodeId, 'pins:', pins);
        if (pins.length === 0) return;

        const resolvedPins = [];
        const pinState =
          (node.data?.breadboard && isPlainObject(node.data.breadboard.pinState)
            ? node.data.breadboard.pinState
            : {}) || {};
        const nextPinState = { ...pinState };
        const usedSocketIds = new Set();
        const defaultRowIndices = pins.map(pin => rowToIndex(pin.row));
        let rowShift = null;
        const basePinDefaultIndex = defaultRowIndices.find(index => index !== null);
        if (basePinDefaultIndex !== null) {
          const baseCandidate = findNearestSocketForPin({
            targetX: node.position?.x || 0,
            targetY: node.position?.y || 0,
            directoryEntries
          });
          if (baseCandidate?.socket) {
            const baseRowLabel = chooseSocketRow(baseCandidate.socket, pins[0]?.row);
            const actualIndex = rowToIndex(baseRowLabel);
            if (actualIndex !== null) {
              rowShift = actualIndex - basePinDefaultIndex;
            }
          }
        }

        const segmentAlignment = new Map();

        pins.forEach((pin, index) => {
          const handleKey = pin.handleKey || pin.key || pin.id || pin.label;
          if (!handleKey) return;
          const handleInfo = hasHandleOnNode(node, handleKey);
          if (!handleInfo) {
            console.warn(
              '[BreadboardAutoWire]',
              `Handle "${handleKey}" not found on node ${dropLabel}.`,
              {
                handles: node.handles,
                outputs: node.outputs,
                inputs: node.inputs
              }
            );
            return;
          }

          const savedState = pinState[handleInfo.match.key || handleKey];
          let socket = null;
          let socketKey = null;

          let rowHintForDrop = savedState ? (pin.row || null) : null;
          if (!savedState) {
            const defaultIndex = defaultRowIndices[index];
            if (defaultIndex !== null) {
              const targetIndex =
                rowShift !== null ? defaultIndex + rowShift : defaultIndex;
              rowHintForDrop = indexToRow(targetIndex);
            }
          }

          if (savedState?.offset && node.position) {
            const targetX = node.position.x + savedState.offset.x;
            const targetY = node.position.y + savedState.offset.y;
            const candidate = findNearestAvailableSocket({
              targetX,
              targetY,
              rowHint: rowHintForDrop,
              directoryEntries
            }, usedSocketIds);
            if (candidate) {
              socket = candidate.socket;
              socketKey = candidate.key;
            }
          }

          if (!socket && savedState?.socketId) {
            const candidate = socketById.get(savedState.socketId);
            if (candidate && !usedSocketIds.has(candidate.id)) {
              socket = candidate;
              socketKey = savedState.socketKey || deriveSocketKey(socket, pin.row);
            }
          }

          const segmentKey = deriveRowKey(pin, handleInfo.match?.key);
          const existingAlignment = segmentAlignment.get(segmentKey);
          if (!socket && existingAlignment && typeof existingAlignment.assignedColumn === 'number') {
            const originalColumn =
              typeof existingAlignment.originalColumn === 'number'
                ? existingAlignment.originalColumn
                : existingAlignment.assignedColumn;
            if (typeof pin.column === 'number') {
              const desiredColumn = existingAlignment.assignedColumn + (pin.column - originalColumn);
              const key = buildSocketRowColumnKey(pin.row || existingAlignment.rowHint, desiredColumn);
              if (key) {
                const candidate = directory.get(key);
                if (candidate && !usedSocketIds.has(candidate.id)) {
                  socket = candidate;
                  socketKey = key;
                }
              }
            }
          }

          if (!socket && node.position) {
            const candidate = findNearestAvailableSocket({
              targetX: node.position.x,
              targetY: node.position.y,
              rowHint: rowHintForDrop,
              directoryEntries
            }, usedSocketIds);
            if (candidate) {
              socket = candidate.socket;
              socketKey = candidate.key;
            }
          }

          if (!socket) {
            const desiredRowForMetadata = rowHintForDrop || pin.row;
            let key = null;
            if (pin?.socketId) {
              key = normalizeSocketKey(pin.socketId);
            } else if (pin?.socket) {
              key = normalizeSocketKey(pin.socket);
            } else if (desiredRowForMetadata !== undefined && pin?.column !== undefined) {
              key = buildSocketRowColumnKey(desiredRowForMetadata, pin.column);
            }
            if (key) {
              const candidate = directory.get(key);
              if (candidate && !usedSocketIds.has(candidate.id)) {
                socket = candidate;
                socketKey = key;
              }
            }
          }

          if (!socket) return;
          socketKey = socketKey || deriveSocketKey(socket, pin.row);
          usedSocketIds.add(socket.id);
          if (rowShift === null) {
            const actualRowLabel = chooseSocketRow(socket, pin.row);
            const actualRowIndex = rowToIndex(actualRowLabel);
            const defaultIndex = defaultRowIndices[index];
            if (actualRowIndex !== null && defaultIndex !== null) {
              rowShift = actualRowIndex - defaultIndex;
            }
          }
          if (!segmentAlignment.has(segmentKey) && typeof socket.data?.column === 'number') {
            segmentAlignment.set(segmentKey, {
              assignedColumn: socket.data.column,
              originalColumn: typeof pin.column === 'number' ? pin.column : socket.data.column,
              rowHint: pin.row
            });
          }

          resolvedPins.push({
            handle: handleInfo.match.key || handleKey,
            socketId: socket.id,
            socketKey,
            pinIndex: index
          });

          const existingEdge = workingEdges.find(edge =>
            edge.source === node.id &&
            edge.sourceHandle === (handleInfo.match.key || handleKey) &&
            edge.target === socket.id
          );
          if (existingEdge) {
            debugLog('Edge already exists:', existingEdge.id);
            return;
          }

          const conflictingEdges = workingEdges.filter(edge =>
            edge.source === node.id &&
            edge.sourceHandle === handleKey &&
            socketNodeIds.has(edge.target)
          );
          debugLog('Conflicting edges:', conflictingEdges.length);

          conflictingEdges.forEach(edge => {
            if (edge.target === socket.id) return;
            if (typeof api.deleteEdge === 'function') {
              api.deleteEdge(edge.id);
            }
            const idx = workingEdges.findIndex(e => e.id === edge.id);
            if (idx !== -1) {
              workingEdges.splice(idx, 1);
            }
          });

          const payload = {
            source: node.id,
            sourceHandle: handleInfo.match.key || handleKey,
            target: socket.id,
            targetHandle: 'socket',
            type: 'default'
          };
          const result = api.createEdge(payload);
          if (result?.success && result.data) {
            workingEdges.push(result.data);
            debugLog(`Created edge ${result.data.id} (${node.id}.${handleKey} → ${socket.id})`);
          } else if (!result?.success) {
            const reason = result?.error || 'Unknown error';
            console.warn(
              '[BreadboardAutoWire]',
              `Failed to create edge for ${node.id}.${handleKey} → ${socket.id}: ${reason}`,
              { payload, result }
            );
          }
        });

        if (resolvedPins.length > 0) {
          const summary = resolvedPins.map(entry => `${entry.handle}→${entry.socketKey || entry.socketId}`).join(', ');
          console.info(`[BreadboardAutoWire] Drop processed for ${dropLabel}: ${resolvedPins.length} pin(s) connected (${summary}).`);
        } else {
          console.info(`[BreadboardAutoWire] Drop processed for ${dropLabel}: no matching pins found.`);
        }

        let pinsChanged = false;
        resolvedPins.forEach((entry, idx) => {
          const pin = pins[idx];
          const socket = socketById.get(entry.socketId);
          if (!pin || !socket) return;
          const socketData = socket.data || {};
          const column = socketData.column;
          const row = pin.row || (Array.isArray(socketData.rows) ? socketData.rows[0] : null);
          if (entry.socketKey && pin.socket !== entry.socketKey) {
            pin.socket = entry.socketKey;
            pinsChanged = true;
          }
          if (column !== undefined && pin.column !== column) {
            pin.column = column;
            pinsChanged = true;
          }
          if (row && pin.row !== row) {
            pin.row = row;
            pinsChanged = true;
          }
          const socketPos = getSocketPosition(socket);
          nextPinState[entry.handle] = {
            offset: {
              x: socketPos.x - (node.position?.x || 0),
              y: socketPos.y - (node.position?.y || 0)
            },
            socketId: entry.socketId,
            socketKey: entry.socketKey
          };
        });

        const currentPosition = {
          x: typeof node.position?.x === 'number' ? node.position.x : 0,
          y: typeof node.position?.y === 'number' ? node.position.y : 0
        };

        let snapTargetPosition = null;
        const cachedOffsets = pinOffsetCache.get(node.type);
        if (cachedOffsets) {
          const desiredPositions = [];
          resolvedPins.forEach(entry => {
            const cached = cachedOffsets[entry.handle];
            if (!cached) return;
            const socket = socketById.get(entry.socketId);
            if (!socket) return;
            const socketPos = getSocketPosition(socket);
            desiredPositions.push({
              x: socketPos.x - cached.x,
              y: socketPos.y - cached.y
            });
          });
          if (desiredPositions.length > 0) {
            const avg = desiredPositions.reduce(
              (acc, curr) => ({ x: acc.x + curr.x, y: acc.y + curr.y }),
              { x: 0, y: 0 }
            );
            avg.x /= desiredPositions.length;
            avg.y /= desiredPositions.length;
            avg.x += 1;
            snapTargetPosition = avg;
          }
        }

        if (!snapTargetPosition && resolvedPins.length > 0) {
          const targetPositions = resolvedPins
            .map(entry => socketById.get(entry.socketId))
            .filter(Boolean)
            .map(socket => getSocketPosition(socket));
          if (targetPositions.length > 0) {
            const avg = targetPositions.reduce(
              (acc, curr) => ({ x: acc.x + curr.x, y: acc.y + curr.y }),
              { x: 0, y: 0 }
            );
            avg.x /= targetPositions.length;
            avg.y /= targetPositions.length;
            avg.x += 1;
            snapTargetPosition = avg;
          }
        }

        const snapDelta = snapTargetPosition
          ? {
              x: snapTargetPosition.x - currentPosition.x,
              y: snapTargetPosition.y - currentPosition.y
            }
          : null;

        const nextPosition = snapTargetPosition ? { ...snapTargetPosition } : null;

        if (nextPosition) {
          resolvedPins.forEach(entry => {
            const socket = socketById.get(entry.socketId);
            if (!socket) return;
            const socketPos = getSocketPosition(socket);
            const offset = {
              x: socketPos.x - nextPosition.x,
              y: socketPos.y - nextPosition.y
            };
            nextPinState[entry.handle] = {
              ...(nextPinState[entry.handle] || {}),
              offset,
              socketId: entry.socketId,
              socketKey: entry.socketKey
            };
            registerPinOffset(node.type, entry.handle, offset);
          });
        } else {
          resolvedPins.forEach(entry => {
            const state = nextPinState[entry.handle];
            if (state?.offset) {
              registerPinOffset(node.type, entry.handle, { ...state.offset });
            }
          });
        }

        const needsDataUpdate =
          pinsChanged ||
          JSON.stringify(nextPinState) !== JSON.stringify(pinState) ||
          Boolean(snapDelta);

        if ((needsDataUpdate || nextPosition) && typeof api.updateNode === 'function') {
          const existingBreadboard = isPlainObject(node.data?.breadboard) ? node.data.breadboard : {};
          const payload = {};
          if (needsDataUpdate) {
            payload.data = {
              pins,
              breadboard: {
                ...existingBreadboard,
                pinState: nextPinState
              }
            };
          }
          if (nextPosition) {
            payload.position = nextPosition;
          }
          api.updateNode(node.id, payload);
        }
      });
    };

    const handleNodeDragEnd = (payload = {}) => {
      const nodeIds = extractNodeIds(payload);
      debugLog('handleNodeDragEnd resolved nodeIds:', nodeIds, 'from payload:', payload);
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;
      nodeIds.forEach(id => pendingDragEndNodeIds.add(id));
      scheduleDragEndProcessing(processNodeDragEnd);
    };

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
    console.info(
      '[BreadboardAutoWire] Registered drag handlers for events:',
      dragStartEventNames.concat(dragEndEventNames)
    );

    // Debug: log all events
    const wildcardListener = (event, data) => {
      debugLog('Event fired:', event, data);
    };
    if (eventBus?.on) {
      eventBus.on('*', wildcardListener);
      registerCleanup(() => eventBus.off('*', wildcardListener));
    }

    const relayListener = (event) => {
      if (!shouldHandleRelayMessages) return;
      debugLog('Relay message received:', event.data);
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
    window.__breadboardAutoWireCleanup = detach;
    return detach;
  };

  attemptAttach();
})();
  const deriveRowKey = (pin, fallback) => {
    if (typeof pin?.row === 'string' && pin.row.trim()) {
      return pin.row.trim().toUpperCase();
    }
    if (fallback) return fallback;
    return `pin:${pin?.id || pin?.handleKey || pin?.key || 'unknown'}`;
  };
