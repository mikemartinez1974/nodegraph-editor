// generateBreadboardTemplate.mjs
//
// Generates a breadboard graph that matches your ORIGINAL spacing,
// so your resistor / LED / jumper / rail-tap renderers fit cleanly.
//
// Run:
//   node scripts/generateBreadboardTemplate.mjs
//
// Result:
//   scripts/breadboard.node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// GEOMETRY CONSTANTS – match original board
// ---------------------------------------------------------------------------

const COLS = 30;

const SOCKET_WIDTH = 18;
const SOCKET_HEIGHT = 56;

// Original socket band centers
const TOP_BLOCK_Y = -68;
const BOTTOM_BLOCK_Y = 68;

// Distance from socket centers to rail centers
const RAIL_OFFSET = 52;

// Rail centers
const TOP_RAIL_Y = TOP_BLOCK_Y - RAIL_OFFSET;      // -120
const BOTTOM_RAIL_Y = BOTTOM_BLOCK_Y + RAIL_OFFSET; // 120

// Original skin size
const skinWidth = 920;
const skinHeight = 380;

const SKIN_X = 0;
const SKIN_Y = 0;

// Column spacing
const COL_SPACING = 26;

// Bus node id  👇 (this is the missing piece)
const BUS_NODE_ID = "breadboard-bus";

// ---------------------------------------------------------------------------
// Runtime metadata that used to live inside autowire-runtime.js.
// Embedding it into the node payload lets the runtime stay lean.
// ---------------------------------------------------------------------------

const RUNTIME_METADATA = {
  rowGroups: {
    top: ["A", "B", "C", "D", "E"],
    bottom: ["F", "G", "H", "I", "J"]
  },
  pinPresets: {
    "io.breadboard.components:railTapPositive": {
      rail: { segmentPreference: "rail-top-positive" },
      tap: { row: "A", segment: "top" }
    },
    "io.breadboard.components:railTapNegative": {
      rail: { segmentPreference: "rail-bottom-negative" },
      tap: { row: "J", segment: "bottom" }
    },
    "io.breadboard.components:led": {
      anode: { row: "E", segment: "top" },
      cathode: { row: "F", segment: "bottom" }
    }
  },
  conductiveComponents: {
    "io.breadboard.components:resistor": [["pinA", "pinB"]],
    "io.breadboard.components:railTapPositive": [["rail", "tap"]],
    "io.breadboard.components:railTapNegative": [["rail", "tap"]],
    "io.breadboard.components:jumper": [["wireA", "wireB"]],
    "io.breadboard.sockets:railSocket": [
      ["vplus", "positive"],
      ["gnd", "negative"]
    ]
  },
  defaults: {
    minWidth: 18,
    minHeight: 24,
    bodyMargin: 14,
    inputHandleKey: "in"
  }
};


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// X position of column 1 socket center from original board
const FIRST_COL_X = -377;

function socketX(col) {
  // Match original board exactly: -377, -351, ..., 377
  return FIRST_COL_X + (col - 1) * COL_SPACING;
}

const ROW_SPACING = SOCKET_HEIGHT / 5;

// Build a single socket node (A–E or F–J)
function buildSocketNode({ id, label, col, rows, segment, x, y }) {
  return {
    id,
    type: "io.breadboard.sockets:socket",
    label,
    position: { x, y },
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
      column: col,
      segment,
      sockets: rows.map((r) => `${r}${col}`)
    },
    handles: [
      {
        id: "socket",
        label: "Socket",
        type: "value",
        direction: "bidirectional"
      }
    ],
    inputs: [{ key: "socket", label: "Socket", type: "value" }],
    outputs: [{ key: "socket", label: "Socket", type: "value" }]
  };
}

// ---------------------------------------------------------------------------
// Build all sockets (top + bottom)
// ---------------------------------------------------------------------------

