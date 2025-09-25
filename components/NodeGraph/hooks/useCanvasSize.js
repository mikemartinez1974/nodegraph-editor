import { useState, useEffect } from 'react';

export function useCanvasSize() {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function updateSize() {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return canvasSize;
}