import React, { useRef, useEffect, useCallback } from 'react';

const PanZoomLayer = React.forwardRef(({ pan, zoom, onPanZoom, setZoom, onBackgroundClick, onMarqueeStart, children, theme, layerRefs }, ref) => {
    const dragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const mouseDownPosRef = React.useRef(null);
    const allowNativeScrollRef = useRef(false);

    const tempPanRef = useRef({ x: 0, y: 0 });
    const rafIdRef = useRef(null);
    const localRef = useRef(null);

    const setRefs = useCallback((node) => {
        localRef.current = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            ref.current = node;
        }
    }, [ref]);

    const shouldAllowNativeScroll = useCallback((target) => {
        if (!target || typeof window === 'undefined') return false;
        let el = target;
        while (el && el !== localRef.current) {
            if (el.dataset && el.dataset.allowTouchScroll === 'true') {
                return true;
            }
            const style = window.getComputedStyle(el);
            const overflowY = style?.overflowY || style?.overflow;
            const overflowX = style?.overflowX || style?.overflow;
            const canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2;
            const canScrollX = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2;
            if (canScrollX || canScrollY) {
                return true;
            }
            el = el.parentElement;
        }
        return false;
    }, []);

    const applyTempPan = useCallback(() => {
        const tx = tempPanRef.current.x;
        const ty = tempPanRef.current.y;
        const t = (tx || ty) ? `translate(${tx}px, ${ty}px)` : '';
        
        if (layerRefs?.edgeCanvas?.current) layerRefs.edgeCanvas.current.style.transform = t;
        if (layerRefs?.handleCanvas?.current) layerRefs.handleCanvas.current.style.transform = t;
        if (layerRefs?.group?.current) layerRefs.group.current.style.transform = t;
        if (layerRefs?.nodeContainer?.current) layerRefs.nodeContainer.current.style.transform = t;
    }, [layerRefs]);

    const updatePanByDelta = useCallback((dx, dy) => {
        tempPanRef.current.x += dx;
        tempPanRef.current.y += dy;

        if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
                applyTempPan();
                rafIdRef.current = null;
            });
        }
    }, [applyTempPan]);

    const handleMouseMove = useCallback((e) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };
        updatePanByDelta(dx, dy);
    }, [updatePanByDelta]);

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

    const handleTouchStart = useCallback((e) => {
        if (!e.touches || e.touches.length === 0) return;

        if (e.touches.length > 1) {
            allowNativeScrollRef.current = false;
            dragging.current = false;
            return;
        }

        const touch = e.touches[0];
        const target = e.target;
        const tag = target?.tagName?.toUpperCase?.();
        const isInteractive = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
        const allowScroll = isInteractive || shouldAllowNativeScroll(target);
        allowNativeScrollRef.current = allowScroll;
        if (allowScroll) {
            dragging.current = false;
            return;
        }
        if (target && target.closest && target.closest('[data-node-draggable="true"]')) {
            dragging.current = false;
            return;
        }

        dragging.current = true;
        lastPos.current = { x: touch.clientX, y: touch.clientY };
        mouseDownPosRef.current = { x: touch.clientX, y: touch.clientY };
    }, [shouldAllowNativeScroll]);

    const handleTouchMove = useCallback((e) => {
        if (!e.touches || e.touches.length === 0) return;
        if (allowNativeScrollRef.current) return;
        if (!dragging.current) return;

        const touch = e.touches[0];
        const dx = touch.clientX - lastPos.current.x;
        const dy = touch.clientY - lastPos.current.y;
        lastPos.current = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
        updatePanByDelta(dx, dy);
    }, [updatePanByDelta]);

    const handleTouchEnd = useCallback(() => {
        if (allowNativeScrollRef.current) {
            allowNativeScrollRef.current = false;
            return;
        }
        if (!dragging.current) return;
        dragging.current = false;
        const panDelta = { ...tempPanRef.current };
        onPanZoom((prev) => ({ x: prev.x + panDelta.x, y: prev.y + panDelta.y }));
        tempPanRef.current = { x: 0, y: 0 };
        applyTempPan();
        if (mouseDownPosRef.current) {
            const dx = Math.abs(lastPos.current.x - mouseDownPosRef.current.x);
            const dy = Math.abs(lastPos.current.y - mouseDownPosRef.current.y);
            const moved = dx > 5 || dy > 5;
            if (!moved && typeof onBackgroundClick === 'function') {
                onBackgroundClick();
            }
        }
        mouseDownPosRef.current = null;
    }, [applyTempPan, onBackgroundClick, onPanZoom]);

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
        const node = localRef.current;
        if (!node) return;
        const listenerOptions = { passive: false };
        node.addEventListener('touchstart', handleTouchStart, listenerOptions);
        node.addEventListener('touchmove', handleTouchMove, listenerOptions);
        node.addEventListener('touchend', handleTouchEnd, listenerOptions);
        node.addEventListener('touchcancel', handleTouchEnd, listenerOptions);
        return () => {
            node.removeEventListener('touchstart', handleTouchStart, listenerOptions);
            node.removeEventListener('touchmove', handleTouchMove, listenerOptions);
            node.removeEventListener('touchend', handleTouchEnd, listenerOptions);
            node.removeEventListener('touchcancel', handleTouchEnd, listenerOptions);
        };
    }, [handleTouchEnd, handleTouchMove, handleTouchStart]);

    useEffect(() => {
        applyTempPan();
    }, [pan, applyTempPan]);

    return (
        <div
            ref={setRefs}
            style={{
                position: 'absolute',
                inset: 0,
                cursor: 'default',
                zIndex: 1,
                background: 'transparent',
                transition: 'background 0.2s',
                pointerEvents: 'auto'
            }}
            onMouseDown={handleMouseDown}
        >
            {children}
        </div>
    );
});

export default PanZoomLayer;
