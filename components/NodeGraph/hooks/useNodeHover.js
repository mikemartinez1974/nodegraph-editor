import { useState, useCallback } from 'react';

export function useNodeHover(nodes) {
    const [hoveredNode, setHoveredNode] = useState(null);
    const [hoveredHandle, setHoveredHandle] = useState(null);

    // Prioritize node hover over handle hover
    const handleMouseMove = useCallback((event) => {
        const { clientX, clientY } = event;
        let foundNode = null;
        let foundHandle = null;
        for (const node of nodes) {
            // Assume node has {x, y, width, height, handles}
            if (
                clientX >= node.x &&
                clientX <= node.x + node.width &&
                clientY >= node.y &&
                clientY <= node.y + node.height
            ) {
                foundNode = node;
                break;
            }
            if (node.ports) {
                for (const handle of node.ports) {
                    // Assume handle has {x, y, radius}
                    const dx = clientX - handle.x;
                    const dy = clientY - handle.y;
                    if (Math.hypot(dx, dy) <= handle.radius) {
                        foundHandle = handle;
                    }
                }
            }
        }
        if (foundNode) {
            setHoveredNode(foundNode);
            setHoveredHandle(null);
        } else if (foundHandle) {
            setHoveredNode(null);
            setHoveredHandle(foundHandle);
        } else {
            setHoveredNode(null);
            setHoveredHandle(null);
        }
    }, [nodes]);

    return { hoveredNode, hoveredHandle, handleMouseMove };
}