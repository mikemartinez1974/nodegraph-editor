// Utility helpers for generating unique IDs and sanitizing node lists

export function generateUUID(existingIds = new Set()) {
  const makeId = () =>
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `node_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

  let id = makeId();
  while (existingIds.has(id)) {
    id = makeId();
  }
  return id;
}

export function ensureUniqueNodeIds(nodes = [], existingNodes = []) {
  const existingIds = new Set(existingNodes.map(n => n.id));
  return nodes.map(node => {
    if (!node || typeof node !== 'object') return node;
    if (!node.id || existingIds.has(node.id)) {
      const newId = generateUUID(existingIds);
      existingIds.add(newId);
      return { ...node, id: newId };
    }
    existingIds.add(node.id);
    return node;
  });
}

export function deduplicateNodes(nodes = []) {
  const seen = new Set();
  const out = [];
  for (const n of nodes) {
    if (!n || !n.id) continue;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}
