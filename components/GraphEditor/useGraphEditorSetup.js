// ============================================
// 3. GraphEditor/useGraphEditorSetup.js
// Initialization, event listeners, and effects
// ============================================
import { useEffect, useRef } from 'react';
import eventBus from '../NodeGraph/eventBus';
import GraphCRUD from './GraphCrud';

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
        console.log('Graph CRUD API available at window.graphAPI');
      }
    }
  }, [defaultNodeColor, defaultEdgeColor]);
    
  // Handle drop events
  useEffect(() => {
    const handleDrop = (data) => {
      if (!data?.sourceNode) return;
      
      if (data.targetNode) {
        graphAPI.current.createEdge({
          source: data.sourceNode,
          target: data.targetNode,
          type: data.edgeType
        });
      } else {
        const sourceNode = nodesRef.current.find(n => n.id === data.sourceNode);
        const nodeResult = graphAPI.current.createNode({
          label: data.label || `Node-${Date.now()}`,
          position: data.graph,
          data: data.nodeData || {},
          type: sourceNode?.type || 'default',
          width: sourceNode?.width || 80,
          height: sourceNode?.height || 48
        });
        
        if (nodeResult.success) {
          setTimeout(() => {
            graphAPI.current.createEdge({
              source: data.sourceNode,
              target: nodeResult.data.id,
              type: data.edgeType
            });
          }, 50);
        }
      }
    };

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
    
    eventBus.on('handleDrop', handleDrop);
    eventBus.on('nodeResize', handleNodeResize);
    eventBus.on('nodeResizeEnd', handleNodeResizeEnd);
    eventBus.on('pasteGraphData', handlePasteGraphData);
    
    return () => {
      eventBus.off('handleDrop', handleDrop);
      eventBus.off('nodeResize', handleNodeResize);
      eventBus.off('nodeResizeEnd', handleNodeResizeEnd);
      eventBus.off('pasteGraphData', handlePasteGraphData);
    };
  }, [handlePasteGraphData]);
  
  // Load background
  useEffect(() => {
    const savedBg = localStorage.getItem('backgroundImage');
    if (savedBg) {
      const el = document.getElementById('graph-editor-background');
      if (el) el.style.backgroundImage = `url('/background art/${savedBg}')`;
    }
  }, []);
  
  // Expose for testing
  if (typeof window !== 'undefined') {
    window.handlePasteGraphData = handlePasteGraphData;
  }

  // On first client mount, if no document is loaded, navigate to configured home URL
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      // Only run once
      if (!initialGraphLoadedRef || initialGraphLoadedRef.current) return;

      const hasNodes = Array.isArray(nodesRef.current) && nodesRef.current.length > 0;
      const hasEdges = Array.isArray(edgesRef.current) && edgesRef.current.length > 0;

      if (!hasNodes && !hasEdges) {
        const DEFAULT_HOME = 'https://cpwith.me/tlz/IntroGraph.json';
        let home = DEFAULT_HOME;
        try {
          const stored = localStorage.getItem('homeUrl');
          if (stored) home = stored;
        } catch (err) {
          // ignore
        }

        if (home) {
          eventBus.emit('fetchUrl', { url: home });
        }
      }

      initialGraphLoadedRef.current = true;
    } catch (err) {
      console.warn('Startup home navigation failed:', err);
      if (initialGraphLoadedRef) initialGraphLoadedRef.current = true;
    }
  }, []);

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

        // Update address/history with the canonical fetchable URL (do not show tlz://)
        eventBus.emit('setAddress', fetchable);
        // Emit fetchUrl to load the resource
        eventBus.emit('fetchUrl', { url: fetchable });
      } catch (err) {
        console.warn('Failed to handle tlzClick:', err);
      }
    };

    eventBus.on('tlzClick', handler);
    return () => eventBus.off('tlzClick', handler);
  }, []);

  return graphAPI;
}