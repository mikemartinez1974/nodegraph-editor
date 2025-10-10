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
import { MarqueeOverlay } from './marqueeSelection';

export default function NodeGraph({ 
  nodes = [], 
  edges = [], 
  groups = [], 
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
  
  const canvasRef = useRef(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [draggingGroupId, setDraggingGroupId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef(null);
  const draggingGroupIdRef = useRef(null);
  const containerRef = useRef(null);
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

  // Define handler functions outside useEffect
  function handleNodeClick({ id, event }) {
    if (!onNodeClick && setSelectedNodeIds) {
      setSelectedNodeIds([id]);
      if (setSelectedEdgeIds) setSelectedEdgeIds([]);
    }
  }

  function handleEdgeClick({ id, event }) {
    if (!onEdgeClick && setSelectedEdgeIds) {
      setSelectedEdgeIds([id]);
      if (setSelectedNodeIds) setSelectedNodeIds([]);
    }
  }

  function handleEdgeHover(id) {
    setHoveredNodeId(id);
  }

  function handleNodeMouseEnter({ id }) {
    setHoveredNodeId(id);
    setIsNodeHovered(true);
  }

  function handleNodeMouseLeave({ id }) {
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

  // Event bus handlers for node/edge events
  useEffect(() => {
    eventBus.on('nodeClick', handleNodeClick);
    eventBus.on('edgeClick', handleEdgeClick);
    eventBus.on('nodeMouseEnter', handleNodeMouseEnter);
    eventBus.on('nodeMouseLeave', handleNodeMouseLeave);
    return () => {
      eventBus.off('nodeClick', handleNodeClick);
      eventBus.off('edgeClick', handleEdgeClick);
      eventBus.off('nodeMouseEnter', handleNodeMouseEnter);
      eventBus.off('nodeMouseLeave', handleNodeMouseLeave);
    };
  }, [setSelectedNodeIds, setSelectedEdgeIds, onNodeClick, onEdgeClick]);

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

  // Node drag logic
  function onNodeDragMove(e) {
    if (draggingNodeIdRef.current) {
      const graphDx = (e.clientX - lastMousePos.current.x) / zoom;
      const graphDy = (e.clientY - lastMousePos.current.y) / zoom;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      if (!draggingInfoRef.current) {
        draggingInfoRef.current = { nodeId: draggingNodeIdRef.current, offset: { x: 0, y: 0 } };
      }
      draggingInfoRef.current.offset.x += graphDx;
      draggingInfoRef.current.offset.y += graphDy;

      // Update lastDragPosition for onNodeDragEnd
      lastDragPosition.current = {
        x: lastDragPosition.current.x + graphDx,
        y: lastDragPosition.current.y + graphDy
      };

      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          // Move node DOM
          const nodeEl = nodeRefs.current.get(draggingNodeIdRef.current);
          if (nodeEl) {
            nodeEl.style.transform = `translate(${draggingInfoRef.current.offset.x * zoom}px, ${draggingInfoRef.current.offset.y * zoom}px)`;
          }

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
    setDraggingNodeId(node.id);
    draggingNodeIdRef.current = node.id;
    dragOffset.current = {
      x: e.clientX - (node.position.x * zoom + pan.x),
      y: e.clientY - (node.position.y * zoom + pan.y)
    };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    lastDragPosition.current = { x: node.position.x, y: node.position.y }; // Initialize for onNodeDragEnd
    window.addEventListener('mousemove', onNodeDragMove);
    window.addEventListener('mouseup', handleNodeDragEnd);
  }

  function handleNodeDragEnd() {
    if (draggingNodeIdRef.current && draggingInfoRef.current) {
      const id = draggingNodeIdRef.current;
      const offset = draggingInfoRef.current.offset;
      const node = nodes.find(n => n.id === id);
      if (node && typeof onNodeMove === 'function') {
        const newPosition = { x: node.position.x + offset.x, y: node.position.y + offset.y };
        onNodeMove(id, newPosition);
      }

      // Reset
      const nodeEl = nodeRefs.current.get(id);
      if (nodeEl) nodeEl.style.transform = '';
      draggingInfoRef.current = null;

      // Final redraw
      if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
      if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();

      // Call onNodeDragEnd if needed
      if (typeof onNodeDragEnd === 'function') {
        onNodeDragEnd(id, lastDragPosition.current);
      }
    }

    setDraggingNodeId(null);
    draggingNodeIdRef.current = null;
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    window.removeEventListener('mousemove', onNodeDragMove);
    window.removeEventListener('mouseup', handleNodeDragEnd);
  }

  // Group drag logic
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
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom
      };
    }
    window.addEventListener('mousemove', onGroupDragMove);
    window.addEventListener('mouseup', handleGroupDragEnd);
  }

  function handleGroupDragEnd() {
    setDraggingGroupId(null);
    draggingGroupIdRef.current = null;
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    window.removeEventListener('mousemove', onGroupDragMove);
    window.removeEventListener('mouseup', handleGroupDragEnd);
  }

  // Handle background click from PanZoomLayer
  function handleBackgroundClickFromPanZoom(event) {
    if (typeof onBackgroundClick === 'function') {
      onBackgroundClick(event);
    }
    if (setSelectedNodeIds) setSelectedNodeIds([]);
    if (setSelectedEdgeIds) setSelectedEdgeIds([]);
  }

  // Marquee selection logic
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState(null);
  const [marqueeEnd, setMarqueeEnd] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);

  const startMarqueeSelection = useCallback((e) => {
    if (!e.shiftKey) return false;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return false;

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setMarqueeStart({ x: startX, y: startY });
    setMarqueeEnd({ x: startX, y: startY });
    setIsMarqueeSelecting(true);

    return true;
  }, []);

  const updateMarqueeSelection = useCallback((e) => {
    if (!isMarqueeSelecting) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    setMarqueeEnd({ x: endX, y: endY });

    const minX = Math.min(marqueeStart.x, endX);
    const minY = Math.min(marqueeStart.y, endY);
    const width = Math.abs(endX - marqueeStart.x);
    const height = Math.abs(endY - marqueeStart.y);

    setSelectionRect({ x: minX, y: minY, width, height });
  }, [isMarqueeSelecting, marqueeStart]);

  const endMarqueeSelection = useCallback((event) => {
    if (!isMarqueeSelecting || !marqueeStart || !marqueeEnd) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Convert screen coords to graph coords
    const bounds = {
      x: (Math.min(marqueeStart.x, marqueeEnd.x) - pan.x) / zoom,
      y: (Math.min(marqueeStart.y, marqueeEnd.y) - pan.y) / zoom,
      width: Math.abs(marqueeEnd.x - marqueeStart.x) / zoom,
      height: Math.abs(marqueeEnd.y - marqueeStart.y) / zoom
    };

    // Find intersecting nodes
    const selectedNodes = nodes.filter(node => {
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const nodeWidth = node.width || 120;
      const nodeHeight = node.height || 60;
      
      // Check if node intersects with selection rectangle
      return !(
        nodeX + nodeWidth < bounds.x ||
        nodeX > bounds.x + bounds.width ||
        nodeY + nodeHeight < bounds.y ||
        nodeY > bounds.y + bounds.height
      );
    });

    console.log('Selected nodes:', selectedNodes);

    if (selectedNodes.length > 0 && setSelectedNodeIds) {
      setSelectedNodeIds(selectedNodes.map(node => node.id));
      if (setSelectedEdgeIds) setSelectedEdgeIds([]);
      
      // Emit event
      eventBus.emit('nodes-selected', selectedNodes);
      
      if (onNodeClick && selectedNodes.length === 1) {
        onNodeClick(selectedNodes[0].id, event);
      }
    }

    // Clean up
    setIsMarqueeSelecting(false);
    setMarqueeStart(null);
    setMarqueeEnd(null);
    setSelectionRect(null);
  }, [isMarqueeSelecting, marqueeStart, marqueeEnd, nodes, zoom, setSelectedNodeIds, setSelectedEdgeIds, onNodeClick]);

  // Global mouse event listeners for marquee selection
  useEffect(() => {
    if (!isMarqueeSelecting) return;

    const handleMouseMove = (e) => {
      updateMarqueeSelection(e);
    };

    const handleMouseUp = (e) => {
      endMarqueeSelection(e);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMarqueeSelecting, updateMarqueeSelection, endMarqueeSelection]);

  return (
    <div id="graph-canvas" ref={containerRef} style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      background: "none",
      zIndex: 0
    }}>
      <PanZoomLayer
        pan={pan}
        zoom={zoom}
        onPanZoom={setPan}
        setZoom={setZoom}
        onBackgroundClick={handleBackgroundClickFromPanZoom}
        onMarqueeStart={startMarqueeSelection}
        theme={theme}
        style={{ pointerEvents: 'auto', width: '100vw', height: '100vh' }}
        layerRefs={layerRefs}
      >
        <GroupLayer
          ref={groupRef}
          groups={groups}
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
      </PanZoomLayer>

      {/* Marquee selection overlay */}
      <MarqueeOverlay 
        selectionRect={selectionRect} 
        theme={theme} 
      />
    </div>
  );
}