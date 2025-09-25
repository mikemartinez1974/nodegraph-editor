import { useEffect } from 'react';
import { on, off } from '../eventBus';
import { updateNodePosition, updateNodeSize, selectNode, selectEdge } from '../graphData';

export function useNodeGraphEvents({ nodeListRef, edgeListRef }) {
  useEffect(() => {
    function handleNodeMove({ id, position }) {
      if (nodeListRef.current) {
        nodeListRef.current = nodeListRef.current.map(n =>
          n.id === id ? { ...n, position } : n
        );
      }
    }
    on('nodeMove', handleNodeMove);

    function handleNodeSelect({ id, shiftKey }) {
      selectNode(id, shiftKey);
    }
    on('nodeSelect', handleNodeSelect);

    function handleEdgeSelect({ id, shiftKey }) {
      selectEdge(id, shiftKey);
    }
    on('edgeSelect', handleEdgeSelect);

    function handleResizeNode({ id, width, height }) {
      updateNodeSize(id, width, height);
    }
    on('resizeNode', handleResizeNode);

    function handleNodeMouseEnter({ id }) {
      // Extend handles if showHandlesOnHover is true
      if (nodeListRef.current) {
        nodeListRef.current = nodeListRef.current.map(n =>
          n.id === id && n.showHandlesOnHover ? { ...n, handleProgress: 1 } : n
        );
      }
    }
    on('nodeMouseEnter', handleNodeMouseEnter);

    function handleNodeMouseLeave({ id }) {
      // Retract handles if showHandlesOnHover is true
      if (nodeListRef.current) {
        nodeListRef.current = nodeListRef.current.map(n =>
          n.id === id && n.showHandlesOnHover ? { ...n, handleProgress: 0 } : n
        );
      }
    }
    on('nodeMouseLeave', handleNodeMouseLeave);

    let pan = { x: 0, y: 0 };
    let zoom = 1;

    function handleCanvasPan({ dx, dy }) {
      pan.x += dx;
      pan.y += dy;
      if (nodeListRef.current) {
        nodeListRef.current = nodeListRef.current.map(n => ({ ...n })); // trigger update
      }
    }
    on('canvasPan', handleCanvasPan);

    function handleCanvasZoom({ direction, amount }) {
      const zoomFactor = 1.05;
      if (direction > 0) {
        zoom = Math.min(zoom * zoomFactor, 2);
      } else {
        zoom = Math.max(zoom / zoomFactor, 0.5);
      }
      if (nodeListRef.current) {
        nodeListRef.current = nodeListRef.current.map(n => ({ ...n })); // trigger update
      }
    }
    on('canvasZoom', handleCanvasZoom);

    return () => {
      off('nodeMove', handleNodeMove);
      off('nodeSelect', handleNodeSelect);
      off('edgeSelect', handleEdgeSelect);
      off('resizeNode', handleResizeNode);
      off('nodeMouseEnter', handleNodeMouseEnter);
      off('nodeMouseLeave', handleNodeMouseLeave);
      off('canvasPan', handleCanvasPan);
      off('canvasZoom', handleCanvasZoom);
    };
  }, [nodeListRef, edgeListRef]);
}
