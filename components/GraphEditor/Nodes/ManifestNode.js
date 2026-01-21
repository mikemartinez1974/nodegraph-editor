"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import FixedNode from './FixedNode';
import eventBus from '../../NodeGraph/eventBus';
import useNodeHandleSchema from '../hooks/useNodeHandleSchema';

const EMPTY_HANDLES = [];
const NON_PASSIVE_LISTENER = { passive: false };

const formatList = (value) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '—';
  }
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const ManifestNode = (props) => {
  const node = useNodeHandleSchema(props.node, EMPTY_HANDLES, EMPTY_HANDLES);
  const { zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  const manifest = node?.data || {};
  const identity = manifest.identity || {};
  const intent = manifest.intent || {};
  const dependencies = manifest.dependencies || {};
  const authority = manifest.authority || {};

  const sections = useMemo(
    () => [
      {
        title: 'Identity',
        rows: [
          ['Graph ID', identity.graphId],
          ['Name', identity.name],
          ['Version', identity.version],
          ['Description', identity.description],
          ['Created', identity.createdAt],
          ['Updated', identity.updatedAt]
        ]
      },
      {
        title: 'Intent',
        rows: [
          ['Kind', intent.kind],
          ['Scope', intent.scope],
          ['Description', intent.description]
        ]
      },
      {
        title: 'Dependencies',
        rows: [
          ['Node Types', formatList(dependencies.nodeTypes)],
          ['Handle Contracts', formatList(dependencies.handleContracts)],
          ['Skills', formatList(dependencies.skills)],
          [
            'Schema Versions',
            dependencies.schemaVersions ? JSON.stringify(dependencies.schemaVersions) : '—'
          ]
        ]
      },
      {
        title: 'Authority',
        rows: [
          [
            'Mutation',
            authority.mutation ? JSON.stringify(authority.mutation) : '—'
          ],
          ['Actors', authority.actors ? JSON.stringify(authority.actors) : '—'],
          ['Style Authority', authority.styleAuthority],
          ['History', authority.history ? JSON.stringify(authority.history) : '—']
        ]
      }
    ],
    [identity, intent, dependencies, authority]
  );

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
    resizeStartSize.current = { width: node.width || 60, height: node.height || 60 };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (event) => {
      const point = getPointerPosition(event);
      if (!point) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const dx = (point.x - resizeStartPos.current.x) / zoom;
      const dy = (point.y - resizeStartPos.current.y) / zoom;
      const newWidth = Math.max(240, resizeStartSize.current.width + dx);
      const newHeight = Math.max(180, resizeStartSize.current.height + dy);

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
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          bottom: '24px',
          fontSize: Math.max(10, 12 * zoom),
          lineHeight: 1.4,
          userSelect: 'text',
          overflow: 'hidden',
          padding: '8px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>
          Manifest
        </div>
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sections.map((section) => (
            <div key={section.title} style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '6px' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{section.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '4px', columnGap: '8px' }}>
                {section.rows.map(([label, value]) => (
                  <React.Fragment key={label}>
                    <div style={{ opacity: 0.7 }}>{label}</div>
                    <div>{formatList(value)}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        onMouseDown={handleResizeStart}
        onTouchStart={(e) => handleResizeStart(e.nativeEvent || e)}
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
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = isSelected ? '0.7' : '0.3';
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

export default ManifestNode;
