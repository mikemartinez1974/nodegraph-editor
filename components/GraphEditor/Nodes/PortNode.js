"use client";
import React from 'react';
import { useTheme } from '@mui/material/styles';
import FixedNode from './FixedNode';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';
import eventBus from '../../NodeGraph/eventBus';

const DEFAULT_INPUTS = [
  { key: 'in', label: 'In', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'out', label: 'Out', type: 'value' }
];

const buildTargetLabel = (target = {}) => {
  if (!target || typeof target !== 'object') return 'No target';
  const label = target.label || target.name || target.nodeLabel;
  if (label) return label;
  if (target.nodeId) return `node:${target.nodeId}`;
  if (target.graphId) return `graph:${target.graphId}`;
  if (target.url) return target.url;
  return 'No target';
};

const PortNode = (props) => {
  const node = useNodeHandleSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const theme = useTheme();
  const target = node?.data?.target || {};
  const targetLabel = buildTargetLabel(target);
  const intent = node?.data?.intent || node?.data?.type || 'port';
  const targetUrl = typeof target.url === 'string' ? target.url.trim() : '';

  const handleNavigate = (event) => {
    if (!targetUrl) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    try {
      eventBus.emit('fetchUrl', { url: targetUrl, source: 'port-node' });
    } catch (err) {
      console.warn('[PortNode] Failed to emit fetchUrl', err);
      if (typeof window !== 'undefined') {
        window.location.assign(targetUrl);
      }
    }
  };

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        style={{
          position: 'absolute',
          inset: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'auto',
          cursor: targetUrl ? 'pointer' : 'default'
        }}
        onClick={handleNavigate}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: theme.palette.primary.main,
              boxShadow: `0 0 0 3px ${theme.palette.action.selected}`
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 14 }}>Port</div>
          <div
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 999,
              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              color: theme.palette.text.secondary
            }}
          >
            {intent}
          </div>
        </div>
        <div style={{ fontSize: 12, color: theme.palette.text.secondary }}>
          {targetLabel}
        </div>
        {(target.url || target.graphId || target.nodeId) ? (
          <div
            style={{
              fontSize: 11,
              color: theme.palette.text.secondary,
              border: `1px dashed ${theme.palette.divider}`,
              borderRadius: 6,
              padding: '4px 6px',
              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa'
            }}
          >
            {target.url ? `url: ${target.url}` : null}
            {target.graphId ? `${target.url ? ' • ' : ''}graph: ${target.graphId}` : null}
            {target.nodeId ? `${target.url || target.graphId ? ' • ' : ''}node: ${target.nodeId}` : null}
          </div>
        ) : null}
      </div>
    </FixedNode>
  );
};

export default PortNode;
