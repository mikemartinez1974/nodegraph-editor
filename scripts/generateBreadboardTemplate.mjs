#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLUMN_COUNT = Number(process.env.BREADBOARD_COLUMNS) || 30;
const COLUMN_SPACING = Number(process.env.BREADBOARD_COLUMN_SPACING) || 32;
const ROW_OFFSET = Number(process.env.BREADBOARD_ROW_OFFSET) || 60;

const now = new Date().toISOString();

const buildSocketNode = ({ column, segment, rows }) => {
  const isTop = segment === 'top';
  const positionX = (column - (COLUMN_COUNT + 1) / 2) * COLUMN_SPACING;
  const positionY = isTop ? -ROW_OFFSET : ROW_OFFSET;
  return {
    id: `socket-${segment}-${column}`,
    type: 'breadboardSocket',
    label: `${rows[0]}-${rows[rows.length - 1]}${column}`,
    position: { x: positionX, y: positionY },
    width: 18,
    height: 18,
    state: { locked: true },
    data: {
      rows,
      column,
      sockets: rows.map((row) => `${row}${column}`),
      segment
    },
    handles: [
      { id: 'socket', label: 'Socket', type: 'value', direction: 'output' }
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

const graph = {
  version: '1.0.0',
  nodes: sockets,
  edges: [],
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
      rails: [],
      presets: [],
      activePresetId: null,
      metadata: {
        generatedBy: 'scripts/generateBreadboardTemplate.mjs'
      }
    }
  }
};

const outputDir = path.resolve(__dirname, '../templates/breadboard');
const outputPath = path.join(outputDir, 'breadboard-sockets.node');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

console.log(`Breadboard template saved to ${outputPath}`);
