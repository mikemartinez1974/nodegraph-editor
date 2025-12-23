"use client";
import { useEffect } from 'react';
import eventBus from '../../NodeGraph/eventBus';

export default function useGraphInteractions({
  backgroundUrl,
  setPan,
  setZoom,
  nodes,
  setNodes,
  nodesRef,
  state,
  setDocumentUrl,
  setDocumentBackgroundImage,
  setDocumentSettings,
  setDocumentTheme,
  setBackgroundUrl,
  setSelectedNodeIds,
  setSelectedEdgeIds,
  setHoveredEdgeId,
  setHoveredNodeId,
  setShowEdgePanel,
  selectionHook
}) {
  useEffect(() => {
    if (!backgroundUrl) return undefined;
    let frame = 0;
    const animate = () => {
      if (frame < 3) {
        setPan((prev) => ({ x: prev.x, y: prev.y }));
        frame += 1;
        requestAnimationFrame(animate);
      }
    };
    const timer = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 200);
    return () => clearTimeout(timer);
  }, [backgroundUrl, setPan]);

  useEffect(() => {
    if (!backgroundUrl) return undefined;
    const timers = [100, 300, 500].map((delay) =>
      setTimeout(() => {
        eventBus.emit('forceRedraw');
      }, delay)
    );
    return () => timers.forEach((id) => clearTimeout(id));
  }, [backgroundUrl]);

  useEffect(() => {
    if (!backgroundUrl) return undefined;
    const timer = setTimeout(() => {
      setPan((prev) => ({
        x: prev.x + 0.001,
        y: prev.y + 0.001
      }));

      requestAnimationFrame(() => {
        setPan((prev) => ({
          x: prev.x - 0.001,
          y: prev.y - 0.001
        }));
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [backgroundUrl, setPan]);

  useEffect(() => {
    function handleLoadSaveFile(payload = {}) {
      const { settings = {}, viewport = {}, scripts: topLevelScripts } = payload || {};
      try {
        if (viewport.pan) setPan(viewport.pan);
        if (typeof viewport.zoom === 'number') setZoom(viewport.zoom);
        if (settings.defaultNodeColor) state.defaultNodeColor = settings.defaultNodeColor;
        if (settings.document && settings.document.url) {
          setDocumentUrl(settings.document.url);
          setBackgroundUrl(settings.document.url);
        } else {
          setDocumentUrl('');
          setBackgroundUrl('');
        }
        if (settings.backgroundImage) {
          setDocumentBackgroundImage(settings.backgroundImage);
        } else {
          setDocumentBackgroundImage('');
        }
        if (settings.gridSize && settings.gridSize >= 5 && settings.gridSize <= 100) {
          setDocumentSettings((prev) => ({ ...prev, gridSize: settings.gridSize }));
        }
        if (settings.edgeRouting) {
          setDocumentSettings((prev) => ({ ...prev, edgeRouting: settings.edgeRouting }));
        }
        try {
          const scriptsToLoad = Array.isArray(topLevelScripts)
            ? topLevelScripts
            : Array.isArray(settings.scripts)
            ? settings.scripts
            : null;
          if (scriptsToLoad) {
            localStorage.setItem('scripts', JSON.stringify(scriptsToLoad));
          }
        } catch (err) {
          // ignore
        }
        if (settings.theme) {
          setDocumentTheme(settings.theme);
        }
      } catch (err) {
        console.warn('Failed to apply loaded save settings:', err);
      }
    }

    eventBus.on('loadSaveFile', handleLoadSaveFile);
    return () => eventBus.off('loadSaveFile', handleLoadSaveFile);
  }, [
    setPan,
    setZoom,
    state,
    setDocumentUrl,
    setBackgroundUrl,
    setDocumentBackgroundImage,
    setDocumentSettings,
    setDocumentTheme
  ]);

  useEffect(() => {
    const handleNodeUpdate = ({ id, updates }) => {
      const nodeExists = nodes.find((n) => n.id === id);
      if (!nodeExists) return;

      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                ...updates,
                data: {
                  ...node.data,
                  ...updates?.data
                }
              }
            : node
        )
      );
    };

    eventBus.on('nodeUpdate', handleNodeUpdate);
    return () => eventBus.off('nodeUpdate', handleNodeUpdate);
  }, [nodes, setNodes]);

  useEffect(() => {
    const handleNodeMove = ({ id, position }) => {
      setNodes((prev) => {
        const next = prev.map((node) =>
          node.id === id ? { ...node, position } : node
        );
        // Keep the ref in sync so consumers like window.graphAPI see live positions
        if (nodesRef) nodesRef.current = next;
        return next;
      });
    };

    eventBus.on('nodeMove', handleNodeMove);
    return () => eventBus.off('nodeMove', handleNodeMove);
  }, [setNodes, nodesRef]);

  useEffect(() => {
    const handleEdgeClick = ({ id, event }) => {
      const isMultiSelect = event?.ctrlKey || event?.metaKey;
      const edgeId = id;

      if (isMultiSelect) {
        setSelectedEdgeIds((prev) =>
          prev.includes(edgeId) ? prev.filter((eid) => eid !== edgeId) : [...prev, edgeId]
        );
        return;
      }

      setSelectedEdgeIds((prev) => {
        const already = prev.includes(edgeId);
        if (already) {
          setShowEdgePanel((s) => !s);
          return prev;
        }
        setShowEdgePanel(true);
        return [edgeId];
      });
      setSelectedNodeIds([]);
    };

    eventBus.on('edgeClick', handleEdgeClick);
    return () => eventBus.off('edgeClick', handleEdgeClick);
  }, [setSelectedEdgeIds, setSelectedNodeIds, setShowEdgePanel, selectionHook]);

  useEffect(() => {
    const handleEdgeHover = ({ edgeId }) => {
      setHoveredEdgeId(edgeId);
    };

    eventBus.on('edgeHover', handleEdgeHover);
    return () => eventBus.off('edgeHover', handleEdgeHover);
  }, [setHoveredEdgeId]);

  useEffect(() => {
    const handleNodeHover = ({ id }) => {
      setHoveredNodeId(id);
    };

    eventBus.on('nodeHover', handleNodeHover);
    return () => eventBus.off('nodeHover', handleNodeHover);
  }, [setHoveredNodeId]);

  useEffect(() => {
    const handleNodeClick = ({ id }) => {
      setSelectedNodeIds([id]);
      setSelectedEdgeIds([]);
    };

    eventBus.on('nodeClick', handleNodeClick);
    return () => eventBus.off('nodeClick', handleNodeClick);
  }, [setSelectedNodeIds, setSelectedEdgeIds]);
}
