import { useState, useCallback } from 'react';
import { isPointNearLine, isPointNearBezier } from '../utils';

export function useEdgeHover(edges) {
    const [hoveredEdge, setHoveredEdge] = useState(null);

    const handleMouseMove = useCallback((event) => {
        const { clientX, clientY } = event;
        let foundEdge = null;
        for (const edge of edges) {
            // Assume edge has type: 'line' or 'bezier', and relevant points
            if (edge.type === 'line') {
                if (isPointNearLine({ x: clientX, y: clientY }, edge.source, edge.target)) {
                    foundEdge = edge;
                    break;
                }
            } else if (edge.type === 'bezier' && edge.bezierPoints) {
                if (isPointNearBezier({ x: clientX, y: clientY }, edge.bezierPoints)) {
                    foundEdge = edge;
                    break;
                }
            }
        }
        setHoveredEdge(foundEdge);
    }, [edges]);

    return { hoveredEdge, handleMouseMove };
}