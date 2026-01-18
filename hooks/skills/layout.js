const DEFAULT_SPACING = 60;
const DEFAULT_GRID = 50;
const MAX_COLLISION_SHIFTS = 200;

const ensureArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  return value;
};

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const roundToMultiple = (value, size) => {
  const divisor = size || DEFAULT_GRID;
  if (!Number.isFinite(divisor) || divisor <= 0) return value;
  return Math.round(value / divisor) * divisor;
};

const getNodeSize = (node) => ({
  width: toNumber(node?.width ?? node?.data?.width, DEFAULT_SPACING),
  height: toNumber(node?.height ?? node?.data?.height, DEFAULT_SPACING)
});

const getNodePosition = (node, overrides) => {
  const fallback = { x: 0, y: 0 };
  const current = overrides?.get(node.id) || node.position || fallback;
  return {
    x: toNumber(current.x, 0),
    y: toNumber(current.y, 0)
  };
};

const rectsOverlap = (a, b, padding = 1) => {
  if (!a || !b) return false;
  return !(
    a.x + a.width + padding <= b.x ||
    a.x >= b.x + b.width + padding ||
    a.y + a.height + padding <= b.y ||
    a.y >= b.y + b.height + padding
  );
};

const buildBoundingRect = (node, overrides) => {
  const pos = getNodePosition(node, overrides);
  const size = getNodeSize(node);
  return {
    id: node.id,
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height
  };
};

const clampToGroups = (node, nextPos, groupBounds) => {
  if (!Array.isArray(groupBounds) || groupBounds.length === 0) {
    return nextPos;
  }

  const size = getNodeSize(node);
  let clamped = { ...nextPos };

  groupBounds.forEach((bounds) => {
    if (!bounds) return;
    const minX = bounds.x;
    const maxX = bounds.x + bounds.width - size.width;
    const minY = bounds.y;
    const maxY = bounds.y + bounds.height - size.height;
    clamped.x = Math.max(minX, Math.min(maxX, clamped.x));
    clamped.y = Math.max(minY, Math.min(maxY, clamped.y));
  });

  return clamped;
};

const mapNodeGroups = (groups = []) => {
  const nodeToBounds = new Map();
  groups.forEach((group) => {
    if (!group || !Array.isArray(group.nodeIds) || !group.bounds) return;
    group.nodeIds.forEach((nodeId) => {
      if (!nodeToBounds.has(nodeId)) nodeToBounds.set(nodeId, []);
      nodeToBounds.get(nodeId).push({
        x: toNumber(group.bounds.x, 0),
        y: toNumber(group.bounds.y, 0),
        width: toNumber(group.bounds.width, 0),
        height: toNumber(group.bounds.height, 0)
      });
    });
  });
  return nodeToBounds;
};

const applyPositionUpdates = (graphAPI, updates, dryRun) => {
  if (dryRun) {
    return {
      success: true,
      data: { nodes: updates }
    };
  }

  const applied = [];
  updates.forEach(({ id, position }) => {
    if (!id || !position) return;
    const result = graphAPI.updateNode(id, { position });
    if (result?.success) {
      applied.push(id);
    }
  });

  return {
    success: true,
    data: { updated: applied }
  };
};

const runAutoLayout = async ({ eventBus }, params = {}) => {
  if (!eventBus) {
    return { success: false, error: 'No event bus available for layout skill' };
  }

  if (params.dryRun) {
    return {
      success: true,
      data: {
        action: 'applyLayout',
        layoutType: params.layoutType || null
      }
    };
  }

  try {
    eventBus.emit('edgeIntentCaptured', {
      trigger: 'applyLayout',
      layoutType: params.layoutType || undefined,
      timestamp: new Date().toISOString(),
      source: 'skill.layout.autoLayout'
    });
  } catch (err) {
    return { success: false, error: err?.message || 'Failed to emit auto-layout intent' };
  }

  return {
    success: true,
    data: { queued: true }
  };
};

