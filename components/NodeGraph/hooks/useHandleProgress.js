import { useState, useEffect } from 'react';

export function useHandleProgress(nodeList, hoveredNodeId) {
  const [handleProgressMap, setHandleProgressMap] = useState({});

  useEffect(() => {
    let animationFrame;
    const duration = 125; // ms
    const start = performance.now();
    const initial = { ...handleProgressMap };
    const target = {};
    nodeList.forEach(node => {
      target[node.id] = hoveredNodeId === node.id ? 1 : 0;
      if (initial[node.id] === undefined) initial[node.id] = 0;
    });
    function animate(now) {
      const elapsed = Math.min(now - start, duration);
      const progress = elapsed / duration;
      const next = {};
      nodeList.forEach(node => {
        const from = initial[node.id];
        const to = target[node.id];
        next[node.id] = from + (to - from) * progress;
      });
      setHandleProgressMap(next);
      if (elapsed < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setHandleProgressMap(target);
      }
    }
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [hoveredNodeId, nodeList]);

  return handleProgressMap;
}