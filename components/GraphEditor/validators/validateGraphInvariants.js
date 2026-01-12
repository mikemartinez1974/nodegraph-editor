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

export function validateGraphInvariants({ nodes = [], edges = [], edgeRoutes = {} }) {
  const nodeMap = new Map();
  nodes.forEach((node) => {
    if (node?.id) {
      nodeMap.set(node.id, node);
    }
  });

  const errors = [];
  const warnings = [];

  const findHandle = (node, handleId) => {
    if (!handleId || !node) return undefined;
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
