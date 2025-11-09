// ============================================
// nodegraph-editor/components/GraphEditor/hooks/useGraphEditorSetup.js
// Initialization, event listeners, and effects
// ============================================
import { useEffect, useRef } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import GraphCRUD from '../GraphCrud';

export function useGraphEditorSetup(state, handlers, historyHook) {
  const graphAPI = useRef(null);
  const {
    nodesRef, setNodes, edgesRef, setEdges, setGroups,
    groupManager, initialGraphLoadedRef,
    defaultNodeColor, defaultEdgeColor, setDefaultNodeColor, setDefaultEdgeColor,
    zoom, setLoading, setSelectedNodeIds, setSelectedEdgeIds
  } = state;
  
  const { saveToHistory } = historyHook;
  const { handlePasteGraphData } = handlers;
  
  // Initialize GraphCRUD API
  useEffect(() => {
    graphAPI.current = new GraphCRUD(
      () => nodesRef.current,
      setNodes,
      () => edgesRef.current,
      setEdges,
      saveToHistory
    );
    
    const originalCreateNode = graphAPI.current.createNode;
    graphAPI.current.createNode = (nodeData) => {
      return originalCreateNode.call(graphAPI.current, {
        ...nodeData,
        color: nodeData.color || defaultNodeColor
      });
    };
    
    const originalCreateEdge = graphAPI.current.createEdge;
    graphAPI.current.createEdge = (edgeData) => {
      return originalCreateEdge.call(graphAPI.current, {
        ...edgeData,
        color: edgeData.color || defaultEdgeColor
      });
    };

    if (typeof window !== 'undefined') {
      window.graphAPI = graphAPI.current;
      window.graphAPI.getNodes = () => nodesRef.current;
      window.graphAPI.getEdges = () => edgesRef.current;
      window.setDefaultNodeColor = setDefaultNodeColor;
      window.setDefaultEdgeColor = setDefaultEdgeColor;
      
      if (!window.__graphAPILogged) {
        window.__graphAPILogged = true;
        // console.log('Graph CRUD API available at window.graphAPI');
      }
    }
  }, [defaultNodeColor, defaultEdgeColor]);
    
  // Handle drop events
  useEffect(() => {
    // Removed handleDrop handler to prevent duplicate node creation
    const handleNodeResize = (data) => {
      setNodes(prev => {
        const next = prev.map(n => 
          n.id === data.id ? { ...n, width: data.width, height: data.height } : n
        );
        nodesRef.current = next;
        return next;
      });
    };

    const handleNodeResizeEnd = () => {
      saveToHistory(nodesRef.current, edgesRef.current);
    };
    
    eventBus.on('nodeResize', handleNodeResize);
    eventBus.on('nodeResizeEnd', handleNodeResizeEnd);
    eventBus.on('pasteGraphData', handlePasteGraphData);
    
    return () => {
      eventBus.off('nodeResize', handleNodeResize);
      eventBus.off('nodeResizeEnd', handleNodeResizeEnd);
      eventBus.off('pasteGraphData', handlePasteGraphData);
    };
  }, [handlePasteGraphData]);
  
  // Load background
  useEffect(() => {
    const applyBackground = (bg) => {
      try {
        const el = document.getElementById('graph-editor-background');
        if (!el) return;
        if (!bg) {
          el.style.backgroundImage = '';
          return;
        }

        let url = null;

        // If bg is an absolute URL
        if (/^https?:\/\//i.test(bg)) {
          url = bg;
        } else if (bg.startsWith('/')) {
          // Leading slash path under site root
          url = bg;
        } else if (bg.includes('/')) {
          // Relative path with folders - resolve against site origin
          try {
            url = new URL(bg, window.location.origin).href;
          } catch (err) {
            url = `/${bg}`;
          }
        } else {
          // Plain filename (no slashes) — interpret as file relative to last loaded document's directory
          const lastLoaded = typeof window !== 'undefined' ? localStorage.getItem('lastLoadedUrl') : null;
          if (lastLoaded) {
            try {
              const base = lastLoaded.substring(0, lastLoaded.lastIndexOf('/') + 1);
              url = new URL(bg, base).href;
            } catch (err) {
              // fallback to public/background art
              url = `/background art/${bg}`;
            }
          } else {
            // No lastLoadedUrl available — fall back to public/background art
            url = `/background art/${bg}`;
          }
        }

        // Normalize to absolute URL if possible
        try {
          url = new URL(url, window.location.origin).href;
        } catch (err) {
          // keep as-is
        }

        el.style.backgroundImage = `url('${url}')`;
      } catch (err) {
        console.warn('Failed to apply background image:', err);
      }
    };

    try {
      const savedBg = localStorage.getItem('backgroundImage');
      if (savedBg) {
        applyBackground(savedBg);
      }
    } catch (err) {
      // ignore
    }

    const handler = ({ backgroundImage }) => {
      applyBackground(backgroundImage || null);
    };
    eventBus.on('backgroundChanged', handler);
    return () => eventBus.off('backgroundChanged', handler);
  }, []);

  // Expose for testing
  if (typeof window !== 'undefined') {
    window.handlePasteGraphData = handlePasteGraphData;
  }



  // Handle tlzClick emitted by TlzLink: show tlz in address/history and fetch converted URL
  useEffect(() => {
    const handler = ({ href }) => {
      if (!href) return;
      try {
        // Convert tlz to a fetchable URL
        const rest = href.slice('tlz://'.length);
        const firstSlash = rest.indexOf('/');
        let host = '';
        let path = '';
        if (firstSlash !== -1) {
          host = rest.slice(0, firstSlash);
          path = rest.slice(firstSlash);
        } else {
          path = '/' + rest;
        }
        const origin = (window.location.protocol === 'https:' ? 'https://' : window.location.protocol + '//') + host;
        const fetchable = origin + path;

        // Emit fetchUrl to load the resource; the central fetch handler will emit setAddress
        eventBus.emit('fetchUrl', { url: fetchable });
      } catch (err) {
        console.warn('Failed to handle tlzClick:', err);
      }
    };

    eventBus.on('tlzClick', handler);
    return () => eventBus.off('tlzClick', handler);
  }, []);

  // Attach viewport helpers to API returned to callers
  if (typeof graphAPI.current !== 'undefined' && graphAPI.current) {
    graphAPI.current.getViewport = () => {
      try { return { pan: state?.pan || { x: 0, y: 0 }, zoom: state?.zoom || 1 }; } catch (e) { return { pan: { x: 0, y: 0 }, zoom: 1 }; }
    };

    graphAPI.current.setViewport = ({ pan, zoom } = {}) => {
      try {
        if (pan && typeof state?.setPan === 'function') state.setPan({ x: Number(pan.x) || 0, y: Number(pan.y) || 0 });
        if (zoom !== undefined && typeof state?.setZoom === 'function') state.setZoom(Number(zoom));
        return true;
      } catch (e) { return false; }
    };

    // fitToNodes is available but NOT called automatically anymore
    graphAPI.current.fitToNodes = ({ padding = 40, minZoom = 0.2, maxZoom = 3 } = {}) => {
      try {
        const nodes = (state && state.nodes) ? state.nodes : [];
        if (!nodes || nodes.length === 0) return null;

        const positions = nodes.map((n) => ({
          x: (n.position?.x ?? n.x ?? 0),
          y: (n.position?.y ?? n.y ?? 0),
          width: n.width || 60,
          height: n.height || 60
        }));

        const minX = Math.min(...positions.map((p) => p.x - p.width / 2));
        const maxX = Math.max(...positions.map((p) => p.x + p.width / 2));
        const minY = Math.min(...positions.map((p) => p.y - p.height / 2));
        const maxY = Math.max(...positions.map((p) => p.y + p.height / 2));

        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);

        const container = document.getElementById('graph-canvas') || document.body;
        const availW = Math.max(1, container.clientWidth - padding * 2);
        const availH = Math.max(1, container.clientHeight - padding * 2);

        const scaleX = availW / bboxW;
        const scaleY = availH / bboxH;
        let newZoomVal = Math.min(scaleX, scaleY, 1);
        newZoomVal = Math.max(minZoom, Math.min(maxZoom, newZoomVal));

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const newPanX = container.clientWidth / 2 - centerX * newZoomVal;
        const newPanY = container.clientHeight / 2 - centerY * newZoomVal;

        if (typeof state?.setZoom === 'function') state.setZoom(newZoomVal);
        if (typeof state?.setPan === 'function') state.setPan({ x: newPanX, y: newPanY });

        return { pan: { x: newPanX, y: newPanY }, zoom: newZoomVal };
      } catch (e) { return null; }
    };

    // Also expose the API on window.graphAPI for script access
    try {
      if (typeof window !== 'undefined') {
        window.graphAPI = graphAPI.current;
      }
    } catch (e) { /* ignore */ }
  }

  // Ensure we clean up window.graphAPI when the hook is torn down
  useEffect(() => {
    return () => {
      try { if (typeof window !== 'undefined' && window.graphAPI === graphAPI.current) delete window.graphAPI; } catch (e) {}
    };
  }, []);

  return graphAPI;
}