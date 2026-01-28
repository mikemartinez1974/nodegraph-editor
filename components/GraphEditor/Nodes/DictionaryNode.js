"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import FixedNode from './FixedNode';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';
import { useGraphEditorStateContext } from '../providers/GraphEditorContext';

const NON_PASSIVE_LISTENER = { passive: false };

const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const DictionaryNode = (props) => {
  const node = useNodeHandleSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const { zoom = 1, isSelected } = props;
  const theme = useTheme();
  const { edges = [], nodes = [] } = useGraphEditorStateContext();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  const nodeDefs = Array.isArray(node?.data?.nodeDefs) ? node.data.nodeDefs : [];
  const skills = Array.isArray(node?.data?.skills) ? node.data.skills : [];
  const views = Array.isArray(node?.data?.views) ? node.data.views : [];

  const scriptNodesById = useRef(new Map());
  scriptNodesById.current = new Map(
    (nodes || [])
      .filter((candidate) => candidate?.type === 'script')
      .map((script) => [script.id, script])
  );

  const scriptBindings = (edges || [])
    .filter((edge) => edge?.source === node.id)
    .filter((edge) => scriptNodesById.current.has(edge?.target))
    .map((edge) => ({
      id: edge.id,
      type: edge.type || 'edge',
      script: scriptNodesById.current.get(edge.target)
    }));

  const getPointerPosition = (event) => {
    if (!event) return null;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x: event.clientX, y: event.clientY };
    }
    return null;
  };

  const handleResizeStart = (event) => {
    const point = getPointerPosition(event);
    if (!point) return;
    if (event.stopPropagation) event.stopPropagation();
    if (event.cancelable && event.preventDefault) event.preventDefault();
    setIsResizing(true);
    resizeStartPos.current = { x: point.x, y: point.y };
    resizeStartSize.current = { width: node.width || 200, height: node.height || 120 };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (event) => {
      const point = getPointerPosition(event);
      if (!point) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const dx = (point.x - resizeStartPos.current.x) / zoom;
      const dy = (point.y - resizeStartPos.current.y) / zoom;
      const newWidth = Math.max(180, resizeStartSize.current.width + dx);
      const newHeight = Math.max(140, resizeStartSize.current.height + dy);

      eventBus.emit('nodeResize', { id: node.id, width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      eventBus.emit('nodeResizeEnd', { id: node.id });
    };

    document.addEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('mouseup', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchmove', handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchend', handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener('touchcancel', handleResizeEnd, NON_PASSIVE_LISTENER);
    };
  }, [isResizing, node.id, zoom]);

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        className="dictionary-content"
        data-allow-touch-scroll="true"
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          bottom: '24px',
          fontSize: Math.max(10, 12 * zoom),
          lineHeight: 1.4,
          userSelect: 'text',
          cursor: 'text',
          overflow: 'hidden',
          padding: '8px',
          boxSizing: 'border-box',
          zIndex: 1,
          pointerEvents: 'auto',
          backgroundColor: 'transparent',
          color: '#000',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            {node?.label || 'Dictionary'}
          </div>
          <div style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: 2 }}>
            Definitions + bindings
          </div>
          <hr style={{ width: '100%', opacity: 0.3, margin: '8px 0' }} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Node Definitions</div>
          {nodeDefs.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {nodeDefs.map((entry, index) => (
                <div
                  key={entry?.key || `${node.id}-entry-${index}`}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1px solid ${theme.palette.divider}`,
                    background: theme.palette.background.paper
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {entry?.key || `node-${index + 1}`}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                    {entry?.ref || entry?.path || entry?.file || 'No reference'}
                  </div>
                  {entry?.version ? (
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {entry.version}
                    </div>
                  ) : null}
                  {entry?.source ? (
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {entry.source}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
              No node definitions defined.
            </div>
          )}

          <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>Skills</div>
          {skills.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {skills.map((entry, index) => (
                <div
                  key={entry?.key || `${node.id}-skill-${index}`}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1px solid ${theme.palette.divider}`,
                    background: theme.palette.background.paper
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {entry?.key || `skill-${index + 1}`}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                    {entry?.ref || entry?.path || entry?.file || 'No reference'}
                  </div>
                  {entry?.version ? (
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {entry.version}
                    </div>
                  ) : null}
                  {entry?.source ? (
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {entry.source}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
              No skills defined.
            </div>
          )}

          <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>Views</div>
          {views.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {views.map((entry, index) => (
                <div
                  key={`${entry?.key || `view-${index}`}::${entry?.view || 'view'}`}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1px solid ${theme.palette.divider}`,
                    background: theme.palette.background.paper
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {entry?.key || `view-${index + 1}`}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    {`${entry?.intent || 'node'} / ${entry?.payload || entry?.view || 'twilite.web'}`}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                    {entry?.ref || entry?.path || entry?.file || 'No reference'}
                  </div>
                  {entry?.version ? (
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {entry.version}
                    </div>
                  ) : null}
                  {entry?.source ? (
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {entry.source}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
              No views defined.
            </div>
          )}

          <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>Bindings</div>
          {scriptBindings.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scriptBindings.map((binding) => (
                <div
                  key={binding.id}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1px dashed ${theme.palette.divider}`,
                    background: 'transparent'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {binding.script?.label || binding.script?.id || 'Script'}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    {binding.type}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
              No script bindings found.
            </div>
          )}
        </div>
      </div>

      <div
        onMouseDown={handleResizeStart}
        onTouchStart={(event) => handleResizeStart(event.nativeEvent || event)}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          opacity: isSelected ? 0.7 : 0.3,
          transition: 'opacity 0.2s ease',
          zIndex: 2
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.opacity = isSelected ? '0.7' : '0.3';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M 16,0 L 16,16 L 0,16"
            fill="none"
            stroke={theme.palette.text.secondary}
            strokeWidth="2"
          />
        </svg>
      </div>
    </FixedNode>
  );
};

export default DictionaryNode;
