"use client";

import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useEventBusListener } from '../../NodeGraph/eventBus';

export default function PluginNodePlaceholder({ data, label, type }) {
  const pluginId = useMemo(() => {
    if (data?.pluginId) return data.pluginId;
    if (typeof type === 'string' && type.includes(':')) {
      return type.split(':')[0];
    }
    return null;
  }, [data?.pluginId, type]);

  const pluginNodeType = useMemo(() => {
    if (data?.pluginNodeType) return data.pluginNodeType;
    if (typeof type === 'string' && type.includes(':')) {
      return type.split(':')[1];
    }
    return null;
  }, [data?.pluginNodeType, type]);

  const [runtimeState, setRuntimeState] = useState({ status: 'idle', error: null });

  useEventBusListener(
    'pluginRuntime:status',
    (payload) => {
      if (!payload || payload.pluginId !== pluginId) return;
      setRuntimeState((prev) => ({
        ...prev,
        status: payload.status || prev.status,
        error: payload.error || null
      }));
    },
    { enabled: Boolean(pluginId), dependencies: [pluginId] }
  );

  useEventBusListener(
    'pluginRuntime:error',
    (payload) => {
      if (!payload || payload.pluginId !== pluginId) return;
      setRuntimeState({
        status: 'error',
        error: payload.error || 'Runtime error'
      });
    },
    { enabled: Boolean(pluginId), dependencies: [pluginId] }
  );

  const greeting =
    data?.greeting ||
    data?.message ||
    'Plugin runtime placeholder – waiting for remote node component.';

  let statusLabel = 'Runtime not started';
  if (runtimeState.error) {
    statusLabel = `Runtime error: ${runtimeState.error}`;
  } else if (runtimeState.status === 'ready') {
    statusLabel = 'Runtime connected';
  } else if (runtimeState.status === 'loading') {
    statusLabel = 'Runtime starting…';
  } else if (runtimeState.status === 'removed') {
    statusLabel = 'Plugin disabled';
  }

  return (
    <Box
      sx={{
        p: 1.5,
        fontSize: 12,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'text.secondary'
      }}
    >
      <Typography variant="body2" fontWeight={600}>
        {label || pluginNodeType || 'Plugin Node'}
      </Typography>
      {pluginId && (
        <Typography variant="caption" sx={{ mb: 0.5 }}>
          {pluginId}
        </Typography>
      )}
      <Typography variant="caption" sx={{ mb: 0.5 }}>
        {statusLabel}
      </Typography>
      <Typography variant="caption">{greeting}</Typography>
    </Box>
  );
}
