"use client";

import React, { useRef, useEffect, useState } from 'react';

function EdgeOverlay({ edgeList, nodeList, pan, zoom, selectedEdgeId }) {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight * 0.9 });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    edgeList.forEach(edge => {
      const sourceNode = nodeList.find(n => n.id === edge.source);
      const targetNode = nodeList.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;
      ctx.save();
      ctx.beginPath();
      let x1 = sourceNode.position.x;
      let y1 = sourceNode.position.y;
      let x2 = targetNode.position.x;
      let y2 = targetNode.position.y;
      if (edge.type === 'curved') {
        const dx = (x2 - x1) / 3;
        const dy = (y2 - y1) / 3;
        ctx.moveTo(x1, y1);
        if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
          ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
        } else {
          ctx.bezierCurveTo(x1, y1 + dy, x2, y2 - dy, x2, y2);
        }
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.strokeStyle = edge.id === selectedEdgeId ? '#2196f3' : '#888';
      ctx.lineWidth = edge.id === selectedEdgeId ? 3 : 1.5;
      if (edge.type === 'dashed') {
        ctx.setLineDash([10, 8]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }, [edgeList, nodeList, pan, zoom, selectedEdgeId, canvasSize]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5 }}
    />
  );
}

export default EdgeOverlay;
