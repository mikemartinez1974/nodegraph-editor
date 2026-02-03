import { useState, useEffect, useCallback, useRef } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import { DEFAULT_ELK_ROUTING_SETTINGS, ELK_EDGE_ROUTING_OPTIONS } from '../layoutSettings';

let elkInstance = null;
let elkNoWorkerInstance = null;
const getElk = async () => {
  if (elkInstance) return elkInstance;
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  if (typeof window !== 'undefined' && window.__Twilite_ELK_WORKER_URL__) {
    try {
      elkInstance = new ELK({ workerUrl: window.__Twilite_ELK_WORKER_URL__ });
      return elkInstance;
    } catch {
      // fall through to default worker resolution
    }
  }
  const workerUrl = new URL('elkjs/lib/elk-worker.min.js', import.meta.url);
  elkInstance = new ELK({ workerUrl: workerUrl.toString() });
  return elkInstance;
};
const getElkNoWorker = async () => {
  if (elkNoWorkerInstance) return elkNoWorkerInstance;
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  elkNoWorkerInstance = new ELK();
  return elkNoWorkerInstance;
};

const getNodeSize = (node) => ({
  width: Number(node?.width) || 200,
  height: Number(node?.height) || 120
});

const VALID_ELK_ROUTING_VALUES = new Set(ELK_EDGE_ROUTING_OPTIONS.map((option) => option.value.toUpperCase()));

const getElkSettings = (layoutSettings = {}, edgeRouting = 'auto') => {
  const base = { ...DEFAULT_ELK_ROUTING_SETTINGS, ...(layoutSettings?.elk || {}) };
  const normalizedRouting = typeof edgeRouting === 'string' ? edgeRouting.trim().toUpperCase() : '';
  if (normalizedRouting && normalizedRouting !== 'AUTO' && VALID_ELK_ROUTING_VALUES.has(normalizedRouting)) {
    base.edgeRouting = normalizedRouting;
  }
  return base;
};

const buildElkLayoutOptions = (settings = {}) => {
  return {
    'elk.algorithm': settings.algorithm,
    'elk.edgeRouting': settings.edgeRouting,
    'elk.portConstraints': settings.portConstraints,
    ...(Number.isFinite(Number(settings.nodeSpacing)) ? { 'elk.spacing.nodeNode': Number(settings.nodeSpacing) } : {}),
    ...(Number.isFinite(Number(settings.layeredEdgeSpacing))
      ? { 'elk.layered.spacing.edgeNodeBetweenLayers': Number(settings.layeredEdgeSpacing) }
      : {})
  };
};

const getBoundsFromPositions = (positions = [], sizeMap = {}) => {
  if (!positions.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  positions.forEach((pos) => {
    const size = sizeMap[pos.id] || { width: 0, height: 0 };
    const left = pos.x;
    const top = pos.y;
    const right = left + size.width;
    const bottom = top + size.height;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, bottom);
  });
  return { minX, minY, maxX, maxY };
};

const getCycleInfo = (nodeIds = [], edges = []) => {
  const ids = Array.isArray(nodeIds) ? nodeIds : [];
  if (ids.length === 0) return { hasCycle: false, largestSccSize: 0, sccCount: 0 };

  const nodeIdSet = new Set(ids);
  const adjacency = new Map();
  ids.forEach((id) => adjacency.set(id, []));
  (edges || []).forEach((edge) => {
    const source = edge?.source;
    const target = edge?.target;
    if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) return;
    adjacency.get(source).push(target);
  });

  // Tarjan SCC
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowlink = new Map();
  const sccs = [];

  const strongConnect = (v) => {
    indices.set(v, index);
    lowlink.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    const neighbors = adjacency.get(v) || [];
    neighbors.forEach((w) => {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), indices.get(w)));
      }
    });

    if (lowlink.get(v) === indices.get(v)) {
      const scc = [];
      while (stack.length) {
        const w = stack.pop();
        onStack.delete(w);
        scc.push(w);
        if (w === v) break;
      }
      sccs.push(scc);
    }
  };

  ids.forEach((id) => {
    if (!indices.has(id)) strongConnect(id);
  });

  let hasCycle = false;
  let largestSccSize = 0;
  sccs.forEach((scc) => {
    largestSccSize = Math.max(largestSccSize, scc.length);
    if (scc.length > 1) hasCycle = true;
  });
  if (!hasCycle) {
    // Single-node SCC can still be a cycle if there is a self-loop.
    const hasSelfLoop = (edges || []).some((e) => e?.source && e?.target && e.source === e.target && nodeIdSet.has(e.source));
    if (hasSelfLoop) {
      hasCycle = true;
      largestSccSize = Math.max(largestSccSize, 1);
    }
  }
  return { hasCycle, largestSccSize, sccCount: sccs.length };
};

