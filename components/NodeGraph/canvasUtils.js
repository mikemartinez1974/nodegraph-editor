// Canvas utilities for HiDPI scaling and performance
export function setupHiDPICanvas(canvas, ctx, width, height) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  // Set the actual size in memory (scaled up for HiDPI)
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  
  // Set the display size (CSS pixels)
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  // Scale the drawing context so everything draws at the correct size
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  return devicePixelRatio;
}

export function getCanvasContext(canvas, contextType = '2d') {
  const ctx = canvas.getContext(contextType);
  
  // Improve rendering quality
  if (contextType === '2d') {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  
  return ctx;
}

export function clearCanvas(ctx, width, height) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, width, height);
}