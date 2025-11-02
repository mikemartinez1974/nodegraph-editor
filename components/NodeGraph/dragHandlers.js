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
        const nodeEl = nodeRefs?.current?.get(draggingNodeIdRef.current);
        if (nodeEl) {
          nodeEl.style.transform = `translate(${draggingInfoRef.current.offset.x * zoom}px, ${draggingInfoRef.current.offset.y * zoom}px)`;
        }

        if (edgeLayerImperativeRef?.current) edgeLayerImperativeRef.current.redraw();
        if (handleLayerImperativeRef?.current) handleLayerImperativeRef.current.redraw();

        dragRafRef.current = null;
      });
    }
  }
}

export function onNodeDragStart({ e, node, setDraggingNodeId, draggingNodeIdRef, dragOffset, zoom, pan, lastMousePos, lastDragPosition, // optional helpers used by the move handler
  draggingInfoRef, dragRafRef, nodeRefs, edgeLayerImperativeRef, handleLayerImperativeRef }) {
  e.preventDefault();
  setDraggingNodeId(node.id);
  draggingNodeIdRef.current = node.id;
  dragOffset.current = {
    x: e.clientX - (node.position.x * zoom + pan.x),
    y: e.clientY - (node.position.y * zoom + pan.y)
  };
  lastMousePos.current = { x: e.clientX, y: e.clientY };
  lastDragPosition.current = { x: node.position.x, y: node.position.y };

  // Create named handlers so they can be removed later
  const moveHandler = (event) => onNodeDragMove({ e: event, draggingNodeIdRef, lastMousePos, zoom, draggingInfoRef, dragRafRef, nodeRefs, edgeLayerImperativeRef, handleLayerImperativeRef });
  const upHandler = (event) => {
    // Ensure we call the module-level cleanup handler with expected params if present elsewhere
    // Try to call handleNodeDragEnd exported function by dispatching a custom event via window so callers can hook in,
    // and also perform local cleanup of listeners below.
    // Emit a DOM custom event for any legacy listeners
    try {
      const detail = { draggingNodeIdRef, draggingInfoRef, nodeRefs, edgeLayerImperativeRef, handleLayerImperativeRef, lastDragPosition };
      window.dispatchEvent(new CustomEvent('nodeDragLocalEnd', { detail }));
    } catch (err) { /* ignore */ }

    // Local cleanup
    if (draggingNodeIdRef.current && draggingNodeIdRef.current.__dragHandlers) {
      const handlers = draggingNodeIdRef.current.__dragHandlers;
      try { window.removeEventListener('mousemove', handlers.moveHandler); } catch (e) {}
      try { window.removeEventListener('mouseup', handlers.upHandler); } catch (e) {}
      draggingNodeIdRef.current.__dragHandlers = null;
    } else {
      try { window.removeEventListener('mousemove', moveHandler); } catch (e) {}
      try { window.removeEventListener('mouseup', upHandler); } catch (e) {}
    }
  };

  // Store handlers so handleNodeDragEnd can remove them reliably
  draggingNodeIdRef.current.__dragHandlers = { moveHandler, upHandler };

  window.addEventListener('mousemove', moveHandler);
  window.addEventListener('mouseup', upHandler);
}

export function handleNodeDragEnd({ draggingNodeIdRef, draggingInfoRef, nodes, onNodeMove, edgeLayerImperativeRef, handleLayerImperativeRef, setDraggingNodeId, dragRafRef, onNodeDragEnd, lastDragPosition, nodeRefs }) {
  // If custom stored handlers exist, remove them
  if (draggingNodeIdRef.current && draggingNodeIdRef.current.__dragHandlers) {
    const handlers = draggingNodeIdRef.current.__dragHandlers;
    try { window.removeEventListener('mousemove', handlers.moveHandler); } catch (e) {}
    try { window.removeEventListener('mouseup', handlers.upHandler); } catch (e) {}
    draggingNodeIdRef.current.__dragHandlers = null;
  } else {
    // Best-effort removal of generic listeners
    try { window.removeEventListener('mousemove', onNodeDragMove); } catch (e) {}
    try { window.removeEventListener('mouseup', handleNodeDragEnd); } catch (e) {}
  }

  if (draggingNodeIdRef.current && draggingInfoRef.current) {
    const id = draggingNodeIdRef.current;
    const offset = draggingInfoRef.current.offset;
    const node = nodes?.find(n => n.id === id);
    if (node && typeof onNodeMove === 'function') {
      const newPosition = { x: node.position.x + offset.x, y: node.position.y + offset.y };
      onNodeMove(id, newPosition);
    }

    const nodeEl = nodeRefs?.current?.get(id);
    if (nodeEl) nodeEl.style.transform = '';
    draggingInfoRef.current = null;

    if (edgeLayerImperativeRef?.current) edgeLayerImperativeRef.current.redraw();
    if (handleLayerImperativeRef?.current) handleLayerImperativeRef.current.redraw();

    if (typeof onNodeDragEnd === 'function') {
      onNodeDragEnd(id, lastDragPosition?.current);
    }
  }

  if (typeof setDraggingNodeId === 'function') setDraggingNodeId(null);
  if (draggingNodeIdRef) draggingNodeIdRef.current = null;
  if (dragRafRef?.current) {
    cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = null;
  }
}