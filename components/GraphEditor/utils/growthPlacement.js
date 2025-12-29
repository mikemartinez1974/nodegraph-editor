const DEFAULT_NODE_SIZE = { width: 200, height: 120 };

function getNodeSize(node) {
  const width = Number(node?.width);
  const height = Number(node?.height);
  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_NODE_SIZE.width,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_NODE_SIZE.height
  };
}

function getNodeRect(node) {
  const size = getNodeSize(node);
  const x = Number(node?.position?.x) || 0;
  const y = Number(node?.position?.y) || 0;
  return { x, y, width: size.width, height: size.height };
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getRectsBounds(rects) {
  if (!Array.isArray(rects) || rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  rects.forEach((r) => {
    if (!r) return;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  });
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function computeSuggestedAnchorFromEdges({
  clusterNodeIds,
  nodesById,
  edges,
  direction,
  gapPx
}) {
  const dir = String(direction || 'DOWN').toUpperCase() === 'RIGHT' ? 'RIGHT' : 'DOWN';
  const clusterSet = new Set(clusterNodeIds || []);
  const suggestions = [];

  (edges || []).forEach((edge) => {
    if (!edge) return;
    const source = edge.source;
    const target = edge.target;
    const sourceIn = clusterSet.has(source);
    const targetIn = clusterSet.has(target);
    if (sourceIn === targetIn) return; // only crossing edges

    const fixedId = sourceIn ? target : source;
    const movingId = sourceIn ? source : target;
    const fixedNode = nodesById.get(fixedId);
    const movingNode = nodesById.get(movingId);
    if (!fixedNode || !movingNode) return;

    const fixedRect = getNodeRect(fixedNode);
    const movingSize = getNodeSize(movingNode);
    const fixedCenter = {
      x: fixedRect.x + fixedRect.width / 2,
      y: fixedRect.y + fixedRect.height / 2
    };

    const wantsAfter = !sourceIn; // fixed -> moving if source is fixed
    const sign = wantsAfter ? 1 : -1;
    const offset =
      dir === 'RIGHT'
        ? { x: sign * (fixedRect.width / 2 + movingSize.width / 2 + gapPx), y: 0 }
        : { x: 0, y: sign * (fixedRect.height / 2 + movingSize.height / 2 + gapPx) };

    suggestions.push({ x: fixedCenter.x + offset.x, y: fixedCenter.y + offset.y });
  });

  if (suggestions.length === 0) return null;
  const sum = suggestions.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / suggestions.length, y: sum.y / suggestions.length };
}

function findNearestNonOverlappingOffset(clusterRects, obstacleRects, stepPx, maxRadiusSteps) {
  const step = Number(stepPx) || 40;
  const maxR = Number(maxRadiusSteps) || 30;

  const isValid = (dx, dy) => {
    const moved = clusterRects.map((r) => ({
      ...r,
      x: r.x + dx,
      y: r.y + dy
    }));
    for (const m of moved) {
      for (const o of obstacleRects) {
        if (rectsOverlap(m, o)) return false;
      }
    }
    return true;
  };

  if (isValid(0, 0)) return { dx: 0, dy: 0 };

  for (let r = 1; r <= maxR; r += 1) {
    // square "spiral" rings
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only ring perimeter
        const ox = dx * step;
        const oy = dy * step;
        if (isValid(ox, oy)) return { dx: ox, dy: oy };
      }
    }
  }

  // fallback: shove down-right
  return { dx: maxR * step, dy: maxR * step };
}

export function placeNodesIncrementally({
  nodes,
  edges,
  groups,
  lockedNodeIds,
  nodeIdsToPlace,
  pointer,
  direction,
  paddingPx = 120,
  gapPx = 80,
  stepPx = 40
}) {
  const ids = Array.isArray(nodeIdsToPlace) ? nodeIdsToPlace.filter(Boolean) : [];
  if (!Array.isArray(nodes) || ids.length === 0) return { nodes, movedNodeIds: [] };

  const clusterSet = new Set(ids);
  const nodesById = new Map(nodes.map((n) => [n?.id, n]));

  const movingNodes = ids.map((id) => nodesById.get(id)).filter(Boolean);
  if (movingNodes.length === 0) return { nodes, movedNodeIds: [] };

  const fixedNodes = nodes.filter((n) => n?.id && !clusterSet.has(n.id));
  const lockedSet =
    lockedNodeIds instanceof Set ? lockedNodeIds : new Set(Array.isArray(lockedNodeIds) ? lockedNodeIds : []);

  const obstacleRects = [
    ...fixedNodes.map(getNodeRect),
    ...fixedNodes.filter((n) => lockedSet.has(n.id)).map(getNodeRect)
  ];

  // Treat groups as obstacles when they have meaningful bounds.
  (groups || []).forEach((g) => {
    const b = g?.bounds;
    if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return;
    const width = Number(b.width) || 0;
    const height = Number(b.height) || 0;
    if (width <= 1 || height <= 1) return;
    obstacleRects.push({ x: b.x, y: b.y, width, height });
  });

  const clusterRects = movingNodes.map(getNodeRect);
  const clusterBounds = getRectsBounds(clusterRects);
  if (!clusterBounds) return { nodes, movedNodeIds: [] };

  const anchorFromEdges = computeSuggestedAnchorFromEdges({
    clusterNodeIds: ids,
    nodesById,
    edges,
    direction,
    gapPx
  });

  const anchor =
    anchorFromEdges ||
    (pointer && pointer.inside ? { x: Number(pointer.x) || 0, y: Number(pointer.y) || 0 } : null) ||
    { x: clusterBounds.x + clusterBounds.width / 2, y: clusterBounds.y + clusterBounds.height / 2 };

  const desiredTopLeft = {
    x: anchor.x - clusterBounds.width / 2,
    y: anchor.y - clusterBounds.height / 2
  };

  const initialDx = desiredTopLeft.x - clusterBounds.x;
  const initialDy = desiredTopLeft.y - clusterBounds.y;

  const paddedObstacleRects = obstacleRects.map((r) => ({
    x: r.x - paddingPx,
    y: r.y - paddingPx,
    width: r.width + paddingPx * 2,
    height: r.height + paddingPx * 2
  }));

  const movedClusterRects = clusterRects.map((r) => ({
    ...r,
    x: r.x + initialDx,
    y: r.y + initialDy
  }));

  const offset = findNearestNonOverlappingOffset(
    movedClusterRects,
    paddedObstacleRects,
    stepPx,
    30
  );

  const dx = initialDx + offset.dx;
  const dy = initialDy + offset.dy;

  const updated = nodes.map((n) => {
    if (!n?.id || !clusterSet.has(n.id)) return n;
    const x = Number(n?.position?.x) || 0;
    const y = Number(n?.position?.y) || 0;
    return {
      ...n,
      position: { x: x + dx, y: y + dy }
    };
  });

  return { nodes: updated, movedNodeIds: ids };
}

