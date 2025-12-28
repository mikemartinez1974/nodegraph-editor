import { useState, useEffect, useCallback, useRef } from 'react';
import { gsap } from 'gsap';

let elkInstance = null;
const getElk = async () => {
  if (elkInstance) return elkInstance;
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  elkInstance = new ELK();
  return elkInstance;
};

const getNodeSize = (node) => ({
  width: Number(node?.width) || 200,
  height: Number(node?.height) || 120
});

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

export default function useGraphModes({ nodes, setNodes, selectedNodeIds, edges, setEdgeRoutes }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'nav' | 'auto'
  const [autoLayoutType, setAutoLayoutType] = useState('hierarchical'); // 'hierarchical' | 'radial' | 'grid'
  const animationRef = useRef(null);
  const physicsRef = useRef(null);
  const velocitiesRef = useRef(new Map()); // Store velocity for each node

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

  // Animate nodes to new positions
  const animateToPositions = useCallback((newPositions) => {
    if (animationRef.current) {
      animationRef.current.kill();
    }

    // Clear velocities when animating to new positions
    velocitiesRef.current.clear();

    const timeline = gsap.timeline({
      onUpdate: () => {
        setNodes(prevNodes => {
          return prevNodes.map(node => {
            const target = newPositions.find(p => p.id === node.id);
            if (!target) return node;
            
            // GSAP will interpolate these values
            return {
              ...node,
              position: {
                x: target.x,
                y: target.y
              }
            };
          });
        });
      }
    });
    
    newPositions.forEach(pos => {
      const node = nodes.find(n => n.id === pos.id);
      if (node) {
        timeline.to(node.position, {
          x: pos.x,
          y: pos.y,
          duration: 1,
          ease: 'power2.out'
        }, 0);
      }
    });
    
    animationRef.current = timeline;
  }, [nodes, setNodes]);

  // Auto layout algorithms
  const applyAutoLayout = useCallback((layoutType) => {
    if (nodes.length === 0) return;

    if (layoutType === 'hierarchical') {
      (async () => {
        try {
          const elk = await getElk();
          const elkGraph = {
            id: 'root',
            layoutOptions: {
              'elk.algorithm': 'layered',
              'elk.direction': 'DOWN',
              'elk.spacing.nodeNode': '120',
              'elk.layered.spacing.nodeNodeBetweenLayers': '160',
              'elk.layered.spacing.edgeNodeBetweenLayers': '80',
              'elk.edgeRouting': 'ORTHOGONAL'
            },
            children: nodes.map((node) => ({
              id: node.id,
              width: getNodeSize(node).width,
              height: getNodeSize(node).height
            })),
            edges: edges.map((edge, index) => ({
              id: edge.id || `edge_${index}`,
              sources: [edge.source],
              targets: [edge.target]
            }))
          };

          const layout = await elk.layout(elkGraph);
          const newPositions = (layout.children || []).map((child) => ({
            id: child.id,
            x: child.x || 0,
            y: child.y || 0
          }));

          if (newPositions.length > 0) {
            const sizeMap = Object.fromEntries(
              nodes.map((node) => [node.id, getNodeSize(node)])
            );
            const currentPositions = nodes.map((node) => ({
              id: node.id,
              x: node.position?.x || 0,
              y: node.position?.y || 0
            }));
            const currentBounds = getBoundsFromPositions(currentPositions, sizeMap);
            const nextBounds = getBoundsFromPositions(newPositions, sizeMap);
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
              const routeMap = buildElkEdgeRoutes(layout.edges || [], offset);
              setEdgeRoutes(routeMap);
            }
          }
        } catch (err) {
          console.warn('[AutoLayout] ELK layout failed, falling back:', err);
          const fallback = calculateHierarchicalLayout(nodes, edges);
          animateToPositions(fallback);
          if (typeof setEdgeRoutes === 'function') {
            setEdgeRoutes({});
          }
        }
      })();
      return;
    }

    let newPositions = [];

    switch (layoutType) {
      case 'radial':
        newPositions = calculateRadialLayout(nodes);
        break;
      case 'grid':
        newPositions = calculateGridLayout(nodes);
        break;
      default:
        return;
    }

    // Animate to new positions
    animateToPositions(newPositions);
    if (typeof setEdgeRoutes === 'function') {
      setEdgeRoutes({});
    }
  }, [nodes, edges, animateToPositions, setEdgeRoutes, buildElkEdgeRoutes]);

  const rerouteEdges = useCallback(async () => {
    if (!Array.isArray(nodes) || nodes.length === 0) return;
    if (!Array.isArray(edges) || edges.length === 0) {
      if (typeof setEdgeRoutes === 'function') setEdgeRoutes({});
      return;
    }

    try {
      const elk = await getElk();

      const nodeById = new Map(nodes.map((node) => [node.id, node]));

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

      const portsByNodeId = new Map();
      const getPortsForNode = (node) => {
        if (!node) return [];
        if (portsByNodeId.has(node.id)) return portsByNodeId.get(node.id);
        const w = getNodeSize(node).width;
        const h = getNodeSize(node).height;
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
        layoutOptions: {
          'elk.algorithm': 'fixed',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.portConstraints': 'FIXED_SIDE'
        },
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
          .filter((edge) => edge && edge.source && edge.target)
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
      const routeMap = buildElkEdgeRoutes(layout.edges || []);
      if (typeof setEdgeRoutes === 'function') {
        setEdgeRoutes(routeMap);
      }
    } catch (err) {
      console.warn('[EdgeReroute] ELK routing failed:', err);
      if (typeof setEdgeRoutes === 'function') {
        setEdgeRoutes({});
      }
    }
  }, [nodes, edges, setEdgeRoutes, buildElkEdgeRoutes]);

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
      if (animationRef.current) {
        animationRef.current.kill();
      }
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
    rerouteEdges
  };
}
