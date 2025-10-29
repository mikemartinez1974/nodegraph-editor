// components/GraphEditor/nodeTypeRegistry.js
// Central registry for all node types with metadata

import DefaultNode from './Nodes/DefaultNode';
import FixedNode from './Nodes/FixedNode';
import MarkdownNode from './Nodes/MarkdownNode';
import SvgNode from './Nodes/SvgNode';
import DivNode from './Nodes/DivNode';
import TimerNode from './Nodes/TimerNode';
import ToggleNode from './Nodes/ToggleNode';
import CounterNode from './Nodes/CounterNode';
import GateNode from './Nodes/GateNode';
import DelayNode from './Nodes/DelayNode';
import APINode from './Nodes/APINode';
import ScriptNode from './Nodes/ScriptNode';


// Registry structure: each entry has the component and display metadata
const nodeTypeRegistry = {
  default: {
    component: DefaultNode,
    label: 'Default Node',
    description: 'Standard node with basic functionality',
    icon: 'Note', // MUI icon name
    category: 'basic'
  },
  fixed: {
    component: FixedNode,
    label: 'Fixed Node',
    description: 'Node with fixed position',
    icon: 'PushPin',
    category: 'basic'
  },
  markdown: {
    component: MarkdownNode,
    label: 'Markdown Node',
    description: 'Node with markdown rendering',
    icon: 'Article',
    category: 'content'
  },
  svg: {
    component: SvgNode,
    label: 'SVG Node',
    description: 'Node for SVG graphics',
    icon: 'Image',
    category: 'media'
  },
  div: {
    component: DivNode,
    label: 'Div Node',
    description: 'Custom HTML div container',
    icon: 'Code',
    category: 'advanced'
  },
  timer: {
    component: TimerNode,
    label: 'Timer Node',
    description: 'Node that functions as a countdown or stopwatch timer',
    icon: 'Timer',
    category: 'utility'
  },
  toggle: {
    component: ToggleNode,
    label: 'Toggle Node',
    description: 'Node that toggles between two states',
    icon: 'ToggleOn',
    category: 'utility'
  },
  counter: {
    component: CounterNode,
    label: 'Counter Node',
    description: 'Node that counts up or down',
    icon: 'AddCircleOutline',
    category: 'utility'
  }, 
  gate: {
    component: GateNode,
    label: 'Gate',
    description: 'Logical gate node (AND/OR/NOT/XOR/NAND/NOR)',
    icon: 'CallSplit',
    category: 'logic'
  },
  delay: {
    component: DelayNode,
    label: 'Delay Node',
    description: 'Schedules a delayed trigger; supports queueing and cancel',
    icon: 'Timer',
    category: 'utility'
  },
  api: {
    component: APINode,
    label: 'API Node',
    description: 'Fetch data from a URL on trigger; supports method, headers, body, cancel',
    icon: 'CloudDownload',
    category: 'integration'
  },
  script: {
    component: ScriptNode,
    label: 'Script Node',
    description: 'Runs a saved session script on trigger; emits result',
    icon: 'Code',
    category: 'logic'
  }
};

// Export helpers
export function getNodeTypes() {
  const types = {};
  Object.entries(nodeTypeRegistry).forEach(([key, { component }]) => {
    types[key] = component;
  });
  return types;
}

export function getNodeTypeList() {
  return Object.entries(nodeTypeRegistry).map(([key, meta]) => ({
    type: key,
    ...meta
  }));
}

export function getNodeTypesByCategory() {
  const byCategory = {};
  Object.entries(nodeTypeRegistry).forEach(([key, meta]) => {
    const cat = meta.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ type: key, ...meta });
  });
  return byCategory;
}

export function getNodeTypeMetadata(type) {
  return nodeTypeRegistry[type] || null;
}

export default nodeTypeRegistry;