const runRerouteEdges = async ({ eventBus }, params = {}) => {
  if (!eventBus) {
    return { success: false, error: 'No event bus available for reroute skill' };
  }

  if (params.dryRun) {
    return {
      success: true,
      data: { action: 'rerouteEdges' }
    };
  }

  try {
    eventBus.emit('edgeIntentCaptured', {
      trigger: 'toolbarReroute',
      timestamp: new Date().toISOString(),
      source: 'skill.layout.rerouteEdges'
    });
  } catch (err) {
    return { success: false, error: err?.message || 'Failed to emit reroute intent' };
  }

  return {
    success: true,
    data: { queued: true }
  };
};

const resolveCollisionShift = ({
  graphAPI,
  nodeIds,
  axis,
  spacing,
  lockedIds
}) => {
  const nodes = graphAPI.getNodes?.() || [];
  const groups = graphAPI.getGroups?.() || [];
  const nodeSet = new Set(nodeIds);
  const lockedSet = new Set(lockedIds || []);
  const overrides = new Map();
  const nodeBoundsMap = mapNodeGroups(groups);

  const others = nodes.filter((node) => !nodeSet.has(node.id)).map((node) => buildBoundingRect(node, null));

  const ordered = nodes
    .filter((node) => nodeSet.has(node.id))
    .sort((a, b) => {
      const posA = getNodePosition(a, null);
      const posB = getNodePosition(b, null);
      return axis === 'x' ? posA.x - posB.x || posA.y - posB.y : posA.y - posB.y || posA.x - posB.x;
    });

  const updates = [];

  ordered.forEach((node) => {
    const originalPos = getNodePosition(node, overrides);
    let nextPos = { ...originalPos };

    if (lockedSet.has(node.id)) {
      overrides.set(node.id, nextPos);
      return;
    }

    const size = getNodeSize(node);
    const groupBounds = nodeBoundsMap.get(node.id) || [];
    let shiftCount = 0;

    const collides = () => {
      const candidateRect = {
        x: nextPos.x,
        y: nextPos.y,
        width: size.width,
        height: size.height
      };
      const allRectangles = [
        ...others,
        ...ordered
          .filter((other) => other.id !== node.id)
          .map((other) => buildBoundingRect(other, overrides))
      ];
      return allRectangles.some((rect) => rect && rect.id !== node.id && rectsOverlap(candidateRect, rect));
    };

    while (collides() && shiftCount < MAX_COLLISION_SHIFTS) {
      if (axis === 'x') {
        nextPos.x += spacing;
      } else {
        nextPos.y += spacing;
      }
      nextPos = clampToGroups(node, nextPos, groupBounds);
      shiftCount += 1;
    }

    if (shiftCount >= MAX_COLLISION_SHIFTS) {
      throw new Error(`Unable to resolve collisions for node ${node.id} within ${MAX_COLLISION_SHIFTS} iterations`);
    }

    if (nextPos.x !== originalPos.x || nextPos.y !== originalPos.y) {
      updates.push({ id: node.id, position: nextPos });
    }
    overrides.set(node.id, nextPos);
    others.push({
      id: node.id,
      x: nextPos.x,
      y: nextPos.y,
      width: size.width,
      height: size.height
    });
  });

  return updates;
};

const runAvoidCollisions = async ({ graphAPI }, params = {}) => {
  if (!graphAPI?.getNodes) {
    return { success: false, error: 'Graph API unavailable for collision avoidance' };
  }

  const allNodes = graphAPI.getNodes() || [];
  const targetIds = params.nodeIds && params.nodeIds.length ? params.nodeIds : allNodes.map((node) => node.id);
  const axis = params.axis === 'x' ? 'x' : 'y';
  const spacing = toNumber(params.spacing, DEFAULT_SPACING);
  const lockedIds = Array.isArray(params.lockedNodeIds) ? params.lockedNodeIds : [];

  if (!targetIds.length) {
    return { success: false, error: 'No nodes available for collision resolution' };
  }

  let updates;
  try {
    updates = resolveCollisionShift({
      graphAPI,
      nodeIds: targetIds,
      axis,
      spacing,
      lockedIds
    });
  } catch (error) {
    return { success: false, error: error?.message || 'Collision avoidance failed' };
  }

  if (updates.length === 0) {
    return { success: true, data: { updated: [] } };
  }

  return applyPositionUpdates(graphAPI, updates, params.dryRun === true);
};

