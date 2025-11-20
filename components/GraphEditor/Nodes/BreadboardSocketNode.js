"use client";
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const SOCKET_OUTPUTS = [
  { key: 'socket', label: 'Socket', type: 'value', direction: 'output' }
];

const clampSize = (value, fallback) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(8, value);
};

export default function BreadboardSocketNode({
  node: rawNode,
  pan = { x: 0, y: 0 },
  zoom = 1,
  isSelected,
  nodeRefs
}) {
  const node = useNodeHandleSchema(rawNode, [], SOCKET_OUTPUTS);
  const theme = useTheme();
  const nodeRef = useRef(null);

  const nominalWidth = clampSize(node?.width, 18);
  const nominalHeight = clampSize(node?.height, 18);
  const width = nominalWidth * zoom;
  const height = nominalHeight * zoom;

  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  const x = (node?.position?.x || 0) * zoom + pan.x - width / 2;
  const y = (node?.position?.y || 0) * zoom + pan.y - height / 2;

  const segment = node?.data?.segment || 'top';
  const label = node?.label || node?.data?.displayLabel || 'Socket';
  const occupiedBy = node?.data?.occupiedBy;
  const visualState = occupiedBy ? 'occupied' : 'idle';

  const baseColor =
    segment === 'top'
      ? theme.palette.info.light
      : theme.palette.success.light;

  const borderColor =
    visualState === 'occupied'
      ? theme.palette.warning.main
      : theme.palette.text.disabled;

  return (
    <div
      ref={nodeRef}
      className="node-or-handle"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        pointerEvents: 'auto',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 120ms ease',
        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
        borderRadius: '999px',
        backgroundColor: baseColor,
        border: `1px solid ${borderColor}`,
        color: theme.palette.getContrastText(baseColor),
        fontSize: 10 * Math.max(0.5, zoom),
        fontWeight: 500,
        zIndex: node?.state?.locked ? 0 : 1
      }}
      data-breadboard-socket
    >
      <span
        style={{
          opacity: visualState === 'occupied' ? 0.9 : 0.7
        }}
      >
        {label}
      </span>
    </div>
  );
}
