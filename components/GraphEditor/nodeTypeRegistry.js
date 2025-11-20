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
import ThreeDNode from './Nodes/ThreeDNode';
import BackgroundRpcNode from './Nodes/BackgroundRpcNode';
import ValueTriggerNode from './Nodes/ValueTriggerNode';
import PluginNodeRenderer from './Nodes/PluginNodeRenderer';
import CanvasNode from './Nodes/CanvasNode';
import BreadboardSocketNode from './Nodes/BreadboardSocketNode';
import { getInstalledPlugins } from './plugins/pluginRegistry';

// Registry structure: each entry has the component and display metadata
const baseNodeTypeRegistry = {
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
  valueTrigger: {
    component: ValueTriggerNode,
    label: 'Value Adapter',
    description: 'Convert value changes into trigger pulses (edge/change detection)',
    icon: 'Bolt',
    category: 'logic'
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
  },
  backgroundRpc: {
    component: BackgroundRpcNode,
    label: 'Background RPC',
    description: 'Call methods exposed by the embedded background frame',
    icon: 'Lan',
    category: 'integration'
  },
  canvas: {
    component: CanvasNode,
    label: 'Canvas Node',
    description: 'Native node rendered directly on the canvas',
    icon: 'Gesture',
    category: 'advanced',
    defaultWidth: 220,
    defaultHeight: 140,
    extensions: {
      layout: {
        handleExtension: 4
      }
    },
    defaultData: {
      style: 'wave',
      caption: 'Native Canvas Node'
    }
  },
  breadboardSocket: {
    component: BreadboardSocketNode,
    label: 'Breadboard Socket',
    description: 'Represents a column of breadboard holes',
    icon: 'FiberManualRecord',
    category: 'breadboard',
    defaultWidth: 18,
    defaultHeight: 18,
    state: {
      locked: true
    },
    style: {
      borderRadius: 999
    }
  },
  '3d': {
    component: ThreeDNode,
    label: '3D View',
    description: 'Interactive 3D scene with Three.js',
    icon: 'ViewInAr',
    category: 'media',
    defaultWidth: 300,
    defaultHeight: 300
  }
};

// Define nodeTypeMetadata array with all node type definitions
export const nodeTypeMetadata = [
  {
    type: 'default',
    label: 'Default Node',
    description: 'A basic node',
    icon: 'Circle',
    category: 'basic',
    defaultWidth: 200,
    defaultHeight: 120
  },
  {
    type: '3d',
    label: '3D View',
    description: 'Interactive 3D scene with Three.js',
    icon: 'ViewInAr',
    category: 'media',
    defaultWidth: 300,
    defaultHeight: 300
  },
  {
    type: 'canvas',
    label: 'Canvas Node',
    description: 'Native node drawn using the canvas API',
    icon: 'Gesture',
    category: 'advanced',
    defaultWidth: 220,
    defaultHeight: 140,
    extensions: {
      layout: {
        handleExtension: 4
      }
    },
    defaultData: {
      style: 'wave',
      caption: 'Native Canvas Node'
    }
  },
  {
    type: 'backgroundRpc',
    label: 'Background RPC',
    description: 'Invoke methods provided by BackgroundFrame RPC',
    icon: 'Lan',
    category: 'integration',
    defaultWidth: 260,
    defaultHeight: 220
  },
  {
    type: 'valueTrigger',
    label: 'Value Adapter',
    description: 'Convert value changes into trigger pulses',
    icon: 'Bolt',
    category: 'logic',
    defaultWidth: 240,
    defaultHeight: 180
  },
  {
    type: 'breadboardSocket',
    label: 'Breadboard Socket',
    description: 'Locked socket column used to build breadboard templates',
    icon: 'FiberManualRecord',
    category: 'breadboard',
    defaultWidth: 18,
    defaultHeight: 18,
    state: {
      locked: true
    },
    defaultData: {
      rows: ['A', 'B', 'C', 'D', 'E'],
      column: 1,
      segment: 'top'
    }
  }
  // Add more node types here as needed
];

const buildHandlesFromDefinition = (definition) => {
  if (!definition || !definition.handles) return undefined;
  const handles = [];
  const inputs = Array.isArray(definition.handles.inputs) ? definition.handles.inputs : [];
  const outputs = Array.isArray(definition.handles.outputs) ? definition.handles.outputs : [];
  inputs.forEach((handle) => {
    if (!handle?.id) return;
    handles.push({
      id: handle.id,
      label: handle.label || handle.id,
      direction: 'input',
      dataType: handle.dataType || 'value'
    });
  });
  outputs.forEach((handle) => {
    if (!handle?.id) return;
    handles.push({
      id: handle.id,
      label: handle.label || handle.id,
      direction: 'output',
      dataType: handle.dataType || 'value'
    });
  });
  return handles.length > 0 ? handles : undefined;
};

const buildLegacyHandleLists = (handles, direction) => {
  if (!Array.isArray(handles) || handles.length === 0) return undefined;
  return handles
    .filter((handle) => handle.direction === direction)
    .map((handle) => ({
      key: handle.id,
      label: handle.label || handle.id,
      type: handle.dataType || 'value'
    }));
};

const deriveDefaultDataFromDefinition = (definition) => {
  if (!definition || !Array.isArray(definition.properties)) return {};
  return definition.properties.reduce((acc, field) => {
    if (!field?.key) return acc;
    if (field.defaultValue !== undefined) {
      acc[field.key] = field.defaultValue;
    } else if (field.type === 'toggle') {
      acc[field.key] = false;
    } else if (field.type === 'number') {
      acc[field.key] = 0;
    } else {
      acc[field.key] = '';
    }
    return acc;
  }, {});
};

