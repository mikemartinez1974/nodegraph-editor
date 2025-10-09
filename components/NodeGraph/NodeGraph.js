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
import { useMarqueeSelection, MarqueeOverlay } from './marqueeSelection';

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

  // Process nodes with defaults
  const nodeList = useMemo(() => nodes.map(node => ({
    ...node,
    handleProgress: node.handleProgress !== undefined ? node.handleProgress : 0,
    showHandlesOnHover: node.showHandlesOnHover !== undefined ? node.showHandlesOnHover : true,
    visible: node.visible !== undefined ? node.visible : true
  })), [nodes]);

  // Event bus handlers for node/edge events
  useEffect(() => {
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
      const newX = (e.clientX - dragOffset.current.x - (typeof pan?.x === 'number' ? pan.x : 0)) / (typeof zoom === 'number' ? zoom : 1);
      const newY = (e.clientY - dragOffset.current.y - (typeof pan?.y === 'number' ? pan.y : 0)) / (typeof zoom === 'number' ? zoom : 1);
      lastDragPosition.current = { x: newX, y: newY };
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          if (typeof onNodeMove === 'function' && lastDragPosition.current) {
            onNodeMove(draggingNodeIdRef.current, lastDragPosition.current);
          }
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
    window.addEventListener('mousemove', onNodeDragMove);
    window.addEventListener('mouseup', handleNodeDragEnd);
  }
  function handleNodeDragEnd() {
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
            
            group.nodeIds.forEach(nodeId => {
              const node = nodes.find(n => n.id === nodeId);
              if (node && typeof onNodeMove === 'function') {
                onNodeMove(nodeId, {
                  x: node.position.x + deltaX,
                  y: node.position.y + deltaY
                });
              }
            });
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
    window.removeEventListener('mousemove', onGroupDragMove);
    window.removeEventListener('mouseup', handleGroupDragEnd);
  }

  function handleBackgroundClickFromPanZoom(e) {
    if (typeof onBackgroundClick === 'function') onBackgroundClick(e);
    if (setSelectedNodeIds) setSelectedNodeIds([]);
    if (setSelectedEdgeIds) setSelectedEdgeIds([]);
  }

  // Edge Handle Events - HandleLayer manages its own events, we just track state
  useEffect(() => {
    const handleHandleDragStart = ({ handle }) => {
      setDraggingHandle(handle);
    };
    
    const handleHandleDragEnd = ({ handle }) => {
      setDraggingHandle(null);
      setDraggingHandlePos(null);
    };
    
    eventBus.on('handleDragStart', handleHandleDragStart);
    eventBus.on('handleDragEnd', handleHandleDragEnd);
    
    return () => {
      eventBus.off('handleDragStart', handleHandleDragStart);
      eventBus.off('handleDragEnd', handleHandleDragEnd);
    };
  }, []);

  // Window resize handler
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse event handlers for node hover
  const handleNodeMouseEnter = (nodeId) => {
    setHoveredNodeId(nodeId);
  };
  const handleNodeMouseLeave = () => {
    setHoveredNodeId(null);
  };

  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState(null);
  const [marqueeEnd, setMarqueeEnd] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);

  // Convert screen coordinates to graph coordinates
  const screenToGraph = useCallback((screenX, screenY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom
    };
  }, [pan, zoom]);

  // Convert graph coordinates to screen coordinates  
  const graphToScreen = useCallback((graphX, graphY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    return {
      x: graphX * zoom + pan.x + rect.left,
      y: graphY * zoom + pan.y + rect.top
    };
  }, [pan, zoom]);

  // Start marquee selection
  const startMarqueeSelection = useCallback((event) => {
    if (!event.shiftKey) return false;
    
    console.log('Starting marquee selection');
    setIsMarqueeSelecting(true);
    
    const graphPos = screenToGraph(event.clientX, event.clientY);
    setMarqueeStart(graphPos);
    setMarqueeEnd(graphPos);
    
    // Calculate screen rect for overlay
    const screenRect = {
      x: event.clientX,
      y: event.clientY,
      width: 0,
      height: 0
    };
    setSelectionRect(screenRect);
    
    return true;
  }, [screenToGraph]);

  // Update marquee selection
  const updateMarqueeSelection = useCallback((event) => {
    if (!isMarqueeSelecting || !marqueeStart) return;
    
    const graphPos = screenToGraph(event.clientX, event.clientY);
    setMarqueeEnd(graphPos);
    
    // Calculate screen rect for overlay
    const startScreen = graphToScreen(marqueeStart.x, marqueeStart.y);
    const screenRect = {
      x: Math.min(startScreen.x, event.clientX),
      y: Math.min(startScreen.y, event.clientY),
      width: Math.abs(event.clientX - startScreen.x),
      height: Math.abs(event.clientY - startScreen.y)
    };
    setSelectionRect(screenRect);
  }, [isMarqueeSelecting, marqueeStart, screenToGraph, graphToScreen]);

  // End marquee selection
  const endMarqueeSelection = useCallback((event) => {
    if (!isMarqueeSelecting || !marqueeStart || !marqueeEnd) {
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      setSelectionRect(null);
      return;
    }

    console.log('Ending marquee selection', { marqueeStart, marqueeEnd });

    // Calculate selection bounds in graph space
    const bounds = {
      x: Math.min(marqueeStart.x, marqueeEnd.x),
      y: Math.min(marqueeStart.y, marqueeEnd.y),
      width: Math.abs(marqueeEnd.x - marqueeStart.x),
      height: Math.abs(marqueeEnd.y - marqueeStart.y)
    };

    // Only proceed if selection is large enough
    if (bounds.width >= 10 / zoom || bounds.height >= 10 / zoom) {
      // Find nodes within selection bounds
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
      >
        <GroupLayer
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
          canvasRef={canvasRef}
          nodes={nodeList}
          edges={edges}
          pan={pan}
          zoom={zoom}
          edgeTypes={edgeTypes}
        />

        <div style={{ pointerEvents: draggingHandle ? 'none' : 'auto' }}>
          <NodeLayer
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