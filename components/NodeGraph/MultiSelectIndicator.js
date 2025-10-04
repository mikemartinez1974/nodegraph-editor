import React from 'react';
import { useTheme } from '@mui/material/styles';

export default function MultiSelectIndicator({ 
  selectedNodeIds = [], 
  selectedEdgeIds = [], 
  nodes = [], 
  edges = [], 
  pan, 
  zoom 
}) {
  const theme = useTheme();

  const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
  const selectedEdges = edges.filter(edge => selectedEdgeIds.includes(edge.id));

  // Calculate transform for pan/zoom
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        transform,
        transformOrigin: '0 0',
        zIndex: 1000
      }}
    >
      {/* Multi-select indicators for nodes */}
      {selectedNodes.map(node => (
        <div
          key={`selection-${node.id}`}
          style={{
            position: 'absolute',
            left: node.position.x - 4,
            top: node.position.y - 4,
            width: (node.width || 80) + 8,
            height: (node.height || 48) + 8,
            border: `2px solid ${theme.palette.primary.main}`,
            borderRadius: 6,
            backgroundColor: `${theme.palette.primary.main}20`,
            boxShadow: `0 0 0 1px ${theme.palette.background.paper}`,
            animation: selectedNodeIds.length > 1 ? 'pulse 2s infinite' : 'none'
          }}
        />
      ))}

      {/* Multi-select count indicator */}
      {(selectedNodeIds.length > 1 || selectedEdgeIds.length > 1) && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            padding: '8px 12px',
            borderRadius: 20,
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: theme.shadows[4],
            zIndex: 2000,
            pointerEvents: 'auto',
            transform: 'none'
          }}
        >
          {selectedNodeIds.length > 0 && `${selectedNodeIds.length} nodes`}
          {selectedNodeIds.length > 0 && selectedEdgeIds.length > 0 && ', '}
          {selectedEdgeIds.length > 0 && `${selectedEdgeIds.length} edges`} selected
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}