const alignNodes = ({
  graphAPI,
  nodeIds,
  mode
}) => {
  const nodes = graphAPI.getNodes?.() || [];
  const nodeSet = new Set(nodeIds);
  const selected = nodes.filter((node) => nodeSet.has(node.id));
  if (!selected.length) return [];

  const rects = selected.map((node) => buildBoundingRect(node, null));
  const bounds = {
    minX: Math.min(...rects.map((rect) => rect.x)),
    maxX: Math.max(...rects.map((rect) => rect.x + rect.width)),
    minY: Math.min(...rects.map((rect) => rect.y)),
    maxY: Math.max(...rects.map((rect) => rect.y + rect.height))
  };
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const updates = [];
  rects.forEach((rect) => {
    const node = selected.find((item) => item.id === rect.id);
    if (!node) return;
    let target = { x: rect.x, y: rect.y };
    switch (mode) {
      case 'left':
        target.x = bounds.minX;
        break;
      case 'right':
        target.x = bounds.maxX - rect.width;
        break;
      case 'center-horizontal':
        target.x = centerX - rect.width / 2;
        break;
      case 'top':
        target.y = bounds.minY;
        break;
      case 'bottom':
        target.y = bounds.maxY - rect.height;
        break;
      case 'center-vertical':
        target.y = centerY - rect.height / 2;
        break;
      default:
        break;
    }
    if (target.x !== rect.x || target.y !== rect.y) {
      updates.push({ id: node.id, position: target });
    }
  });

  return updates;
};

const distributeNodes = ({
  graphAPI,
  nodeIds,
  axis
}) => {
  const nodes = graphAPI.getNodes?.() || [];
  const nodeSet = new Set(nodeIds);
  const selected = nodes.filter((node) => nodeSet.has(node.id));
  if (selected.length <= 2) return [];

  const metrics = selected.map((node) => {
    const rect = buildBoundingRect(node, null);
    return {
      id: node.id,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + rect.height / 2,
      width: rect.width,
      height: rect.height,
      rect
    };
  });

  const sorted = [...metrics].sort((a, b) => axis === 'horizontal' ? a.centerX - b.centerX : a.centerY - b.centerY);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = axis === 'horizontal'
    ? last.centerX - first.centerX
    : last.centerY - first.centerY;

  if (Math.abs(span) < 0.0001) {
    return [];
  }

  const step = span / (sorted.length - 1);
  const updates = [];

  sorted.forEach((item, index) => {
    if (index === 0 || index === sorted.length - 1) return;
    const targetCenter = axis === 'horizontal'
      ? first.centerX + step * index
      : first.centerY + step * index;
    const rect = item.rect;
    const target = {
      x: axis === 'horizontal' ? targetCenter - rect.width / 2 : rect.x,
      y: axis === 'vertical' ? targetCenter - rect.height / 2 : rect.y
    };
    if (target.x !== rect.x || target.y !== rect.y) {
      updates.push({ id: item.id, position: target });
    }
  });

  return updates;
};

const runAlignDistribute = async ({ graphAPI, eventBus }, params = {}) => {
  if (params.mode === 'grid') {
    if (params.dryRun) {
      return { success: true, data: { action: 'alignToGrid' } };
    }
    if (!eventBus) {
      return { success: false, error: 'Grid alignment requires event bus' };
    }
    eventBus.emit('alignToGrid');
    return { success: true, data: { queued: true } };
  }

  if (!graphAPI?.getNodes) {
    return { success: false, error: 'Graph API unavailable for alignment' };
  }

  const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
  const mode = params.mode || 'left';
  let updates = [];

  if (mode === 'horizontal' || mode === 'vertical') {
    updates = distributeNodes({
      graphAPI,
      nodeIds,
      axis: mode === 'horizontal' ? 'horizontal' : 'vertical'
    });
  } else {
    updates = alignNodes({
      graphAPI,
      nodeIds,
      mode
    });
  }

  if (!updates.length) {
    return { success: true, data: { updated: [] } };
  }

  return applyPositionUpdates(graphAPI, updates, params.dryRun === true);
};