function buildAllSocketNodes() {
  const nodes = [];

  for (let col = 1; col <= COLS; col++) {
    const x = socketX(col);

    // Top block: A–E
    nodes.push(
      buildSocketNode({
        id: `socket-top-${col}`,
        label: `A-E${col}`,
        col,
        rows: ["A", "B", "C", "D", "E"],
        segment: "top",
        x,
        y: TOP_BLOCK_Y
      })
    );

    // Bottom block: F–J
    nodes.push(
      buildSocketNode({
        id: `socket-bottom-${col}`,
        label: `F-J${col}`,
        col,
        rows: ["F", "G", "H", "I", "J"],
        segment: "bottom",
        x,
        y: BOTTOM_BLOCK_Y
      })
    );
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Build schema + skin node
// ---------------------------------------------------------------------------

function buildSkinNode(socketNodes) {
  const schema = {
    sockets: [],
    segments: []
  };

  // Hole positions & segment entries per socket
  for (const node of socketNodes) {
    const { x, y } = node.position;
    const { column, rows, segment } = node.data;

    rows.forEach((row, i) => {
      const holeY = y - SOCKET_HEIGHT / 2 + ROW_SPACING * (i + 0.5);
      schema.sockets.push({
        id: `${row}${column}`,
        row,
        column,
        position: { x, y: holeY }
      });
    });

    schema.segments.push({
      nodeId: node.id,
      segment,
      column,
      rows,
      socketIds: rows.map((r) => `${r}${column}`),
      position: { x, y }
    });
  }

  // Use original rail Y positions
  const rails = [
    {
      id: "rail-top-positive",
      channel: "bus",
      polarity: "positive",
      segments: Array.from({ length: COLS }, (_, i) => {
        const col = i + 1;
        return {
          nodeId: `rail-positive-${col}`,
          column: col,
          position: { x: socketX(col), y: TOP_RAIL_Y },
          handle: "positive"
        };
      })
    },
    {
      id: "rail-bottom-negative",
      channel: "bus",
      polarity: "negative",
      segments: Array.from({ length: COLS }, (_, i) => {
        const col = i + 1;
        return {
          nodeId: `rail-negative-${col}`,
          column: col,
          position: { x: socketX(col), y: BOTTOM_RAIL_Y },
          handle: "negative"
        };
      })
    }
  ];

  schema.rails = rails;

  return {
    id: "breadboard-skin",
    type: "io.breadboard.sockets:skin",
    label: "Breadboard Skin",
    position: { x: SKIN_X, y: SKIN_Y },
    width: skinWidth,
    height: skinHeight,
    state: { locked: true },
    data: {
      breadboard: {
        schema,
        metadata: JSON.parse(JSON.stringify(RUNTIME_METADATA))
      }
    },
    extensions: {
      layout: {
        hideChrome: true,
        padding: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0
      }
    }
  };
}


// ---------------------------------------------------------------------------
// Rail socket nodes (V+ and GND bars)
// ---------------------------------------------------------------------------

function buildRailSocketNodes() {
  const nodes = [];

  for (let col = 1; col <= COLS; col++) {
    const x = socketX(col);

    // Positive rail socket (top)
    nodes.push({
      id: `rail-positive-${col}`,
      type: "io.breadboard.sockets:railSocket",
      label: `V+${col}`,
      position: { x, y: TOP_RAIL_Y },
      width: 18,
      height: 36,
      state: { locked: true },
      data: {
        column: col,
        rails: [{ polarity: "positive", railId: "rail-top-positive" }]
      },
      inputs: [{ key: "positive", label: "V+", type: "value" }],
      outputs: [{ key: "positive", label: "V+", type: "value" }]
    });

    // Negative rail socket (bottom)
    nodes.push({
      id: `rail-negative-${col}`,
      type: "io.breadboard.sockets:railSocket",
      label: `GND${col}`,
      position: { x, y: BOTTOM_RAIL_Y },
      width: 18,
      height: 36,
      state: { locked: true },
      data: {
        column: col,
        rails: [{ polarity: "negative", railId: "rail-bottom-negative" }]
      },
      inputs: [{ key: "negative", label: "GND", type: "value" }],
      outputs: [{ key: "negative", label: "GND", type: "value" }]
    });
  }

  return nodes;
}


// ---------------------------------------------------------------------------
// Script node for autowire
// (You’ll paste your autoWire.js contents into data.code)
// ---------------------------------------------------------------------------

function buildScriptNode() {
  const autowirePath = path.join(__dirname, "autowire-runtime.js");
  const rawCode = fs.readFileSync(autowirePath, "utf8");

  return {
    id: "breadboard-autowire-script",
    type: "script",
    label: "Breadboard AutoWire",
    position: { x: 0, y: skinHeight / 2 + 40 },
    width: 320,
    height: 400,
    data: {
      language: "javascript",
      autoRun: true,
      dryRun: false,
      allowMutations: true,
      scriptId: "breadboard-autowire-runtime",
      script: rawCode
    }
  };
}

// ---------------------------------------------------------------------------
// Power bus node (V+ / GND source for the solver)
// ---------------------------------------------------------------------------

function buildBusNode() {
  return {
    id: BUS_NODE_ID,
    type: "io.breadboard.bus",
    label: "Power Bus",
    position: { x: 0, y: skinHeight / 2 + 120 },
    width: 180,
    height: 80,
    data: {},
    inputs: [
      { key: "positive", label: "V+", type: "value" },
      { key: "negative", label: "GND", type: "value" }
    ],
    outputs: [
      { key: "positive", label: "V+", type: "value" },
      { key: "negative", label: "GND", type: "value" }
    ]
  };
}

// ---------------------------------------------------------------------------
// Edges: connect bus → rail sockets
// ---------------------------------------------------------------------------

function buildBusEdges(busNode) {
  const edges = [];

  const busId = busNode.id;

  for (let col = 1; col <= COLS; col++) {
    const posRailId = `rail-positive-${col}`;
    const negRailId = `rail-negative-${col}`;

    // Bus positive → V+ rail socket
    edges.push({
      id: `edge-bus-pos-${col}`,
      source: busId,
      sourceHandle: "positive",
      target: posRailId,
      targetHandle: "positive",
      type: "default"
    });

    // Bus negative → GND rail socket
    edges.push({
      id: `edge-bus-neg-${col}`,
      source: busId,
      sourceHandle: "negative",
      target: negRailId,
      targetHandle: "negative",
      type: "default"
    });
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Assemble final graph
// ---------------------------------------------------------------------------

function generateGraph() {
  const socketNodes = buildAllSocketNodes();
  const railNodes = buildRailSocketNodes();
  const skinNode = buildSkinNode(socketNodes);
  const scriptNode = buildScriptNode();
  const busNode = buildBusNode();
  const edges = buildBusEdges(busNode);

  return {
    type: "nodegraph-data",
    nodes: [
      skinNode,        // FIRST: backplate, for auto-centering
      ...socketNodes,
      ...railNodes,
      scriptNode,
      busNode
    ],
    edges,
    timestamp: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Write to file next to this script
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const graph = generateGraph();
const outputPath = path.join(__dirname, "breadboard.node");

fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2), "utf-8");
console.log(`Breadboard written to: ${outputPath}`);
