import React from 'react';
import DefaultNode from '../GraphEditor/Nodes/DefaultNode';
import eventBus from './eventBus';

const NodeLayer = ({ nodes, pan = { x: 0, y: 0 }, zoom = 1, selectedNodeId, selectedNodeIds = [], draggingNodeId, onNodeEvent, onNodeDragStart, nodeTypes = { default: DefaultNode } }) => {
    // Runtime check for duplicate node ids
    const idSet = new Set();
    const duplicates = [];
    nodes.forEach(node => {
        if (idSet.has(node.id)) {
            duplicates.push(node.id);
        } else {
            idSet.add(node.id);
        }
    });
    if (duplicates.length > 0) {
        console.warn('Duplicate node ids detected in NodeLayer:', duplicates);
    }

    return (
        <div style={{ pointerEvents: 'none', width: '100vw', height: '100vh', position: 'absolute', left: 0, top: 0 }}>
            {nodes.map(node => {
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
                        onMouseEnter={() => eventBus.emit('nodeHover', { id: node.id })}
                        onMouseLeave={() => eventBus.emit('nodeUnhover', { id: node.id })}
                    />
                );
            })}
        </div>
    );
};

export default NodeLayer;