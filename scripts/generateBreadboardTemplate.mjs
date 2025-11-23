#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLUMN_COUNT = Number(process.env.BREADBOARD_COLUMNS) || 30;
const SOCKET_WIDTH = Number(process.env.BREADBOARD_SOCKET_WIDTH) || 24;
const SOCKET_HEIGHT = Number(process.env.BREADBOARD_SOCKET_HEIGHT) || 54;
const COLUMN_SPACING = Number(process.env.BREADBOARD_COLUMN_SPACING) || SOCKET_WIDTH;
const CENTER_GAP = Number(process.env.CENTER_GAP) || 0; // No gap - segments should touch
const ROW_OFFSET =
  Number(process.env.BREADBOARD_ROW_OFFSET) ||
  Math.max(1, Math.round(SOCKET_HEIGHT / 2 + CENTER_GAP / 2));
const RAIL_SOCKET_WIDTH =
  Number(process.env.BREADBOARD_RAIL_SOCKET_WIDTH) || SOCKET_WIDTH;
const RAIL_SOCKET_HEIGHT =
  Number(process.env.BREADBOARD_RAIL_SOCKET_HEIGHT) || 44;
const RAIL_GAP = Number(process.env.BREADBOARD_RAIL_GAP) || 0; // No gap - rails abut the breadboard exactly
const RAIL_LAYER_SPACING =
  Number(process.env.BREADBOARD_RAIL_LAYER_SPACING) || 4;
const SKIN_MARGIN = 32;
const SKIN_RAIL_INSET = Number(process.env.BREADBOARD_SKIN_RAIL_INSET) || 32;
const SKIN_RAIL_THICKNESS = Number(process.env.BREADBOARD_SKIN_RAIL_THICKNESS) || 24;
const SKIN_GAP_HEIGHT = Number(process.env.BREADBOARD_SKIN_GAP_HEIGHT) || 96;
const SKIN_WIDTH = Math.max(360, COLUMN_SPACING * COLUMN_COUNT + SKIN_MARGIN * 2);
const SKIN_HEIGHT = Math.max(
  280,
  ROW_OFFSET * 2 + SOCKET_HEIGHT + RAIL_GAP + RAIL_SOCKET_HEIGHT * 2 + SKIN_MARGIN * 2
);

const now = new Date().toISOString();

const buildSocketNode = ({ column, segment, rows }) => {
  const isTop = segment === 'top';
  const positionX = (column - (COLUMN_COUNT + 1) / 2) * COLUMN_SPACING;
  const positionY = isTop ? -ROW_OFFSET : ROW_OFFSET;
  return {
    id: `socket-${segment}-${column}`,
    type: 'io.breadboard.sockets:socket',
    label: `${rows[0]}-${rows[rows.length - 1]}${column}`,
    position: { x: positionX, y: positionY },
    width: SOCKET_WIDTH,
    height: SOCKET_HEIGHT,
    state: { locked: true },
    extensions: {
      layout: {
        hideChrome: true,
        padding: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0
      }
    },
    data: {
      rows,
      column,
      sockets: rows.map((row) => `${row}${column}`),
      segment
    },
    // keep legacy "handles" for plugin renderer compatibility
    handles: [
      { id: 'socket', label: 'Socket', type: 'value', direction: 'bidirectional' }
    ],
    // Structured ports for unified handle system
    inputs: [
      { key: 'socket', label: 'Socket', type: 'value' },
      { key: 'vplus', label: 'V+', type: 'value' },
      { key: 'gnd', label: 'GND', type: 'value' }
    ],
    outputs: [
      { key: 'socket', label: 'Socket', type: 'value' }
    ]
  };
};

const sockets = [];
for (let column = 1; column <= COLUMN_COUNT; column += 1) {
  sockets.push(
    buildSocketNode({
      column,
      segment: 'top',
      rows: ['A', 'B', 'C', 'D', 'E']
    }),
    buildSocketNode({
      column,
      segment: 'bottom',
      rows: ['F', 'G', 'H', 'I', 'J']
    })
  );
}

const getRailCenterOffset = () =>
  ROW_OFFSET + SOCKET_HEIGHT / 2 + RAIL_GAP + RAIL_SOCKET_HEIGHT / 2;

