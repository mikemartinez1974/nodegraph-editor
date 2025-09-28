import React from 'react';
import NodeComponent from '../GraphEditor/Nodes/NodeComponent';

const NodeLayer = ({ nodes, pan = { x: 0, y: 0 }, zoom = 1, selectedNodeId, draggingNodeId, onNodeEvent, onNodeDragStart }) => {
    return (
        <div style={{ pointerEvents: 'none', width: '100vw', height: '100vh', position: 'absolute', left: 0, top: 0 }}>
            {nodes.map(node => (
                <NodeComponent
                    key={node.id}
                    node={node}
                    pan={pan}
                    zoom={zoom}
                    isSelected={selectedNodeId === node.id}
                    draggingHandle={draggingNodeId === node.id}
                    onMouseDown={e => onNodeDragStart && onNodeDragStart(e, node)}
                    onClick={onNodeEvent ? (e) => onNodeEvent(node.id, e) : undefined}
                />
            ))}
        </div>
    );
};

export default NodeLayer;