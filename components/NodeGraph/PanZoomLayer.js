import React, { useRef, useEffect, useCallback } from 'react';

const PanZoomLayer = React.forwardRef(({ pan, zoom, onPanZoom, setZoom, onBackgroundClick, onMarqueeStart, children, theme, layerRefs }, ref) => {
    const dragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const mouseDownPosRef = React.useRef(null);

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

        if (e.shiftKey && onMarqueeStart) {
            const marqueeStarted = onMarqueeStart(e);
            if (marqueeStarted) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove, handleMouseUp, onMarqueeStart]);

    useEffect(() => {
        let accumulatedDelta = 0;
        let lastCursorPos = { x: 0, y: 0 };
        let throttleTimeout = null;
        let isThrottling = false;
        
        function handleWheel(e) {
            const tag = e.target.tagName;
            const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
            const isScrollablePanel = e.target.closest('.MuiDrawer-paper, .scrollable-panel, .MuiPaper-root');
            if (isTextInput || isScrollablePanel) {
                return;
            }
            e.preventDefault();
            
            // Accumulate wheel delta
            accumulatedDelta += e.deltaY;
            lastCursorPos = { x: e.clientX, y: e.clientY };
            
            // Clear existing timeout
            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
            }
            
            // Only update state every 16ms (60fps) while scrolling
            if (!isThrottling) {
                isThrottling = true;
                
                const zoomSpeed = 0.002;
                const delta = -accumulatedDelta * zoomSpeed;
                accumulatedDelta = 0;
                
                setZoom((prevZoom) => {
                    const newZoom = Math.max(0.1, Math.min(3, prevZoom * (1 + delta)));
                    
                    const cursorX = lastCursorPos.x;
                    const cursorY = lastCursorPos.y;
                    
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
                
                setTimeout(() => {
                    isThrottling = false;
                }, 16); // 60fps
            }
            
            // Debounce - final update after scrolling stops
            throttleTimeout = setTimeout(() => {
                if (accumulatedDelta !== 0) {
                    const zoomSpeed = 0.002;
                    const delta = -accumulatedDelta * zoomSpeed;
                    accumulatedDelta = 0;
                    
                    setZoom((prevZoom) => {
                        const newZoom = Math.max(0.1, Math.min(3, prevZoom * (1 + delta)));
                        
                        const cursorX = lastCursorPos.x;
                        const cursorY = lastCursorPos.y;
                        
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
            }, 100);
        }
        
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('wheel', handleWheel);
            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
            }
        };
    }, [setZoom, onPanZoom]);

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