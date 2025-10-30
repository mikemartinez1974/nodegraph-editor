// eventHandlers.js
import React, { useEffect } from 'react';
import eventBus from './eventBus';
import { isPointNearLine, isPointNearBezier } from './utils.js';

// ============================================
// Legacy handlers (kept for backward compatibility)
// ============================================

export function handleCanvasClick(e, canvasRef, pan, zoom, edgeListRef, nodeList, setSelectedEdgeId, setSelectedNodeId) {
  const rect = canvasRef.current.getBoundingClientRect();
  const x = (e.clientX - rect.left - pan.x) / zoom;
  const y = (e.clientY - rect.top - pan.y) / zoom;
  for (const edge of edgeListRef.current) {
    const sourceNode = nodeList.find(n => n.id === edge.source);
    const targetNode = nodeList.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;
    const x1 = sourceNode.position.x;
    const y1 = sourceNode.position.y;
    const x2 = targetNode.position.x;
    const y2 = targetNode.position.y;
    if (edge.type === 'curved') {
      const curveOffset = Math.max(Math.abs(y2 - y1), 100);
      const cx1 = x1 + curveOffset;
      const cy1 = y1;
      const cx2 = x2 - curveOffset;
      const cy2 = y2;
      if (isPointNearBezier(x, y, x1, y1, cx1, cy1, cx2, cy2, x2, y2)) {
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
        return;
      }
    } else {
      if (isPointNearLine(x, y, x1, y1, x2, y2)) {
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
        return;
      }
    }
  }
}

export function handleCanvasMouseDown(e, isPanning, setIsPanningState, lastPanPos, handleCanvasMouseMove, handleCanvasMouseUp) {
  if (e.button === 0 && e.target === e.currentTarget) {
    isPanning.current = true;
    setIsPanningState(true);
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
  }
}

export function handleCanvasMouseMove(e, isPanning, lastPanPos, setPan) {
  if (isPanning.current) {
    const dx = e.clientX - lastPanPos.current.x;
    const dy = e.clientY - lastPanPos.current.y;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }
}

export function handleCanvasMouseUp(isPanning, setIsPanningState, handleCanvasMouseMove, handleCanvasMouseUp) {
  isPanning.current = false;
  setIsPanningState(false);
  window.removeEventListener('mousemove', handleCanvasMouseMove);
  window.removeEventListener('mouseup', handleCanvasMouseUp);
}

export function handleNodeMouseDown(e, node, setDraggingNodeId, draggingNodeIdRef, dragOffset, zoom, pan, handleNodeMouseMove, handleNodeMouseUp) {
  e.preventDefault();
  setDraggingNodeId(node.id);
  draggingNodeIdRef.current = node.id;
  dragOffset.current = {
    x: e.clientX - (node.position.x * zoom + pan.x),
    y: e.clientY - (node.position.y * zoom + pan.y)
  };
  window.addEventListener('mousemove', handleNodeMouseMove);
  window.addEventListener('mouseup', handleNodeMouseUp);
}

export function handleNodeMouseMove(e, draggingNodeIdRef, dragOffset, pan, zoom, setNodeList) {
  if (draggingNodeIdRef.current) {
    const newX = (e.clientX - dragOffset.current.x - pan.x) / zoom;
    const newY = (e.clientY - dragOffset.current.y - pan.y) / zoom;
    setNodeList(prev => prev.map(n => n.id === draggingNodeIdRef.current ? { ...n, position: { x: newX, y: newY } } : n));
  }
}

export function handleNodeMouseUp(setDraggingNodeId, draggingNodeIdRef, handleNodeMouseMove, handleNodeMouseUp) {
  setDraggingNodeId(null);
  draggingNodeIdRef.current = null;
  window.removeEventListener('mousemove', handleNodeMouseMove);
  window.removeEventListener('mouseup', handleNodeMouseUp);
}

