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
  hoveredEdgeId, 
  backgroundUrl,
  backgroundInteractive,
  setSnackbar,
  showMinimap = true,
  snapToGrid = false,
  gridSize = 20,
  lockedNodes = new Set(),
  lockedEdges = new Set(),
}) {
  const theme = useTheme();
  
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
  const unifiedEventHandlerRef = useRef(null);

  // State
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [draggingGroupId, setDraggingGroupId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
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
  const dragThreshold = 5;

  // Create layerRefs object
  const layerRefs = useMemo(() => ({
    edgeCanvas: edgeCanvasRef,
    handleCanvas: handleCanvasRef,
    group: groupRef,
    nodeContainer: nodeContainerRef
  }), []);

  // Process nodes with defaults
  const nodeList = useMemo(() => nodes.map(node => ({
    ...node,
    visible: node.visible !== undefined ? node.visible : true
  })), [nodes]);

  const visibleNodeList = useMemo(() => nodeList.filter(n => n.visible !== false), [nodeList]);

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
    const handleDrop = ({ handle, targetNode, targetNodeObject, position }) => {
      if (!handle) return;

      // Handle type: 'new-link' or 'edge-source' or 'edge-target'
      if (handle.type === 'new-link') {
        // Creating a new edge from a node
        if (targetNode && targetNode !== handle.nodeId) {
          const newEdge = {
            id: `edge_${Date.now()}`,
            source: handle.nodeId,
            target: targetNode,
            type: 'default',
            label: '',
            style: {}
          };

          setEdges(prev => [...prev, newEdge]);
          
          if (setSnackbar) {
            setSnackbar({ 
              open: true, 
              message: `Created edge from ${handle.nodeId} to ${targetNode}`, 
              severity: 'success' 
            });
          }
        }
      } else if (handle.type === 'edge-source' || handle.type === 'edge-target') {
        // Modifying existing edge
        if (targetNode) {
          const edge = edges.find(e => e.id === handle.edgeId);
          if (!edge) return;

          if (handle.type === 'edge-source') {
            // Change source
            setEdges(prev => prev.map(e => 
              e.id === handle.edgeId 
                ? { ...e, source: targetNode }
                : e
            ));
          } else {
            // Change target
            setEdges(prev => prev.map(e => 
              e.id === handle.edgeId 
                ? { ...e, target: targetNode }
                : e
            ));
          }

          if (setSnackbar) {
            setSnackbar({ 
              open: true, 
              message: `Updated edge connection`, 
              severity: 'success' 
            });
          }
        }
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
      dragStartTime.current = Date.now();
      dragStartPos.current = { x: event.clientX, y: event.clientY };
      
      const initialPositions = {};
      nodesToDrag.forEach(id => {
        const n = nodes.find(nd => nd.id === id);
        if (n) {
          initialPositions[id] = { x: n.position.x, y: n.position.y };
        }
      });
      lastDragPosition.current = initialPositions;
      
      dragOffset.current = {
        x: event.clientX - (node.position.x * zoom + pan.x),
        y: event.clientY - (node.position.y * zoom + pan.y)
      };
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      
      containerRef.current.addEventListener('mousemove', onNodeDragMove, { passive: false });
      containerRef.current.addEventListener('mouseup', handleNodeDragEnd, { passive: false });
    };

    eventBus.on('nodeDragStart', handleNodeDragStart);
    return () => eventBus.off('nodeDragStart', handleNodeDragStart);
  }, [nodes, selectedNodeIds, lockedNodes, pan, zoom]);

  function onNodeDragMove(e) {
    if (!draggingNodeIdRef.current || !Array.isArray(draggingNodeIdRef.current)) return;

    const dragDistance = Math.hypot(
      e.clientX - dragStartPos.current.x,
      e.clientY - dragStartPos.current.y
    );
    
    if (dragDistance < dragThreshold) return;

    const graphDx = (e.clientX - lastMousePos.current.x) / zoom;
    const graphDy = (e.clientY - lastMousePos.current.y) / zoom;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (!draggingInfoRef.current) {
      draggingInfoRef.current = { nodeIds: draggingNodeIdRef.current, offset: { x: 0, y: 0 } };
    }
    draggingInfoRef.current.offset.x += graphDx;
    draggingInfoRef.current.offset.y += graphDy;
    
    if (snapToGrid) {
      draggingInfoRef.current.offset.x = Math.round(draggingInfoRef.current.offset.x / gridSize) * gridSize;
      draggingInfoRef.current.offset.y = Math.round(draggingInfoRef.current.offset.y / gridSize) * gridSize;
    }
    
    isDragging.current = true;

    if (!dragRafRef.current) {
      dragRafRef.current = requestAnimationFrame(() => {
        draggingNodeIdRef.current.forEach(nodeId => {
          const nodeEl = nodeRefs.current.get(nodeId);
          if (nodeEl) {
            nodeEl.style.transform = `translate(${draggingInfoRef.current.offset.x * zoom}px, ${draggingInfoRef.current.offset.y * zoom}px)`;
          }
        });

        if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
        if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();

        dragRafRef.current = null;
      });
    }
  }

  function handleNodeDragEnd() {
    if (!draggingNodeIdRef.current || !Array.isArray(draggingNodeIdRef.current)) {
      // Clean up listeners even if no drag
      containerRef.current?.removeEventListener('mousemove', onNodeDragMove);
      containerRef.current?.removeEventListener('mouseup', handleNodeDragEnd);
      return;
    }

    const dragDistance = Math.hypot(
      lastMousePos.current.x - dragStartPos.current.x,
      lastMousePos.current.y - dragStartPos.current.y
    );
    
    if (dragDistance < dragThreshold) {
      const node = nodes.find(n => n.id === draggingNodeIdRef.current[0]);
      if (node && typeof onNodeClick === 'function') {
        onNodeClick(node.id, {});
      }
    } else if (draggingInfoRef.current) {
      const offset = draggingInfoRef.current.offset;
      
      draggingNodeIdRef.current.forEach(id => {
        const node = nodes.find(n => n.id === id);
        if (node) {
          const newPosition = { 
            x: node.position.x + offset.x, 
            y: node.position.y + offset.y 
          };
          eventBus.emit('nodeMove', { id, position: newPosition });
        }

        const nodeEl = nodeRefs.current.get(id);
        if (nodeEl) nodeEl.style.transform = '';
      });

      draggingInfoRef.current = null;

      requestAnimationFrame(() => {
        if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
        if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();
      });
      
      // Only emit nodeDragEnd if we actually dragged
      eventBus.emit('nodeDragEnd', { nodeIds: draggingNodeIdRef.current });
    }

    setDraggingNodeId(null);
    draggingNodeIdRef.current = null;
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    containerRef.current?.removeEventListener('mousemove', onNodeDragMove);
    containerRef.current?.removeEventListener('mouseup', handleNodeDragEnd);
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
          pointerEvents: 'none'
        }}
      />

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
        {snapToGrid && (
          <GridLayer pan={pan} zoom={zoom} gridSize={gridSize} theme={theme} />
        )}

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
          onBackgroundClick={() => {}}
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
          onEdgeClick={(edge, event) => {
            eventBus.emit('edgeClick', { id: edge?.id, event });
          }}
          onEdgeDoubleClick={(edge, event) => {
            if (typeof onEdgeDoubleClick === 'function') {
              onEdgeDoubleClick(edge.id);
            }
          }}
          onEdgeHover={undefined}
        />
        
        <HandleLayer
          ref={handleLayerImperativeRef}
          draggingInfoRef={draggingInfoRef}
          canvasRef={handleCanvasRef}
          nodes={visibleNodeList}
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
        nodes={visibleNodeList}
        pan={pan}
        zoom={zoom}
        selectedNodeId={selectedNodeId}
        selectedNodeIds={selectedNodeIds}
        draggingNodeId={draggingNodeId}
        theme={theme}
        nodeTypes={nodeTypes}
        lockedNodes={lockedNodes}
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
          setHoveredNodeId(id);
          eventBus.emit('nodeHover', { id });
        }}
        onNodeMouseLeave={(id) => {
          setHoveredNodeId(null);
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