const buildRailColumnNode = ({ column, channel }) => {
  const positionX = (column - (COLUMN_COUNT + 1) / 2) * COLUMN_SPACING;
  const offset = getRailCenterOffset();
  const positionY = channel === 'bottom' ? offset : -offset;
  const railSet =
    channel === 'bottom'
      ? [
          { railId: 'rail-bottom-negative', polarity: 'negative', label: 'GND', slot: 0 },
          { railId: 'rail-bottom-positive', polarity: 'positive', label: 'V+', slot: 1 }
        ]
      : [
          { railId: 'rail-top-negative', polarity: 'negative', label: 'GND', slot: 0 },
          { railId: 'rail-top-positive', polarity: 'positive', label: 'V+', slot: 1 }
        ];
  return {
    id: `rail-${channel}-${column}`,
    type: 'io.breadboard.sockets:railSocket',
    label: `${channel === 'top' ? 'TOP' : 'BOTTOM'} ${column}`,
    position: { x: positionX, y: positionY },
    width: RAIL_SOCKET_WIDTH,
    height: RAIL_SOCKET_HEIGHT,
    state: { locked: true },
    extensions: {
      layout: {
        hideChrome: true,
        padding: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0
      }
    },
    data: {
      channel,
      column,
      rails: railSet.map((rail) => ({
        ...rail,
        sockets: [
          `${rail.label || rail.polarity}${column}-outer`,
          `${rail.label || rail.polarity}${column}-inner`
        ]
      }))
    },
    handles: [
      { id: 'positive', label: 'V+', type: 'value', direction: 'output' },
      { id: 'negative', label: 'GND', type: 'value', direction: 'output' }
    ]
  };
};

const railNodes = [];
const railsMetadata = [
  { id: 'rail-top-negative', polarity: 'negative', channel: 'top', label: 'GND' },
  { id: 'rail-top-positive', polarity: 'positive', channel: 'top', label: 'V+' },
  { id: 'rail-bottom-negative', polarity: 'negative', channel: 'bottom', label: 'GND' },
  { id: 'rail-bottom-positive', polarity: 'positive', channel: 'bottom', label: 'V+' }
].map((rail) => ({
  ...rail,
  nodeIds: Array.from({ length: COLUMN_COUNT }, (_, index) => {
    const column = index + 1;
    const nodeId = `rail-${rail.channel}-${column}`;
    return nodeId;
  })
}));

for (let column = 1; column <= COLUMN_COUNT; column += 1) {
  railNodes.push(buildRailColumnNode({ column, channel: 'top' }));
  railNodes.push(buildRailColumnNode({ column, channel: 'bottom' }));
}

// add structured ports to rail nodes so they can receive bus connections
railNodes.forEach(rn => {
  rn.inputs = rn.inputs || [
    { key: 'vplus', label: 'V+', type: 'value' },
    { key: 'gnd', label: 'GND', type: 'value' }
  ];
  rn.outputs = rn.outputs || [
    { key: 'positive', label: 'V+', type: 'value' },
    { key: 'negative', label: 'GND', type: 'value' }
  ];
});

// create 4 bus nodes (top/bottom x V+/GND) to represent continuous rails
const busNodes = [
  {
    id: 'bus-top-positive',
    type: 'io.breadboard.bus',
    label: 'TOP V+',
    position: { x: 0, y: -getRailCenterOffset() - RAIL_SOCKET_HEIGHT },
    width: 28,
    height: 20,
    state: { locked: true },
    extensions: {
      layout: {
        hideChrome: true,
        padding: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0
      }
    },
    data: { channel: 'top', polarity: 'positive' },
    outputs: [{ key: 'positive', label: 'V+', type: 'value' }]
  },
  {
    id: 'bus-top-negative',
    type: 'io.breadboard.bus',
    label: 'TOP GND',
    position: { x: 0, y: -getRailCenterOffset() - RAIL_SOCKET_HEIGHT + 22 },
    width: 28,
    height: 20,
    state: { locked: true },
    extensions: {
      layout: {
        hideChrome: true,
        padding: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0
      }
    },
    data: { channel: 'top', polarity: 'negative' },
    outputs: [{ key: 'negative', label: 'GND', type: 'value' }]
  },
  {
    id: 'bus-bottom-positive',
    type: 'io.breadboard.bus',
    label: 'BOTTOM V+',
    position: { x: 0, y: getRailCenterOffset() + RAIL_SOCKET_HEIGHT - 50 },
    width: 28,
    height: 20,
    state: { locked: true },
    extensions: {
      layout: {
        hideChrome: true,
        padding: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0
      }
    },
    data: { channel: 'bottom', polarity: 'positive' },
    outputs: [{ key: 'positive', label: 'V+', type: 'value' }]
  },
  {
    id: 'bus-bottom-negative',
    type: 'io.breadboard.bus',
    label: 'BOTTOM GND',
    position: { x: 0, y: getRailCenterOffset() + RAIL_SOCKET_HEIGHT + 22 - 50 },
    width: 28,
    height: 20,
    state: { locked: true },
    extensions: {
      layout: {
        hideChrome: true,
        padding: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0
      }
    },
    data: { channel: 'bottom', polarity: 'negative' },
    outputs: [{ key: 'negative', label: 'GND', type: 'value' }]
  }
];

