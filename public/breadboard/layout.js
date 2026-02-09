// layout.js
import {
  isPlainObject,
  normalizeRowName,
  normalizeSegmentName,
  makeSegmentColumnKey,
  getSocketPosition
} from './utils.js';

/**
 * Build a mapping of row → pixel position for a socket column.
 */
export function buildRowPositionMap({
  rows,
  column,
  socketNode,
  socketIds = [],
  holePositionById = null
}) {
  const normalizedRows = Array.isArray(rows) && rows.length > 0
    ? rows
    : Array.isArray(socketNode?.data?.rows)
    ? socketNode.data.rows
    : [];

  const rowPositions = new Map();
  const basePosition = getSocketPosition(socketNode);

  const height =
    typeof socketNode?.height === 'number'
      ? socketNode.height
      : typeof socketNode?.data?.height === 'number'
      ? socketNode.data.height
      : null;

  const spacing =
    normalizedRows.length > 0 && Number.isFinite(height) && height > 0
      ? height / normalizedRows.length
      : null;

  normalizedRows.forEach((rowName, index) => {
    const normRow = normalizeRowName(rowName);
    if (!normRow) return;

    const holeId =
      socketIds[index] ||
      `${normRow}${Number.isFinite(column) ? column : ''}`;

    // schema hole positions override calculated ones
    const precise = holePositionById?.get(holeId);
    if (precise) {
      const px = typeof precise.x === 'number' ? precise.x : basePosition.x;
      const py = typeof precise.y === 'number' ? precise.y : basePosition.y;
      rowPositions.set(normRow, { x: px, y: py });
      return;
    }

    if (spacing !== null) {
      const startY = basePosition.y - height / 2 + spacing / 2;
      rowPositions.set(normRow, {
        x: basePosition.x,
        y: startY + spacing * index
      });
    } else {
      rowPositions.set(normRow, { x: basePosition.x, y: basePosition.y });
    }
  });

  return rowPositions;
}

/**
 * Build a board layout from a schema (if present).
 * If schema is bad or missing, returns null.
 */
