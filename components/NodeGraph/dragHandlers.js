// dragHandlers.js

export function onNodeDragMove({ e, draggingNodeIdRef, lastMousePos, zoom, draggingInfoRef, dragRafRef, nodeRefs, edgeLayerImperativeRef, handleLayerImperativeRef }) {
  if (draggingNodeIdRef.current) {
    const graphDx = (e.clientX - lastMousePos.current.x) / zoom;
    const graphDy = (e.clientY - lastMousePos.current.y) / zoom;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (!draggingInfoRef.current) {
      draggingInfoRef.current = { nodeId: draggingNodeIdRef.current, offset: { x: 0, y: 0 } };
    }
    draggingInfoRef.current.offset.x += graphDx;
    draggingInfoRef.current.offset.y += graphDy;

    if (!dragRafRef.current) {
      dragRafRef.current = requestAnimationFrame(() => {
        const nodeEl = nodeRefs.current.get(draggingNodeIdRef.current);
        if (nodeEl) {
          nodeEl.style.transform = `translate(${draggingInfoRef.current.offset.x * zoom}px, ${draggingInfoRef.current.offset.y * zoom}px)`;
        }

        if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
        if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();

        dragRafRef.current = null;
      });
    }
  }
}

export function onNodeDragStart({ e, node, setDraggingNodeId, draggingNodeIdRef, dragOffset, zoom, pan, lastMousePos, lastDragPosition }) {
  e.preventDefault();
  setDraggingNodeId(node.id);
  draggingNodeIdRef.current = node.id;
  dragOffset.current = {
    x: e.clientX - (node.position.x * zoom + pan.x),
    y: e.clientY - (node.position.y * zoom + pan.y)
  };
  lastMousePos.current = { x: e.clientX, y: e.clientY };
  lastDragPosition.current = { x: node.position.x, y: node.position.y };
  window.addEventListener('mousemove', (event) => onNodeDragMove({ e: event, draggingNodeIdRef, lastMousePos, zoom, draggingInfoRef, dragRafRef, nodeRefs, edgeLayerImperativeRef, handleLayerImperativeRef }));
  window.addEventListener('mouseup', handleNodeDragEnd);
}

export function handleNodeDragEnd({ draggingNodeIdRef, draggingInfoRef, nodes, onNodeMove, edgeLayerImperativeRef, handleLayerImperativeRef, setDraggingNodeId, dragRafRef, onNodeDragEnd, lastDragPosition, nodeRefs }) {
  if (draggingNodeIdRef.current && draggingInfoRef.current) {
    const id = draggingNodeIdRef.current;
    const offset = draggingInfoRef.current.offset;
    const node = nodes.find(n => n.id === id);
    if (node && typeof onNodeMove === 'function') {
      const newPosition = { x: node.position.x + offset.x, y: node.position.y + offset.y };
      onNodeMove(id, newPosition);
    }

    const nodeEl = nodeRefs.current.get(id);
    if (nodeEl) nodeEl.style.transform = '';
    draggingInfoRef.current = null;

    if (edgeLayerImperativeRef.current) edgeLayerImperativeRef.current.redraw();
    if (handleLayerImperativeRef.current) handleLayerImperativeRef.current.redraw();

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