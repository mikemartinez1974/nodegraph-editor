"use client";

const TOLERANCE = 4;

const toNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const getNodeBounds = (node) => {
  const xBase = toNumber(node.position?.x ?? node.x);
  const yBase = toNumber(node.position?.y ?? node.y);
  const width = toNumber(node.width ?? node.data?.width);
  const height = toNumber(node.height ?? node.data?.height);
  return {
    left: xBase,
    top: yBase,
    right: xBase + Math.max(width, 0),
    bottom: yBase + Math.max(height, 0)
  };
};

const portSideMatchesPoint = (side, bounds, point) => {
  if (!side || !bounds || !point) return true;
  const { left, right, top, bottom } = bounds;
  switch (side) {
    case "left":
      return point.x >= left - TOLERANCE && point.x <= left + TOLERANCE;
    case "right":
      return point.x >= right - TOLERANCE && point.x <= right + TOLERANCE;
    case "top":
      return point.y >= top - TOLERANCE && point.y <= top + TOLERANCE;
    case "bottom":
      return point.y >= bottom - TOLERANCE && point.y <= bottom + TOLERANCE;
    default:
      return true;
  }
};

const BANNED_ROUTE_KEYS = [
  "sections",
  "metadata",
  "bend",
  "collision",
  "avoidance",
  "style",
  "rounded",
  "curve",
  "glow",
  "animation",
  "decorations"
];

