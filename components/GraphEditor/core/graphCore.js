const DEFAULT_GRAPH = {
  nodes: [],
  edges: [],
  groups: []
};

let graphState = deepCopyGraph(DEFAULT_GRAPH);
let historyEntries = [];
const graphListeners = new Set();
const intentListeners = new Set();

function deepCopyGraph(snapshot) {
  return {
    nodes: Array.isArray(snapshot.nodes) ? snapshot.nodes.map((node) => ({ ...node })) : [],
    edges: Array.isArray(snapshot.edges) ? snapshot.edges.map((edge) => ({ ...edge })) : [],
    groups: Array.isArray(snapshot.groups) ? snapshot.groups.map((group) => ({ ...group })) : []
  };
}

function notifyGraph() {
  graphListeners.forEach((callback) => callback());
}

function persistSnapshot(snapshot, storageKey) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(storageKey || 'Twilite_local_graph', JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[graphCore] Failed to persist graph snapshot:', err);
  }
}

export function initGraphCore(initial = {}) {
  graphState = deepCopyGraph({
    nodes: Array.isArray(initial.nodes) ? initial.nodes : DEFAULT_GRAPH.nodes,
    edges: Array.isArray(initial.edges) ? initial.edges : DEFAULT_GRAPH.edges,
    groups: Array.isArray(initial.groups) ? initial.groups : DEFAULT_GRAPH.groups
  });
  historyEntries = [];
  notifyGraph();
}

export function getGraphSnapshot() {
  return deepCopyGraph(graphState);
}

export function subscribeGraph(callback) {
  graphListeners.add(callback);
  return () => {
    graphListeners.delete(callback);
  };
}

function mergeGraphPayload(payload = {}) {
  const nextState = { ...graphState };
  if (Array.isArray(payload.nodes)) {
    nextState.nodes = payload.nodes.map((node) => ({ ...node }));
  }
  if (Array.isArray(payload.edges)) {
    nextState.edges = payload.edges.map((edge) => ({ ...edge }));
  }
  if (Array.isArray(payload.groups)) {
    nextState.groups = payload.groups.map((group) => ({ ...group }));
  }
  return nextState;
}

export function dispatchGraph(action = {}) {
  if (!action || typeof action.type !== 'string') return;
  let updated = false;
  switch (action.type) {
    case 'setNodes': {
      const payload = Array.isArray(action.payload) ? action.payload.map((node) => ({ ...node })) : [];
      if (payload.length || graphState.nodes.length) {
        graphState.nodes = payload;
        updated = true;
      }
      break;
    }
    case 'setEdges': {
      const payload = Array.isArray(action.payload) ? action.payload.map((edge) => ({ ...edge })) : [];
      if (payload.length || graphState.edges.length) {
        graphState.edges = payload;
        updated = true;
      }
      break;
    }
    case 'setGroups': {
      const payload = Array.isArray(action.payload) ? action.payload.map((group) => ({ ...group })) : [];
      if (payload.length || graphState.groups.length) {
        graphState.groups = payload;
        updated = true;
      }
      break;
    }
    case 'setGraph': {
      const merged = mergeGraphPayload(action.payload);
      graphState = merged;
      updated = true;
      break;
    }
    case 'patchGraph': {
      const merged = mergeGraphPayload(action.payload);
      graphState = {
        nodes: merged.nodes.length ? merged.nodes : graphState.nodes,
        edges: merged.edges.length ? merged.edges : graphState.edges,
        groups: merged.groups.length ? merged.groups : graphState.groups
      };
      updated = true;
      break;
    }
    case 'snapshot': {
      const entry = {
        id: Date.now().toString(36),
        label: action.payload?.label || 'snapshot',
        graph: getGraphSnapshot()
      };
      historyEntries.push(entry);
      break;
    }
    case 'rollback': {
      const targetId = action.payload?.id;
      const targetEntry = historyEntries.find((entry) => entry.id === targetId);
      if (targetEntry) {
        graphState = deepCopyGraph(targetEntry.graph);
        updated = true;
      }
      break;
    }
    default:
      break;
  }
  if (updated) {
    notifyGraph();
    persistSnapshot(graphState);
  }
}

export function getHistory() {
  return historyEntries.slice();
}

export function emitIntent(intent = {}) {
  intentListeners.forEach((callback) => {
    callback(intent);
  });
}

export function subscribeIntent(callback) {
  intentListeners.add(callback);
  return () => {
    intentListeners.delete(callback);
  };
}
