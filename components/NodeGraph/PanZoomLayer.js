import React, { useRef, useEffect } from 'react';

const PanZoomLayer = ({ pan, zoom, onPanZoom, onBackgroundClick }) => {
    const dragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const mouseDownPosRef = React.useRef(null);
    const layerRef = useRef(null);

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };
        onPanZoom((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handleMouseUp = (e) => {
        if (e.button !== 0) return;
        dragging.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (!mouseDownPosRef.current) return;
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        const moved = dx > 5 || dy > 5;
        if (!moved && typeof onBackgroundClick === 'function') {
            onBackgroundClick(e);
        }
        mouseDownPosRef.current = null;
    };

    useEffect(() => {
        const el = layerRef.current;
        if (!el) return;
        function handleWheel(e) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            onPanZoom((prev) => ({ ...prev, zoom: Math.max(0.1, zoom + delta) }));
        }
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', handleWheel, { passive: false });
        };
    }, [zoom, onPanZoom]);

    return (
        <div
            ref={layerRef}
            style={{
                position: 'absolute',
                inset: 0,
                cursor: 'grab',
                zIndex: 1,
                background: 'transparent',
            }}
            onMouseDown={handleMouseDown}
        />
    );
};

export default PanZoomLayer;