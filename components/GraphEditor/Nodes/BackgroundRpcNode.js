"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const CARD_WIDTH = 300;
const CARD_HEIGHT = 220;
const RPC_INPUTS = [{ key: 'trigger', label: 'Trigger', type: 'trigger' }];
const RPC_OUTPUTS = [{ key: 'result', label: 'Result', type: 'value' }];

export default function BackgroundRpcNode({
  node: origNode,
  pan = { x: 0, y: 0 },
  zoom = 1,
  style = {},
  isSelected,
  onMouseDown,
  onClick,
  onDoubleClick,
  nodeRefs
}) {
  const theme = useTheme();
  const nodeRef = useRef(null);
  const node = useNodeHandleSchema(origNode, RPC_INPUTS, RPC_OUTPUTS);

  const width = (node?.width || CARD_WIDTH) * zoom;
  const height = (node?.height || CARD_HEIGHT) * zoom;
  const baseLeft = (node?.position?.x || 0) * zoom + pan.x - width / 2;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y - height / 2;

  const initialData = node?.data || {};

  const [availableMethods, setAvailableMethods] = useState(initialData.availableMethods || []);
  const [isReady, setIsReady] = useState(Boolean(initialData.isReady));
  const [selectedMethod, setSelectedMethod] = useState(initialData.selectedMethod || '');
  const [argsText, setArgsText] = useState(initialData.argsText || '{}');
  const [lastResult, setLastResult] = useState(initialData.lastResult || '');
  const [lastError, setLastError] = useState(initialData.lastError || null);
  const [isCalling, setIsCalling] = useState(false);

  // Register node ref
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  // Persist configuration changes back to graph state
  useEffect(() => {
    try {
      eventBus.emit('nodeUpdate', {
        id: node.id,
        updates: {
          data: {
            ...node.data,
            availableMethods,
            isReady,
            selectedMethod,
            argsText,
            lastResult,
            lastError
          }
        }
      });
    } catch (err) {
      console.warn('[BackgroundRpcNode] Failed to persist node data:', err);
    }
  }, [availableMethods, isReady, selectedMethod, argsText, lastResult, lastError, node.id, node.data]);

  // Handle handshake updates
  useEffect(() => {
    const handleMethods = ({ methods = [], ready = false } = {}) => {
      setAvailableMethods(methods);
      setIsReady(ready);
      if (methods.length > 0) {
        setSelectedMethod((prev) => (prev && methods.includes(prev)) ? prev : methods[0]);
      } else {
        setSelectedMethod('');
      }
    };

    eventBus.on('backgroundRpc:methods', handleMethods);
    return () => eventBus.off('backgroundRpc:methods', handleMethods);
  }, []);

  // Handle responses
  useEffect(() => {
    const handleResponse = ({ nodeId, method, result } = {}) => {
      if (nodeId !== node.id) return;
      setIsCalling(false);
      setLastError(null);
      try {
        const serialized = typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2);
        setLastResult(serialized);
        eventBus.emit('nodeOutput', {
          nodeId: node.id,
          outputName: method || 'result',
          value: result
        });
      } catch (err) {
        setLastResult(String(result));
      }
    };

    const handleError = ({ nodeId, method, error } = {}) => {
      if (nodeId !== node.id) return;
      setIsCalling(false);
      setLastError(error || 'RPC call failed');
    };

    eventBus.on('backgroundRpc:response', handleResponse);
    eventBus.on('backgroundRpc:error', handleError);
    return () => {
      eventBus.off('backgroundRpc:response', handleResponse);
      eventBus.off('backgroundRpc:error', handleError);
    };
  }, [node.id]);

  // Handle incoming nodeInput triggers
  useEffect(() => {
    const handleInput = ({ targetNodeId, value } = {}) => {
      if (targetNodeId !== node.id) return;

      let method = selectedMethod;
      let args = {};

      if (value && typeof value === 'object') {
        if (value.method && typeof value.method === 'string') {
          method = value.method;
        }
        if (value.args !== undefined) {
          args = value.args;
        } else {
          args = value;
        }
      } else if (value !== undefined) {
        args = value;
      }

      invokeRpc(method, args);
    };

    eventBus.on('nodeInput', handleInput);
    return () => eventBus.off('nodeInput', handleInput);
  }, [selectedMethod]);

  const parseArgs = () => {
    try {
      if (!argsText || argsText.trim() === '') {
        return {};
      }
      return JSON.parse(argsText);
    } catch (err) {
      setLastError('Invalid JSON in args');
      throw err;
    }
  };

  const invokeRpc = (methodOverride, argsOverride) => {
    const methodToCall = methodOverride || selectedMethod;
    if (!methodToCall) {
      setLastError('Select a method to call');
      return;
    }
    if (!isReady) {
      setLastError('Background RPC not ready');
      return;
    }

    let args = argsOverride;
    if (args === undefined) {
      try {
        args = parseArgs();
      } catch {
        return;
      }
    }

    setIsCalling(true);
    setLastError(null);
    eventBus.emit('backgroundRpc:call', {
      nodeId: node.id,
      method: methodToCall,
      args
    });
  };

  const containerStyle = useMemo(() => ({
    position: 'absolute',
    left: baseLeft,
    top: baseTop,
    width,
    minHeight: height,
    borderRadius: 12,
    border: isSelected
      ? `2px solid ${theme.palette.secondary.main}`
      : `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    boxShadow: isSelected
      ? `0 0 0 4px ${theme.palette.secondary.light}33`
      : '0px 10px 20px rgba(0,0,0,0.12)',
    padding: 12,
    boxSizing: 'border-box',
    color: theme.palette.text.primary,
    fontFamily: 'Inter, system-ui, sans-serif',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    ...style
  }), [baseLeft, baseTop, width, height, isSelected, theme, style]);

  // Add a static method for properties panel support
  BackgroundRpcNode.getProperties = function(node) {
    const data = node?.data || {};
    return [
      { label: 'Selected Method', value: data.selectedMethod || '' },
      { label: 'Args', value: data.argsText || '' },
      { label: 'Last Result', value: data.lastResult || '' },
      { label: 'Last Error', value: data.lastError || '' },
      { label: 'Is Ready', value: data.isReady ? 'Yes' : 'No' },
      { label: 'Available Methods', value: Array.isArray(data.availableMethods) ? data.availableMethods.join(', ') : '' },
    ];
  };

  return (
    <div
      ref={nodeRef}
      className="node-or-handle"
      style={containerStyle}
      tabIndex={0}
      onMouseDown={e => {
        e.stopPropagation();
        if (onMouseDown) onMouseDown(e);
        eventBus.emit('nodeMouseDown', { id: node.id, event: e });
      }}
      onClick={e => {
        e.stopPropagation();
        if (onClick) onClick(e);
        eventBus.emit('nodeClick', { id: node.id, event: e });
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick(e);
      }}
      onMouseEnter={e => eventBus.emit('nodeMouseEnter', { id: node.id, event: e })}
      onMouseLeave={e => eventBus.emit('nodeMouseLeave', { id: node.id, event: e })}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            Background RPC
          </h4>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: 6,
              background: isReady
                ? theme.palette.success.light
                : theme.palette.warning.light,
              color: isReady
                ? theme.palette.success.contrastText
                : theme.palette.warning.contrastText
            }}
          >
            {isReady ? 'Connected' : 'Waiting'}
          </span>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: theme.palette.text.secondary }}>
          Method
        </label>
        <select
          value={selectedMethod}
          onChange={e => setSelectedMethod(e.target.value)}
          disabled={!availableMethods.length}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: 6,
            border: `1px solid ${theme.palette.divider}`,
            fontSize: 12,
            background: theme.palette.background.default,
            color: theme.palette.text.primary,
            outline: 'none'
          }}
        >
          {availableMethods.length === 0 ? (
            <option value="">No methods available</option>
          ) : (
            availableMethods.map(method => (
              <option key={method} value={method}>{method}</option>
            ))
          )}
        </select>

        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: theme.palette.text.secondary }}>
          Args (JSON)
        </label>
        <textarea
          value={argsText}
          onChange={e => setArgsText(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: 60,
            maxHeight: 140,
            borderRadius: 6,
            border: `1px solid ${theme.palette.divider}`,
            fontSize: 12,
            padding: 8,
            background: theme.palette.background.default,
            color: theme.palette.text.primary,
            fontFamily: 'Monaco, monospace'
          }}
        />

        <button
          onClick={() => invokeRpc()}
          disabled={!isReady || !selectedMethod || isCalling}
          style={{
            marginTop: 4,
            borderRadius: 6,
            border: 'none',
            padding: '8px 10px',
            fontSize: 12,
            fontWeight: 600,
            cursor: (!isReady || !selectedMethod || isCalling) ? 'not-allowed' : 'pointer',
            background: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            opacity: (!isReady || !selectedMethod || isCalling) ? 0.5 : 1,
            transition: 'background 0.2s ease'
          }}
        >
          {isCalling ? 'Calling…' : 'Invoke'}
        </button>

        {lastError && (
          <div
            style={{
              marginTop: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: theme.palette.error.light,
              color: theme.palette.error.contrastText,
              fontSize: 11,
              lineHeight: 1.4
            }}
          >
            {lastError}
          </div>
        )}

        {lastResult && (
          <div
            style={{
              marginTop: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: theme.palette.background.default,
              color: theme.palette.text.primary,
              fontSize: 11,
              lineHeight: 1.4,
              maxHeight: 120,
              overflow: 'auto',
              border: `1px solid ${theme.palette.divider}`
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>Last Result:</strong>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Monaco, monospace'
              }}
            >
              {lastResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
