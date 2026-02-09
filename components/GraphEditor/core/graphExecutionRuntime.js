import eventBus from '../../NodeGraph/eventBus.js';

const buildGraph = (nodes, edges) => {
  const nodeMap = new Map();
  (nodes || []).forEach((node) => {
    if (node?.id) nodeMap.set(node.id, node);
  });

  const adjacency = new Map();
  const reverseAdjacency = new Map();
  const incomingEdges = new Map();
  (edges || []).forEach((edge) => {
    if (!edge?.source || !edge?.target) return;
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    adjacency.get(edge.source).add(edge.target);
    if (!reverseAdjacency.has(edge.target)) reverseAdjacency.set(edge.target, new Set());
    reverseAdjacency.get(edge.target).add(edge.source);
    if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);
    incomingEdges.get(edge.target).push(edge);
  });

  return { nodeMap, adjacency, reverseAdjacency, incomingEdges };
};

const topoSort = (nodeIds, adjacency, reverseAdjacency) => {
  const indegree = new Map();
  nodeIds.forEach((id) => indegree.set(id, 0));
  nodeIds.forEach((id) => {
    const incoming = reverseAdjacency.get(id);
    if (!incoming) return;
    let count = 0;
    incoming.forEach((src) => {
      if (indegree.has(src)) count += 1;
    });
    indegree.set(id, count);
  });

  const queue = [];
  indegree.forEach((count, id) => {
    if (count === 0) queue.push(id);
  });

  const order = [];
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    const outgoing = adjacency.get(current);
    if (!outgoing) continue;
    outgoing.forEach((target) => {
      if (!indegree.has(target)) return;
      const nextCount = indegree.get(target) - 1;
      indegree.set(target, nextCount);
      if (nextCount === 0) queue.push(target);
    });
  }

  if (order.length !== nodeIds.length) {
    const remaining = nodeIds.filter((id) => !order.includes(id));
    return order.concat(remaining);
  }

  return order;
};

export const createGraphExecutionRuntime = ({ getNodes, getEdges } = {}) => {
  const readNodes = () => (typeof getNodes === 'function' ? getNodes() : []);
  const readEdges = () => (typeof getEdges === 'function' ? getEdges() : []);

  const resolveNodeOutput = (node, inputByHandle, fallbackValue) => {
    if (!node || typeof node !== 'object') return fallbackValue;
    const data = node.data || {};
    if (data.output !== undefined) return data.output;
    if (data.outputs && typeof data.outputs === 'object') return data.outputs;
    if (data.payload !== undefined) return data.payload;
    if (data.value !== undefined) return data.value;
    if (data.result !== undefined) return data.result;
    if (data.memo !== undefined) return data.memo;
    if (inputByHandle && inputByHandle.root !== undefined) return inputByHandle.root;
    const firstHandle = inputByHandle && Object.keys(inputByHandle)[0];
    if (firstHandle) return inputByHandle[firstHandle];
    return fallbackValue;
  };

  const executeGraph = (payload = {}) => {
    const nodes = readNodes();
    const edges = readEdges();
    const { nodeMap, adjacency, reverseAdjacency, incomingEdges } = buildGraph(nodes, edges);

    const startNodeIds = Array.isArray(payload.startNodeIds)
      ? payload.startNodeIds.filter((id) => nodeMap.has(id))
      : null;

    let targetNodeIds = [];
    if (startNodeIds && startNodeIds.length) {
      const visited = new Set();
      const queue = [...startNodeIds];
      while (queue.length) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        const outgoing = adjacency.get(current);
        if (outgoing) outgoing.forEach((next) => queue.push(next));
      }
      targetNodeIds = Array.from(visited);
    } else {
      targetNodeIds = Array.from(nodeMap.keys());
    }

    const order = topoSort(targetNodeIds, adjacency, reverseAdjacency);
    const initialValue = payload.value ?? payload.input ?? payload.payload ?? {};
    const defaultHandleId = payload.handleId || 'root';
    const meta = {
      requestedBy: 'executeGraph',
      source: payload.source || 'execution',
      startedAt: Date.now(),
      ...payload.meta
    };

    const outputs = new Map();

    order.forEach((nodeId) => {
      const incoming = incomingEdges.get(nodeId) || [];
      const inputByHandle = {};

      if (incoming.length > 0) {
        incoming.forEach((edge) => {
          const srcOutputs = outputs.get(edge.source) || {};
          const sourceHandle = edge.sourceHandle || 'root';
          const targetHandle = edge.targetHandle || 'root';
          const sourceValue =
            srcOutputs[sourceHandle] !== undefined
              ? srcOutputs[sourceHandle]
              : srcOutputs.root !== undefined
              ? srcOutputs.root
              : initialValue;
          if (inputByHandle[targetHandle] === undefined) {
            inputByHandle[targetHandle] = sourceValue;
          } else if (Array.isArray(inputByHandle[targetHandle])) {
            inputByHandle[targetHandle].push(sourceValue);
          } else {
            inputByHandle[targetHandle] = [inputByHandle[targetHandle], sourceValue];
          }
        });
      } else {
        inputByHandle[defaultHandleId] = initialValue;
      }

      Object.entries(inputByHandle).forEach(([handleId, value]) => {
        eventBus.emit('nodeInput', {
          targetNodeId: nodeId,
          handleId: handleId || 'root',
          inputName: handleId || 'root',
          value,
          source: meta.source,
          meta
        });
      });

      eventBus.emit('executeNode', { nodeId, meta });

      const node = nodeMap.get(nodeId);
      const resolved = resolveNodeOutput(node, inputByHandle, initialValue);
      const nextOutputs = {};
      if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
        Object.entries(resolved).forEach(([key, value]) => {
          nextOutputs[key] = value;
        });
      }
      nextOutputs.root = resolved;
      outputs.set(nodeId, nextOutputs);
    });

    return { success: true, data: { order, count: order.length } };
  };

  const executeNodes = (payload = {}) => {
    const nodes = readNodes();
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const ids = Array.isArray(payload.nodeIds) ? payload.nodeIds.filter((id) => nodeMap.has(id)) : [];
    const value = payload.value ?? payload.input ?? payload.payload ?? {};
    const handleId = payload.handleId || 'root';
    const meta = {
      requestedBy: 'executeNodes',
      source: payload.source || 'execution',
      startedAt: Date.now(),
      ...payload.meta
    };

    ids.forEach((nodeId) => {
      eventBus.emit('nodeInput', {
        targetNodeId: nodeId,
        handleId,
        inputName: handleId,
        value,
        source: meta.source,
        meta
      });
      eventBus.emit('executeNode', { nodeId, meta });
    });

    return { success: true, data: { count: ids.length } };
  };

  return { executeGraph, executeNodes };
};