const DEFAULT_GRAPH_MODES_OPTIONS = {
  layoutSettings: null,
  edgeRouting: 'auto',
  setSnackbar: () => {},
  skipRerouteRef: null
};

export default function useGraphModes(options = {}) {
  const {
    nodes,
    setNodes,
    selectedNodeIds,
    edges,
    setEdgeRoutes,
    layoutSettings,
    edgeRouting,
    setSnackbar,
    skipRerouteRef
  } = { ...DEFAULT_GRAPH_MODES_OPTIONS, ...options };
  const [mode, setMode] = useState('manual'); // 'manual' | 'nav' | 'auto'
  const [autoLayoutType, setAutoLayoutType] = useState('hierarchical'); // 'hierarchical' | 'serpentine' | 'radial' | 'grid'
  const velocitiesRef = useRef(new Map()); // Store velocity for each node

  const SERPENTINE_DEFAULT_MAX_PER_ROW = 6;
  const HEAVY_CYCLE_SCC_THRESHOLD = 0.35;
  const HEAVY_CYCLE_MIN_SCC_SIZE = 4;
  const HEAVY_CYCLE_MIN_NODES = 6;

  const layoutDirection = String(layoutSettings?.direction || 'DOWN').toUpperCase() === 'RIGHT'
    ? 'RIGHT'
    : 'DOWN';
  const serpentineMaxPerRow = (() => {
    const value = Number(layoutSettings?.serpentine?.maxPerRow);
    if (!Number.isFinite(value)) return SERPENTINE_DEFAULT_MAX_PER_ROW;
    return Math.max(2, Math.min(50, value));
  })();
  const cycleFallbackEnabled = layoutSettings?.cycleFallback?.enabled !== false;
  const heavyCycleThreshold = (() => {
    const value = Number(layoutSettings?.cycleFallback?.heavySccThreshold);
    if (!Number.isFinite(value)) return HEAVY_CYCLE_SCC_THRESHOLD;
    return Math.max(0.05, Math.min(0.9, value));
  })();
  const heavyCycleMinSccSize = (() => {
    const value = Number(layoutSettings?.cycleFallback?.minSccSize);
    if (!Number.isFinite(value)) return HEAVY_CYCLE_MIN_SCC_SIZE;
    return Math.max(2, Math.min(1000, Math.floor(value)));
  })();
  const heavyCycleMinNodes = (() => {
    const value = Number(layoutSettings?.cycleFallback?.minNodes);
    if (!Number.isFinite(value)) return HEAVY_CYCLE_MIN_NODES;
    return Math.max(3, Math.min(10000, Math.floor(value)));
  })();

const buildElkEdgeRoutes = useCallback((layoutEdges = [], offset = { x: 0, y: 0 }) => {
    const offsetX = Number(offset.x) || 0;
    const offsetY = Number(offset.y) || 0;
    const routeMap = {};
    layoutEdges.forEach((edge) => {
      if (!edge || !edge.id) return;
      const sections = Array.isArray(edge.sections) ? edge.sections : [];
      const points = [];
      const pushPoint = (pt) => {
        if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
        const last = points[points.length - 1];
        const nextPoint = { x: pt.x + offsetX, y: pt.y + offsetY };
        if (last && last.x === nextPoint.x && last.y === nextPoint.y) return;
        points.push(nextPoint);
      };
      sections.forEach((section) => {
        if (!section) return;
        pushPoint(section.startPoint);
        const bends = Array.isArray(section.bendPoints) ? section.bendPoints : [];
        bends.forEach(pushPoint);
        pushPoint(section.endPoint);
      });
      if (points.length >= 2) {
        routeMap[edge.id] = { points };
      }
    });
    return routeMap;
  }, []);

const normalizeSide = (side) => {
  switch (String(side || '').toLowerCase()) {
    case 'left':
      return 'WEST';
    case 'right':
      return 'EAST';
    case 'top':
      return 'NORTH';
    case 'bottom':
      return 'SOUTH';
    default:
      return null;
  }
};

const getHandleRelativePosition = (node, handle) => {
  if (!node || !handle) return null;
  const size = getNodeSize(node);
  const w = size.width;
  const h = size.height;
  const rawSide = handle?.position?.side;
  const side = normalizeSide(rawSide);
  const offset = Number(handle?.position?.offset);
  const t = Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : 0.5;
  if (side === 'WEST') {
    return { x: 0, y: h * t };
  }
  if (side === 'EAST') {
    return { x: w, y: h * t };
  }
  if (side === 'NORTH') {
    return { x: w * t, y: 0 };
  }
  if (side === 'SOUTH') {
    return { x: w * t, y: h };
  }
  return { x: w / 2, y: h / 2 };
};

const buildStraightEdgeRoutes = useCallback((edgeList = [], nodeList = []) => {
  const nodePositionMap = new Map(nodeList.map((node) => [node.id, {
    x: Number(node.position?.x) || 0,
    y: Number(node.position?.y) || 0
  }]));
  const routeMap = {};
  const nodeById = new Map(nodeList.map((node) => [node.id, node]));

  const resolvePoint = (nodeId, handleId) => {
    const node = nodeById.get(nodeId);
    if (!node) return null;
    const base = nodePositionMap.get(nodeId);
    if (!base) return null;
    const handles = Array.isArray(node?.handles) ? node.handles : [];
    const handle = handles.find((h) => h?.id === handleId);
    const relative = handle ? getHandleRelativePosition(node, handle) : { x: getNodeSize(node).width / 2, y: getNodeSize(node).height / 2 };
    return { x: base.x + (relative.x || 0), y: base.y + (relative.y || 0) };
  };

  edgeList.forEach((edge) => {
    if (!edge || !edge.id) return;
    const sourcePoint = resolvePoint(edge.source, edge.sourceHandle);
    const targetPoint = resolvePoint(edge.target, edge.targetHandle);
    if (sourcePoint && targetPoint) {
      routeMap[edge.id] = { points: [sourcePoint, targetPoint] };
    }
  });

  return routeMap;
}, []);

  // Get the center node for nav mode
  const getCenterNode = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      return nodes.find(n => n.id === selectedNodeIds[0]);
    }
    // Fallback to first node or create a virtual center
    return nodes[0] || null;
  }, [nodes, selectedNodeIds]);

  // Force-directed physics simulation for nav mode
  const runPhysicsSimulation = useCallback(() => {
    if (mode !== 'nav' || nodes.length === 0) return;

    const centerNode = getCenterNode();
    if (!centerNode) return;

    // Physics parameters (tuned for springy, responsive behavior)
    const repulsion = 400000; // Strong repulsion keeps nodes apart
    const attraction = 0.08; // Increased attraction for bouncier springs
    const damping = 0.75; // Reduced damping for more movement
    const centerForce = 0.2; // Stronger center pull
    const minDistance = 50; // Minimum distance between nodes
    const maxVelocity = 15; // Increased max velocity for faster movement

    // Calculate forces for each node
    const forces = nodes.map(() => ({ x: 0, y: 0 }));

    nodes.forEach((nodeA, i) => {
      // 1. REPULSION: All nodes push each other away
      nodes.forEach((nodeB, j) => {
        if (i === j) return;
        
        const dx = nodeA.position.x - nodeB.position.x;
        const dy = nodeA.position.y - nodeB.position.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), minDistance);
        
        // Stronger repulsion at close distances
        const force = repulsion / (distance * distance);
        
        forces[i].x += (dx / distance) * force;
        forces[i].y += (dy / distance) * force;
      });

      // 2. ATTRACTION: Edges pull connected nodes together
      edges.forEach(edge => {
        let otherNode = null;
        let isSource = false;

        if (edge.source === nodeA.id) {
          otherNode = nodes.find(n => n.id === edge.target);
          isSource = true;
        } else if (edge.target === nodeA.id) {
          otherNode = nodes.find(n => n.id === edge.source);
          isSource = false;
        }

        if (otherNode) {
          const dx = otherNode.position.x - nodeA.position.x;
          const dy = otherNode.position.y - nodeA.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Spring force proportional to distance
          forces[i].x += dx * attraction;
          forces[i].y += dy * attraction;
        }
      });

      // 3. CENTER FORCE: Keep center node near origin
      if (nodeA.id === centerNode.id) {
        const dx = 0 - nodeA.position.x;
        const dy = 0 - nodeA.position.y;
        forces[i].x += dx * centerForce;
        forces[i].y += dy * centerForce;
      } else {
        // Other nodes gently drift toward center to prevent scatter
        const dx = 0 - nodeA.position.x;
        const dy = 0 - nodeA.position.y;
        forces[i].x += dx * (centerForce * 0.1);
        forces[i].y += dy * (centerForce * 0.1);
      }
    });

    // Apply forces with velocity and damping
    const newNodes = nodes.map((node, i) => {
      // Get or initialize velocity for this node
      const velocity = velocitiesRef.current.get(node.id) || { x: 0, y: 0 };
      
      // Update velocity with force
      velocity.x = (velocity.x + forces[i].x) * damping;
      velocity.y = (velocity.y + forces[i].y) * damping;
      
      // Cap velocity to prevent explosions
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > maxVelocity) {
        velocity.x = (velocity.x / speed) * maxVelocity;
        velocity.y = (velocity.y / speed) * maxVelocity;
      }
      
      // Store updated velocity
      velocitiesRef.current.set(node.id, velocity);
      
      // Update position
      return {
        ...node,
        position: {
          x: node.position.x + velocity.x,
          y: node.position.y + velocity.y
        }
      };
    });

    // Update nodes - this will trigger re-render
    setNodes(newNodes);
  }, [mode, nodes, edges, getCenterNode, setNodes]);

  // Layout algorithms
  const calculateHierarchicalLayout = (nodes, edges) => {
    // Simple top-down hierarchy
    const maxWidth = Math.max(...nodes.map((node) => getNodeSize(node).width), 200);
    const maxHeight = Math.max(...nodes.map((node) => getNodeSize(node).height), 120);
    const spacing = { x: maxWidth + 80, y: maxHeight + 80 };
    const levels = {};
    
    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(edges.map(e => e.target));
    const roots = nodes.filter(n => !hasIncoming.has(n.id));
    
    // If no roots, use first node
    if (roots.length === 0 && nodes.length > 0) {
      roots.push(nodes[0]);
    }
    
    // Assign levels using BFS
    const queue = roots.map(n => ({ id: n.id, level: 0 }));
    const visited = new Set();
    
    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      
      if (!levels[level]) levels[level] = [];
      levels[level].push(id);
      
      // Add children to next level
      edges.filter(e => e.source === id).forEach(edge => {
        if (!visited.has(edge.target)) {
          queue.push({ id: edge.target, level: level + 1 });
        }
      });
    }
    
    // Add any unvisited nodes to level 0
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        if (!levels[0]) levels[0] = [];
        levels[0].push(node.id);
      }
    });
    
    // Position nodes
    return nodes.map(node => {
      const level = Object.keys(levels).find(l => levels[l].includes(node.id)) || 0;
      const indexInLevel = levels[level]?.indexOf(node.id) || 0;
      const nodesInLevel = levels[level]?.length || 1;
      
      return {
        id: node.id,
        x: (indexInLevel - (nodesInLevel - 1) / 2) * spacing.x,
        y: level * spacing.y - 200
      };
    });
  };

  const calculateRadialLayout = (nodes) => {
    const radius = 200;
    const angleStep = (2 * Math.PI) / nodes.length;
    
    return nodes.map((node, i) => ({
      id: node.id,
      x: Math.cos(i * angleStep) * radius,
      y: Math.sin(i * angleStep) * radius
    }));
  };

  const calculateGridLayout = (nodes) => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = 150;
    
    return nodes.map((node, i) => ({
      id: node.id,
      x: (i % cols - (cols - 1) / 2) * spacing,
      y: (Math.floor(i / cols) - Math.floor((nodes.length - 1) / cols) / 2) * spacing
    }));
  };

  const detectChainOrder = useCallback((nodesToOrder, edgeList) => {
    if (!Array.isArray(nodesToOrder) || nodesToOrder.length === 0) return null;
    const nodeIds = new Set(nodesToOrder.map((n) => n.id));
    const outgoing = new Map();
    const incomingCount = new Map();
    nodesToOrder.forEach((node) => {
      outgoing.set(node.id, []);
      incomingCount.set(node.id, 0);
    });

    (edgeList || []).forEach((edge) => {
      const source = edge?.source;
      const target = edge?.target;
      if (!nodeIds.has(source) || !nodeIds.has(target)) return;
      outgoing.get(source).push(target);
      incomingCount.set(target, (incomingCount.get(target) || 0) + 1);
    });

    // Chain requirement: each node has <=1 outgoing and <=1 incoming; exactly one root.
    const roots = [];
    for (const nodeId of nodeIds) {
      const out = outgoing.get(nodeId) || [];
      const inc = incomingCount.get(nodeId) || 0;
      if (out.length > 1 || inc > 1) return null;
      if (inc === 0) roots.push(nodeId);
    }
    if (roots.length !== 1) return null;

    const order = [];
    const visited = new Set();
    let current = roots[0];
    while (current && !visited.has(current)) {
      visited.add(current);
      order.push(current);
      const nextCandidates = outgoing.get(current) || [];
      current = nextCandidates.length === 1 ? nextCandidates[0] : null;
    }
    if (order.length !== nodesToOrder.length) return null;
    return order;
  }, []);

  const calculateSerpentineLayout = useCallback((nodesToLayout, edgeList, maxPerRow = SERPENTINE_DEFAULT_MAX_PER_ROW) => {
    const order = detectChainOrder(nodesToLayout, edgeList);
    if (!order) return null;

    const maxPerRowSafe = Math.max(2, Math.min(50, Number(maxPerRow) || SERPENTINE_DEFAULT_MAX_PER_ROW));
    const nodeById = new Map(nodesToLayout.map((n) => [n.id, n]));
    const sizeById = new Map(nodesToLayout.map((n) => [n.id, getNodeSize(n)]));

    const xGap = 120;
    const yGap = 160;

    const positions = [];
    let x = 0;
    let y = 0;
    let rowMaxHeight = 0;
    let colIndex = 0;
    let rowIndex = 0;

    const rowIds = [];
    const flushRow = () => {
      if (rowIds.length === 0) return;
      const isReverse = rowIndex % 2 === 1;
      const ids = isReverse ? [...rowIds].reverse() : [...rowIds];
      let cursorX = 0;
      ids.forEach((nodeId) => {
        const size = sizeById.get(nodeId) || { width: 200, height: 120 };
        positions.push({ id: nodeId, x: cursorX, y });
        cursorX += size.width + xGap;
      });
      rowIds.length = 0;
    };

    order.forEach((nodeId, index) => {
      const size = sizeById.get(nodeId) || { width: 200, height: 120 };
      rowMaxHeight = Math.max(rowMaxHeight, size.height);
      rowIds.push(nodeId);
      colIndex += 1;
      const isRowEnd = colIndex >= maxPerRowSafe || index === order.length - 1;
      if (isRowEnd) {
        flushRow();
        rowIndex += 1;
        colIndex = 0;
        y += rowMaxHeight + yGap;
        rowMaxHeight = 0;
      }
    });

    // Center around origin for a nicer initial placement.
    if (positions.length > 0) {
      const sizeMap = Object.fromEntries(nodesToLayout.map((node) => [node.id, getNodeSize(node)]));
      const bounds = getBoundsFromPositions(positions, sizeMap);
      if (bounds) {
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        positions.forEach((pos) => {
          pos.x -= centerX;
          pos.y -= centerY;
        });
      }
    }

    // Preserve current graph center to avoid big camera jumps.
    const sizeMap = Object.fromEntries(nodesToLayout.map((node) => [node.id, getNodeSize(node)]));
    const currentPositions = nodesToLayout.map((node) => ({
      id: node.id,
      x: node.position?.x || 0,
      y: node.position?.y || 0
    }));
    const currentBounds = getBoundsFromPositions(currentPositions, sizeMap);
    const nextBounds = getBoundsFromPositions(positions, sizeMap);
    if (currentBounds && nextBounds) {
      const currentCenterX = (currentBounds.minX + currentBounds.maxX) / 2;
      const currentCenterY = (currentBounds.minY + currentBounds.maxY) / 2;
      const nextCenterX = (nextBounds.minX + nextBounds.maxX) / 2;
      const nextCenterY = (nextBounds.minY + nextBounds.maxY) / 2;
      const dx = currentCenterX - nextCenterX;
      const dy = currentCenterY - nextCenterY;
      positions.forEach((pos) => {
        pos.x += dx;
        pos.y += dy;
      });
    }

    // Ensure every node in nodesToLayout is present.
    const fallbackForMissing = nodesToLayout.map((node) => ({
      id: node.id,
      x: node.position?.x || 0,
      y: node.position?.y || 0
    }));
    const posById = new Map(positions.map((p) => [p.id, p]));
    return fallbackForMissing.map((p) => posById.get(p.id) || p);
  }, [detectChainOrder]);

  // Apply new positions immediately
  const animateToPositions = useCallback((newPositions) => {
    velocitiesRef.current.clear();
    if (typeof window !== 'undefined') {
      window.__Twilite_FORCE_LAYOUT_POSITIONS__ = newPositions;
    }
    const positionMap = new Map(newPositions.map((pos) => [pos.id, { x: pos.x, y: pos.y }]));
    setNodes((prevNodes) => prevNodes.map((node) => {
      const target = positionMap.get(node.id);
      if (!target) return node;
      return {
        ...node,
        position: {
          x: target.x,
          y: target.y
        },
        x: target.x,
        y: target.y
      };
    }));
    try {
      eventBus.emit('layoutApplied', { count: newPositions.length });
    } catch (err) {
      // ignore emit errors
    }
  }, [setNodes]);