// Plugin helpers
const getPluginNodeEntries = () => {
  const entries = {};
  try {
    const plugins = getInstalledPlugins() || [];
    plugins
      .filter((plugin) => plugin && plugin.enabled !== false)
      .forEach((plugin) => {
        const manifestNodes = Array.isArray(plugin.nodes) ? plugin.nodes : [];
        const runtimeNodes =
          plugin.runtime && typeof plugin.runtime === 'object'
            ? plugin.runtime.nodesByType || {}
            : {};
        const manifestMap = manifestNodes.reduce((acc, node) => {
          if (node && node.type) {
            acc[node.type] = node;
          }
          return acc;
        }, {});
        const runtimeTypes = Object.keys(runtimeNodes);
        const allTypes = new Set();
        for (const node of manifestNodes) {
          if (node && node.type) allTypes.add(node.type);
        }
        for (const type of runtimeTypes) {
          if (type) allTypes.add(type);
        }
        allTypes.forEach((nodeType) => {
          if (!nodeType) return;
          const manifestMeta = manifestMap[nodeType] || {};
          const runtimeMeta = runtimeNodes[nodeType];
          const definition = manifestMeta.definition || runtimeMeta?.definition;
          const handlesFromDefinition = buildHandlesFromDefinition(definition);
          const handles = runtimeMeta?.handles || handlesFromDefinition || manifestMeta.handles;
          const inputsList =
            runtimeMeta?.inputs ||
            buildLegacyHandleLists(handles, 'input') ||
            manifestMeta.inputs;
          const outputsList =
            runtimeMeta?.outputs ||
            buildLegacyHandleLists(handles, 'output') ||
            manifestMeta.outputs;
          const definitionDefaults = deriveDefaultDataFromDefinition(definition);
          const manifestDefaults =
            manifestMeta.defaultData && typeof manifestMeta.defaultData === 'object'
              ? manifestMeta.defaultData
              : {};
          const runtimeDefaults =
            runtimeMeta?.defaultData && typeof runtimeMeta.defaultData === 'object'
              ? runtimeMeta.defaultData
              : {};
          const mergedDefaults = {
            ...definitionDefaults,
            ...manifestDefaults,
            ...runtimeDefaults
          };
          const sizeFromDefinition = definition?.size || {};
          const key = `${plugin.id}:${nodeType}`;
          entries[key] = {
            component: PluginNodeRenderer,
            label:
              runtimeMeta?.label ||
              manifestMeta.label ||
              runtimeMeta?.pluginType ||
              nodeType,
            description:
              runtimeMeta?.description ||
              manifestMeta.description ||
              `Plugin node from ${plugin.name || plugin.id}`,
            icon: runtimeMeta?.icon || manifestMeta.icon || 'Extension',
            category: runtimeMeta?.category || manifestMeta.category || 'plugin',
            pluginId: plugin.id,
            pluginNodeType: nodeType,
            pluginManifestUrl: plugin.manifestUrl,
            defaultWidth:
              runtimeMeta?.defaultWidth ??
              manifestMeta.defaultWidth ??
              sizeFromDefinition.width,
            defaultHeight:
              runtimeMeta?.defaultHeight ??
              manifestMeta.defaultHeight ??
              sizeFromDefinition.height,
            defaultData: mergedDefaults,
            handles,
            inputs: inputsList,
            outputs: outputsList,
            state: runtimeMeta?.state,
            extensions: runtimeMeta?.extensions,
            runtimeDefinition: runtimeMeta || null,
            entry: runtimeMeta?.entry || manifestMeta.entry || null,
            rendererEntry:
              runtimeMeta?.renderer?.entry ||
              manifestMeta.renderer?.entry ||
              runtimeMeta?.entry ||
              manifestMeta.entry ||
              null,
            definition
          };
        });
      });
  } catch (err) {
    console.warn('[nodeTypeRegistry] Failed to read plugin registry', err);
  }
  return entries;
};

const buildRegistry = () => ({
  ...baseNodeTypeRegistry,
  ...getPluginNodeEntries()
});

const buildNodeTypeMetadataList = () => {
  const pluginEntries = Object.entries(getPluginNodeEntries()).map(([type, meta]) => ({
    type,
    label: meta.label,
    description: meta.description,
    icon: meta.icon || 'Extension',
    category: meta.category || 'plugin',
    defaultWidth: meta.defaultWidth,
    defaultHeight: meta.defaultHeight,
    pluginId: meta.pluginId,
    pluginNodeType: meta.pluginNodeType,
    pluginManifestUrl: meta.pluginManifestUrl,
    defaultData: meta.defaultData,
    handles: meta.handles,
    inputs: meta.inputs,
    outputs: meta.outputs,
    state: meta.state,
    extensions: meta.extensions,
    runtimeDefinition: meta.runtimeDefinition,
    entry: meta.entry,
    rendererEntry: meta.rendererEntry,
    definition: meta.definition
  }));
  return [...nodeTypeMetadata, ...pluginEntries];
};

// Export helpers
export function getNodeTypes() {
  const types = {};
  Object.entries(buildRegistry()).forEach(([key, { component }]) => {
    types[key] = component;
  });
  return types;
}

export function getNodeTypeList() {
  return Object.entries(buildRegistry()).map(([key, meta]) => ({
    type: key,
    ...meta
  }));
}

export function getNodeTypesByCategory() {
  const byCategory = {};
  Object.entries(buildRegistry()).forEach(([key, meta]) => {
    const cat = meta.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ type: key, ...meta });
  });
  return byCategory;
}

export function getNodeTypeMetadata(type) {
  const registry = buildRegistry();
  return registry[type] || null;
}

export function getAllNodeTypeMetadata() {
  return buildNodeTypeMetadataList();
}
