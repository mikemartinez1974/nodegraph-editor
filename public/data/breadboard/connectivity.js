//
// connectivity.js
//
// Responsible only for:
//  - Extracting component pins
//  - Determining orientation
//  - Matching pins to nearest sockets/rails in the layout
//  - Producing final connection targets
//

import {
  normalizeSegmentPreference,
  resolveSegmentPreference,
  quantizeValue,
  findNearestColumn,
  clampColumn
} from './utils.js';

/**
 * Determine component orientation based on bounding box.
 * Horizontal:    width > height (resistor, wire)
 * Vertical:      height > width (tap, LED)
 */
export function determineOrientation(node) {
  const w = node?.width || node?.data?.width;
  const h = node?.height || node?.data?.height;

  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    return 'horizontal';
  }
  return w >= h ? 'horizontal' : 'vertical';
}

/**
 * Return an array describing the component's pins.
 * Output format:
 *   [
 *     { name: 'anode',   preference: 'positive' },
 *     { name: 'cathode', preference: 'negative' }
 *   ]
 *
 * Supports:
 *  - Resistor (two generic pins)
 *  - LED (anode + cathode from data)
 *  - Rail Tap (one pin with polarity preference)
 */
export function getComponentPins(node) {
  const type = node?.data?.type || node?.type || '';

  // --- LED --------------------------------------------------------
  if (type.includes('led')) {
    const bb = node?.data?.breadboard || {};
    const pinState = bb.pinState || {};
    return [
      { name: 'anode',   preference: normalizeSegmentPreference(pinState.anode) },
      { name: 'cathode', preference: normalizeSegmentPreference(pinState.cathode) }
    ];
  }

  // --- Rail Tap ---------------------------------------------------
  if (type.includes('tap')) {
    const pol = node?.data?.pins?.[0]?.segmentPreference || 'positive';
    return [
      { name: 'pin', preference: normalizeSegmentPreference(pol) }
    ];
  }

  // --- Resistor / generic 2-lead components -----------------------
  return [
    { name: 'p0', preference: null },
    { name: 'p1', preference: null }
  ];
}

/**
 * Locate the nearest socket or rail target for a pin.
 * Uses the precomputed layout from layout.js
 */
export function findNearestTargetForPin(pinPos, layout, pinPreference = null) {
  if (!layout) return null;

  const {
    targetsBySegmentColumn,
    columnCenters,
    minColumn,
    maxColumn,
    boardMidY,
    rowSpacing
  } = layout;

  const { x, y } = pinPos;

  // Quantize X test point into nearest column #
  const targetColumn = findNearestColumn(
    x,
    columnCenters,
    minColumn,
    maxColumn
  );

  if (targetColumn == null) return null;

  const segments = ['top', 'bottom'];
  const candidates = [];

  for (let seg of segments) {
    const key = `${seg}:${targetColumn}`;
    const entry = targetsBySegmentColumn.get(key);
    if (!entry) continue;

    // Polarity check for rails
    if (entry.segmentType === 'rail') {
      const pol = entry.railInfo?.polarity || 'positive';
      if (pinPreference && !resolveSegmentPreference(pinPreference, pol)) {
        continue;
      }
    }

    // Each entry contains rowPositions map for sockets
    if (entry.segmentType === 'socket' && entry.rowPositions instanceof Map) {
      entry.rowPositions.forEach((pos, rowId) => {
        const dy = Math.abs(pos.y - y);
        candidates.push({
          entry,
          rowId,
          pos,
          distance: dy * dy + Math.abs(pos.x - x) * Math.abs(pos.x - x)
        });
      });
    } else {
      // Rail target has no per-row choices
      const pos = entry.node ? entry.node.position : { x, y };
      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      candidates.push({
        entry,
        rowId: null,
        pos,
        distance: dx * dx + dy * dy
      });
    }
  }

  if (candidates.length === 0) return null;

  // This finds the single nearest valid target (socket or rail)
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0];
}

/**
 * High-level helper:
 * Given a node + layout, return:
 *
 * [
 *   { pinName: 'anode',  targetNode: X, targetHandle: 'socket', row: '29t' },
 *   { pinName: 'cathode', targetNode: Y, targetHandle: 'socket', row: '29b' }
 * ]
 *
 */
export function computeConnectionsForComponent(node, layout) {
  const pins = getComponentPins(node);
  const out = [];

  pins.forEach(pin => {
    const pinPos = getPinPosition(node, pin.name);
    if (!pinPos) return;

    const nearest = findNearestTargetForPin(
      pinPos,
      layout,
      pin.preference
    );

    if (!nearest) return;

    out.push({
      pinName: pin.name,
      targetNodeId: nearest.entry.node?.id || null,
      targetHandle: nearest.entry.targetHandle || 'socket',
      row: nearest.rowId,
      pos: nearest.pos
    });
  });

  return out;
}

/**
 * Convert a component + connections list into edge builder input:
 *
 * [
 *   {
 *     fromNodeId: "componentId",
 *     fromHandle: "anode",
 *     toNodeId:   "bb-node-123",
 *     toHandle:   "socket"
 *   },
 *   ...
 * ]
 */
export function buildEdgeCommands(componentNode, connectionSpecs) {
  return connectionSpecs.map(spec => ({
    fromNodeId: componentNode.id,
    fromHandle: spec.pinName,
    toNodeId: spec.targetNodeId,
    toHandle: spec.targetHandle
  }));
}

/**
 * Determine the pixel position of a given pin on a node.
 * For now, use the bounding box to approximate:
 *
 * Horizontal parts:
 *   p0 = left center
 *   p1 = right center
 *
 * Vertical parts:
 *   p0 = top center
 *   p1 = bottom center
 *
 * LED:
 *   anode   = top
 *   cathode = bottom
 *
 * Tap:
 *   single pin = bottom
 */
export function getPinPosition(node, pinName) {
  const orientation = determineOrientation(node);
  const x = node.position.x;
  const y = node.position.y;
  const w = node.width;
  const h = node.height;

  // LED
  if (pinName === 'anode') {
    return { x, y: y - h / 2 };
  }
  if (pinName === 'cathode') {
    return { x, y: y + h / 2 };
  }

  // Resistors + generic 2-pin horizontal
  if (orientation === 'horizontal') {
    if (pinName === 'p0') return { x: x - w / 2, y };
    if (pinName === 'p1') return { x: x + w / 2, y };
  }

  // Vertical (taps, LEDs fallback)
  if (orientation === 'vertical') {
    if (pinName === 'p0') return { x, y: y - h / 2 };
    if (pinName === 'p1') return { x, y: y + h / 2 };
  }

  // Tap (single pin)
  if (pinName === 'pin') {
    return { x, y: y + h / 2 };
  }

  return null;
}