export function buildLayoutFromSchema(schema, socketNodes, railNodes = []) {
  if (!schema || typeof schema !== 'object') return null;

  const socketNodeById = new Map(socketNodes.map(n => [n.id, n]));
  const railNodeById = new Map(railNodes.map(n => [n.id, n]));

  const targetsBySegmentColumn = new Map();
  const columnCenters = new Map();
  const holePositionById = new Map();

  let minColumn = Infinity;
  let maxColumn = -Infinity;

  let topYSum = 0;
  let bottomYSum = 0;
  let topCount = 0;
  let bottomCount = 0;

  let rowSpacingSum = 0;
  let rowSpacingCount = 0;

  // schema holes
  if (Array.isArray(schema.sockets)) {
    schema.sockets.forEach(hole => {
      if (!hole) return;
      const holeId = hole.id || (hole.row && hole.column ? `${hole.row}${hole.column}` : null);
      if (!holeId) return;

      const pos = hole.position || {};
      holePositionById.set(String(holeId), {
        x: typeof pos.x === 'number' ? pos.x : 0,
        y: typeof pos.y === 'number' ? pos.y : 0
      });
    });
  }

  const recordRowSpacing = map => {
    if (!map || map.size < 2) return;
    let last = null;
    map.forEach(pos => {
      if (last) {
        const diff = Math.abs(pos.y - last.y);
        if (diff > 0.001) {
          rowSpacingSum += diff;
          rowSpacingCount++;
        }
      }
      last = pos;
    });
  };

  const registerColumnStats = (column, x, segment, y) => {
    if (Number.isFinite(column) && Number.isFinite(x)) {
      // center average
      if (columnCenters.has(column)) {
        const prev = columnCenters.get(column);
        columnCenters.set(column, (prev + x) * 0.5);
      } else {
        columnCenters.set(column, x);
      }
    }

    if (!Number.isFinite(y)) return;

    if (segment === 'top') {
      topYSum += y;
      topCount++;
    } else if (segment === 'bottom') {
      bottomYSum += y;
      bottomCount++;
    }
  };

  //
  // Schema segment entries
  //
  const schemaSegments = Array.isArray(schema.segments) ? schema.segments : [];

  schemaSegments.forEach(entry => {
    const column = Number(entry?.column);
    const segment = normalizeSegmentName(entry?.segment);
    if (!Number.isFinite(column) || !segment) return;

    const socketNode = socketNodeById.get(entry.nodeId);
    if (!socketNode) return;

    minColumn = Math.min(minColumn, column);
    maxColumn = Math.max(maxColumn, column);

    const rows = entry.rows || socketNode.data.rows || [];
    const socketIds = entry.socketIds || rows.map(r => `${r}${column}`);

    const rowPositions = buildRowPositionMap({
      rows,
      column,
      socketNode,
      socketIds,
      holePositionById
    });

    recordRowSpacing(rowPositions);

    const key = makeSegmentColumnKey(segment, column);
    targetsBySegmentColumn.set(key, {
      node: socketNode,
      targetPort: 'socket',
      segmentType: 'socket',
      rowPositions
    });

    const px = entry?.position?.x;
    const py = entry?.position?.y;

    const fallback = getSocketPosition(socketNode);

    registerColumnStats(
      column,
      Number.isFinite(px) ? px : fallback.x,
      segment,
      Number.isFinite(py) ? py : fallback.y
    );
  });

  //
  // Schema rails
  //
  const schemaRails = Array.isArray(schema.rails) ? schema.rails : [];

  schemaRails.forEach(rail => {
    const preferredHandle = rail.polarity === 'negative' ? 'negative' : 'positive';
    const segments = rail.segments || [];

    segments.forEach(entry => {
      const column = Number(entry?.column);
      if (!Number.isFinite(column)) return;

      const railNode = railNodeById.get(entry.nodeId);
      if (!railNode) return;

      minColumn = Math.min(minColumn, column);
      maxColumn = Math.max(maxColumn, column);

      const segKey = `rail-${rail.channel}-${rail.polarity}`;
      const key = makeSegmentColumnKey(segKey, column);

      targetsBySegmentColumn.set(key, {
        node: railNode,
        targetPort: preferredHandle,
        segmentType: 'rail',
        railInfo: rail
      });

      const px = entry?.position?.x;
      const fallback = getSocketPosition(railNode);

      if (Number.isFinite(px) && !columnCenters.has(column)) {
        columnCenters.set(column, px);
      } else {
        columnCenters.set(column, fallback.x);
      }
    });
  });

  //
  // Final derived layout
  //
  if (!Number.isFinite(minColumn) || !Number.isFinite(maxColumn) || columnCenters.size === 0) {
    return null;
  }

  const boardMidY =
    topCount > 0 && bottomCount > 0
      ? (topYSum / topCount + bottomYSum / bottomCount) * 0.5
      : null;

  // average column spacing
  const sortedColumns = [...columnCenters.entries()].sort((a, b) => a[0] - b[0]);
  let columnSpacing = null;
  if (sortedColumns.length > 1) {
    let sum = 0;
    for (let i = 1; i < sortedColumns.length; i++) {
      const prev = sortedColumns[i - 1][1];
      const curr = sortedColumns[i][1];
      if (Number.isFinite(prev) && Number.isFinite(curr)) {
        sum += Math.abs(curr - prev);
      }
    }
    columnSpacing = sum / (sortedColumns.length - 1);
  }

  const rowSpacing =
    rowSpacingCount > 0 ? rowSpacingSum / rowSpacingCount : null;

  return {
    targetsBySegmentColumn,
    columnCenters,
    minColumn,
    maxColumn,
    boardMidY,
    columnSpacing,
    rowSpacing
  };
}


/**
 * Fallback layout builder when no schema exists.
 */