const normalizeSpacing = ({
  graphAPI,
  nodeIds,
  axis,
  spacing,
  lockedIds
}) => {
  const nodes = graphAPI.getNodes?.() || [];
  const nodeSet = new Set(nodeIds);
  const lockedSet = new Set(Array.isArray(lockedIds) ? lockedIds : []);
  const selected = nodes.filter((node) => nodeSet.has(node.id));
  if (!selected.length) return [];

  const sorted = [...selected].sort((a, b) => {
    const posA = getNodePosition(a, null);
    const posB = getNodePosition(b, null);
    return axis === 'x' ? posA.x - posB.x : posA.y - posB.y;
  });

  let currentCoordinate = null;
  const updates = [];

  sorted.forEach((node, index) => {
    const pos = getNodePosition(node, null);
    if (lockedSet.has(node.id)) {
      currentCoordinate = axis === 'x' ? pos.x : pos.y;
      return;
    }
    if (currentCoordinate === null) {
      const snapped = roundToMultiple(axis === 'x' ? pos.x : pos.y, spacing);
      currentCoordinate = snapped;
    } else {
      currentCoordinate += spacing;
    }
    const target = axis === 'x'
      ? { x: currentCoordinate, y: pos.y }
      : { x: pos.x, y: currentCoordinate };
    if (target.x !== pos.x || target.y !== pos.y) {
      updates.push({ id: node.id, position: target });
    }
  });

  return updates;
};

const runNormalizeSpacing = async ({ graphAPI }, params = {}) => {
  if (!graphAPI?.getNodes) {
    return { success: false, error: 'Graph API unavailable for spacing normalization' };
  }

  const nodeIds = ensureArray(params.nodeIds, 'nodeIds');
  const axis = params.axis === 'x' ? 'x' : 'y';
  const spacing = toNumber(params.spacing, DEFAULT_GRID);

  const updates = normalizeSpacing({
    graphAPI,
    nodeIds,
    axis,
    spacing,
    lockedIds: params.lockedNodeIds
  });

  if (!updates.length) {
    return { success: true, data: { updated: [] } };
  }

  return applyPositionUpdates(graphAPI, updates, params.dryRun === true);
};

export const layoutSkills = [
  {
    id: 'layout.autoLayout',
    title: 'Auto-Layout (ELK)',
    description: 'Recompute spatial arrangement for clarity using ELK.',
    category: 'layout',
    supportsDryRun: true,
    run: runAutoLayout,
    contracts: {
      inputs: ['layoutType?'],
      forbidden: ['Mutating node identity or semantics']
    }
  },
  {
    id: 'layout.rerouteEdges',
    title: 'Reroute Edges',
    description: 'Recompute edge routes without changing endpoints.',
    category: 'layout',
    supportsDryRun: true,
    run: runRerouteEdges,
    contracts: {
      inputs: [],
      forbidden: ['Changing edge endpoints or handles']
    }
  },
  {
    id: 'layout.avoidCollisions',
    title: 'Avoid Collisions',
    description: 'Resolve overlapping nodes using incremental shifts.',
    category: 'layout',
    supportsDryRun: true,
    run: runAvoidCollisions,
    contracts: {
      inputs: ['nodeIds?', 'axis?', 'spacing?', 'lockedNodeIds?'],
      forbidden: ['Crossing group boundaries', 'Teleporting nodes across large distances']
    }
  },
  {
    id: 'layout.alignDistribute',
    title: 'Align / Distribute',
    description: 'Align or distribute nodes for readability.',
    category: 'layout',
    supportsDryRun: true,
    run: runAlignDistribute,
    contracts: {
      inputs: ['mode', 'nodeIds[]'],
      forbidden: ['Inferring targets without explicit node ids']
    }
  },
  {
    id: 'layout.normalizeSpacing',
    title: 'Normalize Spacing',
    description: 'Enforce consistent spacing across a selection.',
    category: 'layout',
    supportsDryRun: true,
    run: runNormalizeSpacing,
    contracts: {
      inputs: ['nodeIds[]', 'axis', 'spacing?', 'lockedNodeIds?'],
      forbidden: ['Mutating locked nodes', 'Changing ordering']
    }
  }
];