const skinNode = {
  id: 'breadboard-skin',
  type: 'io.breadboard.sockets:skin',
  label: 'Breadboard Skin',
  position: { x: 0, y: 0 },
  width: SKIN_WIDTH,
  height: SKIN_HEIGHT,
  state: { locked: true },
  extensions: {
    layout: {
      hideChrome: true,
      padding: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0
    }
  },
  data: {
    rows: 10,
    columns: COLUMN_COUNT,
    rowPitch: 1,
    columnPitch: 1,
    railInset: SKIN_RAIL_INSET,
    railThickness: SKIN_RAIL_THICKNESS,
    gapHeight: SKIN_GAP_HEIGHT
  },
  inputs: [],
  outputs: []
};

// prepare edges from buses -> each rail node (so rails behave as visual/rendering elements while buses represent the continuous nets)
const edgesFromBus = [];
for (let column = 1; column <= COLUMN_COUNT; column += 1) {
  edgesFromBus.push({
    id: `edge-bus-top-positive-to-rail-top-${column}`,
    source: { nodeId: 'bus-top-positive', handleKey: 'positive' },
    target: { nodeId: `rail-top-${column}`, handleKey: 'vplus' }
  });
  edgesFromBus.push({
    id: `edge-bus-top-negative-to-rail-top-${column}`,
    source: { nodeId: 'bus-top-negative', handleKey: 'negative' },
    target: { nodeId: `rail-top-${column}`, handleKey: 'gnd' }
  });

  edgesFromBus.push({
    id: `edge-bus-bottom-positive-to-rail-bottom-${column}`,
    source: { nodeId: 'bus-bottom-positive', handleKey: 'positive' },
    target: { nodeId: `rail-bottom-${column}`, handleKey: 'vplus' }
  });
  edgesFromBus.push({
    id: `edge-bus-bottom-negative-to-rail-bottom-${column}`,
    source: { nodeId: 'bus-bottom-negative', handleKey: 'negative' },
    target: { nodeId: `rail-bottom-${column}`, handleKey: 'gnd' }
  });
}

// build edges linking rails -> sockets so the template behaves like a real breadboard
const edges = [];
for (let column = 1; column <= COLUMN_COUNT; column += 1) {
  const topRailId = `rail-top-${column}`;
  const bottomRailId = `rail-bottom-${column}`;
  const topSocketId = `socket-top-${column}`;
  const bottomSocketId = `socket-bottom-${column}`;

  edges.push({
    id: `edge-${topRailId}-V+-to-${topSocketId}`,
    source: { nodeId: topRailId, handleKey: 'positive' },
    target: { nodeId: topSocketId, handleKey: 'vplus' }
  });

  edges.push({
    id: `edge-${topRailId}-GND-to-${topSocketId}`,
    source: { nodeId: topRailId, handleKey: 'negative' },
    target: { nodeId: topSocketId, handleKey: 'gnd' }
  });

  edges.push({
    id: `edge-${bottomRailId}-V+-to-${bottomSocketId}`,
    source: { nodeId: bottomRailId, handleKey: 'positive' },
    target: { nodeId: bottomSocketId, handleKey: 'vplus' }
  });

  edges.push({
    id: `edge-${bottomRailId}-GND-to-${bottomSocketId}`,
    source: { nodeId: bottomRailId, handleKey: 'negative' },
    target: { nodeId: bottomSocketId, handleKey: 'gnd' }
  });
}

// append bus edges so nets are continuous
if (typeof edgesFromBus !== 'undefined' && Array.isArray(edgesFromBus)) {
  edges.push(...edgesFromBus);
}

const graph = {
  version: '1.0.0',
  nodes: [...busNodes, skinNode, ...sockets, ...railNodes],
  edges: [...edges],
  groups: [],
  options: {
    gridSize: 16,
    snapToGrid: true,
    theme: 'default',
    validationMode: 'permissive'
  },
  metadata: {
    title: 'Breadboard Socket Template',
    description: 'Pre-generated board substrate composed of socket nodes',
    created: now,
    modified: now,
    author: 'generator'
  },
  extensions: {
    breadboard: {
      grid: {
        rows: 10,
        columns: COLUMN_COUNT,
        rowSpacing: 1,
        columnSpacing: 1
      },
      rails: railsMetadata,
      presets: [],
      activePresetId: null,
      metadata: {
        generatedBy: 'scripts/generateBreadboardTemplate.mjs'
      }
    }
  }
};

const outputDir = path.resolve(__dirname, '../public/data/breadboard');
const outputPath = path.join(outputDir, 'breadboard-sockets.node');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

console.log(`Breadboard template saved to ${outputPath}`);