export function onNodeDragStart(e, node, setDraggingNodeId, draggingNodeIdRef, dragOffset, zoom, pan, onNodeDragMove, onNodeDragEnd) {
  e.preventDefault();
  setDraggingNodeId(node.id);
  draggingNodeIdRef.current = node.id;
  dragOffset.current = {
    x: e.clientX - (node.position.x * zoom + pan.x),
    y: e.clientY - (node.position.y * zoom + pan.y)
  };
  window.addEventListener('mousemove', onNodeDragMove);
  window.addEventListener('mouseup', onNodeDragEnd);
}

export function onNodeDragEnd(setDraggingNodeId, draggingNodeIdRef, onNodeDragMove, onNodeDragEnd) {
  setDraggingNodeId(null);
  draggingNodeIdRef.current = null;
  window.removeEventListener('mousemove', onNodeDragMove);
  window.removeEventListener('mouseup', onNodeDragEnd);
}

export function handleNodeClick({ id, event, setSelectedNodeIds, setSelectedEdgeIds, onNodeClick }) {
  if (!onNodeClick && setSelectedNodeIds) {
    setSelectedNodeIds([id]);
    if (setSelectedEdgeIds) setSelectedEdgeIds([]);
  }
}

export function handleEdgeClick({ id, event, setSelectedEdgeIds, setSelectedNodeIds, onEdgeClick }) {
  if (!onEdgeClick && setSelectedEdgeIds) {
    setSelectedEdgeIds([id]);
    if (setSelectedNodeIds) setSelectedNodeIds([]);
  }
}

export function handleEdgeHover(id, setHoveredNodeId) {
  setHoveredNodeId(id);
}

export function handleNodeMouseEnter({ id, setHoveredNodeId, setIsNodeHovered, hoverTimeoutRef, isNodeHovered, isHandleHovered, draggingHandle }) {
  setHoveredNodeId(id);
  setIsNodeHovered(true);
}

export function handleNodeMouseLeave({ id, setHoveredNodeId, setIsNodeHovered, hoverTimeoutRef, isNodeHovered, isHandleHovered, draggingHandle }) {
  setIsNodeHovered(false);
  if (hoverTimeoutRef.current[id]) {
    clearTimeout(hoverTimeoutRef.current[id]);
  }
  hoverTimeoutRef.current[id] = setTimeout(() => {
    if (!isNodeHovered && !isHandleHovered && !draggingHandle) {
      setHoveredNodeId(prev => (prev === id ? null : prev));
    }
    hoverTimeoutRef.current[id] = null;
  }, 250);
}

// ============================================
// Unified Event Handler Class
// Coordinates events across all layers
// ============================================

/**
 * Unified Event Handler for NodeGraph
 * Coordinates events across all layers in proper priority order
 * 
 * Priority Order (highest to lowest):
 * 1. Handles (create new edges, modify existing edges)
 * 2. Nodes (select, drag, click)
 * 3. Edges (select, click)
 * 4. Groups (select, click)
 * 5. Background (deselect, pan)
 */
