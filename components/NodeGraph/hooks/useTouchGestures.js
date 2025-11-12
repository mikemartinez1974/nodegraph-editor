"use client";

import { useEffect, useRef } from 'react';

const NON_PASSIVE_OPTIONS = { passive: false };

const getPinchInfo = (touches) => {
  if (!touches || touches.length < 2) return null;
  const [a, b] = touches;
  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;
  const distance = Math.hypot(dx, dy);
  const center = {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2
  };
  return { distance, center };
};

/**
 * Hook that wires touch gesture listeners (currently pinch) to a target element.
 * Provides callbacks for pinch start/move/end and blocks native browser pinch zoom
 * so the graph can manage zooming itself.
 */
export default function useTouchGestures(ref, {
  onPinchStart,
  onPinchMove,
  onPinchEnd
} = {}) {
  const handlersRef = useRef({ onPinchStart, onPinchMove, onPinchEnd });

  useEffect(() => {
    handlersRef.current = { onPinchStart, onPinchMove, onPinchEnd };
  }, [onPinchStart, onPinchMove, onPinchEnd]);

  useEffect(() => {
    const target = ref?.current;
    if (!target) return;

    let isPinching = false;
    let pinchStartInfo = null;

    const handleTouchStart = (event) => {
      if (event.touches.length >= 2) {
        const pinchInfo = getPinchInfo(event.touches);
        if (!pinchInfo) return;
        if (event.cancelable) event.preventDefault();
        isPinching = true;
        pinchStartInfo = pinchInfo;
        const handlers = handlersRef.current;
        handlers.onPinchStart?.({
          ...pinchInfo,
          event
        });
      }
    };

    const handleTouchMove = (event) => {
      if (!isPinching || event.touches.length < 2) return;
      const pinchInfo = getPinchInfo(event.touches);
      if (!pinchInfo) return;
      if (event.cancelable) event.preventDefault();
      const scale = pinchStartInfo && pinchStartInfo.distance > 0
        ? pinchInfo.distance / pinchStartInfo.distance
        : 1;
      const handlers = handlersRef.current;
      handlers.onPinchMove?.({
        ...pinchInfo,
        scale,
        initial: pinchStartInfo,
        event
      });
    };

    const handleTouchEnd = (event) => {
      if (!isPinching) return;
      if (event.touches.length >= 2) return;
      isPinching = false;
      pinchStartInfo = null;
      const handlers = handlersRef.current;
      handlers.onPinchEnd?.({ event });
    };

    target.addEventListener('touchstart', handleTouchStart, NON_PASSIVE_OPTIONS);
    target.addEventListener('touchmove', handleTouchMove, NON_PASSIVE_OPTIONS);
    target.addEventListener('touchend', handleTouchEnd, NON_PASSIVE_OPTIONS);
    target.addEventListener('touchcancel', handleTouchEnd, NON_PASSIVE_OPTIONS);

    return () => {
      target.removeEventListener('touchstart', handleTouchStart, NON_PASSIVE_OPTIONS);
      target.removeEventListener('touchmove', handleTouchMove, NON_PASSIVE_OPTIONS);
      target.removeEventListener('touchend', handleTouchEnd, NON_PASSIVE_OPTIONS);
      target.removeEventListener('touchcancel', handleTouchEnd, NON_PASSIVE_OPTIONS);
    };
  }, [ref]);
}