export function validateGraphInvariants({
  nodes = [],
  edges = [],
  edgeRoutes = {},
  clusters = [],
  mode = 'mutation'
}) {
  const nodeMap = new Map();
  nodes.forEach((node) => {
    if (node?.id) {
      nodeMap.set(node.id, node);
    }
  });

  const errors = [];
  const warnings = [];

  const clusterList = Array.isArray(clusters) ? clusters : [];
  const nodeClusterMap = new Map();
  clusterList.forEach((cluster) => {
    if (!cluster?.id || !Array.isArray(cluster.nodeIds)) return;
    cluster.nodeIds.forEach((nodeId) => {
      if (!nodeClusterMap.has(nodeId)) {
        nodeClusterMap.set(nodeId, cluster.id);
      }
    });
  });

  const manifestNodes = nodes.filter((node) => node?.type === 'manifest');
  if (manifestNodes.length === 0) {
    const entry = {
      code: 'MANIFEST_COUNT_INVALID',
      message: 'Manifest missing: graph mutations are blocked.'
    };
    if (mode === 'load') {
      warnings.push(entry);
    } else {
      errors.push(entry);
    }
  }

  const manifestByCluster = new Map();
  const rootManifests = [];
  manifestNodes.forEach((manifest) => {
    const clusterId = nodeClusterMap.get(manifest.id) || null;
    if (clusterId) {
      if (manifestByCluster.has(clusterId)) {
        warnings.push({
          code: 'MANIFEST_MULTIPLE_IN_CLUSTER',
          message: `Multiple manifest nodes found in cluster "${clusterId}". Using the first one.`
        });
        return;
      }
      manifestByCluster.set(clusterId, manifest);
    } else {
      rootManifests.push(manifest);
    }
  });
  if (rootManifests.length > 1) {
    warnings.push({
      code: 'MANIFEST_MULTIPLE_ROOT',
      message: 'Multiple root manifest nodes found. Using the first one.'
    });
  }

  const dictionaryNodes = nodes.filter((node) => node?.type === 'dictionary');
  const dictionaryByCluster = new Map();
  const rootDictionaries = [];
  dictionaryNodes.forEach((dictionary) => {
    const clusterId = nodeClusterMap.get(dictionary.id) || null;
    if (clusterId) {
      if (!dictionaryByCluster.has(clusterId)) dictionaryByCluster.set(clusterId, dictionary);
    } else {
      rootDictionaries.push(dictionary);
    }
  });

  const resolveDictionaryForManifest = (manifest) => {
    if (!manifest) return null;
    const clusterId = nodeClusterMap.get(manifest.id) || null;
    if (clusterId && dictionaryByCluster.has(clusterId)) {
      return dictionaryByCluster.get(clusterId);
    }
    return rootDictionaries[0] || null;
  };

  const resolveEntries = (dictionary) => {
    const nodeDefs = Array.isArray(dictionary?.data?.nodeDefs) ? dictionary.data.nodeDefs : [];
    const views = Array.isArray(dictionary?.data?.views) ? dictionary.data.views : [];
    const entryByKey = new Map();
    nodeDefs.forEach((entry) => {
      const key = entry?.key || entry?.type || entry?.nodeType;
      if (typeof key === 'string' && key.trim()) {
        entryByKey.set(key.trim(), entry);
      }
    });
    const viewByKey = new Map();
    views.forEach((entry) => {
      const key = entry?.key || entry?.type || entry?.nodeType;
      if (typeof key === 'string' && key.trim()) {
        const list = viewByKey.get(key.trim()) || [];
        list.push(entry);
        viewByKey.set(key.trim(), list);
      }
    });
    return { entryByKey, viewByKey };
  };

  const manifestsToValidate = manifestNodes.length ? manifestNodes : [];
  manifestsToValidate.forEach((manifest) => {
    const dependencyTypes = Array.isArray(manifest?.data?.dependencies?.nodeTypes)
      ? manifest.data.dependencies.nodeTypes.filter((value) => typeof value === 'string' && value.trim())
      : [];
    if (dependencyTypes.length === 0) return;

    const dictionary = resolveDictionaryForManifest(manifest);
    if (!dictionary) {
      warnings.push({
        code: 'DICTIONARY_REQUIRED',
        message: 'Dictionary required: manifest declares node type dependencies.'
      });
      return;
    }

    const { entryByKey, viewByKey } = resolveEntries(dictionary);
    dependencyTypes.forEach((nodeType) => {
      const entry = entryByKey.get(nodeType);
      if (!entry) {
        warnings.push({
          code: 'DICTIONARY_MISSING_ENTRY',
          message: `Dictionary missing entry for required node type "${nodeType}".`
        });
        return;
      }
      const filePath = entry?.ref || entry?.file || entry?.path;
      if (typeof filePath !== 'string' || filePath.trim().length === 0) {
        warnings.push({
          code: 'DICTIONARY_MISSING_FILE',
          message: `Dictionary entry "${nodeType}" should reference a .node file.`
        });
      }
      const views = viewByKey.get(nodeType) || [];
      if (!views.length) {
        warnings.push({
          code: 'DICTIONARY_MISSING_VIEW',
          message: `Dictionary missing view entry for node type "${nodeType}".`
        });
      }
    });
  });

  const findHandle = (node, handleId) => {
    if (!handleId || !node) return undefined;
    if (handleId === 'root') {
      return { id: 'root' };
    }
    const handles = Array.isArray(node.handles) ? node.handles : [];
    return handles.find((handle) => handle?.id === handleId);
  };

  const checkRouteMetadata = (route, edgeId) => {
    if (!route) return;
    Object.keys(route).forEach((key) => {
      const normalized = key.toLowerCase();
      if (
        normalized === "points" ||
        normalized === "route" ||
        normalized.startsWith("x") ||
        normalized.startsWith("y")
      ) {
        return;
      }
      if (BANNED_ROUTE_KEYS.some((banned) => normalized.includes(banned))) {
        errors.push({
          code: "FORBIDDEN_ROUTE_METADATA",
          message: `Route for edge "${edgeId}" includes forbidden metadata "${key}".`,
          edgeId
        });
      }
    });
  };

  edges.forEach((edge) => {
    if (!edge || !edge.id) return;
    const sourceNode = edge.source ? nodeMap.get(edge.source) : undefined;
    const targetNode = edge.target ? nodeMap.get(edge.target) : undefined;

    [
      { handleId: edge.sourceHandle, node: sourceNode, nodeType: "source" },
      { handleId: edge.targetHandle, node: targetNode, nodeType: "target" }
    ].forEach(({ handleId, node, nodeType }) => {
      if (!handleId) return;
      if (!node) {
        errors.push({
          code: "NODE_NOT_FOUND",
          message: `Edge "${edge.id}" references ${nodeType} node "${nodeType === "source" ? edge.source : edge.target}" but it does not exist.`,
          edgeId: edge.id
        });
        return;
      }

      const handle = findHandle(node, handleId);
      if (!handle) {
        errors.push({
          code: "HANDLE_NOT_FOUND",
          message: `Edge "${edge.id}" references missing ${nodeType} handle "${handleId}".`,
          edgeId: edge.id,
          nodeId: node.id
        });
        return;
      }

      const side = handle.position?.side;
      const routePoints = edgeRoutes?.[edge.id]?.points;
      if (side && node && Array.isArray(routePoints) && routePoints.length > 0) {
        const bounds = getNodeBounds(node);
        const startPoint = routePoints[0];
        if (!portSideMatchesPoint(side, bounds, startPoint)) {
          warnings.push({
            code: "PORT_SIDE_MISMATCH",
            message: `Edge "${edge.id}" does not start on the ${side} side.`,
            edgeId: edge.id,
            nodeId: node.id
          });
        }
      }
    });

    checkRouteMetadata(edgeRoutes?.[edge.id], edge.id);
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
