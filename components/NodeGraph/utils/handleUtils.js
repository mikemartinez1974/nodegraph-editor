export const HANDLE_RADIUS = 7;
export const HANDLE_SPACING = 28;

/**
 * Returns all handles for a node in **graph space**
 */
export function getHandlesForNode(
  node,
  edgeTypes,
  draggingInfo = null,
  groupDrag = null,
  groups = []
) {
  const handles = [];
  const { id, position = {}, width = 60, height = 60 } = node;
  const x = position.x ?? node.x ?? 0;
  const y = position.y ?? node.y ?? 0;

  // Apply node drag offset
  let adjX = x;
  let adjY = y;
  if (draggingInfo && draggingInfo.nodeIds.includes(id)) {
    adjX += draggingInfo.offset.x;
    adjY += draggingInfo.offset.y;
  }

  // Apply group drag offset
  if (groupDrag && groups.length) {
    const group = groups.find(g => g.id === groupDrag.groupId);
    if (group && group.nodeIds.includes(id)) {
      adjX += groupDrag.offset.x;
      adjY += groupDrag.offset.y;
    }
  }

  Object.entries(edgeTypes).forEach(([type, cfg]) => {
    const color = cfg.style?.color || '#1976d2';

    if (type === 'child' || type === 'parent') {
      // Top (target)
      handles.push({
        id: `${id}-${type}-target`,
        nodeId: id,
        edgeType: type,
        direction: 'target',
        position: { x: adjX, y: adjY - height / 2 },
        color,
      });
      // Bottom (source)
      handles.push({
        id: `${id}-${type}-source`,
        nodeId: id,
        edgeType: type,
        direction: 'source',
        position: { x: adjX, y: adjY + height / 2 },
        color,
      });
    } else if (type === 'peer') {
      // Left (target)
      handles.push({
        id: `${id}-${type}-target`,
        nodeId: id,
        edgeType: type,
        direction: 'target',
        position: { x: adjX - width / 2, y: adjY },
        color,
      });
      // Right (source)
      handles.push({
        id: `${id}-${type}-source`,
        nodeId: id,
        edgeType: type,
        direction: 'source',
        position: { x: adjX + width / 2, y: adjY },
        color,
      });
    } else {
      // Default: center handle
      handles.push({
        id: `${id}-${type}-source`,
        nodeId: id,
        edgeType: type,
        direction: 'source',
        position: { x: adjX, y: adjY },
        color,
      });
    }
  });

  return handles;
}

/**
 * Convert graph point → screen point
 */
export function toScreen(p, pan, zoom) {
  return {
    x: p.x * zoom + pan.x,
    y: p.y * zoom + pan.y,
  };
}