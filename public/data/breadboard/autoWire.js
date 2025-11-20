(function () {
  if (typeof window === 'undefined') return;

  const normalizeSocketKey = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value.trim().toUpperCase();
    if (typeof value === 'number') return String(value);
    return null;
  };

  const buildSocketRowColumnKey = (row, column) => {
    if (row === undefined || row === null) return null;
    const normalizedRow = typeof row === 'string' ? row.trim().toUpperCase() : String(row).toUpperCase();
    const numericColumn = Number(column);
    if (!Number.isFinite(numericColumn)) return null;
    return `${normalizedRow}${numericColumn}`;
  };

  const attemptAttach = () => {
    const eventBus = window.eventBus;
    const api = window.graphAPI;
    if (!eventBus || !api || typeof api.readNode !== 'function') {
      setTimeout(attemptAttach, 500);
      return;
    }
    if (attemptAttach._attached) return;
    attemptAttach._attached = true;

    const handleNodeDragEnd = ({ nodeIds }) => {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;

      const nodesResult = api.readNode?.();
      const edgesResult = api.readEdge?.();
      const allNodes = Array.isArray(nodesResult?.data) ? nodesResult.data : [];
      const allEdges = Array.isArray(edgesResult?.data) ? edgesResult.data : [];

      const socketNodes = allNodes.filter(node => node?.type === 'io.breadboard.sockets:socket');
      if (socketNodes.length === 0) return;

      const socketNodeIds = new Set();
      const directory = new Map();
      socketNodes.forEach(socket => {
        if (!socket?.id) return;
        socketNodeIds.add(socket.id);
        const data = socket.data || {};
        if (Array.isArray(data.sockets)) {
          data.sockets.forEach(label => {
            const key = normalizeSocketKey(label);
            if (key) directory.set(key, socket);
          });
        }
        if (Array.isArray(data.rows) && data.column !== undefined) {
          data.rows.forEach(row => {
            const key = buildSocketRowColumnKey(row, data.column);
            if (key) directory.set(key, socket);
          });
        }
      });
      if (directory.size === 0) return;

      const workingEdges = [...allEdges];

      nodeIds.forEach(nodeId => {
        const node = allNodes.find(n => n.id === nodeId);
        if (!node || node.type === 'io.breadboard.sockets:socket') return;

        const pins = Array.isArray(node.data?.pins) ? node.data.pins : [];
        if (pins.length === 0) return;

        pins.forEach(pin => {
          let key = null;
          if (pin?.socketId) {
            key = normalizeSocketKey(pin.socketId);
          } else if (pin?.socket) {
            key = normalizeSocketKey(pin.socket);
          } else if (pin?.row !== undefined && pin?.column !== undefined) {
            key = buildSocketRowColumnKey(pin.row, pin.column);
          }
          if (!key) return;

          const socket = directory.get(key);
          if (!socket) return;

          const handleKey = pin.handleKey || pin.key || pin.id || pin.label;
          if (!handleKey) return;
          const hasHandle = Array.isArray(node.handles)
            ? node.handles.some(h => h.id === handleKey || h.key === handleKey)
            : false;
          if (!hasHandle) return;

          const existingEdge = workingEdges.find(edge =>
            edge.source === node.id &&
            edge.sourceHandle === handleKey &&
            edge.target === socket.id
          );
          if (existingEdge) return;

          const conflictingEdges = workingEdges.filter(edge =>
            edge.source === node.id &&
            edge.sourceHandle === handleKey &&
            socketNodeIds.has(edge.target)
          );

          conflictingEdges.forEach(edge => {
            if (edge.target === socket.id) return;
            if (typeof api.deleteEdge === 'function') {
              api.deleteEdge(edge.id);
            }
            const idx = workingEdges.findIndex(e => e.id === edge.id);
            if (idx !== -1) {
              workingEdges.splice(idx, 1);
            }
          });

          const payload = {
            source: node.id,
            sourceHandle: handleKey,
            target: socket.id,
            targetHandle: 'socket',
            type: 'default'
          };
          const result = api.createEdge(payload);
          if (result?.success && result.data) {
            workingEdges.push(result.data);
          }
        });
      });
    };

    eventBus.on('nodeDragEnd', handleNodeDragEnd);
    console.info('[BreadboardAutoWire] Registered nodeDragEnd handler (public script).');
  };

  attemptAttach();
})();
