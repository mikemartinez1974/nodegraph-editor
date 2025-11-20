"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PluginNodePlaceholder from './PluginNodePlaceholder';
import { getNodeTypeMetadata } from '../nodeTypeRegistry';
import { NODE_RENDERER_SDK_SOURCE } from '../plugins/sdkSource';
import FixedNode from './FixedNode';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const generateToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const DEFAULT_INPUTS = [{ key: 'in', label: 'In', type: 'trigger' }];
const DEFAULT_OUTPUTS = [{ key: 'out', label: 'Out', type: 'trigger' }];

const resolveUrl = (entry) => {
  if (!entry) return null;
  try {
    if (entry.startsWith('http://') || entry.startsWith('https://')) {
      return entry;
    }
    if (entry.startsWith('/')) {
      return entry;
    }
    if (typeof window !== 'undefined') {
      return new URL(entry, window.location.origin).toString();
    }
    return entry;
  } catch {
    return entry;
  }
};

export default function PluginNodeRenderer(props) {
  const { node, type } = props;
  const nodeWithHandles = useNodeHandleSchema(node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const nodeTypeKey =
    typeof nodeWithHandles?.type === 'string'
      ? nodeWithHandles.type
      : typeof type === 'string'
      ? type
      : null;
  const nodeTypeMeta = useMemo(
    () => (nodeTypeKey ? getNodeTypeMetadata(nodeTypeKey) : null),
    [nodeTypeKey]
  );
  const pluginInfo = node?.extensions?.plugin || {};
  const pluginId =
    pluginInfo.id ||
    nodeTypeMeta?.pluginId ||
    (typeof nodeTypeKey === 'string' && nodeTypeKey.includes(':') ? nodeTypeKey.split(':')[0] : null);
  const pluginNodeType =
    pluginInfo.nodeType ||
    nodeTypeMeta?.pluginNodeType ||
    (typeof nodeTypeKey === 'string' && nodeTypeKey.includes(':') ? nodeTypeKey.split(':')[1] : null);
  const rendererEntry =
    pluginInfo.rendererEntry ||
    nodeTypeMeta?.rendererEntry ||
    nodeTypeMeta?.entry ||
    props.rendererEntry ||
    props.entry;
  const resolvedRendererUrl = resolveUrl(rendererEntry);
  const iframeRef = useRef(null);
  const tokenRef = useRef(generateToken());
  const [frameKey, setFrameKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [dynamicHeight, setDynamicHeight] = useState(null);

  const payload = useMemo(
    () => ({
      nodeId: nodeWithHandles?.id,
      pluginId,
      pluginNodeType,
      label: nodeWithHandles?.label,
      data: nodeWithHandles?.data,
      state: nodeWithHandles?.state,
      width: nodeWithHandles?.width,
      height: nodeWithHandles?.height
    }),
    [nodeWithHandles, pluginId, pluginNodeType]
  );

  const postMessage = useCallback(
    (message) => {
      if (!iframeRef.current?.contentWindow) return;
      try {
        iframeRef.current.contentWindow.postMessage(
          { ...message, token: tokenRef.current },
          '*'
        );
      } catch (err) {
        console.warn('[PluginNodeRenderer] Failed to post message', err);
      }
    },
    []
  );

  useEffect(() => {
    setReady(false);
    setError(null);
    setDynamicHeight(null);
    tokenRef.current = generateToken();
    setFrameKey((value) => value + 1);
  }, [resolvedRendererUrl, node?.id]);

  useEffect(() => {
    if (!ready) return;
    postMessage({ type: 'node:update', payload });
  }, [ready, payload, postMessage]);

  useEffect(() => {
    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.token !== tokenRef.current) return;
      if (msg.type === 'renderer:ready') {
        setReady(true);
        postMessage({ type: 'node:update', payload });
      } else if (msg.type === 'renderer:height' && typeof msg.height === 'number') {
        setDynamicHeight(msg.height);
      } else if (msg.type === 'renderer:error') {
        setError(msg.error || 'Renderer error');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [payload, postMessage]);

  const iframeHtml = useMemo(() => {
    if (!resolvedRendererUrl) return null;
    const baseHref = (() => {
      try {
        const url = new URL(resolvedRendererUrl, typeof window !== 'undefined' ? window.location.href : undefined);
        const clone = new URL(url.toString());
        clone.hash = '';
        clone.search = '';
        clone.pathname = clone.pathname.substring(0, clone.pathname.lastIndexOf('/') + 1);
        return clone.toString();
      } catch {
        return resolvedRendererUrl;
      }
    })();
    const inlineSdk = `<script>${NODE_RENDERER_SDK_SOURCE}</script>`;
    return `<!DOCTYPE html>
<html>
  <head>
    <base href="${baseHref}">
    <style>
      html,body{margin:0;padding:0;background:transparent;color:#111;font-family:Inter,system-ui,sans-serif;}
    </style>
  </head>
  <body>
    <div id="plugin-node-root"></div>
    ${inlineSdk}
    <script type="module" src="${resolvedRendererUrl}"></script>
  </body>
</html>`;
  }, [resolvedRendererUrl]);

  const handleFrameLoad = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    postMessage({ type: 'node:init', payload });
  }, [payload, postMessage, frameKey]);

  const layoutOptions = useMemo(() => {
    const layout =
      nodeWithHandles?.extensions?.layout ||
      nodeTypeMeta?.extensions?.layout ||
      {};
    const toNumber = (value, fallback) =>
      typeof value === 'number' ? value : fallback;
    const padding = toNumber(layout.padding, 8);
    return {
      hideChrome: Boolean(layout.hideChrome),
      inset: {
        top: toNumber(layout.paddingTop, padding),
        right: toNumber(layout.paddingRight, padding),
        bottom: toNumber(layout.paddingBottom, toNumber(layout.padding, 24)),
        left: toNumber(layout.paddingLeft, padding)
      }
    };
  }, [nodeWithHandles?.extensions?.layout, nodeTypeMeta?.extensions?.layout]);

  const renderContent = () => {
    if (!resolvedRendererUrl || error) {
      return (
        <PluginNodePlaceholder
          {...props}
          data={nodeWithHandles?.data}
          label={nodeWithHandles?.label}
          type={nodeTypeKey}
          statusMessage={error || 'Plugin renderer unavailable'}
        />
      );
    }
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <iframe
          key={frameKey}
          ref={iframeRef}
          title={`plugin-node-${nodeWithHandles?.id}`}
          srcDoc={iframeHtml || ''}
          onLoad={handleFrameLoad}
          sandbox="allow-scripts allow-same-origin"
          style={{
            border: 'none',
            width: '100%',
            height: dynamicHeight ? `${dynamicHeight}px` : '100%'
          }}
        />
        {!ready && !error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.6)',
              color: '#555',
              fontSize: 12
            }}
          >
            Loading plugin…
          </div>
        )}
      </div>
    );
  };

  return (
    <FixedNode
      {...props}
      node={nodeWithHandles}
      hideDefaultContent
      disableChrome={layoutOptions.hideChrome}
      style={
        layoutOptions.hideChrome
          ? {
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              padding: 0,
              borderRadius: 0
            }
          : undefined
      }
    >
      <div
        style={{
          position: 'absolute',
          top: layoutOptions.inset.top,
          left: layoutOptions.inset.left,
          right: layoutOptions.inset.right,
          bottom: layoutOptions.inset.bottom,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto'
        }}
      >
        {renderContent()}
      </div>
    </FixedNode>
  );
}
