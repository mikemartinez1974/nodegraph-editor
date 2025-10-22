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
  
  // Load initial graph
  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== 'undefined') {
          if (window.__nodegraph_initial_loaded) return;
          window.__nodegraph_initial_loaded = true;
        }
        if (initialGraphLoadedRef.current) return;
        initialGraphLoadedRef.current = true;

        setLoading(true);
        const resp = await fetch('/data/IntroGraph.json');
        if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
        const data = await resp.json();

        if (data?.nodes && data?.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          const loadedGroups = data.groups || [];
          setGroups(loadedGroups);
          
          loadedGroups.forEach(group => {
            groupManager.current.groups.set(group.id, group);
            group.nodeIds?.forEach(nodeId => {
              groupManager.current.nodeToGroup.set(nodeId, group.id);
            });
          });
          
          nodesRef.current = data.nodes;
          edgesRef.current = data.edges;
          saveToHistory(data.nodes, data.edges);

          if (data.nodes.length > 0) {
            const firstNode = data.nodes[0];
            state.setPan({
              x: window.innerWidth / 2 - (firstNode.position?.x || 0) * zoom,
              y: window.innerHeight / 2 - (firstNode.position?.y || 0) * zoom
            });
            setSelectedNodeIds([firstNode.id]);
            setSelectedEdgeIds([]);
            setTimeout(() => eventBus.emit('openNodeProperties'), 300);
          }
        }
      } catch (err) {
        console.warn('Could not load IntroGraph:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
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
  
  return graphAPI;
}