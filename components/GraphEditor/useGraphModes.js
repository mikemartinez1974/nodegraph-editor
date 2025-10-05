import { useState, useEffect, useCallback, useRef } from 'react';
import { gsap } from 'gsap';

export default function useGraphModes({ nodes, setNodes, selectedNodeIds, edges }) {
  const [mode, setMode] = useState('nav'); // 'manual' | 'nav' | 'auto'
  const [autoLayoutType, setAutoLayoutType] = useState('hierarchical'); // 'hierarchical' | 'radial' | 'grid'
  const animationRef = useRef(null);
  const physicsRef = useRef(null);

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

    // Physics parameters
    const repulsion = 100;
    const attraction = 0.1;
    const damping = 0.8;
    const centerForce = 0.05;

    const forces = nodes.map(node => ({ x: 0, y: 0 }));

    nodes.forEach((nodeA, i) => {
      // Repulsion between all nodes
      nodes.forEach((nodeB, j) => {
        if (i === j) return;
        const dx = nodeA.position.x - nodeB.position.x;
        const dy = nodeA.position.y - nodeB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + 0.1;
        const force = repulsion / (distance * distance);
        forces[i].x += (dx / distance) * force;
        forces[i].y += (dy / distance) * force;
      });

      // Attraction along edges
      edges.forEach(edge => {
        if (edge.source === nodeA.id) {
          const target = nodes.find(n => n.id === edge.target);
          if (target) {
            const dx = target.position.x - nodeA.position.x;
            const dy = target.position.y - nodeA.position.y;
            forces[i].x += dx * attraction;
            forces[i].y += dy * attraction;
          }
        }
        if (edge.target === nodeA.id) {
          const source = nodes.find(n => n.id === edge.source);
          if (source) {
            const dx = source.position.x - nodeA.position.x;
            const dy = source.position.y - nodeA.position.y;
            forces[i].x += dx * attraction;
            forces[i].y += dy * attraction;
          }
        }
      });

      // Keep center node near center
      if (nodeA.id === centerNode.id) {
        const dx = 0 - nodeA.position.x;
        const dy = 0 - nodeA.position.y;
        forces[i].x += dx * centerForce;
        forces[i].y += dy * centerForce;
      }
    });

    // Apply forces with animation
    const newNodes = nodes.map((node, i) => ({
      ...node,
      position: {
        x: node.position.x + forces[i].x * damping,
        y: node.position.y + forces[i].y * damping
      }
    }));

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
    const spacing = { x: 150, y: 100 };
    const levels = {};
    
    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(edges.map(e => e.target));
    const roots = nodes.filter(n => !hasIncoming.has(n.id));
    
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
    const radius = 150;
    const angleStep = (2 * Math.PI) / nodes.length;
    
    return nodes.map((node, i) => ({
      id: node.id,
      x: Math.cos(i * angleStep) * radius,
      y: Math.sin(i * angleStep) * radius
    }));
  };

  const calculateGridLayout = (nodes) => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = 120;
    
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

    const timeline = gsap.timeline();
    
    newPositions.forEach(pos => {
      const node = nodes.find(n => n.id === pos.id);
      if (node) {
        timeline.to(node.position, {
          x: pos.x,
          y: pos.y,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => {
            setNodes(prev => prev.map(n => 
              n.id === pos.id ? { ...n, position: { ...node.position } } : n
            ));
          }
        }, 0);
      }
    });

    animationRef.current = timeline;
  }, [nodes, setNodes]);

  // Physics loop for nav mode
  useEffect(() => {
    if (mode === 'nav') {
      const interval = setInterval(runPhysicsSimulation, 50); // 20 FPS
      physicsRef.current = interval;
      return () => clearInterval(interval);
    } else {
      if (physicsRef.current) {
        clearInterval(physicsRef.current);
        physicsRef.current = null;
      }
    }
  }, [mode, runPhysicsSimulation]);

  // Handle mode changes
  const handleModeChange = useCallback((newMode) => {
    if (newMode === mode) return;
    
    setMode(newMode);
    
    if (newMode === 'auto') {
      applyAutoLayout(autoLayoutType);
    }
  }, [mode, autoLayoutType, applyAutoLayout]);

  // Handle auto layout type changes
  const handleAutoLayoutChange = useCallback((layoutType) => {
    setAutoLayoutType(layoutType);
    if (mode === 'auto') {
      applyAutoLayout(layoutType);
    }
  }, [mode, applyAutoLayout]);

  return {
    mode,
    autoLayoutType,
    handleModeChange,
    handleAutoLayoutChange,
    applyAutoLayout: () => applyAutoLayout(autoLayoutType)
  };
}