import { useEffect } from 'react';

export function useEventBusHandlers({ setNodeList, setSelectedNodeId, setSelectedEdgeId, setHoveredEdgeId, setHoveredNodeId, hoverTimeoutRef }) {
  useEffect(() => {
    function handleNodeMove({ id, position }) {
      setNodeList(prev => prev.map(n => n.id === id ? { ...n, position } : n));
    }
    function handleNodeClick({ id }) {
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
    }
    function handleEdgeClick({ id }) {
      setSelectedEdgeId(id);
      setSelectedNodeId(null);
    }
    function handleEdgeHover(id) {
      setHoveredEdgeId(id);
    }
    function handleNodeMouseEnter({ id }) {
      if (hoverTimeoutRef.current[id]) {
        clearTimeout(hoverTimeoutRef.current[id]);
        hoverTimeoutRef.current[id] = null;
      }
      setHoveredNodeId(id);
    }
    function handleNodeMouseLeave({ id }) {
      if (hoverTimeoutRef.current[id]) {
        clearTimeout(hoverTimeoutRef.current[id]);
      }
      hoverTimeoutRef.current[id] = setTimeout(() => {
        const handleHovered = document.querySelector(`div[key*='${id}-'][style*='z-index: 30']`);
        const nodeHovered = document.querySelector(`div[key='${id}']`);
        const isHandleHovered = handleHovered && handleHovered.matches(':hover');
        const isNodeHovered = nodeHovered && nodeHovered.matches(':hover');
        if (!isHandleHovered && !isNodeHovered) {
          setHoveredNodeId(prev => (prev === id ? null : prev));
        }
        hoverTimeoutRef.current[id] = null;
      }, 100);
    }

    eventBus.on('nodeMove', handleNodeMove);
    eventBus.on('nodeClick', handleNodeClick);
    eventBus.on('edgeClick', handleEdgeClick);
    eventBus.on('nodeMouseEnter', handleNodeMouseEnter);
    eventBus.on('nodeMouseLeave', handleNodeMouseLeave);

    return () => {
      eventBus.off('nodeMove', handleNodeMove);
      eventBus.off('nodeClick', handleNodeClick);
      eventBus.off('edgeClick', handleEdgeClick);
      eventBus.off('nodeMouseEnter', handleNodeMouseEnter);
      eventBus.off('nodeMouseLeave', handleNodeMouseLeave);
    };
  }, [setNodeList, setSelectedNodeId, setSelectedEdgeId, setHoveredEdgeId, setHoveredNodeId, hoverTimeoutRef]);
}