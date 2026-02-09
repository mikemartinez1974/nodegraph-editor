// edgeVerification.js
const verificationTimers = new Map();

export function scheduleEdgeVerification(api, componentNode, desiredEdges) {
  if (!api || !componentNode || !componentNode.id) return;
  if (!Array.isArray(desiredEdges) || desiredEdges.length === 0) return;

  const nodeId = componentNode.id;

  // clear any queued verification for this node
  if (verificationTimers.has(nodeId)) {
    clearTimeout(verificationTimers.get(nodeId));
  }

  const timer = setTimeout(async () => {
    try {
      // 1) wait for graph to settle
      if (typeof api.waitForGraphSettled === 'function') {
        await api.waitForGraphSettled();
      }

      // 2) read fresh edges
      const snapshot = typeof api.readEdge === 'function' ? api.readEdge() : null;
      const liveEdges = Array.isArray(snapshot?.data)
        ? snapshot.data.filter(e => e.source === nodeId)
        : [];

      // index live edges by handle
      const grouped = new Map();
      for (const edge of liveEdges) {
        const handle = edge.sourcePort;
        if (!grouped.has(handle)) grouped.set(handle, []);
        grouped.get(handle).push(edge);
      }

      // 3) verify each desired edge
      for (const spec of desiredEdges) {
        const handle = spec.fromHandle;

        const existing = grouped.get(handle) || [];
        const match = existing.find(e => e.target === spec.toNodeId);

        // missing → recreate
        if (!match) {
          await api.createEdge({
            source: nodeId,
            sourcePort: spec.fromHandle,
            target: spec.toNodeId,
            targetPort: spec.toHandle || null
          });
          continue;
        }

        // duplicates → remove extras
        if (existing.length > 1) {
          for (const extra of existing.slice(1)) {
            await api.deleteEdge(extra.id);
          }
        }
      }
    } catch (err) {
      console.warn('[BreadboardAutoWire] Verification error:', err);
    } finally {
      verificationTimers.delete(nodeId);
    }
  }, 32);

  verificationTimers.set(nodeId, timer);
}
