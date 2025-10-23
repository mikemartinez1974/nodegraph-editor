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
        
        if (layerRefs?.edgeCanvas?.current) layerRefs.edgeCanvas.current.style.transform = t;
        if (layerRefs?.handleCanvas?.current) layerRefs.handleCanvas.current.style.transform = t;
        if (layerRefs?.group?.current) layerRefs.group.current.style.transform = t;
        if (layerRefs?.nodeContainer?.current) layerRefs.nodeContainer.current.style.transform = t;
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

        // Use latest tempPanRef for pan update, then reset synchronously
        const panDelta = { ...tempPanRef.current };
        onPanZoom((prev) => ({ x: prev.x + panDelta.x, y: prev.y + panDelta.y }));
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
                e.preventDefault();
                e.stopPropagation();
                return;
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
        const wheelTimeoutRef = { current: null };
        
        function handleWheel(e) {
            // Only zoom if mouse is over the graph canvas, not a scrollable panel or input
            const tag = e.target.tagName;
            const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
            const isScrollablePanel = e.target.closest('.MuiDrawer-paper, .scrollable-panel, .MuiPaper-root');
            if (isTextInput || isScrollablePanel) {
                return;
            }
            e.preventDefault();
            
            // Clear any pending zoom timeout
            if (wheelTimeoutRef.current) {
                clearTimeout(wheelTimeoutRef.current);
            }
            
            // Multiplicative zoom for smooth, natural feel
            const zoomSpeed = 0.002;
            const delta = -e.deltaY * zoomSpeed;
            
            setZoom((prevZoom) => {
                const newZoom = Math.max(0.1, Math.min(3, prevZoom * (1 + delta)));
                
                // Calculate cursor position in graph coordinates
                const cursorX = e.clientX;
                const cursorY = e.clientY;
                
                // Zoom towards cursor
                onPanZoom((prevPan) => {
                    const graphX = (cursorX - prevPan.x) / prevZoom;
                    const graphY = (cursorY - prevPan.y) / prevZoom;
                    
                    return {
                        x: cursorX - graphX * newZoom,
                        y: cursorY - graphY * newZoom
                    };
                });
                
                return newZoom;
            });
        }
        
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('wheel', handleWheel, { passive: false });
            if (wheelTimeoutRef.current) {
                clearTimeout(wheelTimeoutRef.current);
            }
        };
    }, [setZoom, onPanZoom]);

    // Ensure transforms are cleared after pan changes
    useEffect(() => {
        applyTempPan();
    }, [pan, applyTempPan]);

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
                pointerEvents: 'auto',
            }}
            onMouseDown={handleMouseDown}
        >
            {children}
        </div>
    );
});

export default PanZoomLayer;