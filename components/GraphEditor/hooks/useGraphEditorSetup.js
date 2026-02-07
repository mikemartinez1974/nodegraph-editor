// ============================================
// nodegraph-editor/components/GraphEditor/hooks/useGraphEditorSetup.js
// Initialization, event listeners, and effects
// ============================================
import { useEffect, useRef } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import GraphCRUD from '../GraphCrud';
import { attachSkills } from '../../../hooks/skills/index.js';

export function useGraphEditorSetup(state, handlers, historyHook) {
  const graphAPI = useRef(null);
  const {
    nodesRef, setNodes, edgesRef, setEdges, setGroups,
    groupsRef, groupManager, initialGraphLoadedRef,
    defaultNodeColor, defaultEdgeColor, setDefaultNodeColor, setDefaultEdgeColor,
    zoom, setLoading, setSelectedNodeIds, setSelectedEdgeIds
  } = state;
  
  const { saveToHistory } = historyHook;
  const { handlePasteGraphData } = handlers;
  
  // Initialize GraphCRUD API
  useEffect(() => {
    const rawGraph = new GraphCRUD(
      () => nodesRef.current,
      setNodes,
      () => edgesRef.current,
      setEdges,
      saveToHistory,
      nodesRef,
      edgesRef,
      () => groupsRef.current,
      setGroups,
      groupsRef,
      groupManager
    );
    
    attachSkills({ graphAPI: rawGraph, context: { eventBus } });
    
    const emitEvent = (name, payload) => {
      try {
        eventBus.emit(name, payload);
      } catch (err) {
        // ignore event bus errors
      }
    };

    const emitExecutionIntent = (proposals, meta = {}) => {
      const list = Array.isArray(proposals) ? proposals : [proposals];
      try {
        eventBus.emit('executionIntent', {
          trigger: meta.trigger || 'graphAPI',
          proposals: list,
          source: meta.source || 'graphAPI',
          meta
        });
      } catch (err) {
        // ignore intent emit errors
      }
    };

    const nextId = () => {
      const api = rawGraph;
      if (api && typeof api._generateId === 'function') {
        let candidate = api._generateId();
        const existing = new Set((api.getNodes?.() || []).map((n) => n.id));
        while (existing.has(candidate)) {
          candidate = api._generateId();
        }
        return candidate;
      }
      return `node_${Date.now()}`;
    };

    const nextEdgeId = () => {
      const api = rawGraph;
      if (api && typeof api._generateId === 'function') {
        let candidate = api._generateId();
        const existing = new Set((api.getEdges?.() || []).map((e) => e.id));
        while (existing.has(candidate)) {
          candidate = api._generateId();
        }
        return candidate;
      }
      return `edge_${Date.now()}`;
    };

    const nextGroupId = () => {
      const api = rawGraph;
      if (api && typeof api._generateId === 'function') {
        let candidate = api._generateId();
        const existing = new Set((api.getGroups?.() || []).map((g) => g.id));
        while (existing.has(candidate)) {
          candidate = api._generateId();
        }
        return candidate;
      }
      return `group_${Date.now()}`;
    };

    const intentAPI = {
      _raw: rawGraph,
      readNode: (...args) => rawGraph.readNode?.(...args),
      readEdge: (...args) => rawGraph.readEdge?.(...args),
      getNodes: () => nodesRef.current,
      getEdges: () => edgesRef.current,
      applyDeltas: (...args) => rawGraph.applyDeltas?.(...args),
      createNode: (nodeData = {}) => {
        const prepared = {
          ...nodeData,
          id:
            typeof nodeData.id === 'string' && nodeData.id.trim()
              ? nodeData.id.trim()
              : nextId(),
          color: nodeData.color || defaultNodeColor
        };
        emitExecutionIntent({ action: 'createNode', node: prepared });
        return { success: true, queued: true, data: prepared };
      },
      createNodes: (nodes = []) => {
        const list = Array.isArray(nodes) ? nodes : [];
        const prepared = list.map((node) => ({
          ...node,
          id:
            typeof node.id === 'string' && node.id.trim()
              ? node.id.trim()
              : nextId(),
          color: node.color || defaultNodeColor
        }));
        emitExecutionIntent({ action: 'createNodes', nodes: prepared });
        return { success: true, queued: true, data: { created: prepared } };
      },
      updateNode: (id, updates = {}) => {
        if (!id) return { success: false, error: 'updateNode requires id' };
        emitExecutionIntent({ action: 'updateNode', id, patch: updates });
        return { success: true, queued: true, data: { id, ...updates } };
      },
      updateNodes: (ids = [], updates = {}) => {
        const list = Array.isArray(ids) ? ids : [];
        emitExecutionIntent({ action: 'updateNodes', ids: list, patch: updates });
        return { success: true, queued: true, data: { updated: list } };
      },
      deleteNode: (id) => {
        if (!id) return { success: false, error: 'deleteNode requires id' };
        emitExecutionIntent({ action: 'deleteNode', id });
        return { success: true, queued: true, data: { id } };
      },
      deleteNodes: (ids = []) => {
        const list = Array.isArray(ids) ? ids : [];
        emitExecutionIntent({ action: 'deleteNodes', ids: list });
        return { success: true, queued: true, data: { ids: list } };
      },
      createEdge: (edgeData = {}) => {
        const prepared = {
          ...edgeData,
          id:
            typeof edgeData.id === 'string' && edgeData.id.trim()
              ? edgeData.id.trim()
              : nextEdgeId(),
          color: edgeData.color || defaultEdgeColor
        };
        emitExecutionIntent({ action: 'createEdge', edge: prepared });
        return { success: true, queued: true, data: prepared };
      },
      createEdges: (edges = []) => {
        const list = Array.isArray(edges) ? edges : [];
        const prepared = list.map((edge) => ({
          ...edge,
          id:
            typeof edge.id === 'string' && edge.id.trim()
              ? edge.id.trim()
              : nextEdgeId(),
          color: edge.color || defaultEdgeColor
        }));
        emitExecutionIntent({ action: 'createEdges', edges: prepared });
        return { success: true, queued: true, data: { created: prepared } };
      },
      updateEdge: (id, updates = {}) => {
        if (!id) return { success: false, error: 'updateEdge requires id' };
        emitExecutionIntent({ action: 'updateEdge', id, patch: updates });
        return { success: true, queued: true, data: { id, ...updates } };
      },
      updateEdges: (ids = [], updates = {}) => {
        const list = Array.isArray(ids) ? ids : [];
        emitExecutionIntent({ action: 'updateEdges', ids: list, patch: updates });
        return { success: true, queued: true, data: { updated: list } };
      },
      deleteEdge: (id) => {
        if (!id) return { success: false, error: 'deleteEdge requires id' };
        emitExecutionIntent({ action: 'deleteEdge', id });
        return { success: true, queued: true, data: { id } };
      },
      deleteEdges: (ids = []) => {
        const list = Array.isArray(ids) ? ids : [];
        emitExecutionIntent({ action: 'deleteEdges', ids: list });
        return { success: true, queued: true, data: { ids: list } };
      },
      translateNodes: (ids = [], delta = {}) => {
        const list = Array.isArray(ids) ? ids : [];
        emitExecutionIntent({ action: 'translateNodes', ids: list, delta });
        return { success: true, queued: true, data: { ids: list } };
      },
      createGroups: (groups = []) => {
        const list = Array.isArray(groups) ? groups : [];
        const prepared = list.map((group) => ({
          ...group,
          id:
            typeof group.id === 'string' && group.id.trim()
              ? group.id.trim()
              : nextGroupId()
        }));
        emitExecutionIntent({ action: 'createGroups', groups: prepared });
        return { success: true, queued: true, data: { created: prepared } };
      },
      updateGroup: (id, updates = {}) => {
        if (!id) return { success: false, error: 'updateGroup requires id' };
        emitExecutionIntent({ action: 'updateGroup', id, patch: updates });
        return { success: true, queued: true, data: { id, ...updates } };
      },
      updateGroups: (ids = [], updates = {}) => {
        const list = Array.isArray(ids) ? ids : [];
        emitExecutionIntent({ action: 'updateGroups', ids: list, patch: updates });
        return { success: true, queued: true, data: { updated: list } };
      },
      deleteGroup: (id) => {
        if (!id) return { success: false, error: 'deleteGroup requires id' };
        emitExecutionIntent({ action: 'deleteGroup', id });
        return { success: true, queued: true, data: { id } };
      },
      addNodesToGroup: (id, nodeIds = []) => {
        if (!id) return { success: false, error: 'addNodesToGroup requires id' };
        const list = Array.isArray(nodeIds) ? nodeIds : [];
        emitExecutionIntent({ action: 'addNodesToGroup', id, nodeIds: list });
        return { success: true, queued: true, data: { id, nodeIds: list } };
      },
      removeNodesFromGroup: (id, nodeIds = []) => {
        if (!id) return { success: false, error: 'removeNodesFromGroup requires id' };
        const list = Array.isArray(nodeIds) ? nodeIds : [];
        emitExecutionIntent({ action: 'removeNodesFromGroup', id, nodeIds: list });
        return { success: true, queued: true, data: { id, nodeIds: list } };
      },
      setGroupNodes: (id, nodeIds = []) => {
        if (!id) return { success: false, error: 'setGroupNodes requires id' };
        const list = Array.isArray(nodeIds) ? nodeIds : [];
        emitExecutionIntent({ action: 'setGroupNodes', id, nodeIds: list });
        return { success: true, queued: true, data: { id, nodeIds: list } };
      },
      translateGroups: (ids = [], delta = {}) => {
        const list = Array.isArray(ids) ? ids : [];
        emitExecutionIntent({ action: 'translateGroups', ids: list, delta });
        return { success: true, queued: true, data: { ids: list } };
      }
    };

    const wrapCrud = (method, handler) => {
      const original = rawGraph?.[method];
      if (typeof original !== 'function') return;
      rawGraph[method] = (...args) => {
        const result = original.apply(rawGraph, args);
        handler(result, args);
        return result;
      };
    };

    const originalCreateNode = rawGraph.createNode;
    rawGraph.createNode = (nodeData = {}) => {
      const result = originalCreateNode.call(rawGraph, {
        ...nodeData,
        color: nodeData.color || defaultNodeColor
      });
      if (result?.success && result?.data) {
        emitEvent('nodeAdded', { node: result.data });
      }
      return result;
    };
    
    const originalCreateEdge = rawGraph.createEdge;
    rawGraph.createEdge = (edgeData = {}) => {
      const result = originalCreateEdge.call(rawGraph, {
        ...edgeData,
        color: edgeData.color || defaultEdgeColor
      });
      if (result?.success && result?.data) {
        emitEvent('edgeAdded', { edge: result.data });
      }
      return result;
    };

    wrapCrud('createNodes', (result) => {
      const created = Array.isArray(result?.data?.created) ? result.data.created : [];
      created.forEach((node) => {
        if (node?.id) emitEvent('nodeAdded', { node });
      });
    });

    wrapCrud('createEdges', (result) => {
      const created = Array.isArray(result?.data?.created) ? result.data.created : [];
      created.forEach((edge) => {
        if (edge?.id) emitEvent('edgeAdded', { edge });
      });
    });

    wrapCrud('updateNode', (result, args) => {
      if (!result?.success) return;
      const [id, updates] = args;
      if (id) emitEvent('nodeUpdated', { id, patch: updates || {} });
    });

    wrapCrud('updateNodes', (result, args) => {
      if (!result?.success) return;
      const [ids, updates] = args;
      const targets = Array.isArray(result?.data?.updated)
        ? result.data.updated.map((node) => node?.id).filter(Boolean)
        : Array.isArray(ids)
        ? ids
        : [];
      targets.forEach((id) => emitEvent('nodeUpdated', { id, patch: updates || {} }));
    });

    wrapCrud('deleteNode', (result, args) => {
      if (!result?.success) return;
      const [id] = args;
      if (id) emitEvent('nodeDeleted', { id });
    });

    wrapCrud('updateEdge', (result, args) => {
      if (!result?.success) return;
      const [id, updates] = args;
      if (id) emitEvent('edgeUpdated', { id, patch: updates || {} });
    });

    wrapCrud('updateEdges', (result, args) => {
      if (!result?.success) return;
      const [ids] = args;
      const targets = Array.isArray(ids) ? ids : [];
      targets.forEach((id) => emitEvent('edgeUpdated', { id }));
    });

    wrapCrud('deleteEdge', (result, args) => {
      if (!result?.success) return;
      const [id] = args;
      if (id) emitEvent('edgeDeleted', { id });
    });

    wrapCrud('createGroups', (result) => {
      if (!result?.success) return;
      const created = Array.isArray(result?.data?.created) ? result.data.created : [];
      created.forEach((group) => {
        if (group?.id) emitEvent('groupAdded', { group });
      });
    });

    wrapCrud('updateGroup', (result, args) => {
      if (!result?.success) return;
      const [id, updates] = args;
      if (id) emitEvent('groupUpdated', { id, patch: updates || {} });
    });

    wrapCrud('updateGroups', (result, args) => {
      if (!result?.success) return;
      const [ids, updates] = args;
      const targets = Array.isArray(ids) ? ids : [];
      targets.forEach((id) => emitEvent('groupUpdated', { id, patch: updates || {} }));
    });

    wrapCrud('deleteGroup', (result, args) => {
      if (!result?.success) return;
      const [id] = args;
      if (id) emitEvent('groupDeleted', { id });
    });

    wrapCrud('addNodesToGroup', (result, args) => {
      if (!result?.success) return;
      const [id] = args;
      if (id) emitEvent('groupUpdated', { id, patch: { nodeIds: result?.data?.nodeIds } });
    });

    wrapCrud('removeNodesFromGroup', (result, args) => {
      if (!result?.success) return;
      const [id] = args;
      if (id) emitEvent('groupUpdated', { id, patch: { nodeIds: result?.data?.nodeIds } });
    });

    wrapCrud('setGroupNodes', (result, args) => {
      if (!result?.success) return;
      const [id] = args;
      if (id) emitEvent('groupUpdated', { id, patch: { nodeIds: result?.data?.nodeIds } });
    });

    wrapCrud('translateGroups', (result, args) => {
      if (!result?.success) return;
      const [ids] = args;
      const targets = Array.isArray(ids) ? ids : [];
      targets.forEach((id) => emitEvent('groupUpdated', { id }));
    });

    graphAPI.current = intentAPI;

    if (typeof window !== 'undefined') {
      window.graphAPI = intentAPI;
      window.graphAPI._raw = rawGraph;
      window.graphAPIRaw = rawGraph;
      window.graphAPI.getNodes = () => nodesRef.current;
      window.graphAPI.getEdges = () => edgesRef.current;
      window.setDefaultNodeColor = setDefaultNodeColor;
      window.setDefaultEdgeColor = setDefaultEdgeColor;
      
      if (!window.__graphAPILogged) {
        window.__graphAPILogged = true;
        // console.log('Graph CRUD API available at window.graphAPI');
      }
    }
  }, [defaultNodeColor, defaultEdgeColor]);
    
  // Handle drop events
  useEffect(() => {
    // Removed handleDrop handler to prevent duplicate node creation
    const handleNodeResize = (data) => {
      setNodes(prev => {
        const next = prev.map(n => 
          n.id === data.id ? { ...n, width: data.width, height: data.height } : n
        );
        nodesRef.current = next;
        return next;
      });
    };

    const handleNodeResizeEnd = () => {
      saveToHistory(nodesRef.current, edgesRef.current);
    };
    
    eventBus.on('nodeResize', handleNodeResize);
    eventBus.on('nodeResizeEnd', handleNodeResizeEnd);
    eventBus.on('pasteGraphData', handlePasteGraphData);
    if (typeof window !== 'undefined') {
      window.__Twilite_PASTE_READY__ = true;
    }
    
    return () => {
      eventBus.off('nodeResize', handleNodeResize);
      eventBus.off('nodeResizeEnd', handleNodeResizeEnd);
      eventBus.off('pasteGraphData', handlePasteGraphData);
      if (typeof window !== 'undefined') {
        delete window.__Twilite_PASTE_READY__;
      }
    };
  }, [handlePasteGraphData]);
  
  // Load background
  useEffect(() => {
    const applyBackground = (bg) => {
      try {
        const el = document.getElementById('graph-editor-background');
        if (!el) return;
        if (!bg) {
          el.style.backgroundImage = '';
          return;
        }

        let url = null;

        // If bg is an absolute URL
        if (/^https?:\/\//i.test(bg)) {
          url = bg;
        } else if (bg.startsWith('/')) {
          // Leading slash path under site root
          url = bg;
        } else if (bg.includes('/')) {
          // Relative path with folders - resolve against site origin
          try {
            url = new URL(bg, window.location.origin).href;
          } catch (err) {
            url = `/${bg}`;
          }
        } else {
          // Plain filename (no slashes) — interpret as file relative to last loaded document's directory
          const lastLoaded = typeof window !== 'undefined' ? localStorage.getItem('lastLoadedUrl') : null;
          if (lastLoaded) {
            try {
              const base = lastLoaded.substring(0, lastLoaded.lastIndexOf('/') + 1);
              url = new URL(bg, base).href;
            } catch (err) {
              // fallback to public/background art
              url = `/background art/${bg}`;
            }
          } else {
            // No lastLoadedUrl available — fall back to public/background art
            url = `/background art/${bg}`;
          }
        }

        // Normalize to absolute URL if possible
        try {
          url = new URL(url, window.location.origin).href;
        } catch (err) {
          // keep as-is
        }

        el.style.backgroundImage = `url('${url}')`;
      } catch (err) {
        console.warn('Failed to apply background image:', err);
      }
    };

    try {
      const savedBg = localStorage.getItem('backgroundImage');
      if (savedBg) {
        applyBackground(savedBg);
      }
    } catch (err) {
      // ignore
    }

    const handler = ({ backgroundImage }) => {
      applyBackground(backgroundImage || null);
    };
    eventBus.on('backgroundChanged', handler);
    return () => eventBus.off('backgroundChanged', handler);
  }, []);

  // Expose for testing
  if (typeof window !== 'undefined') {
    window.handlePasteGraphData = handlePasteGraphData;
  }



  // Handle tlzClick emitted by TlzLink: show tlz in address/history and fetch converted URL
  useEffect(() => {
    const handler = ({ href }) => {
      if (!href) return;
      try {
        // Convert tlz to a fetchable URL
        const rest = href.slice('tlz://'.length);
        const firstSlash = rest.indexOf('/');
        let host = '';
        let path = '';
        if (firstSlash !== -1) {
          host = rest.slice(0, firstSlash);
          path = rest.slice(firstSlash);
        } else {
          path = '/' + rest;
        }
        const origin = (window.location.protocol === 'https:' ? 'https://' : window.location.protocol + '//') + host;
        const fetchable = origin + path;

        // Emit fetchUrl to load the resource; the central fetch handler will emit setAddress
        eventBus.emit('fetchUrl', { url: fetchable });
      } catch (err) {
        console.warn('Failed to handle tlzClick:', err);
      }
    };

    eventBus.on('tlzClick', handler);
    return () => eventBus.off('tlzClick', handler);
  }, []);

  // Attach viewport helpers to API returned to callers
  if (typeof graphAPI.current !== 'undefined' && graphAPI.current) {
    graphAPI.current.getViewport = () => {
      try { return { pan: state?.pan || { x: 0, y: 0 }, zoom: state?.zoom || 1 }; } catch (e) { return { pan: { x: 0, y: 0 }, zoom: 1 }; }
    };

    graphAPI.current.setViewport = ({ pan, zoom } = {}) => {
      try {
        if (pan && typeof state?.setPan === 'function') state.setPan({ x: Number(pan.x) || 0, y: Number(pan.y) || 0 });
        if (zoom !== undefined && typeof state?.setZoom === 'function') state.setZoom(Number(zoom));
        return true;
      } catch (e) { return false; }
    };

    // fitToNodes is available but NOT called automatically anymore
    graphAPI.current.fitToNodes = ({ padding = 40, minZoom = 0.2, maxZoom = 3 } = {}) => {
      try {
        const nodes = (state && state.nodes) ? state.nodes : [];
        if (!nodes || nodes.length === 0) return null;

        const positions = nodes.map((n) => ({
          x: (n.position?.x ?? n.x ?? 0),
          y: (n.position?.y ?? n.y ?? 0),
          width: n.width || 60,
          height: n.height || 60
        }));

        const minX = Math.min(...positions.map((p) => p.x - p.width / 2));
        const maxX = Math.max(...positions.map((p) => p.x + p.width / 2));
        const minY = Math.min(...positions.map((p) => p.y - p.height / 2));
        const maxY = Math.max(...positions.map((p) => p.y + p.height / 2));

        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);

        const container = document.getElementById('graph-canvas') || document.body;
        const availW = Math.max(1, container.clientWidth - padding * 2);
        const availH = Math.max(1, container.clientHeight - padding * 2);

        const scaleX = availW / bboxW;
        const scaleY = availH / bboxH;
        let newZoomVal = Math.min(scaleX, scaleY, 1);
        newZoomVal = Math.max(minZoom, Math.min(maxZoom, newZoomVal));

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const newPanX = container.clientWidth / 2 - centerX * newZoomVal;
        const newPanY = container.clientHeight / 2 - centerY * newZoomVal;

        if (typeof state?.setZoom === 'function') state.setZoom(newZoomVal);
        if (typeof state?.setPan === 'function') state.setPan({ x: newPanX, y: newPanY });

        return { pan: { x: newPanX, y: newPanY }, zoom: newZoomVal };
      } catch (e) { return null; }
    };

    // Also expose the API on window.graphAPI for script access
    try {
      if (typeof window !== 'undefined') {
        window.graphAPI = graphAPI.current;
      }
    } catch (e) { /* ignore */ }
  }

  // Ensure we clean up window.graphAPI when the hook is torn down
  useEffect(() => {
    return () => {
      try { if (typeof window !== 'undefined' && window.graphAPI === graphAPI.current) delete window.graphAPI; } catch (e) {}
    };
  }, []);

  return graphAPI;
}
