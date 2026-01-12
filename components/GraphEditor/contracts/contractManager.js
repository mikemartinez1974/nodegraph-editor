"use client";

const DEFAULT_CONTRACT_VERSION = "1.0";

export function getContractVersion(documentSettings = {}) {
  return (
    documentSettings?.contracts?.version ||
    documentSettings?.contractVersion ||
    DEFAULT_CONTRACT_VERSION
  );
}

export function summarizeHandles(nodes = []) {
  const handleSummary = {
    total: 0,
    withHandles: 0,
    handleBySide: {}
  };

  nodes.forEach((node) => {
    const handles = Array.isArray(node?.handles) ? node.handles : [];
    if (handles.length > 0) {
      handleSummary.withHandles += 1;
      handles.forEach((handle) => {
        const side = handle?.side || "center";
        handleSummary.total += 1;
        handleSummary.handleBySide[side] = (handleSummary.handleBySide[side] || 0) + 1;
      });
    }
  });

  return handleSummary;
}

export function summarizeContracts({ nodes = [], edges = [], documentSettings = {} } = {}) {
  const version = getContractVersion(documentSettings);
  const handleSummary = summarizeHandles(nodes);

  return {
    version,
    nodeCount: Array.isArray(nodes) ? nodes.length : 0,
    edgeCount: Array.isArray(edges) ? edges.length : 0,
    handleSummary
  };
}
