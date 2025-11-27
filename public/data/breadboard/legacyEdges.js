export async function legacyHandleNodeDrop({ queuedNodeIds, nodes, layout, api }) {
    // old connectivity logic, unchanged

    return; // TEMP DISABLE LEGACY LOGIC

const connectableNodes = socketNodes.concat(railNodes);
const connectableNodeById = new Map(connectableNodes.map(node => [node.id, node]));
const connectableNodeIds = new Set(connectableNodeById.keys());

const deleteEdgeById = async (edgeId, context) => {
  if (!edgeId || typeof api.deleteEdge !== 'function') return;
  try {
    const result = await toPromise(api.deleteEdge(edgeId));
    if (!result?.success) {
      console.warn(
        '[BreadboardAutoWire]',
        `Failed to delete edge ${edgeId}${context ? ` (${context})` : ''}:`,
        result?.error || 'unknown error'
      );
    }
  } catch (err) {
    console.warn('[BreadboardAutoWire]', `Failed to delete edge ${edgeId}${context ? ` (${context})` : ''}:`, err);
  }
};

const collectConnectableEdges = (nodeId) => {
  if (!nodeId) return [];
  const snapshot = typeof api.readEdge === 'function' ? api.readEdge() : null;
  const edges = Array.isArray(snapshot?.data) ? snapshot.data : [];
  return edges.filter(edge => edge?.source === nodeId && connectableNodeIds.has(edge.target));
};

const describeTargetLabel = (edge) => {
  const targetNode = connectableNodeById.get(edge?.target);
  if (!targetNode) return edge?.target || 'unknown';
  if (targetNode.type === 'io.breadboard.sockets:socket') {
    const segment = normalizeSegmentName(targetNode?.data?.segment);
    const socketRow = chooseSocketRow(targetNode, segment, null, null);
    return deriveSocketKey(targetNode, socketRow) || targetNode.label || targetNode.id;
  }
  if (targetNode.type === 'io.breadboard.sockets:railSocket') {
    const column = targetNode?.data?.column;
    const rowLabel = edge?.targetHandle === 'negative' ? 'GND' : 'V+';
    if (Number.isFinite(column)) {
      return `${rowLabel}${column}`;
    }
    return `${rowLabel} (${targetNode.label || targetNode.id})`;
  }
  return targetNode.label || targetNode.id;
};

const summarizeSocketEdges = (nodeId, label) => {
  const summaries = collectConnectableEdges(nodeId).map(edge => {
    const socketLabel = describeTargetLabel(edge);
    return `${edge.sourceHandle || 'unknown'}→${socketLabel}`;
  });
  console.info('[BreadboardAutoWire]', `${label} edges for ${nodeId}:`, summaries.length > 0 ? summaries.join(', ') : 'none');
  return summaries;
};

return await updateConnectivityStates();

const verificationTimers = new Map();
const scheduleEdgeVerification = (node, desiredMappings) => {
  if (!node || !node.id || !desiredMappings || desiredMappings.size === 0) return;
  const nodeId = node.id;
  if (verificationTimers.has(nodeId)) {
    clearTimeout(verificationTimers.get(nodeId));
  }
  const runVerification = async () => {
    verificationTimers.delete(nodeId);
    await waitForGraphSettled();
    const currentEdges = collectConnectableEdges(nodeId);
    const edgesByHandle = new Map();
    currentEdges.forEach(edge => {
      if (!edge || !edge.sourceHandle) return;
      if (!edgesByHandle.has(edge.sourceHandle)) {
        edgesByHandle.set(edge.sourceHandle, []);
      }
      edgesByHandle.get(edge.sourceHandle).push(edge);
    });

    for (const [handleKey, desired] of desiredMappings.entries()) {
      if (!handleKey || !desired) continue;
      const entries = edgesByHandle.get(handleKey) || [];
      let hasMatch = false;
      const desiredTargetHandle = desired.targetHandle || null;
      for (const edge of entries) {
        const edgeTargetHandle = edge?.targetHandle || null;
        const handleMatches = desiredTargetHandle ? edgeTargetHandle === desiredTargetHandle : true;
        if (edge.target === desired.socketId && handleMatches && !hasMatch) {
          hasMatch = true;
        } else {
          await deleteEdgeById(edge.id, 'verify');
        }
      }
      if (!hasMatch && typeof api.createEdge === 'function') {
        console.warn('[BreadboardAutoWire]', `Retry edge for ${node.label || nodeId}.${handleKey} → ${desired.socketKey || desired.socketId}`);
        const edgePayload = {
          source: nodeId,
          sourceHandle: handleKey,
          target: desired.socketId,
          type: 'default'
        };
        if (desired.targetHandle) {
          edgePayload.targetHandle = desired.targetHandle;
        }
        try {
          const result = await toPromise(api.createEdge(edgePayload));
          if (!result?.success) {
            console.warn('[BreadboardAutoWire]', 'Failed to recreate edge during verification:', result?.error || 'unknown error');
          }
        } catch (err) {
          console.warn('[BreadboardAutoWire]', 'Failed to recreate edge during verification:', err);
        }
      }
    }

    await waitForGraphSettled();
    summarizeSocketEdges(nodeId, 'Verified');
  };

  const timer = setTimeout(() => {
    runVerification().catch((err) => {
      console.warn('[BreadboardAutoWire] Verification task failed:', err);
    });
  }, 32);
  verificationTimers.set(nodeId, timer);
};

const rebuildEdgesForNode = async (node, desiredMappings, onSocketTouched) => {
  if (!node || !node.id) return;
  const nodeId = node.id;
  const nodeLabel = node.label || nodeId;
  await waitForGraphSettled();
  summarizeSocketEdges(nodeId, 'Before rebuild');
  const existingEdges = collectConnectableEdges(nodeId);
  for (const edge of existingEdges) {
    const targetLabel = describeTargetLabel(edge);
    console.info('[BreadboardAutoWire]', `Edge removed for ${nodeLabel}.${edge.sourceHandle || 'unknown'} (was ${targetLabel || edge.target})`);
    if (typeof onSocketTouched === 'function' && edge?.target) {
      onSocketTouched(edge.target);
    }
    await deleteEdgeById(edge.id, 'rebuild');
  }
  if (existingEdges.length > 0) {
    await waitForGraphSettled();
  }
  if (!desiredMappings || desiredMappings.size === 0) {
    await waitForGraphSettled();
    summarizeSocketEdges(nodeId, 'After rebuild');
    return;
  }
  for (const [handleKey, desired] of desiredMappings.entries()) {
    if (!handleKey || !desired) continue;
    if (typeof api.createEdge !== 'function') {
      console.warn('[BreadboardAutoWire]', 'graphAPI.createEdge is not available.');
      continue;
    }
    const edgePayload = {
      source: nodeId,
      sourceHandle: handleKey,
      target: desired.socketId,
      type: 'default'
    };
    if (desired.targetHandle) {
      edgePayload.targetHandle = desired.targetHandle;
    }
    let result;
    try {
      result = await toPromise(api.createEdge(edgePayload));
    } catch (err) {
      console.warn('[BreadboardAutoWire]', 'Failed to create edge:', { nodeId, handleKey, target: desired.socketId }, err);
      continue;
    }
    if (!result?.success) {
      console.warn('[BreadboardAutoWire]', 'Failed to create edge:', { nodeId, handleKey, target: desired.socketId }, result?.error || 'unknown error');
      continue;
    }
    console.info('[BreadboardAutoWire]', `Edge added for ${nodeLabel}.${handleKey} → ${desired.socketKey || desired.socketId}`);
  }
  await waitForGraphSettled();
  summarizeSocketEdges(nodeId, 'After rebuild');
  scheduleEdgeVerification(node, desiredMappings);
};

const socketConnectionInfo = new Map();
edges.forEach(edge => {
  if (!edge || !edge.target || edge.targetHandle !== 'socket') return;
  const socketNode = connectableNodeById.get(edge.target);
  if (!socketNode || socketNode.type !== 'io.breadboard.sockets:socket') return;
  const entry = socketConnectionInfo.get(edge.target) || {
    total: 0,
    perNode: new Map()
  };
  entry.total += 1;
  const sourceId = edge.source || '__unknown__';
  entry.perNode.set(sourceId, (entry.perNode.get(sourceId) || 0) + 1);
  socketConnectionInfo.set(edge.target, entry);
});

const getSocketPeerCount = (socketId, nodeId) => {
  if (!socketId) return 0;
  const info = socketConnectionInfo.get(socketId);
  if (!info) return 0;
  const ownCount = nodeId ? info.perNode.get(nodeId) || 0 : 0;
  return Math.max(0, info.total - ownCount);
};

const getSocketPeerIds = (socketId, excludeId) => {
  if (!socketId) return [];
  const info = socketConnectionInfo.get(socketId);
  if (!info) return [];
  const ids = [];
  info.perNode.forEach((count, nodeId) => {
    if (!nodeId || nodeId === excludeId) return;
    ids.push(nodeId);
  });
  return ids;
};

const queuedNodeSet = new Set(queuedNodeIds);

for (const nodeId of queuedNodeIds) {
  const node = nodes.find(n => n?.id === nodeId);
  if (!node || node.type === 'io.breadboard.sockets:socket') continue;

  const pins = Array.isArray(node.data?.pins) ? node.data.pins.map(pin => ({ ...pin })) : [];
  if (pins.length === 0) {
    debugLog('No pins found for node:', nodeId);
    continue;
  }

  const markPeersForSocket = () => {};
  const normalizedPins = normalizePinsForNode(pins);
  const anchor = determineAnchor(node, layout);
  const columnOffsets = normalizedPins.map(pin =>
    Number.isFinite(pin.columnOffset) ? pin.columnOffset : 0
  );
  const minOffset = columnOffsets.length > 0 ? Math.min(...columnOffsets) : 0;
  const maxOffset = columnOffsets.length > 0 ? Math.max(...columnOffsets) : 0;
  const minAnchorColumn = clampColumn(layout.minColumn - minOffset, layout.minColumn, layout.maxColumn);
  const maxAnchorColumn = clampColumn(layout.maxColumn - maxOffset, layout.minColumn, layout.maxColumn);
  const adjustedAnchorColumn = clampColumn(anchor.column, minAnchorColumn, maxAnchorColumn);
  debugLog('Processing drop for', node.label || node.id, 'anchor:', anchor, 'adjustedColumn:', adjustedAnchorColumn);

  const resolvedPins = [];
  const nextPinState = {};
  const targetPositions = [];
  let pinsChanged = false;

  normalizedPins.forEach((pinInfo, index) => {
    const handleKey = pinInfo.handleKey;
    const handle = hasHandleOnNode(node, handleKey);
    if (!handle) {
      console.warn('[BreadboardAutoWire]', `Handle "${handleKey}" not found on node ${node.label || node.id}.`);
      return;
    }

    const desiredColumn = clampColumn(adjustedAnchorColumn + pinInfo.columnOffset, layout.minColumn, layout.maxColumn);
    let desiredSegment = resolvePinSegment(node, pinInfo, anchor.segment);
    const isGroundTap = node.type === 'io.breadboard.components:railTapNegative' && handle.key === 'tap';
    const socketKey = makeSegmentColumnKey(desiredSegment, desiredColumn);
    let targetEntry = layout.targetsBySegmentColumn.get(socketKey);
    const coerced = coerceRailTarget(targetEntry, desiredSegment, desiredColumn, node, handle.key, layout);
    targetEntry = coerced.entry;
    desiredSegment = coerced.segment;
    if (!targetEntry) {
      debugLog('No socket for', socketKey, 'while dropping', node.label || node.id);
      return;
    }
    const socket = targetEntry.node;
    markPeersForSocket(socket.id);

    const pin = pins[index] || {};
    let preferredRow = pin.row || pinInfo?.originalPin?.row || null;
    if (!preferredRow && Array.isArray(socket?.data?.rows) && socket.data.rows[index]) {
      preferredRow = socket.data.rows[index];
    }
    const socketRow = chooseSocketRow(
      socket,
      desiredSegment,
      targetEntry.rowPositions,
      preferredRow
    );
    const socketIdentifier = deriveSocketKey(socket, socketRow);
    const normalizedRow = normalizeRowName(socketRow);
    const rowPosition =
      (normalizedRow && targetEntry.rowPositions?.get(normalizedRow)) || null;
    resolvedPins.push({
      handle: handle.key,
      socketId: socket.id,
      socketKey: socketIdentifier,
      targetHandle: targetEntry.targetHandle || null,
      pinIndex: index
    });

    const preservedPreference =
      isGroundTap
        ? desiredSegment
        : pin.segmentPreference !== undefined
        ? pin.segmentPreference
        : pinInfo.segmentPreference;
    if (pin.row !== socketRow || pin.column !== desiredColumn || pin.socket !== socketIdentifier) {
      pinsChanged = true;
    }
    pins[index] = {
      ...pin,
      row: socketRow,
      column: desiredColumn,
      segment: desiredSegment,
      segmentPreference: preservedPreference,
      socket: socketIdentifier
    };

    const peerCount = getSocketPeerCount(socket.id, node.id);
    nextPinState[handle.key] = {
      socketId: socket.id,
      socketKey: socketIdentifier,
      segment: desiredSegment,
      column: desiredColumn,
      row: socketRow,
      targetHandle: targetEntry.targetHandle || null,
      peerCount,
      hasPeer: peerCount > 0,
      position: rowPosition || getSocketPosition(socket)
    };

    const socketPos = rowPosition || getSocketPosition(socket);
    targetPositions.push({
      x: socketPos.x,
      y: socketPos.y,
      handle: handle.key,
      segment: desiredSegment
    });
  });

  if (resolvedPins.length === 0) {
    console.info(`[BreadboardAutoWire] Drop processed for ${node.label || node.id}: no matching pins found.`);
    continue;
  }

  const summary = resolvedPins.map(entry => `${entry.handle}→${entry.socketKey || entry.socketId}`).join(', ');
  console.info(`[BreadboardAutoWire] Drop processed for ${node.label || node.id}: ${resolvedPins.length} pin(s) connected (${summary}).`);

  const desiredMap = new Map(resolvedPins.map(entry => [entry.handle, entry]));
  await rebuildEdgesForNode(node, desiredMap, markPeersForSocket);

  const existingPinState = node.data?.breadboard?.pinState || {};
  const pinStateChanged =
    JSON.stringify(existingPinState) !== JSON.stringify(nextPinState);

  // Determine where to place the component based on the sockets
  // it is actually connected to, following a very simple rule:
  //
  // - If the component is wider than it is tall: treat it as horizontal,
  //   so place it between columns (x varies, y stays aligned to the row).
  // - If the component is taller than it is wide: treat it as vertical,
  //   so place it between rows (y varies, x stays aligned to the column).
  // - If there is only a single socket: place the component on that socket.
  let snapPosition = null;

  if (targetPositions.length > 0) {
    const bounds = targetPositions.reduce(
      (acc, curr) => ({
        minX: Math.min(acc.minX, curr.x),
        maxX: Math.max(acc.maxX, curr.x),
        minY: Math.min(acc.minY, curr.y),
        maxY: Math.max(acc.maxY, curr.y)
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
      }
    );

    // Default body size if the host doesn't give us one.
    const bodyWidth =
      typeof node?.width === 'number'
        ? node.width
        : typeof node?.data?.width === 'number'
        ? node.data.width
        : MIN_BODY_WIDTH;

    const bodyHeight =
      typeof node?.height === 'number'
        ? node.height
        : typeof node?.data?.height === 'number'
        ? node.data.height
        : MIN_BODY_HEIGHT;

    const isHorizontal = bodyWidth >= bodyHeight;

    if (targetPositions.length === 1) {
      // Single socket: sit right on the hole.
      const only = targetPositions[0];
      snapPosition = {
        x: only.x + SNAP_OFFSET_X,
        y: only.y
      };
    } else if (isHorizontal) {
      // Wider than tall → between columns: x between min/max columns, y on the row.
      const midX = (bounds.minX + bounds.maxX) / 2 + SNAP_OFFSET_X;
      const midY = (bounds.minY + bounds.maxY) / 2;
      snapPosition = { x: midX, y: midY };
    } else {
      // Taller than wide → between rows: y between min/max rows, x on the column.
      const midX = (bounds.minX + bounds.maxX) / 2 + SNAP_OFFSET_X;
      const midY = (bounds.minY + bounds.maxY) / 2;
      snapPosition = { x: midX, y: midY };
    }
  }


  const needsUpdate =
    pinsChanged || pinStateChanged || Boolean(snapPosition);
  if (!needsUpdate) {
    continue;
  }

  const payload = {};
  if (pinsChanged || pinStateChanged) {
    payload.data = {
      pins,
      breadboard: {
        ...(isPlainObject(node.data?.breadboard)
          ? node.data.breadboard
          : {}),
        pinState: nextPinState
      }
    };
  }

  // Only move the component's center. Do NOT change width/height here.
  if (snapPosition) {
    payload.position = snapPosition;
  }

  api.updateNode(node.id, payload);


  // No peer requeue; connectivity solver updates pin states after all nodes processed.
}

await updateConnectivityStates();

}