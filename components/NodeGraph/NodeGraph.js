"use client";
// NodeGraph.js
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { getEdgeHandlePosition } from './utils';
import EdgeLayer from './EdgeLayer';
import HandleLayer from './HandleLayer';
import PanZoomLayer from './PanZoomLayer';
import NodeLayer from './NodeLayer';
import GroupLayer from './GroupLayer';
import { useCanvasSize } from './hooks/useCanvasSize';
import eventBus from './eventBus';
import { handleNodeClick, handleEdgeClick, handleEdgeHover, handleNodeMouseEnter, handleNodeMouseLeave } from './eventHandlers';
import { onNodeDragMove, onNodeDragStart, handleNodeDragEnd } from './dragHandlers';
import { handleMarqueeStart, useMarqueeSelection, MarqueeOverlay } from './marqueeSelection';

export default function NodeGraph({ 
  nodes = [], 
  setNodes,
  edges = [], 
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
  onEdgeHover, 
  onNodeHover, 
  hoveredEdgeId, 
  hoveredEdgeSource, 
  hoveredEdgeTarget, 
  onNodeDragEnd 
}) {
  const theme = useTheme();
  
  // Auto-update group bounds when nodes move
  useEffect(() => {
    if (!setGroups || groups.length === 0) return;
    
    const updatedGroups = groups.map(group => {
      if (!group.nodeIds || group.nodeIds.length === 0) return group;
      
      const groupNodes = nodes.filter(n => group.nodeIds.includes(n.id));
      if (groupNodes.length === 0) return group;
      
      // Calculate bounding box with padding
      const padding = 20;
      const positions = groupNodes.map(n => ({
        x: n.position?.x || n.x || 0,
        y: n.position?.y || n.y || 0,
        width: n.width || 60,
        height: n.height || 60
      }));
      
      const minX = Math.min(...positions.map(p => p.x - p.width / 2)) - padding;
      const maxX = Math.max(...positions.map(p => p.x + p.width / 2)) + padding;
      const minY = Math.min(...positions.map(p => p.y - p.height / 2)) - padding;
      const maxY = Math.max(...positions.map(p => p.y + p.height / 2)) + padding;
      
      const newBounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
      
      // Only update if bounds changed significantly (avoid unnecessary updates)
      const boundsChanged = !group.bounds || 
        Math.abs(group.bounds.x - newBounds.x) > 1 ||
        Math.abs(group.bounds.y - newBounds.y) > 1 ||
        Math.abs(group.bounds.width - newBounds.width) > 1 ||
        Math.abs(group.bounds.height - newBounds.height) > 1;
      
      return boundsChanged ? { ...group, bounds: newBounds } : group;
    });
    
    // Check if any group actually changed
    const hasChanges = updatedGroups.some((g, i) => g !== groups[i]);
    if (hasChanges) {
      setGroups(updatedGroups);
    }
  }, [nodes, groups, setGroups]);
  
  const canvasRef = useRef(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [draggingGroupId, setDraggingGroupId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef(null);
  const draggingGroupIdRef = useRef(null);
  const containerRef = useRef(null); // Ensure containerRef is defined
  const isDragging = useRef(false); // Track if we actually dragged
  const dragStartTime = useRef(0); // Track when drag started
  const panZoomRef = useRef(null); // Ref for PanZoomLayer
  const hoverTimeoutRef = useRef({});
  const dragRafRef = useRef(null);
  const lastDragPosition = useRef(null);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const [draggingHandlePos, setDraggingHandlePos] = useState(null);
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const [handlePositions, setHandlePositions] = useState({});

  // Add refs for layers
  const edgeCanvasRef = useRef(null);
  const handleCanvasRef = useRef(null);
  const groupRef = useRef(null);
  const nodeContainerRef = useRef(null);

  const layerRefs = {
    edgeCanvas: edgeCanvasRef,
    handleCanvas: handleCanvasRef,
    group: groupRef,
    nodeContainer: nodeContainerRef,
  };

  // New for transient dragging
  const nodeRefs = useRef(new Map());  // Map<id, DOMElement>
  const draggingInfoRef = useRef(null);  // {nodeId, offset: {x, y}} graph-space
  const edgeLayerImperativeRef = useRef(null);
  const handleLayerImperativeRef = useRef(null);
  const lastMousePos = useRef(null); // New ref for mouse position

  // Process nodes with defaults
  const nodeList = useMemo(() => nodes.map(node => ({
    ...node,
    handleProgress: node.handleProgress !== undefined ? node.handleProgress : 0,
    showHandlesOnHover: node.showHandlesOnHover !== undefined ? node.showHandlesOnHover : true,
    visible: node.visible !== undefined ? node.visible : true
  })), [nodes]);

  // Replace inline event handlers with imported functions
  // Define handler functions outside useEffect
  function handleNodeClickWrapper({ id, event }) {
    // Ignore clicks that are actually drag-end events
    if (isDragging.current || (Date.now() - dragStartTime.current < 200 && draggingNodeIdRef.current)) {
      return;
    }
    
    if (!onNodeClick && setSelectedNodeIds) {
      setSelectedNodeIds([id]);
      if (setSelectedEdgeIds) setSelectedEdgeIds([]);
    }
  }

  function handleEdgeClickWrapper({ id, event }) {
    if (!onEdgeClick && setSelectedEdgeIds) {
      setSelectedEdgeIds([id]);
      if (setSelectedNodeIds) setSelectedNodeIds([]);
    }
  }

  // Event bus handlers for node/edge events
  useEffect(() => {
    eventBus.on('nodeClick', handleNodeClickWrapper);
    eventBus.on('edgeClick', handleEdgeClickWrapper);
    return () => {
      eventBus.off('nodeClick', handleNodeClickWrapper);
      eventBus.off('edgeClick', handleEdgeClickWrapper);
    };
  }, [setSelectedNodeIds, setSelectedEdgeIds, onNodeClick, onEdgeClick]);

  // Consolidate event bus handler registration
  useEffect(() => {
    const eventHandlers = [
      { event: 'nodeMouseEnter', handler: (data) => handleNodeMouseEnter({ ...data, setHoveredNodeId, setIsNodeHovered, hoverTimeoutRef, isNodeHovered, isHandleHovered, draggingHandle }) },
      { event: 'nodeMouseLeave', handler: (data) => handleNodeMouseLeave({ ...data, setHoveredNodeId, setIsNodeHovered, hoverTimeoutRef, isNodeHovered, isHandleHovered, draggingHandle }) },
      { event: 'nodeHover', handler: ({ id }) => setHoveredNodeId(id) },
      { event: 'nodeUnhover', handler: () => setHoveredNodeId(null) },
      { event: 'handleHover', handler: ({ nodeId }) => setHoveredNodeId(nodeId) },
      { event: 'handleUnhover', handler: () => setHoveredNodeId(null) },
    ];

    eventHandlers.forEach(({ event, handler }) => eventBus.on(event, handler));

    return () => {
      eventHandlers.forEach(({ event, handler }) => eventBus.off(event, handler));
    };
  }, [setHoveredNodeId, setIsNodeHovered, hoverTimeoutRef, isNodeHovered, isHandleHovered, draggingHandle]);

  // Listen for node/handle hover events from the event bus
  useEffect(() => {
    const handleNodeHover = ({ id }) => setHoveredNodeId(id);
    const handleNodeUnhover = () => setHoveredNodeId(null);
    const handleHandleHover = ({ nodeId }) => setHoveredNodeId(nodeId);
    const handleHandleUnhover = () => setHoveredNodeId(null);
    eventBus.on('nodeHover', handleNodeHover);
    eventBus.on('nodeUnhover', handleNodeUnhover);
    eventBus.on('handleHover', handleHandleHover);
    eventBus.on('handleUnhover', handleHandleUnhover);
    return () => {
      eventBus.off('nodeHover', handleNodeHover);
      eventBus.off('nodeUnhover', handleNodeUnhover);
      eventBus.off('handleHover', handleHandleHover);
      eventBus.off('handleUnhover', handleHandleUnhover);
    };
  }, []);

  // Replace inline drag handlers with imported functions
  // Node drag logic
  function onNodeDragMove(e) {
    if (draggingNodeIdRef.current && Array.isArray(draggingNodeIdRef.current)) {
      const graphDx = (e.clientX - lastMousePos.current.x) / zoom;
      const graphDy = (e.clientY - lastMousePos.current.y) / zoom;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      if (!draggingInfoRef.current) {
        draggingInfoRef.current = { nodeIds: draggingNodeIdRef.current, offset: { x: 0, y: 0 } };
      }
      draggingInfoRef.current.offset.x += graphDx;
      draggingInfoRef.current.offset.y += graphDy;
      
      // Mark that we've actually dragged (moved the mouse)
      isDragging.current = true;

      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          // Move all dragging nodes
          draggingNodeIdRef.current.forEach(nodeId => {
            const nodeEl = nodeRefs.current.get(nodeId);
            if (nodeEl) {
              nodeEl.style.transform = `translate(${draggingInfoRef.current.offset.x * zoom}px, ${draggingInfoRef.current.offset.y * zoom}px)`;
            }
          });

          // Redraw canvases
          if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
          if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();

          dragRafRef.current = null;
        });
      }
    }
  }

  function onNodeDragStart(e, node) {
    e.preventDefault();
    
    // Determine which nodes to drag
    let nodesToDrag = [node.id];
    if (selectedNodeIds.includes(node.id) && selectedNodeIds.length > 1) {
      // Dragging a selected node with multiple selections - drag all selected
      nodesToDrag = [...selectedNodeIds];
    }
    
    setDraggingNodeId(node.id);
    draggingNodeIdRef.current = nodesToDrag; // Now stores array of IDs
    isDragging.current = false; // Reset drag flag
    dragStartTime.current = Date.now(); // Track start time
    
    // Store initial positions for all nodes being dragged
    const initialPositions = {};
    nodesToDrag.forEach(id => {
      const n = nodes.find(nd => nd.id === id);
      if (n) {
        initialPositions[id] = { x: n.position.x, y: n.position.y };
      }
    });
    lastDragPosition.current = initialPositions;
    
    dragOffset.current = {
      x: e.clientX - (node.position.x * zoom + pan.x),
      y: e.clientY - (node.position.y * zoom + pan.y)
    };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    containerRef.current.addEventListener('mousemove', onNodeDragMove, { passive: false });
    containerRef.current.addEventListener('mouseup', handleNodeDragEnd, { passive: false });
  }

  function handleNodeDragEnd() {
    if (draggingNodeIdRef.current && Array.isArray(draggingNodeIdRef.current) && draggingInfoRef.current) {
      const offset = draggingInfoRef.current.offset;
      
      // Update all dragged nodes
      draggingNodeIdRef.current.forEach(id => {
        const node = nodes.find(n => n.id === id);
        if (node && typeof onNodeMove === 'function') {
          const newPosition = { 
            x: node.position.x + offset.x, 
            y: node.position.y + offset.y 
          };
          onNodeMove(id, newPosition);
        }

        // Reset transform
        const nodeEl = nodeRefs.current.get(id);
        if (nodeEl) nodeEl.style.transform = '';
      });

      draggingInfoRef.current = null;

      // Force redraws after React state update completes
      requestAnimationFrame(() => {
        if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
        if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();
      });

      // Call onNodeDragEnd if needed
      if (typeof onNodeDragEnd === 'function' && lastDragPosition.current) {
        // Call once per dragged node with updated positions
        draggingNodeIdRef.current.forEach(id => {
          const initial = lastDragPosition.current[id];
          if (initial) {
            const finalPos = { x: initial.x + offset.x, y: initial.y + offset.y };
            onNodeDragEnd(id, finalPos);
          }
        });
      }
    }

    setDraggingNodeId(null);
    draggingNodeIdRef.current = null;
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    containerRef.current.removeEventListener('mousemove', onNodeDragMove);
    containerRef.current.removeEventListener('mouseup', handleNodeDragEnd);
  }

  // Group drag logic
  const groupDragOffsetRef = useRef({ x: 0, y: 0 });
  
  function onGroupDragMove(e) {
    if (draggingGroupIdRef.current && dragRafRef.current === null) {
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
            
            // Track cumulative offset for handles
            groupDragOffsetRef.current.x += deltaX;
            groupDragOffsetRef.current.y += deltaY;
            
            // Update node positions in the group
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
            
            // Update group bounds
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
            
            // Redraw handles to follow
            if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();
            if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
          }
        }
        dragRafRef.current = null;
      });
    }
  }

  function onGroupDragStart(e, group) {
    e.preventDefault();
    setDraggingGroupId(group.id);
    draggingGroupIdRef.current = group.id;
    groupDragOffsetRef.current = { x: 0, y: 0 }; // Reset cumulative offset
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
    groupDragOffsetRef.current = { x: 0, y: 0 }; // Reset offset
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    window.removeEventListener('mousemove', onGroupDragMove);
    window.removeEventListener('mouseup', handleGroupDragEnd);
    
    // Final redraw after drag ends
    if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();
    if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
  }

  // Handle background click from PanZoomLayer
  function handleBackgroundClickFromPanZoom(event) {
    if (typeof onBackgroundClick === 'function') {
      onBackgroundClick(event);
    }
    if (setSelectedNodeIds) setSelectedNodeIds([]);
    if (setSelectedEdgeIds) setSelectedEdgeIds([]);
  }

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

  // Marquee selection event listeners
  useEffect(() => {
    if (!isSelecting) return;

    console.log('useEffect: Adding mousemove and mouseup listeners for marquee selection'); // Debug log

    const handleMouseMove = (e) => {
      console.log('mousemove event detected'); // Debug log
      updateSelection(e);
    };

    const handleMouseUp = (e) => {
      console.log('mouseup event detected'); // Debug log
      endSelection(e);
    };

    const element = panZoomRef.current;
    if (element) {
      element.addEventListener('mousemove', handleMouseMove, { capture: true });
      element.addEventListener('mouseup', handleMouseUp, { capture: true });
    }

    return () => {
      console.log('useEffect: Removing mousemove and mouseup listeners for marquee selection'); // Debug log
      if (element) {
        element.removeEventListener('mousemove', handleMouseMove, { capture: true });
        element.removeEventListener('mouseup', handleMouseUp, { capture: true });
      }
    };
  }, [isSelecting, updateSelection, endSelection, panZoomRef]);

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
      <PanZoomLayer
        ref={panZoomRef}
        pan={pan}
        zoom={zoom}
        onPanZoom={setPan}
        setZoom={setZoom}
        onBackgroundClick={handleBackgroundClickFromPanZoom}
        theme={theme}
        style={{ pointerEvents: 'auto', width: '100vw', height: '100vh' }}
        layerRefs={{ ...layerRefs, container: containerRef }}
        onMarqueeStart={(e) => handleMarqueeStart({ e, startSelection })}
      >
        <GroupLayer
          ref={groupRef}
          groups={groups}
          nodes={nodeList}
          pan={pan}
          zoom={zoom}
          selectedGroupIds={selectedGroupIds}
          onGroupClick={onGroupClick}
          onGroupDoubleClick={onGroupClick}
          onGroupDragStart={onGroupDragStart}
          theme={theme}
        />
        
        <EdgeLayer
          ref={edgeLayerImperativeRef}
          draggingInfoRef={draggingInfoRef}
          canvasRef={edgeCanvasRef}
          edgeList={edges}
          nodeList={nodeList}
          pan={pan}
          zoom={zoom}
          selectedEdgeId={selectedEdgeId}
          selectedEdgeIds={selectedEdgeIds}
          theme={theme}
          hoveredNodeId={hoveredNodeId}
          handlePositions={handlePositions}
          onEdgeClick={(edge, event) => {
            eventBus.emit('edgeClick', { id: edge?.id });
            if (typeof onEdgeClick === 'function') onEdgeClick(edge, event);
          }}
          onEdgeDoubleClick={(edge, event) => {
            if (typeof onEdgeDoubleClick === 'function') {
              onEdgeDoubleClick(edge.id);
            }
          }}
          onEdgeHover={onEdgeHover}
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
        />

        <div style={{ pointerEvents: draggingHandle ? 'none' : 'auto' }}>
          <NodeLayer
            containerRef={nodeContainerRef}
            nodeRefs={nodeRefs}
            nodes={nodeList.filter(node => node.visible !== false)}
            pan={pan}
            zoom={zoom}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            draggingNodeId={draggingNodeId}
            theme={theme}
            nodeTypes={nodeTypes}
            onNodeEvent={(id, e) => {
            // Ignore clicks that are actually drag-end events
            if (isDragging.current || (Date.now() - dragStartTime.current < 200 && draggingNodeIdRef.current)) {
              isDragging.current = false; // Reset for next interaction
              return;
            }
            
            if (onNodeClick) onNodeClick(id, e);
            const node = nodes.find(n => n.id === id);
            if (node && node.handleProgress === 1) {
              const connectedEdges = edges.filter(edge => edge.source === id || edge.target === id);
              connectedEdges.forEach(edge => {
                const isSource = edge.source === id;
                const otherNode = isSource ? nodeList.find(n => n.id === edge.target) : nodeList.find(n => n.id === edge.source);
                if (!otherNode) return;
                let handlePos;
                if (edge.type === 'curved') {
                  handlePos = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, edge.type);
                } else {
                  handlePos = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, edge.type);
                }
              });
            }
            if (e) {
              e.stopPropagation();
            }
          }}
          onNodeDoubleClick={(id) => {
            if (typeof onNodeDoubleClick === 'function') {
              onNodeDoubleClick(id);
            }
          }}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeDragStart={onNodeDragStart}
          />
        </div>

        {/* Preview edge during handle drag */}
        {draggingHandle && draggingHandlePos && (
          (() => {
            const container = canvasRef.current?.parentElement;
            const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
            const mouseX = (draggingHandlePos.x - rect.left - pan.x) / zoom;
            const mouseY = (draggingHandlePos.y - rect.top - pan.y) / zoom;
            const node = nodeList.find(n => n.id === draggingHandle.nodeId);
            let startX, startY;
            if (node) {
              const otherNode = nodeList.find(n => n.id === draggingHandle.otherNodeId);
              const handlePos = getEdgeHandlePosition(node, otherNode, 1, { x: 0, y: 0 }, draggingHandle.edgeType || 'straight');
              startX = handlePos.x;
              startY = handlePos.y;
            } else {
              startX = draggingHandle.x;
              startY = draggingHandle.y;
            }
            return (
              <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100vw', height: '100vh' }}>
                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={mouseX}
                    y2={mouseY}
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    strokeDasharray="6,4"
                  />
                </g>
              </svg>
            );
          })()
        )}

        <MarqueeOverlay 
          selectionRect={selectionRect} 
          theme={theme} 
        />
      </PanZoomLayer>
    </div>
  );
}