// utils.js
// Shared helper functions used by the breadboard autowire engine.

// ------------------------------------------------------------
// BASIC TYPE HELPERS
// ------------------------------------------------------------

export const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  Object.prototype.toString.call(value) === '[object Object]';


// ------------------------------------------------------------
// STRING & ROW NORMALIZATION
// ------------------------------------------------------------

export const normalizeRowName = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
};

// Given a segment value (top/bottom/A-J/etc), normalize it.
// Converts row letters into TOP/BOTTOM automatically.
export const normalizeSegmentName = (value) => {
  if (!value && value !== 0) return null;
  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'top' || normalized === 'upper' || normalized === 'a')
    return 'top';
  if (normalized === 'bottom' || normalized === 'lower' || normalized === 'b')
    return 'bottom';

  // Explicit rows: A-E = top group, F-J = bottom group.
  const rowChar = normalized.charAt(0).toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(rowChar)) return 'top';
  if (['F', 'G', 'H', 'I', 'J'].includes(rowChar)) return 'bottom';

  return null;
};


// ------------------------------------------------------------
// SEGMENT PREFERENCE LOGIC
// ------------------------------------------------------------

// Normalize semantic preferences like "same", "opposite", "rail-top-positive", etc.
export const normalizeSegmentPreference = (value) => {
  if (!value && value !== 0) return 'same';
  const normalized = String(value).trim().toLowerCase();

  if (isRailSegment(normalized)) return normalized;
  if (normalized === 'opposite' || normalized === 'other') return 'opposite';
  if (normalized === 'same' || normalized === 'auto') return 'same';

  const explicitSegment = normalizeSegmentName(normalized);
  return explicitSegment || 'same';
};

// Resolve the preference relative to a base segment.
export const resolveSegmentPreference = (preference, baseSegment) => {
  if (isRailSegment(preference)) return preference;
  if (preference === 'top' || preference === 'bottom') return preference;
  if (preference === 'opposite') {
    return baseSegment === 'top' ? 'bottom' : 'top';
  }
  // "same" fallback
  return baseSegment || 'top';
};


// ------------------------------------------------------------
// RAIL HELPERS
// ------------------------------------------------------------

export const isRailSegment = (segment) =>
  typeof segment === 'string' && segment.toLowerCase().startsWith('rail-');

export const getRailRowLabel = (segment) => {
  if (!isRailSegment(segment)) return null;
  return segment.includes('negative') ? 'GND' : 'V+';
};


// ------------------------------------------------------------
// POSITION HELPERS
// ------------------------------------------------------------

// Extract (x,y) from a socket or node.
export const getSocketPosition = (socket) => {
  const pos = socket?.position || {};
  const w = typeof socket?.width === 'number' ? socket.width : typeof socket?.data?.width === 'number' ? socket.data.width : 0;
  const h = typeof socket?.height === 'number' ? socket.height : typeof socket?.data?.height === 'number' ? socket.data.height : 0;
  const mode = socket?.data?.breadboard?.positionMode;
  const isTopLeft = mode === 'topleft';
  return {
    x: typeof pos.x === 'number' ? (isTopLeft ? pos.x + w / 2 : pos.x) : 0,
    y: typeof pos.y === 'number' ? (isTopLeft ? pos.y + h / 2 : pos.y) : 0
  };
};

// Return the center of a node, respecting top-left positioning when marked.
export const getNodeCenter = (node) => {
  const pos = node?.position || {};
  const w = typeof node?.width === 'number' ? node.width : typeof node?.data?.width === 'number' ? node.data.width : 0;
  const h = typeof node?.height === 'number' ? node.height : typeof node?.data?.height === 'number' ? node.data.height : 0;
  const mode = node?.data?.breadboard?.positionMode;
  const isTopLeft = mode === 'topleft';
  const x = typeof pos.x === 'number' ? pos.x : 0;
  const y = typeof pos.y === 'number' ? pos.y : 0;
  return {
    x: isTopLeft ? x + w / 2 : x,
    y: isTopLeft ? y + h / 2 : y
  };
};

// Quantize a number to a grid.
// (currently unused by default but included)
export const quantizeValue = (value, step) => {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
};

// Snap-to-nearest-column helper.
export const clampColumn = (column, minColumn, maxColumn) => {
  if (!Number.isFinite(column)) return minColumn || 1;
  const min = Number.isFinite(minColumn) ? minColumn : column;
  const max = Number.isFinite(maxColumn) ? maxColumn : column;
  return Math.max(min, Math.min(max, Math.round(column)));
};


// ------------------------------------------------------------
// COLUMN & SOCKET INDEXING
// ------------------------------------------------------------

// Build a unique key for retrieving the socket in the layout map.
export const makeSegmentColumnKey = (segment, column) => `${segment}::${column}`;

// Given an x-coordinate and a map of column centers, find the nearest column.
export const findNearestColumn = (x, columnCenters) => {
  if (!Number.isFinite(x) || !(columnCenters instanceof Map)) return null;
  let bestColumn = null;
  let bestDist = Infinity;
  columnCenters.forEach((centerX, column) => {
    const dist = Math.abs(centerX - x);
    if (dist < bestDist) {
      bestDist = dist;
      bestColumn = column;
    }
  });
  return bestColumn;
};
