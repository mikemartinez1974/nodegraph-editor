"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import FixedNode from './FixedNode';
import useNodePortSchema from '../hooks/useNodePortSchema';

const DEFAULT_INPUTS = [
  { key: 'signal', label: 'Signal', type: 'value' }
];

const DEFAULT_OUTPUTS = [
  { key: 'out', label: 'Out', type: 'value' }
];

const DEFAULT_COLORS = ['#6C63FF', '#2CB67D', '#FFB020', '#FF5C8D'];

const pickColor = (index) => DEFAULT_COLORS[index % DEFAULT_COLORS.length];

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
};

const drawWaveform = (ctx, width, height, options) => {
  const { color, samples } = options;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((value, idx) => {
    const x = (idx / (samples.length - 1 || 1)) * width;
    const y = height / 2 - (value * height) / 2;
    idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
};

const drawBars = (ctx, width, height, options) => {
  const { color, values } = options;
  const barCount = values.length;
  const gap = 6;
  const barWidth = Math.max(4, (width - gap * (barCount + 1)) / barCount);
  ctx.save();
  ctx.fillStyle = color;
  values.forEach((val, idx) => {
    const x = gap + idx * (barWidth + gap);
    const h = Math.max(4, val * (height - 16));
    const y = height - h - 8;
    drawRoundedRect(ctx, x, y, barWidth, h, 4);
    ctx.fill();
  });
  ctx.restore();
};

const buildWaveSamples = (data = []) => {
  if (Array.isArray(data) && data.length > 0) {
    return data.slice(0, 32).map((value) => Number(value) || 0);
  }
  const samples = [];
  for (let i = 0; i < 32; i += 1) {
    samples.push(Math.sin((i / 32) * Math.PI * 2) * 0.9 * Math.random());
  }
  return samples;
};

const buildBarValues = (data = []) => {
  if (Array.isArray(data) && data.length > 0) {
    return data.slice(0, 8).map((value) => Math.min(1, Math.max(0, Number(value) || 0)));
  }
  const values = [];
  for (let i = 0; i < 8; i += 1) {
    values.push(Math.random());
  }
  return values;
};

const CanvasNode = (props) => {
  const { node: originalNode, zoom = 1 } = props;
  const node = useNodePortSchema(originalNode, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const canvasRef = useRef(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const config = useMemo(() => {
    const type = node?.data?.style || 'wave';
    const palette = Array.isArray(node?.data?.palette) ? node.data.palette : DEFAULT_COLORS;
    const samples = buildWaveSamples(node?.data?.samples);
    const bars = buildBarValues(node?.data?.values);
    return { type, palette, samples, bars, caption: node?.data?.caption || 'Native Canvas Node' };
  }, [node]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = (node?.width || 220) * dpr;
    const height = (node?.height || 140) * dpr;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${node?.width || 220}px`;
    canvas.style.height = `${node?.height || 140}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const renderWidth = node?.width || 220;
    const renderHeight = node?.height || 140;
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 0, 0, renderWidth, renderHeight, 12);
    ctx.fill();
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, renderWidth, renderHeight);
    gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textBaseline = 'top';
    ctx.fillText(config.caption, 12, 12);

    const contentHeight = renderHeight - 48;
    ctx.save();
    ctx.translate(0, 36);
    ctx.beginPath();
    ctx.rect(12, 0, renderWidth - 24, contentHeight);
    ctx.clip();

    if (config.type === 'bars') {
      drawBars(ctx, renderWidth - 24, contentHeight - 8, {
        color: pickColor(1),
        values: config.bars
      });
    } else {
      drawWaveform(ctx, renderWidth - 24, contentHeight - 8, {
        color: pickColor(0),
        samples: config.samples
      });
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(config.type === 'bars' ? 'Canvas Bars' : 'Canvas Wave', renderWidth - 100, renderHeight - 10);
  }, [node?.width, node?.height, config, dpr]);

  return (
    <FixedNode
      {...props}
      node={node}
      hideDefaultContent
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        borderRadius: 0,
        padding: 0
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          overflow: 'hidden',
          pointerEvents: 'none'
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </FixedNode>
  );
};

export default CanvasNode;
