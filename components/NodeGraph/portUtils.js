const DEFAULT_PORT_SIDES = ['top', 'right', 'bottom', 'left'];
const DEFAULT_PORT_SPACING = 20;

export function getPortsForNode(node) {
  // If node explicitly defines ports in data, use them
  try {
    if (node && node.data && Array.isArray(node.data.ports) && node.data.ports.length) {
      return node.data.ports.map((p, i) => ({ id: p.id || `${node.id}-port-${i}`, name: p.name || (p.id || `port${i}`), side: p.side || 'right', relPos: p.relPos, collapseThreshold: p.collapseThreshold }));
    }
  } catch (e) {}

  // Otherwise emit 4 default ports (top/right/bottom/left)
  return DEFAULT_PORT_SIDES.map((side, i) => ({ id: `${node.id}-port-${side}`, name: side, side, relPos: null, collapseThreshold: 4 }));
}

export function computePortAbsolutePosition(node, port, index = 0, totalOnSide = 1, spacing = DEFAULT_PORT_SPACING, draggingInfoRef = null, draggingGroupId = null, groupDragOffset = null, groups = null) {
  // Base node position
  const x = node.position?.x ?? node.x ?? 0;
  const y = node.position?.y ?? node.y ?? 0;
  const width = node.width || 60;
  const height = node.height || 60;

  // Apply dragging offsets if applicable
  let adjustedX = x;
  let adjustedY = y;

  // Node-level drag offset
  try {
    if (draggingInfoRef && draggingInfoRef.current && Array.isArray(draggingInfoRef.current.nodeIds) && draggingInfoRef.current.nodeIds.includes(node.id)) {
      const off = draggingInfoRef.current.offset || { x: 0, y: 0 };
      adjustedX += off.x || 0;
      adjustedY += off.y || 0;
    }
  } catch (e) { }

  // Group-level drag offset
  try {
    if (draggingGroupId && groupDragOffset && Array.isArray(groups)) {
      const group = groups.find(g => g.id === draggingGroupId);
      if (group && Array.isArray(group.nodeIds) && group.nodeIds.includes(node.id)) {
        adjustedX += groupDragOffset.x || 0;
        adjustedY += groupDragOffset.y || 0;
      }
    }
  } catch (e) { }

  // If a relative position is specified (0..1) use it along the side
  if (port && typeof port.relPos === 'number' && port.relPos >= 0 && port.relPos <= 1) {
    const rel = port.relPos;
    switch (port.side) {
      case 'top': return { x: adjustedX - width / 2 + rel * width, y: adjustedY - height / 2 };
      case 'bottom': return { x: adjustedX - width / 2 + rel * width, y: adjustedY + height / 2 };
      case 'left': return { x: adjustedX - width / 2, y: adjustedY - height / 2 + rel * height };
      case 'right': default: return { x: adjustedX + width / 2, y: adjustedY - height / 2 + rel * height };
    }
  }

  // Distribute multiple ports along the side deterministically using index and totalOnSide
  const spacingTotal = spacing;
  const offset = (index - (totalOnSide - 1) / 2) * spacingTotal;

  switch (port.side) {
    case 'top':
      return { x: adjustedX + offset, y: adjustedY - height / 2 };
    case 'bottom':
      return { x: adjustedX + offset, y: adjustedY + height / 2 };
    case 'left':
      return { x: adjustedX - width / 2, y: adjustedY + offset };
    case 'right':
    default:
      return { x: adjustedX + width / 2, y: adjustedY + offset };
  }
}
