const toNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getPosition = (node = {}) => ({
  x: toNumber(node?.position?.x, 0),
  y: toNumber(node?.position?.y, 0)
});

const normalizeRowOrder = (rows = []) => {
  const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  return [...rows].sort((a, b) => {
    const upperA = String(a || '').toUpperCase();
    const upperB = String(b || '').toUpperCase();
    const indexA = ORDER.indexOf(upperA);
    const indexB = ORDER.indexOf(upperB);
    if (indexA === -1 && indexB === -1) return upperA.localeCompare(upperB);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

const deriveColumnSpacing = (columnPositions) => {
  const sortedColumns = [...columnPositions.keys()].sort((a, b) => a - b);
  if (sortedColumns.length < 2) return null;
  let total = 0;
  let steps = 0;
  for (let i = 1; i < sortedColumns.length; i += 1) {
    const prev = columnPositions.get(sortedColumns[i - 1]);
    const curr = columnPositions.get(sortedColumns[i]);
    if (Number.isFinite(prev?.x) && Number.isFinite(curr?.x)) {
      total += Math.abs(curr.x - prev.x);
      steps += 1;
    }
  }
  return steps > 0 ? total / steps : null;
};

const buildSocketSegments = (sockets = []) => {
  const segments = [];
  const holes = [];
  const columnPositions = new Map();
  sockets.forEach((socket) => {
    if (!socket || !socket.data) return;
    const column = toNumber(socket.data.column);
    if (!Number.isFinite(column)) return;
    const segment = socket.data.segment || null;
    const rows = Array.isArray(socket.data.rows) && socket.data.rows.length > 0
      ? normalizeRowOrder(socket.data.rows)
      : ['A', 'B', 'C', 'D', 'E'];
    const position = getPosition(socket);
    const width = toNumber(socket.width, 0);
    const height = toNumber(socket.height, 0);
    const effectiveHeight = height > 0 ? height : 1;
    const rowSpacing = rows.length > 0 ? effectiveHeight / rows.length : effectiveHeight;
    const yStart = position.y - effectiveHeight / 2 + rowSpacing / 2;
    columnPositions.set(column, position);

    const socketIds = [];
    rows.forEach((row, index) => {
      const holeId = `${row}${column}`;
      socketIds.push(holeId);
      holes.push({
        id: holeId,
        row,
        column,
        segment,
        nodeId: socket.id,
        rowIndex: index,
        position: {
          x: position.x,
          y: yStart + rowSpacing * index
        },
        segmentId: `${segment || 'segment'}-${column}`
      });
    });

    segments.push({
      id: `${segment || 'segment'}-${column}`,
      kind: 'socketColumn',
      column,
      segment,
      nodeId: socket.id,
      rows,
      socketIds,
      position,
      size: { width, height: effectiveHeight },
      rowSpacing
    });
  });

  return { segments, holes, columnPositions };
};

const buildRailMetadata = (railNodes = []) => {
  const railsById = new Map();
  railNodes.forEach((node) => {
    if (!node?.data) return;
    const column = toNumber(node.data.column);
    const channel = node.data.channel || null;
    const nodePosition = getPosition(node);
    const rails = Array.isArray(node.data.rails) ? node.data.rails : [];
    rails.forEach((railInfo, index) => {
      const polarity = railInfo?.polarity || (index === 0 ? 'positive' : 'negative');
      const canonicalId = (railInfo?.railId || `rail-${channel || 'channel'}-${polarity}`).toLowerCase();
      const label = railInfo?.label || canonicalId;
      if (!railsById.has(canonicalId)) {
        railsById.set(canonicalId, {
          id: canonicalId,
          label,
          polarity,
          channel,
          voltage: toNumber(railInfo?.voltage),
          segments: [],
          nodeIds: new Set()
        });
      }
      const entry = railsById.get(canonicalId);
      entry.channel = entry.channel || channel;
      entry.nodeIds.add(node.id);
      entry.segments.push({
        column,
        nodeId: node.id,
        position: nodePosition,
        handle: polarity === 'negative' ? 'negative' : 'positive'
      });
    });
  });

  return [...railsById.values()].map((entry) => ({
    ...entry,
    nodeIds: [...entry.nodeIds],
    segments: entry.segments.sort((a, b) => {
      if (!Number.isFinite(a.column) || !Number.isFinite(b.column)) return 0;
      return a.column - b.column;
    })
  }));
};

export function buildCanonicalBreadboardSchema({
  sockets = [],
  railNodes = [],
  generatedAt = new Date().toISOString(),
  metadata = {}
} = {}) {
  const { segments, holes, columnPositions } = buildSocketSegments(sockets);
  const rails = buildRailMetadata(railNodes);
  const uniqueColumns = [...new Set(segments.map((segment) => segment.column))].sort((a, b) => a - b);
  const rowNames = new Set();
  segments.forEach((segment) => segment.rows.forEach((row) => rowNames.add(row)));
  const averageRowSpacing =
    segments.length > 0
      ? segments.reduce((sum, segment) => sum + (segment.rowSpacing || 0), 0) / segments.length
      : null;
  const columnSpacing = deriveColumnSpacing(columnPositions);

  return {
    version: 1,
    generatedAt,
    grid: {
      rows: rowNames.size || 0,
      columns: uniqueColumns.length,
      rowSpacing: averageRowSpacing,
      columnSpacing: columnSpacing || null
    },
    sockets: holes,
    segments,
    rails,
    metadata: {
      ...metadata,
      columnSpacing: columnSpacing || null,
      rowSpacing: averageRowSpacing
    }
  };
}
