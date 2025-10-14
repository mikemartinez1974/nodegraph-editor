import { useState, useEffect, useCallback, useRef } from 'react';
import { gsap } from 'gsap';

export default function useGraphModes({ nodes, setNodes, selectedNodeIds, edges }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'nav' | 'auto'
  const [autoLayoutType, setAutoLayoutType] = useState('hierarchical'); // 'hierarchical' | 'radial' | 'grid'
  const animationRef = useRef(null);
  const physicsRef = useRef(null);
  const velocitiesRef = useRef(new Map()); // Store velocity for each node

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

  // Auto layout algorithms
  const applyAutoLayout = useCallback((layoutType) => {
    if (nodes.length === 0) return;

    let newPositions = [];

    switch (layoutType) {
      case 'hierarchical':
        newPositions = calculateHierarchicalLayout(nodes, edges);
        break;
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
  }, [nodes, edges]);

  // Layout algorithms
  const calculateHierarchicalLayout = (nodes, edges) => {
    // Simple top-down hierarchy
    const spacing = { x: 150, y: 120 };
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
    applyAutoLayout: () => applyAutoLayout(autoLayoutType)
  };
}