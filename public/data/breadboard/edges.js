//
// edges.js
//
// Responsible for:
//  - finding edges connected to a component
//  - removing them cleanly
//  - adding new edges without duplicates
//

/**
 * Find edges that connect to a specific component node.
 */
export function findEdgesForComponent(componentNodeId, allEdges) {
  return allEdges.filter(e =>
    e.fromNodeId === componentNodeId ||
    e.toNodeId === componentNodeId
  );
}

/**
 * Build commands to remove a list of edges by ID.
 */
export function buildRemoveEdgeCommands(edgesToRemove) {
  return edgesToRemove.map(e => ({
    action: "remove-edge",
    id: e.id
  }));
}

/**
 * Build commands to add new edges, but avoid duplicates.
 * Duplicates are edges that connect the same endpoints.
 */
export function buildAddEdgeCommands(newEdges, existingEdges) {
  const existingSet = new Set(
    existingEdges.map(e => `${e.fromNodeId}:${e.fromHandle}->${e.toNodeId}:${e.toHandle}`)
  );

  const cmds = [];

  newEdges.forEach(ne => {
    const key = `${ne.fromNodeId}:${ne.fromHandle}->${ne.toNodeId}:${ne.toHandle}`;
    if (!existingSet.has(key)) {
      cmds.push({
        action: "add-edge",
        fromNodeId: ne.fromNodeId,
        fromHandle: ne.fromHandle,
        toNodeId: ne.toNodeId,
        toHandle: ne.toHandle
      });
    }
  });

  return cmds;
}

/**
 * Simple helper used by autowire:
 * Remove old edges, then add new ones.
 */
export function rebuildEdgesForComponent(componentNodeId, allEdges, newEdgeSpecs) {
  const oldEdges = findEdgesForComponent(componentNodeId, allEdges);
  const removeCmds = buildRemoveEdgeCommands(oldEdges);
  const addCmds = buildAddEdgeCommands(newEdgeSpecs, allEdges);
  return [...removeCmds, ...addCmds];
}