export class UnifiedEventHandler {
  constructor({
    containerRef,
    handleLayerRef,
    nodeRefs,
    nodes,
    edges,
    groups,
    pan,
    zoom,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedGroupIds,
    lockedNodes,
    onNodeClick,
    onEdgeClick,
    onGroupClick,
    onBackgroundClick
  }) {
    this.containerRef = containerRef;
    this.handleLayerRef = handleLayerRef;
    this.nodeRefs = nodeRefs;
    this.nodes = nodes;
    this.edges = edges;
    this.groups = groups;
    this.pan = pan;
    this.zoom = zoom;
    this.setSelectedNodeIds = setSelectedNodeIds;
    this.setSelectedEdgeIds = setSelectedEdgeIds;
    this.setSelectedGroupIds = setSelectedGroupIds;
    this.lockedNodes = lockedNodes;
    this.onNodeClick = onNodeClick;
    this.onEdgeClick = onEdgeClick;
    this.onGroupClick = onGroupClick;
    this.onBackgroundClick = onBackgroundClick;

    // State
    this.draggingHandle = null;
    this.previewLine = null;
    this.hoveredHandle = null;
    this.mouseDownPos = null;
    this.mouseDownTime = 0;
    this.dragThreshold = 5; // pixels of movement to consider it a drag
    
    // Bind methods
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  // Convert screen coordinates to graph coordinates
  screenToGraph(screenX, screenY) {
    const rect = this.containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    return {
      x: (screenX - rect.left - this.pan.x) / this.zoom,
      y: (screenY - rect.top - this.pan.y) / this.zoom
    };
  }

  // Check if point is inside a node
  hitTestNode(graphX, graphY) {
    for (const node of this.nodes) {
      if (node.visible === false) continue;
      
      const nodeX = node.position?.x || node.x || 0;
      const nodeY = node.position?.y || node.y || 0;
      const nodeWidth = node.width || 60;
      const nodeHeight = node.height || 60;
      
      if (graphX >= nodeX - nodeWidth / 2 &&
          graphX <= nodeX + nodeWidth / 2 &&
          graphY >= nodeY - nodeHeight / 2 &&
          graphY <= nodeY + nodeHeight / 2) {
        return node;
      }
    }
    return null;
  }

  // Check if point is inside a group
  hitTestGroup(graphX, graphY) {
    for (const group of this.groups) {
      if (!group.bounds || group.visible === false) continue;
      
      const { x, y, width, height } = group.bounds;
      
      if (graphX >= x && graphX <= x + width &&
          graphY >= y && graphY <= y + height) {
        return group;
      }
    }
    return null;
  }

  // Main event handler
  handleMouseDown(e) {
    const rect = this.containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX;
    const screenY = e.clientY;
    const graph = this.screenToGraph(screenX, screenY);

    // 1. Check handles first (highest priority)
    if (this.handleLayerRef.current) {
      const handle = this.handleLayerRef.current.hitTest(screenX, screenY);
      
      if (handle) {
        console.log('Handle clicked:', handle);
        e.stopPropagation();
        e.preventDefault();
        this.startHandleDrag(handle, e);
        return;
      }
    }

    // 2. Check nodes
    const hitNode = this.hitTestNode(graph.x, graph.y);
    if (hitNode) {
      e.stopPropagation();
      
      // Emit node click for selection handling
      eventBus.emit('nodeClick', { id: hitNode.id, event: e });
      
      // Start node drag if not locked
      if (!this.lockedNodes.has(hitNode.id)) {
        eventBus.emit('nodeDragStart', { node: hitNode, event: e });
      }
      return;
    }

    // 3. Edges are handled by EdgeLayer's own click detection
    // (EdgeLayer has sophisticated hit testing for curved edges)

    // 4. Check groups
    const hitGroup = this.hitTestGroup(graph.x, graph.y);
    if (hitGroup) {
      e.stopPropagation();
      
      if (this.onGroupClick) {
        this.onGroupClick(hitGroup.id);
      }
      
      if (this.setSelectedGroupIds) {
        this.setSelectedGroupIds([hitGroup.id]);
      }
      return;
    }

    // 5. Background - clear selections
    if (this.onBackgroundClick) {
      this.onBackgroundClick(e);
    }
    
    if (this.setSelectedNodeIds) this.setSelectedNodeIds([]);
    if (this.setSelectedEdgeIds) this.setSelectedEdgeIds([]);
    if (this.setSelectedGroupIds) this.setSelectedGroupIds([]);
  }

  handleMouseMove(e) {
    const rect = this.containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX;
    const screenY = e.clientY;
    const graph = this.screenToGraph(screenX, screenY);

    // Check for node proximity (for showing handles)
    const proximityMargin = 40; // pixels in graph space
    let nearNode = null;
    
    for (const node of this.nodes) {
      if (node.visible === false) continue;
      
      const nodeX = node.position?.x || node.x || 0;
      const nodeY = node.position?.y || node.y || 0;
      const nodeWidth = node.width || 60;
      const nodeHeight = node.height || 60;
      
      // Expand hit area for proximity detection
      if (graph.x >= nodeX - nodeWidth / 2 - proximityMargin &&
          graph.x <= nodeX + nodeWidth / 2 + proximityMargin &&
          graph.y >= nodeY - nodeHeight / 2 - proximityMargin &&
          graph.y <= nodeY + nodeHeight / 2 + proximityMargin) {
        nearNode = node;
        break;
      }
    }

    // Emit proximity events for handle visibility
    if (nearNode) {
      eventBus.emit('nodeProximity', { nodeId: nearNode.id });
    }

    // Update handle hover state
    if (this.handleLayerRef.current && !this.draggingHandle) {
      const handle = this.handleLayerRef.current.hitTest(screenX, screenY);
      
      if (handle !== this.hoveredHandle) {
        if (this.hoveredHandle) {
          eventBus.emit('handleUnhover', { handleId: this.hoveredHandle.id });
        }
        
        this.hoveredHandle = handle;
        
        if (handle) {
          eventBus.emit('handleHover', { handleId: handle.id, nodeId: handle.nodeId });
          // Change cursor
          if (this.containerRef.current) {
            this.containerRef.current.style.cursor = 'pointer';
          }
        } else {
          // Reset cursor
          if (this.containerRef.current) {
            this.containerRef.current.style.cursor = 'default';
          }
        }
      }
    }

    // Handle drag in progress
    if (this.draggingHandle) {
      this.updateHandleDrag(screenX, screenY);
    }
  }

  handleMouseUp(e) {
    if (this.draggingHandle) {
      this.endHandleDrag(e);
    }
  }

  // Handle drag operations
  startHandleDrag(handle, e) {
    this.draggingHandle = handle;
    
    const rect = this.containerRef.current?.getBoundingClientRect();
    this.previewLine = {
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      endX: e.clientX - rect.left,
      endY: e.clientY - rect.top
    };

    eventBus.emit('handleDragStart', { handle });
    
    // Change cursor
    if (this.containerRef.current) {
      this.containerRef.current.style.cursor = 'crosshair';
    }
  }

  updateHandleDrag(screenX, screenY) {
    if (!this.draggingHandle) return;

    const rect = this.containerRef.current?.getBoundingClientRect();
    this.previewLine.endX = screenX - rect.left;
    this.previewLine.endY = screenY - rect.top;

    // Emit event for visual preview
    eventBus.emit('handleDragMove', { 
      handle: this.draggingHandle,
      previewLine: this.previewLine
    });
  }

  endHandleDrag(e) {
    if (!this.draggingHandle) return;

    const graph = this.screenToGraph(e.clientX, e.clientY);
    const targetNode = this.hitTestNode(graph.x, graph.y);

    // Emit event for edge creation/modification
    eventBus.emit('handleDrop', {
      handle: this.draggingHandle,
      targetNode: targetNode?.id || null,
      targetNodeObject: targetNode,
      position: graph
    });

    this.draggingHandle = null;
    this.previewLine = null;

    eventBus.emit('handleDragEnd');
    
    // Reset cursor
    if (this.containerRef.current) {
      this.containerRef.current.style.cursor = 'default';
    }
  }

  // Update references (call when props change)
  updateRefs(updates) {
    Object.assign(this, updates);
  }

  // Attach event listeners
  attach() {
    const container = this.containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', this.handleMouseDown, { capture: true });
    container.addEventListener('mousemove', this.handleMouseMove);
    container.addEventListener('mouseup', this.handleMouseUp);
  }

  // Detach event listeners
  detach() {
    const container = this.containerRef.current;
    if (!container) return;

    container.removeEventListener('mousedown', this.handleMouseDown, { capture: true });
    container.removeEventListener('mousemove', this.handleMouseMove);
    container.removeEventListener('mouseup', this.handleMouseUp);
  }
}

// Hook to use the unified event handler
export function useUnifiedEventHandler(config) {
  const handlerRef = React.useRef(null);

  React.useEffect(() => {
    if (!handlerRef.current) {
      handlerRef.current = new UnifiedEventHandler(config);
      handlerRef.current.attach();
    } else {
      handlerRef.current.updateRefs(config);
    }

    return () => {
      if (handlerRef.current) {
        handlerRef.current.detach();
      }
    };
  }, [config]);

  return handlerRef;
}

export function useHandleClickHandler(callback) {
  useEffect(() => {
    eventBus.on('handleClick', callback);
    return () => {
      eventBus.off('handleClick', callback);
    };
  }, [callback]);
}

export default UnifiedEventHandler;