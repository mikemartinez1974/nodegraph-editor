"use client";
import React, { useRef, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';

const GridLayer = ({ pan, zoom, gridSize = 20, theme }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate grid spacing in screen space
    const gridSpacing = gridSize * zoom;

    // Only draw grid if spacing is reasonable (not too dense or sparse)
    if (gridSpacing < 10 || gridSpacing > 200) return;

    // Calculate offset based on pan
    const offsetX = pan.x % gridSpacing;
    const offsetY = pan.y % gridSpacing;

    ctx.strokeStyle = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = offsetX; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = offsetY; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }, [pan, zoom, gridSize, theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1
      }}
    />
  );
};

export default GridLayer;