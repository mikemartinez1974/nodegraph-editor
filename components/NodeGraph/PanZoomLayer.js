import React, { useRef, useEffect, useCallback } from 'react';

const PanZoomLayer = React.forwardRef(({ pan, zoom, onPanZoom, setZoom, onBackgroundClick, onMarqueeStart, children, theme, layerRefs }, ref) => {
    const dragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const mouseDownPosRef = React.useRef(null);
    const layerRef = useRef(null);

    const tempPanRef = useRef({ x: 0, y: 0 });
    const rafIdRef = useRef(null);

    const applyTempPan = useCallback(() => {
        const tx = tempPanRef.current.x;
        const ty = tempPanRef.current.y;
        const t = (tx || ty) ? `translate(${tx}px, ${ty}px)` : '';
        
        if (layerRefs.edgeCanvas.current) layerRefs.edgeCanvas.current.style.transform = t;
        if (layerRefs.handleCanvas.current) layerRefs.handleCanvas.current.style.transform = t;
        if (layerRefs.group.current) layerRefs.group.current.style.transform = t;
        if (layerRefs.nodeContainer.current) layerRefs.nodeContainer.current.style.transform = t;
    }, [layerRefs]);

    const handleMouseMove = useCallback((e) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };

        tempPanRef.current.x += dx;
        tempPanRef.current.y += dy;

        if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
                applyTempPan();
                rafIdRef.current = null;
            });
        }
    }, [applyTempPan]);

    const handleMouseUp = useCallback((e) => {
        if (e.button !== 0) return;
        dragging.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        onPanZoom((prev) => ({ x: prev.x + tempPanRef.current.x, y: prev.y + tempPanRef.current.y }));
        tempPanRef.current = { x: 0, y: 0 };
        applyTempPan();

        if (!mouseDownPosRef.current) return;
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        const moved = dx > 5 || dy > 5;
        if (!moved && typeof onBackgroundClick === 'function') {
            onBackgroundClick(e);
        }
        mouseDownPosRef.current = null;
    }, [handleMouseMove, onBackgroundClick, applyTempPan, onPanZoom]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;

        // Check if this should be handled by marquee selection
        if (e.shiftKey && onMarqueeStart) {
            const marqueeStarted = onMarqueeStart(e);
            if (marqueeStarted) {
                e.preventDefault(); // Prevent default panning behavior
                e.stopPropagation();
                return; // Marquee selection started, block panning
            }
        }

        // Default to panning behavior
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove, handleMouseUp, onMarqueeStart]);

    useEffect(() => {
        function handleWheel(e) {
            e.preventDefault();
            const change = 0.01;
            const delta = e.deltaY < 0 ? change : -change;
            if (typeof setZoom === 'function') {
                setZoom((prev) => Math.max(0.1, Math.min(2, prev + delta)));
            }
        }
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('wheel', handleWheel, { passive: false });
        };
    }, [zoom, setZoom]);

    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                inset: 0,
                cursor: 'default',
                zIndex: 1,
                background: 'transparent',
                transition: 'background 0.2s',
                pointerEvents: 'auto', // Ensure wheel events are received
            }}
            onMouseDown={handleMouseDown}
        >
            {children}
        </div>
    );
});

export default PanZoomLayer;