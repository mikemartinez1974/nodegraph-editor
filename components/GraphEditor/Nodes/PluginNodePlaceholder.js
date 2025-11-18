"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useEventBusListener } from '../../NodeGraph/eventBus';
import { subscribe as subscribeToPluginRegistry, getPluginNodeDefinition } from '../plugins/pluginRegistry';

const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

const extractPluginInfo = (data, type) => {
  if (data?.pluginId && data?.pluginNodeType) {
    return { pluginId: data.pluginId, pluginNodeType: data.pluginNodeType };
  }
  if (typeof type === 'string' && type.includes(':')) {
    const [pluginId, nodeType] = type.split(':');
    return { pluginId, pluginNodeType: nodeType };
  }
  return { pluginId: null, pluginNodeType: null };
};

export default function PluginNodePlaceholder({ data = {}, label, type, statusMessage }) {
  const { pluginId, pluginNodeType } = useMemo(() => extractPluginInfo(data, type), [data, type]);
  const [runtimeState, setRuntimeState] = useState({ status: 'idle', error: null });
  const [definition, setDefinition] = useState(() =>
    pluginId && pluginNodeType ? getPluginNodeDefinition(pluginId, pluginNodeType) : null
  );

  useEffect(() => {
    if (!pluginId || !pluginNodeType) {
      setDefinition(null);
      return undefined;
    }
    const update = () => {
      setDefinition(getPluginNodeDefinition(pluginId, pluginNodeType));
    };
    update();
    const unsubscribe = subscribeToPluginRegistry(() => update());
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [pluginId, pluginNodeType]);

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

  const displayConfig = definition?.display || {};
  const variant = displayConfig.variant || 'card';
  const primaryValue = displayConfig.primaryField ? data[displayConfig.primaryField] : undefined;
  const secondaryValue = displayConfig.secondaryField ? data[displayConfig.secondaryField] : undefined;
  const footerValue = displayConfig.footerField ? data[displayConfig.footerField] : undefined;
  const badgeValues = ensureArray(displayConfig.badgeField ? data[displayConfig.badgeField] : undefined);
  const listValues = ensureArray(displayConfig.listField ? data[displayConfig.listField] : undefined);
  const emptyStateMessage = displayConfig.emptyState || 'Plugin node placeholder — waiting for plugin data.';

  let statusLabel = statusMessage || 'Runtime not started';
  if (runtimeState.error) {
    statusLabel = `Runtime error: ${runtimeState.error}`;
  } else if (runtimeState.status === 'ready') {
    statusLabel = 'Runtime connected';
  } else if (runtimeState.status === 'loading') {
    statusLabel = 'Runtime starting…';
  } else if (runtimeState.status === 'removed') {
    statusLabel = 'Plugin disabled';
  }

  const title = label || definition?.label || pluginNodeType || 'Plugin Node';
  const emphasis = data.emphasis ? 600 : 500;

  const renderBadgeRow = () => {
    if (badgeValues.length === 0) return null;
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
        {badgeValues.map((value, index) => (
          <Chip key={`${value}-${index}`} size="small" label={String(value)} color="primary" variant="outlined" />
        ))}
      </Box>
    );
  };

  const renderList = () => {
    if (listValues.length === 0) return null;
    return (
      <Box sx={{ width: '100%', mt: 0.5 }}>
        {listValues.map((item, index) => (
          <Typography key={`${item}-${index}`} variant="caption" sx={{ display: 'block' }}>
            • {String(item)}
          </Typography>
        ))}
      </Box>
    );
  };

  const renderContent = () => {
    if (!definition) {
      return (
        <Typography variant="caption" align="center">
          {emptyStateMessage}
        </Typography>
      );
    }

    if (variant === 'stat') {
      return (
        <>
          <Typography variant="h5" fontWeight={emphasis} sx={{ mb: 0.25 }}>
            {primaryValue ?? emptyStateMessage}
          </Typography>
          {secondaryValue && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {secondaryValue}
            </Typography>
          )}
          {renderBadgeRow()}
          {footerValue && (
            <Typography variant="caption" color="text.secondary">
              {footerValue}
            </Typography>
          )}
        </>
      );
    }

    if (variant === 'list') {
      return (
        <>
          {primaryValue ? (
            <Typography variant="body2" fontWeight={emphasis} sx={{ mb: 0.5 }}>
              {primaryValue}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {emptyStateMessage}
            </Typography>
          )}
          {renderBadgeRow()}
          {renderList()}
        </>
      );
    }

    return (
      <>
        <Typography variant="body2" fontWeight={emphasis} sx={{ mb: 0.5 }}>
          {primaryValue ?? emptyStateMessage}
        </Typography>
        {secondaryValue && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            {secondaryValue}
          </Typography>
        )}
        {renderBadgeRow()}
        {renderList()}
        {footerValue && (
          <Typography variant="caption" color="text.secondary">
            {footerValue}
          </Typography>
        )}
      </>
    );
  };

  return (
    <Box
      sx={{
        p: 1.5,
        fontSize: 12,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        textAlign: 'left',
        color: 'text.primary'
      }}
    >
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {pluginId || 'Plugin Node'}
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {renderContent()}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {statusLabel}
      </Typography>
    </Box>
  );
}
