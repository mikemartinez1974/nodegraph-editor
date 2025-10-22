import React from 'react';
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
    nodeTypes = { default: DefaultNode } 
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

    return (
        <div ref={containerRef} style={{ pointerEvents: 'none', width: '100vw', height: '100vh', position: 'absolute', left: 0, top: 0, zIndex: 30 }}>
            {uniqueNodes.map(node => {
                const NodeComponent = nodeTypes[node.type] || DefaultNode;
                const isSelected = selectedNodeIds.includes(node.id);
                const isMultiSelect = selectedNodeIds.length > 1;

                return (
                    <NodeComponent
                        key={node.id}
                        node={node}
                        pan={pan}
                        zoom={zoom}
                        isSelected={isSelected}
                        selected={selectedNodeId === node.id} // Backward compatibility
                        isMultiSelect={isMultiSelect}
                        selectedCount={selectedNodeIds.length}
                        draggingHandle={draggingNodeId === node.id}
                        onMouseDown={e => onNodeDragStart && onNodeDragStart(e, node)}
                        onClick={onNodeEvent ? (e) => onNodeEvent(node.id, e) : undefined}
                        onDoubleClick={onNodeDoubleClick ? (e) => {
                            e.stopPropagation();
                            onNodeDoubleClick(node.id);
                        } : undefined}
                        onMouseEnter={() => eventBus.emit('nodeHover', { id: node.id })}
                        onMouseLeave={() => eventBus.emit('nodeUnhover', { id: node.id })}
                        nodeRefs={nodeRefs}  // Pass nodeRefs to each node component
                    />
                 );
            })}
        </div>
    );
};

export default NodeLayer;