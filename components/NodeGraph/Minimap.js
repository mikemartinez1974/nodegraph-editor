// components/NodeGraph/Minimap.js
"use client";
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';

const Minimap = ({ 
  nodes = [], 
  groups = [],
  pan = { x: 0, y: 0 }, 
  zoom = 1,
  setPan,
  containerWidth = window.innerWidth,
  containerHeight = window.innerHeight,
  width = 200,
  height = 150,
  position = 'bottom-right' // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
}) => {
  const canvasRef = useRef(null);
  const theme = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate graph bounds
  const getGraphBounds = useCallback(() => {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      const x = node.position?.x || node.x || 0;
      const y = node.position?.y || node.y || 0;
      const w = (node.width || 60) / 2;
      const h = (node.height || 60) / 2;

      minX = Math.min(minX, x - w);
      maxX = Math.max(maxX, x + w);
      minY = Math.min(minY, y - h);
      maxY = Math.max(maxY, y + h);
    });

    // Add padding
    const padding = 100;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    return { minX, maxX, minY, maxY };
  }, [nodes]);

  // Draw minimap
  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Setup HiDPI canvas
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = theme.palette.mode === 'dark' 
      ? 'rgba(30, 30, 30, 0.9)' 
      : 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = theme.palette.divider;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    const bounds = getGraphBounds();
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;

    // Calculate scale to fit minimap
    const scaleX = (width - 20) / graphWidth;
    const scaleY = (height - 20) / graphHeight;
    const scale = Math.min(scaleX, scaleY);

    // Transform function
    const toMinimapX = (x) => ((x - bounds.minX) * scale) + 10;
    const toMinimapY = (y) => ((y - bounds.minY) * scale) + 10;

    // Draw groups
    groups.forEach(group => {
      if (group.visible === false || !group.bounds) return;
      
      const x = toMinimapX(group.bounds.x);
      const y = toMinimapY(group.bounds.y);
      const w = group.bounds.width * scale;
      const h = group.bounds.height * scale;

      ctx.fillStyle = group.style?.backgroundColor || 'rgba(25, 118, 210, 0.1)';
      ctx.fillRect(x, y, w, h);
      
      ctx.strokeStyle = group.style?.borderColor || theme.palette.primary.main;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    });

    // Draw nodes
    nodes.forEach(node => {
      if (node.visible === false) return;

      const x = toMinimapX(node.position?.x || node.x || 0);
      const y = toMinimapY(node.position?.y || node.y || 0);
      const w = ((node.width || 60) * scale);
      const h = ((node.height || 60) * scale);

      ctx.fillStyle = node.color || theme.palette.primary.main;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
    });

    // Draw viewport rectangle
    const viewportLeft = toMinimapX(-pan.x / zoom);
    const viewportTop = toMinimapY(-pan.y / zoom);
    const viewportWidth = (containerWidth / zoom) * scale;
    const viewportHeight = (containerHeight / zoom) * scale;

    ctx.strokeStyle = theme.palette.secondary.main;
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportLeft, viewportTop, viewportWidth, viewportHeight);

    // Semi-transparent fill
    ctx.fillStyle = theme.palette.mode === 'dark'
      ? 'rgba(244, 143, 177, 0.15)'
      : 'rgba(156, 39, 176, 0.15)';
    ctx.fillRect(viewportLeft, viewportTop, viewportWidth, viewportHeight);

  }, [nodes, groups, pan, zoom, width, height, theme, containerWidth, containerHeight, getGraphBounds]);

  // Redraw on changes
  useEffect(() => {
    drawMinimap();
  }, [drawMinimap]);

  // Handle click/drag on minimap to pan
  const handleMinimapInteraction = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const bounds = getGraphBounds();
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;
    const scaleX = (width - 20) / graphWidth;
    const scaleY = (height - 20) / graphHeight;
    const scale = Math.min(scaleX, scaleY);

    // Convert minimap click to graph coordinates
    const graphX = ((x - 10) / scale) + bounds.minX;
    const graphY = ((y - 10) / scale) + bounds.minY;

    // Center viewport on clicked position
    setPan({
      x: -graphX * zoom + containerWidth / 2,
      y: -graphY * zoom + containerHeight / 2
    });
  }, [width, height, zoom, containerWidth, containerHeight, getGraphBounds, setPan]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleMinimapInteraction(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleMinimapInteraction(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Position styles
  const getPositionStyles = () => {
    const base = {
      position: 'fixed',
      zIndex: 1000,
      cursor: isDragging ? 'grabbing' : 'grab',
      borderRadius: '8px',
      boxShadow: isHovered 
        ? '0 4px 20px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(0,0,0,0.2)',
      transition: 'box-shadow 0.2s, opacity 0.2s',
      opacity: isHovered || isDragging ? 1 : 0.7
    };

    const margin = 16;

    switch (position) {
      case 'bottom-right':
        return { ...base, bottom: margin, right: margin };
      case 'bottom-left':
        return { ...base, bottom: margin, left: margin };
      case 'top-right':
        return { ...base, top: margin + 70, right: margin }; // +70 for header
      case 'top-left':
        return { ...base, top: margin + 70, left: margin };
      default:
        return { ...base, bottom: margin, right: margin };
    }
  };

  return (
    <canvas
      ref={canvasRef}
      style={getPositionStyles()}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
};

export default Minimap;