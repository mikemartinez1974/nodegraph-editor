// eventHandlers.js
import { isPointNearLine, isPointNearBezier } from './utils.js';

export function handleCanvasClick(e, canvasRef, pan, zoom, edgeListRef, nodeList, setSelectedEdgeId, setSelectedNodeId) {
  const rect = canvasRef.current.getBoundingClientRect();
  const x = (e.clientX - rect.left - pan.x) / zoom;
  const y = (e.clientY - rect.top - pan.y) / zoom;
  for (const edge of edgeListRef.current) {
    const sourceNode = nodeList.find(n => n.id === edge.source);
    const targetNode = nodeList.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;
    const x1 = sourceNode.position.x;
    const y1 = sourceNode.position.y;
    const x2 = targetNode.position.x;
    const y2 = targetNode.position.y;
    if (edge.type === 'curved') {
      const curveOffset = Math.max(Math.abs(y2 - y1), 100);
      const cx1 = x1 + curveOffset;
      const cy1 = y1;
      const cx2 = x2 - curveOffset;
      const cy2 = y2;
      if (isPointNearBezier(x, y, x1, y1, cx1, cy1, cx2, cy2, x2, y2)) {
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
        return;
      }
    } else {
      if (isPointNearLine(x, y, x1, y1, x2, y2)) {
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
        return;
      }
    }
  }
}

export function handleCanvasMouseDown(e, isPanning, setIsPanningState, lastPanPos, handleCanvasMouseMove, handleCanvasMouseUp) {
  if (e.button === 0 && e.target === e.currentTarget) {
    isPanning.current = true;
    setIsPanningState(true);
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
  }
}

export function handleCanvasMouseMove(e, isPanning, lastPanPos, setPan) {
  if (isPanning.current) {
    const dx = e.clientX - lastPanPos.current.x;
    const dy = e.clientY - lastPanPos.current.y;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }
}

export function handleCanvasMouseUp(isPanning, setIsPanningState, handleCanvasMouseMove, handleCanvasMouseUp) {
  isPanning.current = false;
  setIsPanningState(false);
  window.removeEventListener('mousemove', handleCanvasMouseMove);
  window.removeEventListener('mouseup', handleCanvasMouseUp);
}

export function handleNodeMouseDown(e, node, setDraggingNodeId, draggingNodeIdRef, dragOffset, zoom, pan, handleNodeMouseMove, handleNodeMouseUp) {
  e.preventDefault();
  setDraggingNodeId(node.id);
  draggingNodeIdRef.current = node.id;
  dragOffset.current = {
    x: e.clientX - (node.position.x * zoom + pan.x),
    y: e.clientY - (node.position.y * zoom + pan.y)
  };
  window.addEventListener('mousemove', handleNodeMouseMove);
  window.addEventListener('mouseup', handleNodeMouseUp);
}

export function handleNodeMouseMove(e, draggingNodeIdRef, dragOffset, pan, zoom, setNodeList) {
  if (draggingNodeIdRef.current) {
    const newX = (e.clientX - dragOffset.current.x - pan.x) / zoom;
    const newY = (e.clientY - dragOffset.current.y - pan.y) / zoom;
    setNodeList(prev => prev.map(n => n.id === draggingNodeIdRef.current ? { ...n, position: { x: newX, y: newY } } : n));
  }
}

export function handleNodeMouseUp(setDraggingNodeId, draggingNodeIdRef, handleNodeMouseMove, handleNodeMouseUp) {
  setDraggingNodeId(null);
  draggingNodeIdRef.current = null;
  window.removeEventListener('mousemove', handleNodeMouseMove);
  window.removeEventListener('mouseup', handleNodeMouseUp);
}

export function onNodeDragStart(e, node, setDraggingNodeId, draggingNodeIdRef, dragOffset, zoom, pan, onNodeDragMove, onNodeDragEnd) {
  e.preventDefault();
  setDraggingNodeId(node.id);
  draggingNodeIdRef.current = node.id;
  dragOffset.current = {
    x: e.clientX - (node.position.x * zoom + pan.x),
    y: e.clientY - (node.position.y * zoom + pan.y)
  };
  window.addEventListener('mousemove', onNodeDragMove);
  window.addEventListener('mouseup', onNodeDragEnd);
}

export function onNodeDragEnd(setDraggingNodeId, draggingNodeIdRef, onNodeDragMove, onNodeDragEnd) {
  setDraggingNodeId(null);
  draggingNodeIdRef.current = null;
  window.removeEventListener('mousemove', onNodeDragMove);
  window.removeEventListener('mouseup', onNodeDragEnd);
}