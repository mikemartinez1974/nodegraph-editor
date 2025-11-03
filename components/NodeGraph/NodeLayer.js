import React, { useEffect, useState } from 'react';
import DefaultNode from '../GraphEditor/Nodes/DefaultNode';
import eventBus from './eventBus';

function deduplicateNodes(nodes) {
  const seen = new Set();
  return nodes.filter(node => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

const NodeLayer = ({ 
    containerRef,
    nodeRefs,
    nodes, 
    pan = { x: 0, y: 0 }, 
    zoom = 1, 
    selectedNodeId, 
    selectedNodeIds = [], 
    draggingNodeId, 
    onNodeEvent, 
    onNodeDoubleClick,
    onNodeDragStart, 
    onNodeMouseEnter, // Add this
    onNodeMouseLeave, // Add this
    onNodeHover,
    nodeTypes = { default: DefaultNode },
    suppressClickRef
}) => {
    // Deduplicate nodes before rendering
    const uniqueNodes = deduplicateNodes(nodes);
    
    // Runtime check for duplicate node ids
    const idSet = new Set();
    const duplicates = [];
    uniqueNodes.forEach(node => {
        if (idSet.has(node.id)) {
            duplicates.push(node.id);
        } else {
            idSet.add(node.id);
        }
    });
    if (duplicates.length > 0) {
        console.warn('Duplicate node ids detected in NodeLayer:', duplicates);
        console.log('Full nodes array with duplicates:', uniqueNodes);
    }

    // Force re-render on mount to ensure nodes appear
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <div ref={containerRef} style={{ pointerEvents: 'none', width: '100vw', height: '100vh', position: 'absolute', left: 0, top: 0, zIndex: 30 }}>
            {uniqueNodes.map(node => {
                const NodeComponent = nodeTypes[node.type] || DefaultNode;
                const isSelected = selectedNodeIds.includes(node.id);
                const isMultiSelect = selectedNodeIds.length > 1;

                return (
                    <div
                      key={node.id}
                      onMouseEnter={() => {
                        console.log('NodeLayer: Mouse entered node', node.id);
                        if (onNodeHover) onNodeHover(node.id);
                        onNodeMouseEnter && onNodeMouseEnter(node.id); // Add this
                      }}
                      onMouseLeave={() => {
                        console.log('NodeLayer: Mouse left node', node.id);
                        if (onNodeHover) onNodeHover(node.id);
                        onNodeMouseLeave && onNodeMouseLeave(node.id); // Add this
                      }}
                    >
                      <NodeComponent
                        node={node}
                        pan={pan}
                        zoom={zoom}
                        isSelected={isSelected}
                        selected={selectedNodeId === node.id}
                        isMultiSelect={isMultiSelect}
                        selectedCount={selectedNodeIds.length}
                        draggingHandle={draggingNodeId === node.id}
                        onMouseDown={e => {
                            const target = e.target;
                            if (target && target.closest && target.closest('.markdown-content')) {
                                return;
                            }
                            onNodeDragStart && onNodeDragStart(e, node);
                        }}
                        onClick={e => {
                            try {
                              const sel = window.getSelection && window.getSelection();
                              if (sel && sel.toString && sel.toString().length > 0) {
                                return;
                              }
                            } catch (err) {}
                            // Don't trigger click if we just finished dragging
                            if (suppressClickRef && suppressClickRef.current) {
                              return;
                            }
                            onNodeEvent && onNodeEvent(node.id, e);
                        }}
                        onDoubleClick={onNodeDoubleClick ? (e) => {
                            e.stopPropagation();
                            onNodeDoubleClick(node.id);
                        } : undefined}
                        onMouseEnter={() => {
                            const nodeId = node.id;
                            eventBus.emit('nodeHover', { id: nodeId });
                        }}
                        onMouseLeave={() => eventBus.emit('nodeUnhover', { id: node.id })}
                        nodeRefs={nodeRefs}
                      />
                    </div>
                 );
            })}
        </div>
    );
};

export default NodeLayer;