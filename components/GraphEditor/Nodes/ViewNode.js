"use client";
import React, { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import FixedNode from './FixedNode';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const getPayloadByDatatype = (data, datatype) => {
  if (!data || !datatype) return undefined;
  const path = String(datatype).split('.').filter(Boolean);
  const normalized = path[0] === 'data' ? path.slice(1) : path;
  let current = data;
  for (const key of normalized) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
};

const stringifyPreview = (value) => {
  if (value === undefined) return 'No payload found for this datatype.';
  if (typeof value === 'string') return value.trim() || '(empty string)';
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
};

const ViewNode = (props) => {
  const node = useNodeHandleSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const theme = useTheme();
  const intent = node?.data?.view?.intent || '';
  const payloadKey = node?.data?.view?.payload || '';
  const datatype = payloadKey ? `data.${payloadKey}` : node?.data?.host?.datatype || '';
  const payload = useMemo(
    () => getPayloadByDatatype(node?.data || {}, datatype),
    [node?.data, datatype]
  );
  const preview = useMemo(() => stringifyPreview(payload), [payload]);

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'hidden',
          pointerEvents: 'auto'
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          View
        </div>
        <div
          style={{
            fontSize: 12,
            color: theme.palette.text.secondary,
            background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            padding: '4px 6px',
            borderRadius: 6,
            alignSelf: 'flex-start'
          }}
        >
          {payloadKey ? `${intent || 'node'} / ${payloadKey}` : datatype || 'data.twilite.web'}
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 11,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 8,
            padding: 8,
            background: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#fafafa'
          }}
        >
          {preview}
        </div>
      </div>
    </FixedNode>
  );
};

export default ViewNode;