export function buildSocketLayout(socketNodes, railNodes = [], schema = null) {
  if (schema && typeof schema === 'object') {
    const layout = buildLayoutFromSchema(schema, socketNodes, railNodes);
    if (layout) return layout;
  }

  if (!socketNodes?.length && !railNodes?.length) return null;

  const targetsBySegmentColumn = new Map();
  const columnCenters = new Map();
  const columnTotals = new Map();

  let minColumn = Infinity;
  let maxColumn = -Infinity;

  let topYSum = 0;
  let bottomYSum = 0;
  let topCount = 0;
  let bottomCount = 0;

  let rowSpacingSum = 0;
  let rowSpacingCount = 0;

  const recordRowSpacing = map => {
    if (!map || map.size < 2) return;
    let last = null;
    map.forEach(pos => {
      if (last) {
        const diff = Math.abs(pos.y - last.y);
        if (diff > 0.001) {
          rowSpacingSum += diff;
          rowSpacingCount++;
        }
      }
      last = pos;
    });
  };

  const register = (segment, column, entry) => {
    if (!segment || !Number.isFinite(column) || !entry?.node) return;
    const key = makeSegmentColumnKey(segment, column);
    targetsBySegmentColumn.set(key, entry);
  };

  // sockets
  socketNodes.forEach(node => {
    const col = Number(node?.data?.column);
    const segment = normalizeSegmentName(node?.data?.segment);
    if (!Number.isFinite(col) || !segment) return;

    minColumn = Math.min(minColumn, col);
    maxColumn = Math.max(maxColumn, col);

    const rowPositions = buildRowPositionMap({
      rows: node.data.rows,
      column: col,
      socketNode: node
    });

    recordRowSpacing(rowPositions);

    register(segment, col, {
      node,
      targetPort: 'socket',
      segmentType: 'socket',
      rowPositions
    });

    const pos = getSocketPosition(node);
    const meta = columnTotals.get(col) || { sum: 0, count: 0 };
    meta.sum += pos.x;
    meta.count++;
    columnTotals.set(col, meta);

    if (segment === 'top') {
      topYSum += pos.y;
      topCount++;
    } else if (segment === 'bottom') {
      bottomYSum += pos.y;
      bottomCount++;
    }
  });

  // rails
  railNodes.forEach(rail => {
    const col = Number(rail?.data?.column);
    if (!Number.isFinite(col)) return;

    minColumn = Math.min(minColumn, col);
    maxColumn = Math.max(maxColumn, col);

    const pos = getSocketPosition(rail);
    const meta = columnTotals.get(col) || { sum: 0, count: 0 };
    meta.sum += pos.x;
    meta.count++;
    columnTotals.set(col, meta);

    // handle rails defined in `rail.data.rails`
    (rail.data.rails || []).forEach(info => {
      const pol = info?.polarity === 'negative' ? 'negative' : 'positive';
      const seg = `rail-${rail.data.channel}-${pol}`;

      register(seg, col, {
        node: rail,
        targetPort: pol,
        segmentType: 'rail',
        railInfo: info
      });
    });
  });

  // derive column centers
  columnTotals.forEach((meta, col) => {
    columnCenters.set(col, meta.sum / meta.count);
  });

  if (!Number.isFinite(minColumn) || !Number.isFinite(maxColumn) || columnCenters.size === 0) {
    return null;
  }

  const boardMidY =
    topCount > 0 && bottomCount > 0
      ? (topYSum / topCount + bottomYSum / bottomCount) * 0.5
      : null;

  const sorted = [...columnCenters.entries()].sort((a, b) => a[0] - b[0]);
  let columnSpacing = null;
  if (sorted.length > 1) {
    let sum = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1][1];
      const curr = sorted[i][1];
      if (Number.isFinite(prev) && Number.isFinite(curr)) {
        sum += Math.abs(curr - prev);
      }
    }
    columnSpacing = sum / (sorted.length - 1);
  }

  const rowSpacing =
    rowSpacingCount > 0 ? rowSpacingSum / rowSpacingCount : null;

  return {
    targetsBySegmentColumn,
    columnCenters,
    minColumn,
    maxColumn,
    boardMidY,
    columnSpacing,
    rowSpacing
  };
}