const rerouteEdges = useCallback(async () => {
    if (!Array.isArray(nodes) || nodes.length === 0) return;
    if (!Array.isArray(edges) || edges.length === 0) {
      if (typeof setEdgeRoutes === 'function') setEdgeRoutes({});
      return;
    }

    const elkSettings = getElkSettings(layoutSettings, edgeRouting);
    try {
    const elk = await getElk();

      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const validNodeIds = new Set(nodeById.keys());

      const portsByNodeId = new Map();
      const getPortsForNode = (node) => {
        if (!node) return [];
        if (portsByNodeId.has(node.id)) return portsByNodeId.get(node.id);
        const handles = Array.isArray(node?.handles) ? node.handles : [];
        const ports = handles
          .filter((handle) => handle && typeof handle.id === 'string' && handle.id)
          .map((handle) => {
            const rawSide = handle?.position?.side;
            const side = normalizeSide(rawSide);
            const offset = Number(handle?.position?.offset);
            const t = Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : 0.5;
            const portId = `${node.id}::${handle.id}`;
            const port = {
              id: portId,
              width: 1,
              height: 1,
              layoutOptions: {}
            };
            if (side) {
              port.layoutOptions['elk.port.side'] = side;
            }
            const size = getNodeSize(node);
            const w = size.width;
            const h = size.height;
            if (side === 'WEST') {
              port.x = 0;
              port.y = h * t;
            } else if (side === 'EAST') {
              port.x = w;
              port.y = h * t;
            } else if (side === 'NORTH') {
              port.x = w * t;
              port.y = 0;
            } else if (side === 'SOUTH') {
              port.x = w * t;
              port.y = h;
            } else {
              port.x = size.width / 2;
              port.y = size.height / 2;
            }
            return port;
          });
        portsByNodeId.set(node.id, ports);
        return ports;
      };

      const resolvePort = (nodeId, handleId) => {
        if (!nodeId || !handleId) return null;
        const node = nodeById.get(nodeId);
        if (!node) return null;
        const ports = getPortsForNode(node);
        const portId = `${node.id}::${handleId}`;
        return ports.some((p) => p.id === portId) ? portId : null;
      };

      const elkGraph = {
        id: 'root',
        layoutOptions: buildElkLayoutOptions(elkSettings),
        children: nodes.map((node) => {
          const size = getNodeSize(node);
          const x = Number(node?.position?.x) || 0;
          const y = Number(node?.position?.y) || 0;
          const ports = getPortsForNode(node);
          return {
            id: node.id,
            x,
            y,
            width: size.width,
            height: size.height,
            ports: ports.length ? ports : undefined
          };
        }),
        edges: edges
          .filter((edge) => edge && edge.source && edge.target && validNodeIds.has(edge.source) && validNodeIds.has(edge.target))
          .map((edge, index) => {
            const id = edge.id || `edge_${index}`;
            const sourcePort = resolvePort(edge.source, edge.sourceHandle);
            const targetPort = resolvePort(edge.target, edge.targetHandle);
            return {
              id,
              sources: [sourcePort || edge.source],
              targets: [targetPort || edge.target]
            };
          })
      };

        const layout = await elk.layout(elkGraph);
      const routeMap = edgeRouting === 'straight'
        ? buildStraightEdgeRoutes(edges, nodes)
        : buildElkEdgeRoutes(layout.edges || []);
      if (typeof setEdgeRoutes === 'function') {
        setEdgeRoutes(routeMap);
      }
    } catch (err) {
      console.warn('[EdgeReroute] ELK routing failed:', err);
      if (typeof setEdgeRoutes === 'function') {
        setEdgeRoutes({});
      }
    }
  }, [nodes, edges, setEdgeRoutes, buildElkEdgeRoutes, layoutSettings, edgeRouting]);

  const rerouteTimerRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    if (skipRerouteRef?.current) {
      console.log('[EdgeReroute] skipped (cached routes applied)');
      skipRerouteRef.current = false;
      return () => {};
    }
    if (rerouteTimerRef.current) {
      clearTimeout(rerouteTimerRef.current);
    }
    rerouteTimerRef.current = window.setTimeout(() => {
      rerouteEdges();
    }, 80);
    return () => {
      if (rerouteTimerRef.current) {
        clearTimeout(rerouteTimerRef.current);
      }
    };
  }, [rerouteEdges]);

  const applyElkLayoutWithAlgorithms = useCallback(async ({ algorithms = [], fallbackPositions } = {}) => {
    const candidates = Array.isArray(algorithms) ? algorithms.filter(Boolean) : [];
    if (!candidates.length) return false;

    const sizeMap = Object.fromEntries(nodes.map((node) => [node.id, getNodeSize(node)]));
    const currentPositions = nodes.map((node) => ({
      id: node.id,
      x: node.position?.x || 0,
      y: node.position?.y || 0
    }));
    const currentBounds = getBoundsFromPositions(currentPositions, sizeMap);

    const layoutOptionsBase = {
      ...buildElkLayoutOptions(getElkSettings(layoutSettings, edgeRouting)),
      'elk.direction': layoutDirection
    };

    const nodeIdsSet = new Set(nodes.map((node) => node.id));
    const withTimeout = (promise, ms, label) => {
      let timer = null;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      });
      return Promise.race([promise, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    };

    const runElkLayout = async (algorithm) => {
      const elk = await getElk();
      const elkGraph = {
        id: 'root',
        layoutOptions: {
          ...layoutOptionsBase,
          'elk.algorithm': algorithm
        },
        children: nodes.map((node) => ({
          id: node.id,
          width: getNodeSize(node).width,
          height: getNodeSize(node).height
        })),
        edges: edges
          .filter((edge) => edge && edge.source && edge.target && nodeIdsSet.has(edge.source) && nodeIdsSet.has(edge.target))
          .map((edge, index) => ({
            id: edge.id || `edge_${index}`,
            sources: [edge.source],
            targets: [edge.target]
          }))
      };

      let layout;
      try {
        layout = await withTimeout(elk.layout(elkGraph), 3000, 'ELK layout');
      } catch (err) {
        if (typeof window !== 'undefined' && window.__Twilite_HOST__ === 'vscode') {
          try {
            const elkNoWorker = await getElkNoWorker();
            layout = await withTimeout(elkNoWorker.layout(elkGraph), 4000, 'ELK layout (no worker)');
          } catch (fallbackErr) {
            console.error('[AutoLayout] ELK failed (worker + no-worker):', err, fallbackErr);
            throw fallbackErr;
          }
        } else {
          throw err;
        }
      }
      const newPositions = (layout.children || []).map((child) => ({
        id: child.id,
        x: child.x || 0,
        y: child.y || 0
      }));
      const nextBounds = getBoundsFromPositions(newPositions, sizeMap);

      if (newPositions.length > 0) {
        let offset = { x: 0, y: 0 };
        if (currentBounds && nextBounds) {
          const currentCenterX = (currentBounds.minX + currentBounds.maxX) / 2;
          const currentCenterY = (currentBounds.minY + currentBounds.maxY) / 2;
          const nextCenterX = (nextBounds.minX + nextBounds.maxX) / 2;
          const nextCenterY = (nextBounds.minY + nextBounds.maxY) / 2;
          offset = {
            x: currentCenterX - nextCenterX,
            y: currentCenterY - nextCenterY
          };
          newPositions.forEach((pos) => {
            pos.x += offset.x;
            pos.y += offset.y;
          });
        }

        animateToPositions(newPositions);
        if (typeof setEdgeRoutes === 'function') {
          const nodesWithUpdatedPositions = nodes.map((node) => {
            const updated = newPositions.find((pos) => pos.id === node.id);
            return updated ? { ...node, position: { x: updated.x, y: updated.y } } : node;
          });
          const routeMap = edgeRouting === 'straight'
            ? buildStraightEdgeRoutes(edges, nodesWithUpdatedPositions)
            : buildElkEdgeRoutes(layout.edges || [], offset);
          setEdgeRoutes(routeMap);
        }
        return true;
      }
      return false;
    };

    for (const algorithm of candidates) {
      try {
        await runElkLayout(algorithm);
        return true;
      } catch (err) {
        console.error('[AutoLayout] ELK layout failed (%s):', algorithm, err);
      }
    }

    if (typeof fallbackPositions === 'function') {
      const fallback = fallbackPositions();
      animateToPositions(fallback);
      if (typeof setEdgeRoutes === 'function') {
        setEdgeRoutes({});
      }
    }
    return false;
  }, [nodes, edges, animateToPositions, setEdgeRoutes, buildElkEdgeRoutes, layoutSettings, edgeRouting, layoutDirection]);

  // Auto layout algorithms
  const applyAutoLayout = useCallback((layoutType) => {
    if (nodes.length === 0) return;
    const resolvedLayoutType = layoutType || autoLayoutType;
    if (typeof window !== 'undefined') {
      window.__Twilite_ALLOW_LAYOUT__ = true;
    }
    if (typeof window !== 'undefined' && window.__Twilite_HOST__ === 'vscode' && typeof window.__Twilite_POST_MESSAGE__ === 'function') {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      try {
        window.__Twilite_POST_MESSAGE__({
          type: 'elkLayout',
          requestId,
          payload: {
            layoutType: resolvedLayoutType,
            direction: layoutDirection,
            nodes: nodes.map((node) => ({
              id: node.id,
              width: node.width,
              height: node.height
            })),
            edges: edges.map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target
            }))
          }
        });
      } catch {}
      return;
    }

    const fallbackPositions = () => {
      const sizeMap = Object.fromEntries(nodes.map((node) => [node.id, getNodeSize(node)]));
      const count = nodes.length;
      const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
      const gap = Math.max(80, Number(layoutSettings?.edgeLaneGapPx) || 80);
      const positions = nodes.map((node, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const size = sizeMap[node.id] || { width: 200, height: 120 };
        return {
          id: node.id,
          x: col * (size.width + gap),
          y: row * (size.height + gap)
        };
      });
      // center the fallback layout on the current graph center
      const currentPositions = nodes.map((node) => ({
        id: node.id,
        x: node.position?.x || 0,
        y: node.position?.y || 0
      }));
      const currentBounds = getBoundsFromPositions(currentPositions, sizeMap);
      const nextBounds = getBoundsFromPositions(positions, sizeMap);
      if (currentBounds && nextBounds) {
        const currentCenterX = (currentBounds.minX + currentBounds.maxX) / 2;
        const currentCenterY = (currentBounds.minY + currentBounds.maxY) / 2;
        const nextCenterX = (nextBounds.minX + nextBounds.maxX) / 2;
        const nextCenterY = (nextBounds.minY + nextBounds.maxY) / 2;
        const dx = currentCenterX - nextCenterX;
        const dy = currentCenterY - nextCenterY;
        positions.forEach((pos) => {
          pos.x += dx;
          pos.y += dy;
        });
      }
      return positions;
    };

    const algorithmMap = {
      layered: ['layered', 'org.eclipse.elk.layered'],
      rectpacking: ['rectpacking', 'org.eclipse.elk.rectpacking', 'box', 'org.eclipse.elk.box'],
      radial: ['radial', 'org.eclipse.elk.radial']
    };

    const algorithms = algorithmMap[resolvedLayoutType] || ['layered'];
    applyElkLayoutWithAlgorithms({ algorithms, fallbackPositions }).then((used) => {
      if (!used) {
        if (typeof window !== 'undefined' && window.__Twilite_HOST__ === 'vscode') {
          const fallback = fallbackPositions();
          animateToPositions(fallback);
          if (typeof setEdgeRoutes === 'function') {
            setEdgeRoutes({});
          }
        }
        setSnackbar({ open: true, message: 'Auto-layout failed (see console)', severity: 'error', copyToClipboard: true });
      }
    });
  }, [nodes, applyElkLayoutWithAlgorithms, setSnackbar, layoutSettings, autoLayoutType]);

  // Handle mode changes
  const handleModeChange = useCallback((newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    // Removed auto-apply when entering auto mode
    // if (newMode === 'auto') {
    //   setTimeout(() => applyAutoLayout(autoLayoutType), 100);
    // }
    if (newMode === 'manual') {
      // Clear any ongoing animations
      velocitiesRef.current.clear();
    }
  }, [mode, autoLayoutType, applyAutoLayout]);

  // Effect: Run physics simulation in nav mode
  useEffect(() => {
    const interval = setInterval(() => {
      runPhysicsSimulation();
    }, 1000 / 30); // 30 FPS

    return () => {
      clearInterval(interval);
    };
  }, [runPhysicsSimulation]);

  return {
    mode,
    autoLayoutType,
    handleModeChange,
    setAutoLayoutType, // <-- ensure this is exported
    applyAutoLayout: () => applyAutoLayout(autoLayoutType),
    applyLayoutPositions: animateToPositions,
    rerouteEdges
  };
}
