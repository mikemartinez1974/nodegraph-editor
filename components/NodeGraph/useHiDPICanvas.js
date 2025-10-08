import { useEffect, useRef, useCallback } from 'react';
import { setupHiDPICanvas, getCanvasContext } from './canvasUtils';

export function useHiDPICanvas(width, height, draw) {
  const canvasRef = useRef();
  const contextRef = useRef();

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return null;

    const ctx = getCanvasContext(canvas);
    contextRef.current = ctx;
    
    // Setup HiDPI scaling
    setupHiDPICanvas(canvas, ctx, width, height);
    
    return ctx;
  }, [width, height]);

  useEffect(() => {
    const ctx = setupCanvas();
    if (ctx && draw) {
      draw(ctx, width, height);
    }
  }, [setupCanvas, draw, width, height]);

  const redraw = useCallback(() => {
    const ctx = contextRef.current;
    if (ctx && draw) {
      ctx.clearRect(0, 0, width, height);
      draw(ctx, width, height);
    }
  }, [draw, width, height]);

  return { canvasRef, redraw };
}