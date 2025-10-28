"use client";
import React from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import DefaultNode from './DefaultNode';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { TlzLink } from '../components/TlzLink';

const DivNode = ({
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
  nodeRefs
}) => {
  const theme = useTheme();

  const contentStyle = {
    width: '100%',
    height: '100%',
    pointerEvents: 'auto',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    color: theme.palette.text?.primary || '#000',
    whiteSpace: 'pre-wrap',
    padding: 8,
    boxSizing: 'border-box'
  };

  const memoContent = node?.memo ?? node?.data?.memo;
  const htmlContent = node?.data?.html;

  const sanitizeSchema = {
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href || []), 'tlz']
    }
  };

  return (
    <DefaultNode
      node={node}
      pan={pan}
      zoom={zoom}
      style={style}
      isSelected={isSelected}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggingHandle={draggingHandle}
      nodeRefs={nodeRefs}
    >
      {memoContent ? (
        <div style={contentStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} components={{ a: TlzLink }}>
            {memoContent}
          </ReactMarkdown>
        </div>
      ) : htmlContent ? (
        <div style={contentStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} components={{ a: TlzLink }}>
            {htmlContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div style={contentStyle}>{node?.data?.text || children}</div>
      )}
    </DefaultNode>
  );
};

export default DivNode;
