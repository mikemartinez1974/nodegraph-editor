import { useState, useCallback } from 'react';

export function usePanZoom({ minZoom = 0.8, maxZoom = 1.5, zoomFactor = 1.05, panBound = 1000 }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const clamp = useCallback((value, min, max) => Math.max(min, Math.min(max, value)), []);

  function handleMouseDown(e, isDraggingRef, lastPosRef) {
    isDraggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseUp(isDraggingRef) {
    isDraggingRef.current = false;
  }

  function handleMouseMove(e, isDraggingRef, lastPosRef) {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    setPan(p => ({
      x: clamp(p.x + dx, -panBound, panBound),
      y: clamp(p.y + dy, -panBound, panBound)
    }));
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleWheel(e) {
    e.preventDefault();
    setZoom(z => clamp(e.deltaY < 0 ? z * zoomFactor : z / zoomFactor, minZoom, maxZoom));
  }

  return {
    pan,
    zoom,
    setPan,
    setZoom,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleWheel
  };
}
