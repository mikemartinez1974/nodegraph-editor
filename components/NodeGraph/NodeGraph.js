"use client";
// NodeGraph.js
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import EdgeLayer from './EdgeLayer';
import HandleLayer from './HandleLayer';
import PanZoomLayer from './PanZoomLayer';
import NodeLayer from './NodeLayer';
import GroupLayer from './GroupLayer';
import eventBus from './eventBus';
import UnifiedEventHandler from './eventHandlers';
import { handleMarqueeStart, useMarqueeSelection, MarqueeOverlay } from './marqueeSelection';
import Minimap from './Minimap';
import GridLayer from './GridLayer';
import useTouchGestures from './hooks/useTouchGestures';

const NON_PASSIVE_LISTENER = { passive: false };
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

export default function NodeGraph({ 
  nodes = [], 
  setNodes,
  edges = [], 
  setEdges,
  groups = [], 
  setGroups,
  nodeTypes = {}, 
  edgeTypes = {}, 
  selectedNodeId, 
  selectedNodeIds = [], 
  selectedEdgeId, 
  selectedEdgeIds = [], 
  selectedGroupIds = [], 
  setSelectedNodeIds, 
  setSelectedEdgeIds, 
  onNodeClick, 
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onGroupClick, 
  onBackgroundClick, 
  pan, 
  zoom, 
  setPan, 
  setZoom, 
  onNodeMove, 
  onEdgeClick, 
  hoveredNodeId,
  hoveredEdgeId, 
  backgroundUrl,
  backgroundInteractive,
  backgroundImage = '',
  setSnackbar,
  showMinimap = true,
  snapToGrid = false,
  showGrid = false,
  gridSize = 20,
  lockedNodes = new Set(),
  lockedEdges = new Set(),
  showAllEdgeLabels = false,
}) {
  const theme = useTheme();
  const clampZoom = useCallback((value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)), []);
  
  // Auto-update group bounds when nodes move
  useEffect(() => {
    if (!setGroups || groups.length === 0) return;
    
    const updatedGroups = groups.map(group => {
      if (!group.nodeIds || group.nodeIds.length === 0) return group;
      
      const groupNodes = nodes.filter(n => group.nodeIds.includes(n.id));
      if (groupNodes.length === 0) return group;
      
      const padding = 20;
      const positions = groupNodes.map(n => ({
        x: n.position?.x || n.x || 0,
        y: n.position?.y || n.y || 0,
        width: n.width || 60,
        height: n.height || 60
      }));
      
      const minX = Math.min(...positions.map(p => p.x - p.width / 2)) - padding;
      const maxX = Math.max(...positions.map(p => p.x + p.width / 2)) + padding;
      const minY = Math.min(...positions.map((p) => p.y - p.height / 2)) - padding;
      const maxY = Math.max(...positions.map(p => p.y + p.height / 2)) + padding;
      
      const newBounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
      
      const boundsChanged = !group.bounds || 
        Math.abs(group.bounds.x - newBounds.x) > 1 ||
        Math.abs(group.bounds.y - newBounds.y) > 1 ||
        Math.abs(group.bounds.width - newBounds.width) > 1 ||
        Math.abs(group.bounds.height - newBounds.height) > 1;
      
      return boundsChanged ? { ...group, bounds: newBounds } : group;
    });
    
    const hasChanges = updatedGroups.some((g, i) => g !== groups[i]);
    if (hasChanges) {
      setGroups(updatedGroups);
    }
  }, [nodes, groups, setGroups]);

  // Refs
  const containerRef = useRef(null);
  const panZoomRef = useRef(null);
  const edgeCanvasRef = useRef(null);
  const handleCanvasRef = useRef(null);
  const groupRef = useRef(null);
  const nodeContainerRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const edgeLayerImperativeRef = useRef(null);
  const handleLayerImperativeRef = useRef(null);
  const pinchStateRef = useRef(null);
  const unifiedEventHandlerRef = useRef(null);

  // State
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [draggingGroupId, setDraggingGroupId] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [handlePreviewLine, setHandlePreviewLine] = useState(null);

  // Drag state
  const draggingNodeIdRef = useRef(null);
  const draggingGroupIdRef = useRef(null);
  const draggingInfoRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef(null);
  const lastDragPosition = useRef(null);
  const dragRafRef = useRef(null);
  const groupDragOffsetRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, inside: false, ts: 0 });
  const dragThreshold = 1; // make pickup as responsive as possible
  const dragStartedRef = useRef(false);
  const suppressClickRef = useRef(false);
  
  // Refs for snap-to-grid values (so drag handler always has current values)
  const snapToGridRef = useRef(snapToGrid);
  const gridSizeRef = useRef(gridSize);
  
  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);
  
  useEffect(() => {
    gridSizeRef.current = gridSize;
  }, [gridSize]);

  // Create layerRefs object
  const layerRefs = useMemo(() => ({
    edgeCanvas: edgeCanvasRef,
    handleCanvas: handleCanvasRef,
    group: groupRef,
    nodeContainer: nodeContainerRef
  }), []);

  // Provide default handles for any node missing them
  const ensureHandles = node => ({
    ...node,
    inputs: Array.isArray(node.inputs) && node.inputs.length > 0 ? node.inputs : [{ key: 'in', label: 'In', type: 'trigger' }],
    outputs: Array.isArray(node.outputs) && node.outputs.length > 0 ? node.outputs : [{ key: 'out', label: 'Out', type: 'trigger' }],
  });

  // Process nodes with defaults
  const nodeList = useMemo(() => nodes.map(ensureHandles), [nodes]);

  const visibleNodeList = useMemo(() => nodeList.filter(n => n.visible !== false), [nodeList]);

  // Track latest pointer in graph coordinates so other components can place new nodes at the cursor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const handleMove = (e) => {
      const rect = el.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      const graphX = (e.clientX - rect.left - (pan?.x || 0)) / (zoom || 1);
      const graphY = (e.clientY - rect.top - (pan?.y || 0)) / (zoom || 1);
      lastPointerRef.current = { x: graphX, y: graphY, inside, ts: Date.now() };
      try {
        eventBus.emit('pointerMove', {
          client: { x: e.clientX, y: e.clientY },
          graph: { x: graphX, y: graphY },
          inside
        });
      } catch (err) {
        /* ignore */
      }
    };
    el.addEventListener('mousemove', handleMove);
    return () => el.removeEventListener('mousemove', handleMove);
  }, [pan, zoom]);

  // ============================================
  // Unified Event Handler Setup
  // ============================================
  
  // useEffect(() => {
  //   if (!containerRef.current) return;

  //   // Create unified event handler
  //   const handler = new UnifiedEventHandler({
  //     containerRef,
  //     handleLayerRef: handleLayerImperativeRef,
  //     nodeRefs,
  //     nodes: nodeList,
  //     edges,
  //     groups,
  //     pan,
  //     zoom,
  //     setSelectedNodeIds,
  //     setSelectedEdgeIds,
  //     setSelectedGroupIds: (ids) => {}, // Add proper handler if needed
  //     lockedNodes,
  //     onNodeClick,
  //     onEdgeClick,
  //     onGroupClick,
  //     onBackgroundClick
  //   });

  //   unifiedEventHandlerRef.current = handler;
  //   handler.attach();

  //   return () => {
  //     handler.detach();
  //   };
  // }, [nodeList, edges, groups, pan, zoom, lockedNodes]);

  // Update handler refs when dependencies change
  useEffect(() => {
    if (unifiedEventHandlerRef.current) {
      unifiedEventHandlerRef.current.updateRefs({
        nodes: nodeList,
        edges,
        groups,
        pan,
        zoom,
        setSelectedNodeIds,
        setSelectedEdgeIds,
        lockedNodes,
        onNodeClick,
        onEdgeClick,
        onGroupClick,
        onBackgroundClick
      });
    }
  }, [nodeList, edges, groups, pan, zoom, setSelectedNodeIds, setSelectedEdgeIds, lockedNodes, onNodeClick, onEdgeClick, onGroupClick, onBackgroundClick]);

  // ============================================
  // Handle Events - Create Edges
  // ============================================
  
  useEffect(() => {
    const handleDrop = ({ handle, targetNode, targetNodeObject, position, targetHandle, validation }) => {
      if (!handle) return;
      if (validation && validation.ok === false) {
        if (setSnackbar && validation.message) {
          setSnackbar({ open: true, message: validation.message, severity: 'warning' });
        }
        return;
      }
      // Ignore open-space drops; GraphEditor handles node creation + edge wiring.
      if (!targetHandle) {
        return;
      }

      // Only allow output→input connections with matching types
      if (handle.type === 'output' && targetHandle && targetHandle.type === 'input') {
        // Validate type match
        if (handle.handleType && targetHandle.handleType && handle.handleType !== targetHandle.handleType) {
          if (setSnackbar) {
            setSnackbar({ open: true, message: `Handle types do not match: ${handle.handleType} → ${targetHandle.handleType}`, severity: 'warning' });
          }
          return;
        }
        // Prevent self-connection
        if (handle.nodeId === targetHandle.nodeId) return;
        // Create edge with handle keys
        const newEdge = {
          id: `edge_${Date.now()}`,
          source: handle.nodeId,
          target: targetHandle.nodeId,
          sourceHandle: handle.key,
          targetHandle: targetHandle.key,
          handleMeta: {
            source: { label: handle.label, type: handle.handleType },
            target: { label: targetHandle.label, type: targetHandle.handleType }
          },
          type: 'default',
          label: '',
          style: {}
        };
        setEdges(prev => [...prev, newEdge]);
        if (setSnackbar) {
          setSnackbar({ open: true, message: `Created edge from ${handle.label} to ${targetHandle.label}`, severity: 'success' });
        }
        return;
      }
      // Invalid connection
      if (setSnackbar) {
        const message = validation?.message || 'Invalid connection: only output→input allowed, and types must match.';
        setSnackbar({ open: true, message, severity: 'warning' });
      }
    };

    const handleDragMove = ({ handle, previewLine }) => {
      setHandlePreviewLine(previewLine);
    };

    const handleDragEnd = () => {
      setHandlePreviewLine(null);
    };

    eventBus.on('handleDrop', handleDrop);
    eventBus.on('handleDragMove', handleDragMove);
    eventBus.on('handleDragEnd', handleDragEnd);

    return () => {
      eventBus.off('handleDrop', handleDrop);
      eventBus.off('handleDragMove', handleDragMove);
      eventBus.off('handleDragEnd', handleDragEnd);
    };
  }, [edges, setEdges, setSnackbar]);

  // ============================================
  // Node Drag Handlers
  // ============================================

  useEffect(() => {
    const getClientPoint = (evt) => {
      if (!evt) return null;
      if (evt.touches && evt.touches.length > 0) {
        return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
      }
      if (evt.changedTouches && evt.changedTouches.length > 0) {
        return { x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY };
      }
      if (typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
        return { x: evt.clientX, y: evt.clientY };
      }
      return null;
    };

    const handleNodeDragStart = ({ node, event }) => {
      if (lockedNodes.has(node.id)) return;

      let nodesToDrag = [node.id];
      if (selectedNodeIds.includes(node.id) && selectedNodeIds.length > 1) {
        nodesToDrag = [...selectedNodeIds];
      }
      
      nodesToDrag = nodesToDrag.filter(id => !lockedNodes.has(id));
      if (nodesToDrag.length === 0) return;
      
      setDraggingNodeId(node.id);
      draggingNodeIdRef.current = nodesToDrag;
      isDragging.current = false;
      dragStartedRef.current = false;
      dragStartTime.current = Date.now();
      const point = getClientPoint(event);
      if (!point) return;
      dragStartPos.current = { x: point.x, y: point.y };
      
      const initialPositions = {};
      nodesToDrag.forEach(id => {
        const n = nodes.find(nd => nd.id === id);
        if (n) {
          initialPositions[id] = { x: n.position.x, y: n.position.y };
        }
      });
      lastDragPosition.current = initialPositions;
      
      dragOffset.current = {
        x: point.x - (node.position.x * zoom + pan.x),
        y: point.y - (node.position.y * zoom + pan.y)
      };
      lastMousePos.current = { x: point.x, y: point.y };
      
      addWindowDragListeners();
    };

    eventBus.on('nodeDragStart', handleNodeDragStart);
    return () => {
      eventBus.off('nodeDragStart', handleNodeDragStart);
      removeWindowDragListeners();
    };
  }, [nodes, selectedNodeIds, lockedNodes, pan, zoom]);

  function onNodeDragMove(e) {
    if (e.touches && e.touches.length > 1) return;
    const point = (() => {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if (e.changedTouches && e.changedTouches.length > 0) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    })();

    if (!draggingNodeIdRef.current || !Array.isArray(draggingNodeIdRef.current)) return;
    if (typeof point.x !== 'number' || typeof point.y !== 'number') return;

    if (e && e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const dragDistance = Math.hypot(
      point.x - dragStartPos.current.x,
      point.y - dragStartPos.current.y
    );
    
    if (dragDistance < dragThreshold) return;

    dragStartedRef.current = true;
    suppressClickRef.current = true;

    const graphDx = (point.x - lastMousePos.current.x) / zoom;
    const graphDy = (point.y - lastMousePos.current.y) / zoom;
    lastMousePos.current = { x: point.x, y: point.y };

    if (!draggingInfoRef.current) {
      draggingInfoRef.current = { nodeIds: draggingNodeIdRef.current, offset: { x: 0, y: 0 } };
    }
    
    // Always accumulate the raw mouse movement
    draggingInfoRef.current.offset.x += graphDx;
    draggingInfoRef.current.offset.y += graphDy;
    
    // If snap-to-grid is enabled, visually snap the display (but keep accumulating raw offset)
    // The actual snapping will happen on drag end
    
    isDragging.current = true;

    if (!dragRafRef.current) {
      dragRafRef.current = requestAnimationFrame(() => {
        draggingNodeIdRef.current.forEach(nodeId => {
          const nodeEl = nodeRefs.current.get(nodeId);
          if (nodeEl) {
            // Preserve node rotation while translating during drag to avoid visual jump
            const nodeObj = (nodesRef.current || nodes).find(n => n.id === nodeId);
            const rotation = nodeObj && nodeObj.data && typeof nodeObj.data.rotation === 'number' ? nodeObj.data.rotation : 0;
            const tx = draggingInfoRef.current.offset.x * zoom;
            const ty = draggingInfoRef.current.offset.y * zoom;
            nodeEl.style.transform = `translate(${tx}px, ${ty}px) rotate(${rotation}deg)`;
          }
        });

        if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
        if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();

        dragRafRef.current = null;
      });
    }
  }

  function addWindowDragListeners() {
    window.addEventListener('mousemove', onNodeDragMove, NON_PASSIVE_LISTENER);
    window.addEventListener('mouseup', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.addEventListener('touchmove', onNodeDragMove, NON_PASSIVE_LISTENER);
    window.addEventListener('touchend', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.addEventListener('touchcancel', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.addEventListener('pointermove', onNodeDragMove, NON_PASSIVE_LISTENER);
    window.addEventListener('pointerup', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.addEventListener('pointercancel', handleNodeDragEnd, NON_PASSIVE_LISTENER);
  }

  function removeWindowDragListeners() {
    window.removeEventListener('mousemove', onNodeDragMove, NON_PASSIVE_LISTENER);
    window.removeEventListener('mouseup', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.removeEventListener('touchmove', onNodeDragMove, NON_PASSIVE_LISTENER);
    window.removeEventListener('touchend', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.removeEventListener('touchcancel', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.removeEventListener('pointermove', onNodeDragMove, NON_PASSIVE_LISTENER);
    window.removeEventListener('pointerup', handleNodeDragEnd, NON_PASSIVE_LISTENER);
    window.removeEventListener('pointercancel', handleNodeDragEnd, NON_PASSIVE_LISTENER);
  }

  function handleNodeDragEnd(event) {
    removeWindowDragListeners();

    if (!draggingNodeIdRef.current || !Array.isArray(draggingNodeIdRef.current)) {
      return;
    }

    const point = (() => {
      if (event?.changedTouches && event.changedTouches.length > 0) {
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
      }
      if (event?.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
      if (event && typeof event.clientX === 'number') {
        return { x: event.clientX, y: event.clientY };
      }
      return null;
    })();

    if (point) {
      lastMousePos.current = { x: point.x, y: point.y };
    }

    const dragDistance = Math.hypot(
      lastMousePos.current.x - dragStartPos.current.x,
      lastMousePos.current.y - dragStartPos.current.y
    );
    
    // Only trigger click if we didn't actually drag
    if (dragDistance < dragThreshold && !dragStartedRef.current) {
      const node = nodes.find(n => n.id === draggingNodeIdRef.current[0]);
      if (node && typeof onNodeClick === 'function') {
        onNodeClick(node.id, {});
      }
      // Even on a tiny drag (or click), emit nodeDragEnd so downstream code
      // (autowire) never misses the first drop.
      const snapshots = getNodeSnapshotsByIds(draggingNodeIdRef.current);
      const first = snapshots[0];
      // Use the actual mouse location (graph coords) when available; avoid
      // falling back to the center position so the very first drop is accurate.
      const dropPointGraph =
        point && panRef.current && zoomRef.current
          ? {
              x: (point.x - panRef.current.x) / zoomRef.current,
              y: (point.y - panRef.current.y) / zoomRef.current
            }
          : null;
      let payloadNodes = snapshots;
      if (dropPointGraph && payloadNodes.length) {
        payloadNodes = payloadNodes.map((n) => ({
          ...n,
          position: { x: dropPointGraph.x, y: dropPointGraph.y }
        }));
      }
      eventBus.emit('nodeDragEnd', {
        nodeIds: draggingNodeIdRef.current,
        nodes: payloadNodes,
        dropPoint: dropPointGraph
      });
    } else if (draggingInfoRef.current) {
      const offset = draggingInfoRef.current.offset;
      
      const updatedSnapshots = [];
      draggingNodeIdRef.current.forEach(id => {
        const node = nodes.find(n => n.id === id);
        if (node) {
          let newX = node.position.x + offset.x;
          let newY = node.position.y + offset.y;
          
          // Apply snap-to-grid on release if enabled (use refs for current values)
          if (snapToGridRef.current && gridSizeRef.current) {
            newX = Math.round(newX / gridSizeRef.current) * gridSizeRef.current;
            newY = Math.round(newY / gridSizeRef.current) * gridSizeRef.current;
          }
          
          const newPosition = { x: newX, y: newY };
          eventBus.emit('nodeMove', { id, position: newPosition });

          // Build an updated snapshot for downstream listeners (avoids stale refs)
          try {
            updatedSnapshots.push(JSON.parse(JSON.stringify({ ...node, position: newPosition })));
          } catch (err) {
            updatedSnapshots.push({ ...node, position: newPosition });
          }
          // Also update the live nodesRef so downstream reads during dragEnd see the fresh position.
          if (nodesRef.current && Array.isArray(nodesRef.current)) {
            nodesRef.current = nodesRef.current.map((entry) =>
              entry && entry.id === id ? { ...entry, position: newPosition } : entry
            );
          }
        }

        const nodeEl = nodeRefs.current.get(id);
        if (nodeEl) {
          // Get the current rotation to preserve it
          const nodeObj = (nodesRef.current || nodes).find(n => n.id === id);
          const rotation = nodeObj && nodeObj.data && typeof nodeObj.data.rotation === 'number' ? nodeObj.data.rotation : 0;
          
          // Aggressively disable all transitions to prevent animation on drop
          nodeEl.style.transition = 'none !important';
          nodeEl.style.transitionDuration = '0s !important';
          nodeEl.style.transitionDelay = '0s !important';
          // Clear drag offset but preserve rotation
          nodeEl.style.transform = rotation !== 0 ? `rotate(${rotation}deg)` : '';
          // Force a reflow to ensure styles are applied
          void nodeEl.offsetHeight;
          // Re-enable transitions in next frame
          requestAnimationFrame(() => {
            nodeEl.style.transition = '';
            nodeEl.style.transitionDuration = '';
            nodeEl.style.transitionDelay = '';
          });
        }
      });

      draggingInfoRef.current = null;

      requestAnimationFrame(() => {
        if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
        if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();
      });
      
      // Compute drop point in graph coords from last mouse position.
      // We intentionally avoid fallbacks so that downstream logic only ever
      // acts on real pointer coordinates.
      const dropPointGraph =
        lastMousePos.current && panRef.current && zoomRef.current
          ? {
              x: (lastMousePos.current.x - panRef.current.x) / zoomRef.current,
              y: (lastMousePos.current.y - panRef.current.y) / zoomRef.current
            }
          : null;

      // Build a payload that always includes node snapshots with the final position.
      let payloadNodes = updatedSnapshots;
      if (!payloadNodes.length) {
        const snapshots = getNodeSnapshotsByIds(draggingNodeIdRef.current);
        payloadNodes = snapshots;
      }

      // Ensure every payload node carries the dropPoint position when available.
      if (payloadNodes.length && dropPointGraph) {
        payloadNodes = payloadNodes.map((n) => ({
          ...n,
          position: { x: dropPointGraph.x, y: dropPointGraph.y }
        }));
      }

      // Only emit nodeDragEnd if we actually dragged
      eventBus.emit('nodeDragEnd', {
        nodeIds: draggingNodeIdRef.current,
        nodes: payloadNodes,
        dropPoint: dropPointGraph
      });
    }

    setDraggingNodeId(null);
    draggingNodeIdRef.current = null;
    
    // Delay resetting suppressClick to ensure click handler sees it
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 10);
    
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }

  // ============================================
  // Group Drag Handlers
  // ============================================
  
  function onGroupDragMove(e) {
    if (!draggingGroupIdRef.current || dragRafRef.current !== null) return;
    
    dragRafRef.current = requestAnimationFrame(() => {
      const group = groups.find(g => g.id === draggingGroupIdRef.current);
      if (group && group.bounds) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const currentX = (e.clientX - rect.left - pan.x) / zoom;
          const currentY = (e.clientY - rect.top - pan.y) / zoom;
          
          const deltaX = currentX - dragOffset.current.x;
          const deltaY = currentY - dragOffset.current.y;
          
          dragOffset.current.x = currentX;
          dragOffset.current.y = currentY;
          
          groupDragOffsetRef.current.x += deltaX;
          groupDragOffsetRef.current.y += deltaY;
          
          setNodes(prevNodes => prevNodes.map(node => {
            if (group.nodeIds.includes(node.id)) {
              return {
                ...node,
                position: {
                  x: node.position.x + deltaX,
                  y: node.position.y + deltaY
                }
              };
            }
            return node;
          }));
          
          setGroups(prevGroups => prevGroups.map(g => {
            if (g.id === group.id) {
              return {
                ...g,
                bounds: {
                  ...g.bounds,
                  x: g.bounds.x + deltaX,
                  y: g.bounds.y + deltaY
                }
              };
            }
            return g;
          }));
          
          if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();
          if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
        }
      }
      dragRafRef.current = null;
    });
  }

  function onGroupDragStart(e, group) {
    e.preventDefault();
    setDraggingGroupId(group.id);
    draggingGroupIdRef.current = group.id;
    groupDragOffsetRef.current = { x: 0, y: 0 };
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom
      };
    }
    window.addEventListener('mousemove', onGroupDragMove, { passive: false });
    window.addEventListener('mouseup', handleGroupDragEnd, { passive: false });
  }

  function handleGroupDragEnd() {
    setDraggingGroupId(null);
    draggingGroupIdRef.current = null;
    groupDragOffsetRef.current = { x: 0, y: 0 };
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    window.removeEventListener('mousemove', onGroupDragMove);
    window.removeEventListener('mouseup', handleGroupDragEnd);
    
    if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();
    if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
  }

  // ============================================
  // Edge Click Handler
  // ============================================
  
  useEffect(() => {
    const handleEdgeClickWrapper = ({ id, event }) => {
      const isMultiSelect = event?.ctrlKey || event?.metaKey;
      
      if (isMultiSelect) {
        setSelectedEdgeIds(prev => {
          if (prev.includes(id)) {
            return prev.filter(eid => eid !== id);
          } else {
            return [...prev, id];
          }
        });
      } else {
        setSelectedEdgeIds(prev => {
          const already = prev.includes(id);
          return already ? prev : [id];
        });
      }
      setSelectedNodeIds([]);
    };

    eventBus.on('edgeClick', handleEdgeClickWrapper);
    return () => eventBus.off('edgeClick', handleEdgeClickWrapper);
  }, [setSelectedEdgeIds, setSelectedNodeIds]);

  // ============================================
  // Marquee Selection
  // ============================================

  const {
    isSelecting,
    selectionRect,
    startSelection,
    updateSelection,
    endSelection
  } = useMarqueeSelection({
    nodes,
    pan,
    zoom,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    onNodeClick,
    containerRef
  });

  useEffect(() => {
    if (!isSelecting) return;

    const handleMouseMove = (e) => updateSelection(e);
    const handleMouseUp = (e) => endSelection(e);

    const element = panZoomRef.current;
    if (element) {
      element.addEventListener('mousemove', handleMouseMove, { capture: true });
      element.addEventListener('mouseup', handleMouseUp, { capture: true });
    }

    return () => {
      if (element) {
        element.removeEventListener('mousemove', handleMouseMove, { capture: true });
        element.removeEventListener('mouseup', handleMouseUp, { capture: true });
      }
    };
  }, [isSelecting, updateSelection, endSelection]);

  // ============================================
  // Layer Redraws
  // ============================================
  
  useEffect(() => {
    requestAnimationFrame(() => {
      try {
        if (handleLayerImperativeRef.current?.redraw) {
          handleLayerImperativeRef.current.redraw();
        }
        if (edgeLayerImperativeRef.current?.redraw) {
          edgeLayerImperativeRef.current.redraw();
        }
      } catch (err) {
        console.warn('Error redrawing layers:', err);
      }
    });
  }, [nodes, groups, edges]);

  // Force initial redraw of layers on mount
  useEffect(() => {
    // Force initial redraw of layers on mount
    if (handleLayerImperativeRef.current?.redraw) {
      handleLayerImperativeRef.current.redraw();
    }
    if (edgeLayerImperativeRef.current?.redraw) {
      edgeLayerImperativeRef.current.redraw();
    }
  }, []);



  // ============================================
  // Background Iframe Handlers
  // ============================================
  
  const handleIframeError = (e) => {
    console.warn('Background iframe error', e);
    setIframeError(true);
    try { eventBus.emit('backgroundLoadFailed', { url: backgroundUrl }); } catch (err) {}
    if (setSnackbar) {
      setSnackbar({ open: true, message: 'Background page failed to load or blocked by X-Frame-Options/CSP.', severity: 'warning' });
    }
  };

  const handleIframeLoad = () => {
    if (iframeError) setIframeError(false);
  };

  // ============================================
  // Render
  // ============================================

  const nodePositionMap = useMemo(() => {
    const map = {};
    nodes.forEach(node => {
      map[node.id] = {
        x: node.position.x * zoom + pan.x,
        y: node.position.y * zoom + pan.y,
        width: node.width,
        height: node.height
      };
    });
    return map;
  }, [nodes, pan, zoom]);

  // Live refs for nodes, edges, pan, zoom
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const getNodeSnapshotsByIds = useCallback((ids = []) => {
    const source = nodesRef.current || nodes || [];
    return ids
      .map((id) => {
        if (!id) return null;
        const node = source.find((entry) => entry && entry.id === id);
        if (!node) return null;
        try {
          return JSON.parse(JSON.stringify(node));
        } catch (err) {
          return { ...node };
        }
      })
      .filter(Boolean);
  }, [nodes]);

  useTouchGestures(containerRef, {
    onPinchStart: ({ center, distance }) => {
      const container = containerRef.current;
      if (!container || !distance || distance <= 0) return;
      const rect = container.getBoundingClientRect();
      const initialZoom = zoomRef.current || zoom;
      const initialPan = panRef.current || pan;
      const relativeCenter = {
        x: center.x - rect.left,
        y: center.y - rect.top
      };
      const graphPoint = {
        x: (relativeCenter.x - initialPan.x) / initialZoom,
        y: (relativeCenter.y - initialPan.y) / initialZoom
      };
      pinchStateRef.current = {
        initialDistance: distance,
        initialZoom,
        initialPan,
        graphPoint,
        rect
      };
    },
    onPinchMove: ({ center, distance }) => {
      const pinch = pinchStateRef.current;
      const container = containerRef.current;
      if (!pinch || !container || !distance || distance <= 0 || !pinch.initialDistance) return;
      const rawScale = distance / pinch.initialDistance;
      if (!rawScale || !isFinite(rawScale)) return;
      const nextZoom = clampZoom(pinch.initialZoom * rawScale);
      const rect = pinch.rect || container.getBoundingClientRect();
      const relativeCenter = {
        x: center.x - rect.left,
        y: center.y - rect.top
      };
      const { graphPoint } = pinch;
      const newPan = {
        x: relativeCenter.x - graphPoint.x * nextZoom,
        y: relativeCenter.y - graphPoint.y * nextZoom
      };
      if (typeof setZoom === 'function') setZoom(nextZoom);
      if (typeof setPan === 'function') setPan(newPan);
    },
    onPinchEnd: () => {
      pinchStateRef.current = null;
    }
  });

  // REMOVED: Auto-fit on load is now disabled
  // Viewport should be controlled by saved viewport state in .node files
  // or by explicit user actions (fit-to-nodes button, etc.)

  // Debug helpers: expose viewport and force redraw to window for console diagnostics
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.__NG_VIEWPORT = {
          get: () => ({ pan: panRef.current || pan, zoom: zoomRef.current || zoom }),
          pan: () => (panRef.current || pan),
          zoom: () => (zoomRef.current || zoom)
        };

        window.__NG_FORCE_REDRAW = () => {
          try { if (handleLayerImperativeRef.current && typeof handleLayerImperativeRef.current.redraw === 'function') handleLayerImperativeRef.current.redraw(); } catch (e) {}
          try { if (edgeLayerImperativeRef.current && typeof edgeLayerImperativeRef.current.redraw === 'function') edgeLayerImperativeRef.current.redraw(); } catch (e) {}
        };
        
        // Allow setting viewport from console for diagnostics
        window.__NG_SET_VIEWPORT = ({ pan: newPan, zoom: newZoom } = {}) => {
          try {
            if (newZoom !== undefined && typeof setZoom === 'function') setZoom(Number(newZoom));
            if (newPan && typeof setPan === 'function') setPan({ x: Number(newPan.x) || 0, y: Number(newPan.y) || 0 });
          } catch (e) { /* ignore */ }
        };
        
        // Compute a fit-to-nodes viewport and apply it
        window.__NG_FIT_TO_NODES = ({ padding = 40, minZoom = 0.2, maxZoom = 3 } = {}) => {
          try {
            const nodes = nodesRef.current || [];
            const container = containerRef.current;
            if (!container || !nodes || nodes.length === 0) return null;

            const positions = nodes.map(n => ({
              x: (n.position?.x ?? n.x ?? 0),
              y: (n.position?.y ?? n.y ?? 0),
              width: n.width || 60,
              height: n.height || 60
            }));

            const minX = Math.min(...positions.map(p => p.x - p.width / 2));
            const maxX = Math.max(...positions.map(p => p.x + p.width / 2));
            const minY = Math.min(...positions.map(p => p.y - p.height / 2));
            const maxY = Math.max(...positions.map(p => p.y + p.height / 2));

            const bboxW = Math.max(1, maxX - minX);
            const bboxH = Math.max(1, maxY - minY);

            const availW = Math.max(1, container.clientWidth - padding * 2);
            const availH = Math.max(1, container.clientHeight - padding * 2);

            const scaleX = availW / bboxW;
            const scaleY = availH / bboxH;
            let newZoomVal = Math.min(scaleX, scaleY);
            newZoomVal = Math.max(minZoom, Math.min(maxZoom, newZoomVal));

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const newPanX = container.clientWidth / 2 - centerX * newZoomVal;
            const newPanY = container.clientHeight / 2 - centerY * newZoomVal;

            if (typeof setZoom === 'function') setZoom(newZoomVal);
            if (typeof setPan === 'function') setPan({ x: newPanX, y: newPanY });

            // force redraw after layout
            requestAnimationFrame(() => {
              try { window.__NG_FORCE_REDRAW && window.__NG_FORCE_REDRAW(); } catch (e) {}
            });

            return { pan: { x: newPanX, y: newPanY }, zoom: newZoomVal };
          } catch (e) { return null; }
        };
       }
     } catch (err) { /* ignore */ }
 
     return () => {
       try { if (typeof window !== 'undefined') { delete window.__NG_VIEWPORT; delete window.__NG_FORCE_REDRAW; } } catch (e) {}
     };
   }, [pan, zoom]);

  return (
    <div id="graph-canvas" ref={containerRef} style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      background: "none",
      zIndex: 0,
      pointerEvents: 'auto'
    }}>
      {backgroundUrl && (
        <iframe
          src={backgroundUrl}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            zIndex: -3,
            pointerEvents: backgroundInteractive ? 'auto' : 'none',
            opacity: backgroundInteractive ? 1 : 0.85,
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="Background Web Page"
        />
      )}

      {iframeError && (
        <div style={{ position: 'absolute', inset: 20, zIndex: -1, pointerEvents: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: 12, borderRadius: 6, maxWidth: 520, pointerEvents: 'auto' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Background page blocked</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 8 }}>The page at the specified URL refused to load in an iframe (X-Frame-Options/CSP) or network error occurred.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => eventBus.emit('clearBackgroundUrl')} style={{ padding: '6px 10px' }}>Clear background</button>
              <button onClick={() => setIframeError(false)} style={{ padding: '6px 10px' }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <div
        id="graph-editor-background"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -2,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          pointerEvents: 'none',
          backgroundImage: backgroundImage ? `url('${backgroundImage}')` : 'none'
        }}
      />

      {(() => {
        return null;
      })()}

      <PanZoomLayer
        ref={panZoomRef}
        pan={pan}
        zoom={zoom}
        onPanZoom={setPan}
        setZoom={setZoom}
        onBackgroundClick={() => {
          if (setSelectedNodeIds) setSelectedNodeIds([]);
          if (setSelectedEdgeIds) setSelectedEdgeIds([]);
        }}
        theme={theme}
        onMarqueeStart={(e) => handleMarqueeStart({ e, startSelection })}
        layerRefs={layerRefs}
      >
        {showGrid && (
          <GridLayer pan={pan} zoom={zoom} gridSize={gridSize} theme={theme} />
        )}

        <GroupLayer
          ref={groupRef}
          groups={groups}
          nodes={nodes}
          pan={pan}
          zoom={zoom}
          selectedGroupIds={selectedGroupIds}
          onGroupClick={onGroupClick}
          onGroupDoubleClick={onGroupClick}
          onGroupDragStart={onGroupDragStart}
          onBackgroundClick={() => {}}
          theme={theme}
        />
        
        <EdgeLayer
          ref={edgeLayerImperativeRef}
          draggingInfoRef={draggingInfoRef}
          canvasRef={edgeCanvasRef}
          edgeList={edges}
          nodeList={nodes}
          pan={pan}
          zoom={zoom}
          selectedEdgeId={selectedEdgeId}
          selectedEdgeIds={selectedEdgeIds}
          theme={theme}
          hoveredNodeId={hoveredNodeId}
          onEdgeClick={(edge, event) => {
            eventBus.emit('edgeClick', { id: edge?.id, event });
          }}
          onEdgeDoubleClick={(edge, event) => {
            if (typeof onEdgeDoubleClick === 'function') {
              onEdgeDoubleClick(edge.id);
            }
          }}
          onEdgeHover={undefined}
          showAllEdgeLabels={showAllEdgeLabels}
          edges={edges}
          nodePositionMap={nodePositionMap}
        />
        
        <HandleLayer
          ref={handleLayerImperativeRef}
          draggingInfoRef={draggingInfoRef}
          canvasRef={handleCanvasRef}
          nodes={nodeList}
          edges={edges}
          pan={pan}
          zoom={zoom}
          edgeTypes={edgeTypes} 
          selectedEdgeIds={selectedEdgeIds}
          hoveredEdgeId={hoveredEdgeId}
        />
      
      <NodeLayer
        containerRef={nodeContainerRef}
        nodeRefs={nodeRefs}
        nodes={nodes}
        pan={pan}
        zoom={zoom}
        selectedNodeId={selectedNodeId}
        selectedNodeIds={selectedNodeIds}
        draggingNodeId={draggingNodeId}
        theme={theme}
        nodeTypes={nodeTypes}
        lockedNodes={lockedNodes}
        suppressClickRef={suppressClickRef}
        onNodeEvent={(id, e) => {
          // Handle node click
          if (onNodeClick) {
            onNodeClick(id, e);
          } else {
            // Default behavior: select the node
            const isMultiSelect = e?.ctrlKey || e?.metaKey;
            if (isMultiSelect) {
              setSelectedNodeIds(prev => {
                if (prev.includes(id)) {
                  return prev.filter(nid => nid !== id);
                } else {
                  return [...prev, id];
                }
              });
            } else {
              setSelectedNodeIds([id]);
              setSelectedEdgeIds([]);
            }
          }
        }}
        onNodeDoubleClick={(id) => {
          if (typeof onNodeDoubleClick === 'function') {
            onNodeDoubleClick(id);
          }
        }}
        onNodeMouseEnter={(id) => {
          eventBus.emit('nodeHover', { id });
        }}
        onNodeMouseLeave={(id) => {
          eventBus.emit('nodeUnhover', { id });
        }}
        onNodeDragStart={(e, node) => {
          // Emit event that your existing handler will catch
          eventBus.emit('nodeDragStart', { node, event: e });
        }}
      />

        

        {/* Preview line during handle drag */}
        {handlePreviewLine && (
          <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: '100%', zIndex: 25 }}>
            <line
              x1={handlePreviewLine.startX}
              y1={handlePreviewLine.startY}
              x2={handlePreviewLine.endX}
              y2={handlePreviewLine.endY}
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              strokeDasharray="6,4"
            />
          </svg>
        )}

        <MarqueeOverlay 
          selectionRect={selectionRect} 
          theme={theme} 
        />
      </PanZoomLayer>

      {showMinimap && (
        <Minimap
          nodes={nodeList}
          groups={groups}
          pan={pan}
          zoom={zoom}
          setPan={setPan}
          containerWidth={window.innerWidth}
          containerHeight={window.innerHeight}
          width={220}
          height={165}
          position="bottom-right"
        />
      )}
    </div>
  );
}
