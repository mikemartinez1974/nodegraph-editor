// public/data/breadboard/autowire-runtime.js
// Minimal autowire runtime: listen for nodeDragEnd, trust the drop position,
// snap to targeted sockets, rebuild edges (dedup, max 2), and log placements.


(function bootstrap(runtimeApi) {
  // Avoid multiple copies fighting each other (across iframes) ASAP.
  if (typeof window !== "undefined") {
    if (window.__breadboardAutowireActive) {
      return;
    }
  }

  const VERSION = "autowire-runtime@v0.5";

  const log = (...args) => {
    try {
      console.log(...args);
      if (typeof window !== "undefined" && window.top && window.top !== window) {
        window.top.console?.log(...args);
      }
    } catch (_) {
      /* ignore */
    }
  };

  const resolveApi = () => {
    // Prefer injected runtimeApi, then in-frame globals, then parent.
    const candidates = [
      runtimeApi,
      typeof window !== "undefined" ? window.graphAPI : null,
      typeof window !== "undefined" ? window.runtimeApi : null,
      typeof window !== "undefined" ? window.breadboardRuntime : null,
      typeof window !== "undefined" ? window.__breadboardAutowireApi : null
    ];
    for (const c of candidates) {
      if (c) return c;
    }
    if (typeof window !== "undefined" && window.top && window.top !== window) {
      try {
        return (
          window.top.graphAPI ||
          window.top.runtimeApi ||
          window.top.breadboardRuntime ||
          window.top.__breadboardAutowireApi ||
          null
        );
      } catch {
        return null;
      }
    }
    return null;
  };

  const topInfo = (() => {
    if (typeof window === "undefined") return { hasTop: false, topHasApi: false };
    let hasTop = false;
    let topHasApi = false;
    try {
      hasTop = !!window.top && window.top !== window;
      topHasApi = hasTop
        ? !!(
            window.top.graphAPI ||
            window.top.runtimeApi ||
            window.top.breadboardRuntime ||
            window.top.__breadboardAutowireApi
          )
        : false;
    } catch {
      hasTop = false;
      topHasApi = false;
    }
    return { hasTop, topHasApi };
  })();

  let api = resolveApi();
  log("[BreadboardAutoWire] init", VERSION, {
    hasRuntimeApi: !!runtimeApi,
    resolved: !!api,
    top: topInfo
  });

  const exposeApi = (resolvedApi) => {
    if (typeof window !== "undefined" && resolvedApi && !window.graphAPI) {
      window.graphAPI = resolvedApi;
    }
  };
  exposeApi(api);

  // If we don't have an API, bail immediately (single runner expected).
  if (!api) {
    log("[BreadboardAutoWire] no runtime API available; aborting");
    return;
  }

  const toPromise = (v) =>
    v && typeof v.then === "function" ? v : Promise.resolve(v);

  const mergeUnique = (current = [], extra = []) => {
    const map = new Map();
    [...current, ...extra].forEach((n) => {
      if (n && n.id && !map.has(n.id)) map.set(n.id, n);
    });
    return Array.from(map.values());
  };

  const fetchFromApi = async (targetApi) => {
    if (!targetApi) return { nodes: [], edges: [] };
    const res = (targetApi.readGraph && (await toPromise(targetApi.readGraph()))) || {};
    let nodes = res.nodes || [];
    let edges = res.edges || [];
    if (!nodes.length && typeof targetApi.getNodes === "function") {
      nodes = await toPromise(targetApi.getNodes());
    }
    if (!edges.length && typeof targetApi.getEdges === "function") {
      edges = await toPromise(targetApi.getEdges());
    }
    return { nodes: nodes || [], edges: edges || [] };
  };

  const hasBoardNodes = (nodes) =>
    (nodes || []).some((n) => n?.type === "io.breadboard.sockets:socket") &&
    (nodes || []).some((n) => n?.type === "io.breadboard.sockets:railSocket");

  // Cache a “board-only” snapshot so first-drop never runs without sockets/rails.
  let cachedBoard = { nodes: [], edges: [] };
  const ensureBoard = async (force = false) => {
    if (!force && hasBoardNodes(cachedBoard.nodes)) return cachedBoard;
    let board = await fetchFromApi(api);
    if (!hasBoardNodes(board.nodes) && typeof window !== "undefined" && window.top && window.top !== window) {
      try {
        const topApi =
          window.top.graphAPI ||
          window.top.runtimeApi ||
          window.top.breadboardRuntime ||
          window.top.__breadboardAutowireApi;
        if (topApi) {
          board = await fetchFromApi(topApi);
        }
      } catch {
        /* ignore */
      }
    }
    cachedBoard = board;
    return cachedBoard;
  };

  // Serialize drop handling per node so we don't double-process the same dragEnd.
  const dropQueue = new Map(); // nodeId -> Promise
  const lastDrop = new Map(); // nodeId -> { x, y }

  const getSnapshot = async () => {
    const primary = await fetchFromApi(api);
    const board = await ensureBoard();

    // If we still have no sockets/rails, try the top window graphAPI (if different).
    let mergedNodes = mergeUnique(primary.nodes || [], board.nodes || []);
    let mergedEdges = mergeUnique(primary.edges || [], board.edges || []);

    const needsBoard = !hasBoardNodes(mergedNodes);

    if (needsBoard && typeof window !== "undefined" && window.top && window.top !== window) {
      try {
        const topApi =
          window.top.graphAPI ||
          window.top.runtimeApi ||
          window.top.breadboardRuntime ||
          window.top.__breadboardAutowireApi;
        if (topApi && topApi !== api) {
          const extra = await fetchFromApi(topApi);
          mergedNodes = mergeUnique(mergedNodes, extra.nodes);
          mergedEdges = mergeUnique(mergedEdges, extra.edges);
        }
      } catch {
        /* ignore cross-origin */
      }
    }

    return { nodes: mergedNodes || [], edges: mergedEdges || [] };
  };

  // Map regular sockets by row/column/segment.
  const buildSocketIndex = (nodes) => {
    const topRows = new Set(["A", "B", "C", "D", "E"]);
    const bottomRows = new Set(["F", "G", "H", "I", "J"]);
    const map = new Map();
    nodes.forEach((n) => {
      if (!n || n.type !== "io.breadboard.sockets:socket") return;
      const col = n.data?.column ?? n.state?.column;
      const rows = n.data?.rows || [];
      if (!col || !rows.length) return;
      rows.forEach((row) => {
        const upperRow = String(row).toUpperCase();
        // If the socket didn't specify a segment, infer it from row letter.
        const inferredSegment = topRows.has(upperRow)
          ? "top"
          : bottomRows.has(upperRow)
          ? "bottom"
          : "top";
        const segment =
          n.data?.segment ||
          n.state?.segment ||
          inferredSegment;
        const key = `${upperRow}:${col}:${segment}`;
        map.set(key, n.id);
      });
    });
    return map;
  };

  // Map rail sockets by railId/column for fast lookup.
  const buildRailIndex = (nodes) => {
    const map = new Map();
    nodes.forEach((n) => {
      if (!n || n.type !== "io.breadboard.sockets:railSocket") return;
      const col = Number(n.data?.column);
      if (!Number.isFinite(col)) return;
      const rails = Array.isArray(n.data?.rails) ? n.data.rails : [];
      rails.forEach((rail) => {
        const railId = String(rail.railId || "").toLowerCase();
        if (!railId) return;
        const key = `${railId}::${col}`;
        const polarity = rail.polarity === "negative" ? "negative" : "positive";
        map.set(key, {
          nodeId: n.id,
          column: col,
          railId,
          polarity,
          targetHandle: polarity
        });
      });
    });
    return map;
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const findNearestSocket = (nodes, position) => {
    let best = null;
    let bestDist = Infinity;
    nodes.forEach((n) => {
      if (n.type !== "io.breadboard.sockets:socket") return;
      const col = Number(n.data?.column ?? n.state?.column);
      if (!Number.isFinite(col)) return;
      const dx = (n.position?.x || 0) - (position?.x || 0);
      const dy = (n.position?.y || 0) - (position?.y || 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    });
    if (!best) return { column: 1, segment: "top" };
    const col = clamp(Number(best.data?.column ?? best.state?.column) || 1, 1, 30);
    const rows = best.data?.rows || [];
    const inferredSegment = rows.some((r) => ["F","G","H","I","J"].includes(String(r).toUpperCase())) ? "bottom" : "top";
    const segment = best.data?.segment || best.state?.segment || inferredSegment;
    return { column: col, segment, socket: best, distance: bestDist };
  };

  const normalizeRow = (row, segmentHint) => {
    if (!row) return segmentHint === "bottom" ? "J" : "A";
    const upper = String(row).toUpperCase();
    if (upper === "GND" || upper === "GROUND") return "J";
    if (upper === "VCC" || upper === "V+") return "A";
    return upper;
  };

  const PIN_PRESETS = {
    "io.breadboard.components:railTapNegative": {
      rail: { row: "J", segmentPreference: "rail-bottom-negative", columnOffset: 0 },
      tap: { row: "J", segmentPreference: "bottom", columnOffset: 0 }
    },
    "io.breadboard.components:railTapPositive": {
      rail: { row: "A", segmentPreference: "rail-top-positive", columnOffset: 0 },
      tap: { row: "A", segmentPreference: "top", columnOffset: 0 }
    },
    "io.breadboard.components:led": {
      anode: { row: "E", segmentPreference: "top", columnOffset: 0 },
      cathode: { row: "F", segmentPreference: "bottom", columnOffset: 0 }
    }
  };

  const applyPinPresets = (node) => {
    const preset = PIN_PRESETS[node?.type];
    const pinsFromNode = Array.isArray(node?.data?.pins) ? node.data.pins : [];
    // If the node was just created and pins haven't hydrated yet, synthesize
    // pins from the preset so first-drop can still route correctly.
    const pins =
      pinsFromNode.length || !preset
        ? pinsFromNode
        : Object.entries(preset).map(([id, meta]) => ({
            id,
            ...meta
          }));
    if (!preset) return pins;
    return pins.map((pin) => {
      const overrides = preset[pin.id] || preset[pin.label] || preset[pin.name];
      return overrides ? { ...pin, ...overrides } : pin;
    });
  };

  const resolveRailTarget = (pref, rails, col, segmentHint) => {
    if (!pref || !pref.startsWith("rail-") || !Number.isFinite(col)) return null;
    const polarity = pref.includes("negative") ? "negative" : "positive";

    // 1) Honor drop segment first (if present)
    const hintedPref =
      segmentHint === "top" || segmentHint === "bottom"
        ? `rail-${segmentHint}-${polarity}`
        : null;
    if (hintedPref) {
      const hinted = rails.get(`${hintedPref}::${col}`);
      if (hinted) return hinted;
    }

    // 2) Try the declared preference
    const fromPref = rails.get(`${pref}::${col}`);
    if (fromPref) return fromPref;

    // 3) Fallback: any rail on this column with matching polarity
    let fallback = null;
    rails.forEach((entry) => {
      if (!fallback && entry.column === col && entry.polarity === polarity) {
        fallback = entry;
      }
    });
    return fallback;
  };

  const buildAssignments = (node, sockets, rails, snapshot, anchorCol, segment) => {
    const pins = applyPinPresets(node);
    if (!pins.length) return [];
    const baseCol = clamp(anchorCol, 1, 30);
    const seg = segment || pins[0]?.segment || "top";

    return pins
      .map((pin, idx) => {
        const colOffset = Number.isFinite(pin.columnOffset) ? pin.columnOffset : idx;
        const col = clamp(baseCol + colOffset, 1, 30);
        // Let tap pins mirror the drop segment so the body straddles rail+socket correctly.
        const isTapPin = pin.id === "tap" || pin.name === "tap";
        const isRailPin = pin.id === "rail" || pin.name === "rail";
        const dropRowOverride = isTapPin
          ? seg === "top"
            ? "A"
            : seg === "bottom"
            ? "J"
            : null
          : null;
        const row = normalizeRow(dropRowOverride || pin.row, seg);
        // Force tap pins to the drop band; force rail pins to the matching rail band.
        const pref = isTapPin
          ? seg
          : isRailPin
          ? seg === "top"
            ? "rail-top-negative"
            : "rail-bottom-negative"
          : (pin.segmentPreference || pin.segment || "").toLowerCase() ||
            (row === "J" ? "bottom" : row === "A" ? "top" : seg);

        // Rail pins
        if (pref.startsWith("rail-")) {
          // Use row A for top rail, J for bottom rail to mirror real breadboard rails.
          const railRow =
            segment === "top" ? "A" : segment === "bottom" ? "J" : row;
          const railTarget = resolveRailTarget(pref, rails, col, segment);
          if (railTarget) {
            return {
              handle: pin.id || pin.name || `pin${idx}`,
              target: {
                nodeId: railTarget.nodeId,
                targetHandle: railTarget.targetHandle,
                row: railRow,
                column: col,
                segment: pref
              }
            };
          }
          return null;
        }

        const pinSegment = pref || seg;
        const key = `${row}:${col}:${pinSegment}`;
        const socketId = sockets.get(key);
        return socketId
          ? {
              handle: pin.id || pin.name || `pin${idx}`,
              target: {
                nodeId: socketId,
                targetHandle: "socket",
                row,
                column: col,
                segment: pinSegment
              }
            }
          : null;
      })
      .filter(Boolean);
  };

  const deleteEdgesFor = async (nodeId) => {
    if (!nodeId) return 0;
    const snap = await getSnapshot();
    const toDelete = snap.edges.filter(
      (e) =>
        e &&
        (e.source === nodeId ||
          e.fromNodeId === nodeId ||
          e.target === nodeId ||
          e.toNodeId === nodeId)
    );
    await Promise.all(
      toDelete.map((e) =>
        toPromise(
          api.deleteEdge ? api.deleteEdge(e.id) : api.removeEdge?.(e.id)
        ).catch(() => Promise.resolve())
      )
    );
    return toDelete.length;
  };

  const createEdges = async (specs) => {
    for (const s of specs) {
      if (!s.source || !s.target) continue;
      await toPromise(
        api.createEdge
          ? api.createEdge(s)
          : api.addEdge?.({
              fromNodeId: s.source,
              fromHandle: s.sourceHandle,
              toNodeId: s.target,
              toHandle: s.targetHandle,
              type: s.type || "default"
            })
      ).catch(() => Promise.resolve());
    }
  };

  const processDrop = async (eventNode, overridePosition) => {
    if (!eventNode?.id) return;

    // Only trust explicit dropPoint/mouse coordinates; never fall back to old snapshot positions.
    const drop =
      (overridePosition &&
        typeof overridePosition.x === "number" &&
        typeof overridePosition.y === "number" &&
        overridePosition) ||
      (eventNode.dropPoint &&
        typeof eventNode.dropPoint.x === "number" &&
        typeof eventNode.dropPoint.y === "number" &&
        eventNode.dropPoint) ||
      null;
    if (!drop) {
      log("[BreadboardAutoWire] skip: missing dropPoint for", eventNode.id);
      return;
    }
    // Hard reset: start every drop with no existing edges for this node.
    await deleteEdgesFor(eventNode.id);
    // Force-refresh the board snapshot before the very first drop to avoid
    // the “column 1” / missing-rails first-drop issue. This is cheap enough
    // and dramatically improves first-drop reliability.
    await ensureBoard(true);

    let { nodes, edges } = await getSnapshot();
    let sockets = buildSocketIndex(nodes);
    let rails = buildRailIndex(nodes);
    if (sockets.size === 0 && rails.size === 0) {
      // Force-refresh board snapshot once to avoid first-drop “stale” placements.
      const board = await ensureBoard(true);
      nodes = mergeUnique(nodes, board.nodes);
      edges = mergeUnique(edges, board.edges);
      sockets = buildSocketIndex(nodes);
      rails = buildRailIndex(nodes);
      if (sockets.size === 0 && rails.size === 0) {
        log("[BreadboardAutoWire] abort: no sockets/rails found in snapshot after refresh");
        return;
      }
    }
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const node = { ...(eventNode || {}) };
    const snapshotNode = nodeById.get(node.id);
    // Merge snapshot data to ensure pins/metadata are present.
    node.data = { ...(snapshotNode?.data || {}), ...(node.data || {}) };
    // Ensure breadboard components keep their intended footprint;
    // if the node already carries a width/height, keep it as-is.
    const ensureSize = (targetWidth, targetHeight) => {
      const w = Number(node.width || snapshotNode?.width);
      const h = Number(node.height || snapshotNode?.height);
      const next = {};
      if (!Number.isFinite(w) || w <= 0) next.width = targetWidth;
      if (!Number.isFinite(h) || h <= 0) next.height = targetHeight;
      return next;
    };
    if (
      typeof node.type === "string" &&
      (node.type.includes("railTapNegative") || node.type.includes("railTapPositive"))
    ) {
      const targetWidth =
        Number(node.width || snapshotNode?.width) || 16;
      const targetHeight =
        Number(node.height || snapshotNode?.height) || 50; // align with renderer/manifest defaults
      const size = ensureSize(targetWidth, targetHeight);
      if (Object.keys(size).length) {
        Object.assign(node, size);
      }
    }
    // Lock position to the actual drop point only.
    node.position = { x: drop.x, y: drop.y };

    const pins = Array.isArray(node?.data?.pins) ? node.data.pins : [];
    const origDrop = { x: drop.x, y: drop.y };

    // Pick the closest socket (column + segment) instead of “column 1” fallback.
    const pickNearest = async () => {
      const nearest = findNearestSocket(nodes, node.position);
      if (nearest?.socket) return nearest;
      // One refresh retry if snapshot was incomplete.
      const board = await ensureBoard(true);
      nodes = mergeUnique(nodes, board.nodes);
      edges = mergeUnique(edges, board.edges);
      sockets = buildSocketIndex(nodes);
      rails = buildRailIndex(nodes);
      return findNearestSocket(nodes, node.position);
    };

    let nearest = await pickNearest();
    if (!nearest || !nearest.socket) {
      log("[BreadboardAutoWire] abort: no nearby socket for drop", {
        node: node.id,
        drop: origDrop
      });
      return;
    }

    const nearestCol = nearest.column;
    const segment =
      nearest.segment ||
      node?.data?.breadboard?.anchor?.segment ||
      (pins.some((p) => normalizeRow(p.row, "top") === "J") ? "bottom" : "top");

    log(
      "[BreadboardAutoWire] placing",
      node.id,
      `pos=(${node.position.x?.toFixed ? node.position.x.toFixed(1) : node.position.x},${node.position.y?.toFixed ? node.position.y.toFixed(1) : node.position.y})`,
      `targetCol=${nearestCol}`,
      `segment=${segment}`,
      {
        dropPoint: origDrop,
        sockets: sockets.size,
        rails: rails.size,
        nearest: {
          socketId: nearest.socket?.id,
          col: nearestCol,
          segment: segment,
          dist: nearest.distance
        }
      }
    );

    const existing = edges.filter(
      (e) => e && (e.source === node.id || e.fromNodeId === node.id)
    );
    if (existing.length > 2) {
      throw new Error(
        `[BreadboardAutoWire] abort: node ${node.id} already has ${existing.length} edges`
      );
    }

    let assignments = buildAssignments(
      node,
      sockets,
      rails,
      { nodes, edges },
      nearestCol,
      segment
    );
    if (!assignments.length) {
      // One retry with a forced board refresh in case the first snapshot was incomplete.
      const board = await ensureBoard(true);
      nodes = mergeUnique(nodes, board.nodes);
      edges = mergeUnique(edges, board.edges);
      sockets = buildSocketIndex(nodes);
      rails = buildRailIndex(nodes);
      assignments = buildAssignments(
        node,
        sockets,
        rails,
        { nodes, edges },
        nearestCol,
        segment
      );
    }
    if (!assignments.length) {
      const socketKeys = Array.from(sockets.keys()).slice(0, 12);
      const railKeys = Array.from(rails.keys()).slice(0, 12);
      const typeCounts = nodes.reduce((acc, n) => {
        if (!n?.type) return acc;
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {});
      log("[BreadboardAutoWire] no assignments derived", {
        node: node.id,
        pins: pins.map((p) => ({
          id: p.id,
          row: p.row,
          segPref: p.segmentPreference,
          seg: p.segment,
          colOff: p.columnOffset
        })),
        nearestCol,
        segment,
        socketKeys,
        railKeys,
        typeCounts,
        drop: origDrop,
        nearest: {
          socketId: nearest.socket?.id,
          col: nearestCol,
          segment: segment,
          dist: nearest.distance
        }
      });
      return;
    }

    const pinState = {};
    assignments.forEach((a) => {
      pinState[a.handle] = {
        row: a.target.row,
        column: a.target.column,
        nodeId: a.target.nodeId,
        targetHandle: "socket",
        segment: a.target.segment
      };
    });

    const breadboard = { ...(node.data?.breadboard || {}) };
    breadboard.anchor = {
      column: assignments[0]?.target?.column || nearestCol,
      segment: assignments[0]?.target?.segment || segment
    };
    breadboard.pinState = pinState;
    breadboard.pendingPlacement = false;

    // Snap to the midpoint of the target sockets we just chose.
    const targetPositions = assignments
      .map((a) => nodeById.get(a.target.nodeId)?.position)
      .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (targetPositions.length > 0) {
      const avgX =
        targetPositions.reduce((sum, p) => sum + p.x, 0) / targetPositions.length;
      const avgY =
        targetPositions.reduce((sum, p) => sum + p.y, 0) / targetPositions.length;
      let snappedY = avgY;
      // If we're snapping to a rail, nudge the body toward the board by half a rail height.
      const railAssignment = assignments.find((a) => {
        const target = nodeById.get(a.target.nodeId);
        return target && target.type === "io.breadboard.sockets:railSocket";
      });
      if (railAssignment) {
        const targetNode = nodeById.get(railAssignment.target.nodeId);
        const railHeight =
          Number(targetNode?.height) ||
          Number(targetNode?.data?.height) ||
          36; // default rail height
        const offset = railHeight / 2;
        snappedY += segment === "top" ? offset : segment === "bottom" ? offset : 0;
      }
      node.position = { x: avgX, y: snappedY };
    }

    // Special-case rail taps: align rail/tap pins with per-band tweaks so the body spans
    // the correct distance without overshooting the rail hole.
    if (
      typeof node.type === "string" &&
      (node.type.includes("railTapNegative") || node.type.includes("railTapPositive"))
    ) {
      const railAssign = assignments.find((a) => a.handle === "rail");
      const tapAssign = assignments.find((a) => a.handle === "tap");
      const railPos =
        railAssign && nodeById.get(railAssign.target.nodeId)?.position;
      // If tap assignment is missing (first drop quirks), synthesize a tap position
      // from the anchor column and expected row (A for top rail, J for bottom rail).
      let tapPos =
        tapAssign && nodeById.get(tapAssign.target.nodeId)?.position;

      if (railPos && (!tapPos || !Number.isFinite(tapPos.x) || !Number.isFinite(tapPos.y))) {
        const anchorCol = breadboard.anchor?.column || nearestCol;
        const isTop = (railAssign?.target?.segment || "").toLowerCase().includes("top") || segment === "top";
        const key = `${isTop ? "A" : "J"}:${anchorCol}:${isTop ? "top" : "bottom"}`;
        const socketId = sockets.get(key);
        if (socketId) {
          const sPos = nodeById.get(socketId)?.position;
          if (sPos && Number.isFinite(sPos.x) && Number.isFinite(sPos.y)) {
            tapPos = sPos;
          }
        }
      }

      if (railPos && Number.isFinite(railPos.x) && Number.isFinite(railPos.y)) {
        const railSegment = (railAssign?.target?.segment || "").toLowerCase();
        const isTopRail = railSegment.includes("top") || segment === "top";

        const desiredHeight = isTopRail ? 32 : 36;
        const offset = isTopRail ? 6 : 10;

        // If we have both positions, center between them; otherwise, anchor on the rail.
        const midX = tapPos && Number.isFinite(tapPos.x) ? (railPos.x + tapPos.x) / 2 : railPos.x;
        const midY = tapPos && Number.isFinite(tapPos.y) ? (railPos.y + tapPos.y) / 2 : railPos.y;

        node.position = { x: midX, y: midY + offset };
        node.height = desiredHeight;
      }
    }

    const updatedData = { ...(node.data || {}), breadboard };
    await toPromise(
      api.updateNode?.(node.id, {
        data: updatedData,
        position: node.position,
        width: node.width,
        height: node.height
      })
    );

    // Hard reset: clear all edges for this node before recreating.
    const purgeAllEdges = async () => {
      let attempts = 0;
      while (attempts < 3) {
        const removed = await deleteEdgesFor(node.id);
        const post = await getSnapshot();
        const still = post.edges.some(
          (e) => e && (e.source === node.id || e.fromNodeId === node.id)
        );
        if (!still || removed === 0) break;
        attempts += 1;
      }
    };
    await purgeAllEdges();
    const dedup = new Map();
    assignments.forEach((a) => {
      if (dedup.size >= 4) return;
      const key = `${a.handle}:${a.target.nodeId}:${a.target.targetHandle}`;
      if (!dedup.has(key)) {
        dedup.set(key, {
          source: node.id,
          sourceHandle: a.handle,
          target: a.target.nodeId,
          targetHandle: a.target.targetHandle || "socket",
          type: "default"
        });
      }
    });
    const intendedEdges = Array.from(dedup.values());
    await createEdges(intendedEdges);

    const pinSummary = assignments
      .map((a) => `${a.handle}->${a.target.row}${a.target.column}`)
      .join(", ");

    // After creating, fetch edges and trim any extras to match intended exactly.
    const reconcileEdges = async () => {
      const snap = await getSnapshot();
      const current = snap.edges.filter(
        (e) => e && (e.source === node.id || e.fromNodeId === node.id)
      );
      const keepKeys = new Set(
        intendedEdges.map(
          (e) =>
            `${e.sourceHandle || e.fromHandle || ""}:${
              e.target || e.toNodeId
            }:${e.targetHandle || e.toHandle || ""}`
        )
      );
      const seen = new Set();
      for (const e of current) {
        const key = `${e.sourceHandle || e.fromHandle || ""}:${
          e.target || e.toNodeId
        }:${e.targetHandle || e.toHandle || ""}`;
        if (!keepKeys.has(key) || seen.has(key)) {
          await toPromise(
            api.deleteEdge ? api.deleteEdge(e.id) : api.removeEdge?.(e.id)
          ).catch(() => Promise.resolve());
        } else {
          seen.add(key);
        }
      }
    };

    await reconcileEdges();
    const finalCheck = (await getSnapshot()).edges.filter(
      (e) => e && (e.source === node.id || e.fromNodeId === node.id)
    );
    const logEdges = finalCheck;
    log(
      "[BreadboardAutoWire] placed",
      node.id,
      `edges=${logEdges.length}`,
      `anchor=${breadboard.anchor.column}:${breadboard.anchor.segment}`,
      `pins=[${pinSummary}]`,
      {
        drop: origDrop,
        snapped: node.position,
        nearestCol
      }
    );
  };

  // Queue drop handling per node to prevent races / duplicate edge creation.
  const enqueueDrop = (node, overridePos) => {
    const id = node?.id;
    if (!id) return Promise.resolve();
    const dropPos =
      overridePos && typeof overridePos.x === "number" && typeof overridePos.y === "number"
        ? { x: overridePos.x, y: overridePos.y }
        : null;
    const last = lastDrop.get(id);
    if (dropPos && last && last.x === dropPos.x && last.y === dropPos.y) {
      // Same coordinates already processed; skip.
      return dropQueue.get(id) || Promise.resolve();
    }

    const run = async () => {
      try {
        await processDrop(node, dropPos);
        if (dropPos) lastDrop.set(id, dropPos);
      } finally {
        if (dropQueue.get(id) === current) {
          dropQueue.delete(id);
        }
      }
    };

    const current = (dropQueue.get(id) || Promise.resolve()).then(run, run);
    dropQueue.set(id, current);
    return current;
  };

  const resolveEventNodes = async (evt = {}) => {
    if (Array.isArray(evt.nodes) && evt.nodes.length) return evt.nodes.filter(Boolean);
    const ids = Array.isArray(evt.nodeIds)
      ? evt.nodeIds
      : evt.nodeId
      ? [evt.nodeId]
      : [];
    if (!ids.length) return [];
    const snap = await getSnapshot();
    return snap.nodes.filter((n) => ids.includes(n.id));
  };

  const handleNodeDragEnd = async (evt = {}) => {
    const nodes = await resolveEventNodes(evt);
    const ids = nodes.map((n) => n?.id).filter(Boolean);
    log("[BreadboardAutoWire] nodeDragEnd", { count: ids.length, ids });
    if (!nodes.length) return;
    const overridePos =
      evt.dropPoint ||
      evt.position ||
      evt.pointer ||
      (evt.pos && typeof evt.pos === "object" ? evt.pos : null);
    for (const n of nodes) {
      try {
        await enqueueDrop(n, overridePos);
      } catch (err) {
        log("[BreadboardAutoWire] drop failed", n?.id, err);
      }
    }
  };

  const subscribe = () => {
    const subs = [];
    const listener = (evt) =>
      handleNodeDragEnd(evt).catch((err) => log("[BreadboardAutoWire] handler error", err));
    if (api.events && typeof api.events.on === "function") {
      subs.push(api.events.on("nodeDragEnd", listener));
      log("[BreadboardAutoWire] subscribed via api.events");
    } else if (typeof window !== "undefined" && window.eventBus?.on) {
      subs.push(window.eventBus.on("nodeDragEnd", listener));
      log("[BreadboardAutoWire] subscribed via window.eventBus");
    } else {
      log("[BreadboardAutoWire] no event bus found; inactive");
    }
    return () => subs.forEach((off) => typeof off === "function" && off());
  };

  const start = () => {
    if (typeof window !== "undefined") {
      if (window.__breadboardAutowireStarted) {
        return;
      }
      window.__breadboardAutowireStarted = true;
      window.__breadboardAutowireActive = VERSION;
    }
    const off = subscribe();
    if (typeof window !== "undefined") {
      window.__breadboardAutowireOff = off;
      window.addEventListener("beforeunload", () => {
        if (typeof off === "function") off();
      });
    }
  };

  start();
})(
  // Prefer the injected API from ScriptRunner if present.
  (typeof api !== "undefined" && api) ||
    window?.graphAPI ||
    window?.runtimeApi ||
    window?.breadboardRuntime
);
