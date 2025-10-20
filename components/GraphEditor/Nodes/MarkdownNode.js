"use client";
import React from 'react';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'
import eventBus from '../../NodeGraph/eventBus';
import LinkIcon from '@mui/icons-material/Link';
import DefaultNode from './DefaultNode';

const MarkdownNode = ({ 
  node, 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  style = {}, 
  isSelected, 
  onMouseDown, 
  onClick, 
  onDoubleClick, 
  children, 
  draggingHandle,
  nodeRefs,
  onResize
}) => {
  const theme = useTheme();
  const memo = node?.data?.memo || '';
  const hasLink = node?.data?.link && node.data.link.trim().length > 0;

  // Theme-sensitive markdown styling
  const isDark = theme.palette.mode === 'dark';

  // Render using DefaultNode as base, with custom markdown content
  return (
    <DefaultNode
      {...{ node, pan, zoom, style, isSelected, onMouseDown, onClick, onDoubleClick, draggingHandle, nodeRefs, onResize }}
    >
      {/* Markdown content */}
      <div 
        style={{ 
          flex: 1,
          padding: '12px',
          overflow: 'auto',
          fontSize: Math.max(10, 12 * zoom),
          lineHeight: 1.5,
          fontFamily: isDark ? '"Courier New", Courier, monospace' : '"Comic Sans MS", "Trebuchet MS", sans-serif',
          cursor: 'pointer',
          pointerEvents: 'none'
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Style markdown elements to fit the board theme
            p: ({node, ...props}) => <p style={{ margin: '0 0 8px 0' }} {...props} />,
            h1: ({node, ...props}) => <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5em', fontWeight: 'bold', borderBottom: isDark ? '2px solid #4a6b4a' : '2px solid #8b7355' }} {...props} />,
            h2: ({node, ...props}) => <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3em', fontWeight: 'bold' }} {...props} />,
            h3: ({node, ...props}) => <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15em', fontWeight: 'bold' }} {...props} />,
            ul: ({node, ...props}) => <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} {...props} />,
            ol: ({node, ...props}) => <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} {...props} />,
            li: ({node, ...props}) => <li style={{ margin: '3px 0' }} {...props} />,
            code: ({node, inline, ...props}) => 
              inline 
                ? <code style={{ background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', padding: '2px 5px', borderRadius: 3, fontFamily: 'monospace' }} {...props} />
                : <code style={{ display: 'block', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', padding: '10px', borderRadius: 4, margin: '10px 0', overflow: 'auto', fontFamily: 'monospace', border: isDark ? '1px solid #4a6b4a' : '1px solid #d0d0d0' }} {...props} />,
            strong: ({node, ...props}) => <strong style={{ fontWeight: 'bold', textShadow: isDark ? '0 0 1px rgba(200, 230, 201, 0.5)' : 'none' }} {...props} />,
            em: ({node, ...props}) => <em style={{ fontStyle: 'italic' }} {...props} />,
            a: ({node, ...props}) => <a style={{ color: isDark ? '#81c784' : '#1976d2', textDecoration: 'underline', pointerEvents: 'auto' }} {...props} target="_blank" rel="noopener noreferrer" />
          }}
        >
          {memo}
        </ReactMarkdown>
      </div>
      
      {/* Link indicator */}
      {hasLink && (
        <div style={{
          position: 'absolute',
          bottom: 6,
          right: 28,
          backgroundColor: isDark ? 'rgba(200, 230, 201, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: '50%',
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.3)',
          border: isDark ? '1px solid #4a6b4a' : '1px solid #8b7355'
        }}>
          <LinkIcon sx={{ fontSize: 14, color: isDark ? '#1a2b1a' : '#8b7355' }} />
        </div>
      )}
      
    </DefaultNode>
  );
};

export default MarkdownNode;
