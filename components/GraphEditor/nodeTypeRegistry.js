// components/GraphEditor/nodeTypeRegistry.js
// Central registry for all node types with metadata

import DefaultNode from './Nodes/DefaultNode';
import FixedNode from './Nodes/FixedNode';
import MarkdownNode from './Nodes/MarkdownNode';
import SvgNode from './Nodes/SvgNode';
import DivNode from './Nodes/DivNode';

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