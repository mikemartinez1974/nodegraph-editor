// settingsManager.js

const SETTINGS_KEY = 'nodegraph-editor-settings';

const introGraph = {
  nodes: [
    {
      id: 'intro-1',
      label: 'Welcome to NodeGraph Editor!',
      position: { x: 200, y: 150 },
      type: 'default',
      width: 250,
      height: 100,
      data: { memo: 'This is an introductory graph. Use the AI to create and edit graphs!' }
    },
    {
      id: 'intro-2',
      label: 'Start Here',
      position: { x: 500, y: 150 },
      type: 'default',
      width: 150,
      height: 80,
      data: { memo: 'Drag nodes, add edges, and explore the features.' }
    }
  ],
  edges: [
    {
      id: 'intro-edge-1',
      source: 'intro-1',
      target: 'intro-2',
      label: 'Next Step'
    }
  ],
  clusters: []
};

const defaultSettings = {
  themeName: 'light',
  backgroundImage: null,
  watermarkEnabled: true,
  watermarkStrength: 100,
  defaultNodeColor: '#1976d2',
  defaultEdgeColor: '#666666',
  pan: { x: 0, y: 0 },
  zoom: 1,
  toolbarPosition: { x: 0, y: 88 },
  nodeListPanelAnchor: 'right',
  groupListPanelPosition: 'right',
  nodePropertiesPanelAnchor: 'right',
  nodePropertiesPanelWidth: 300,
  groupPropertiesPanelPosition: 'bottom',
  autoLayoutType: 'grid',
  snapToGrid: false,
  gridSize: 20,
  groupVisibility: {},
  groupCollapsedState: {},
  nodeFilters: {},
  shortcuts: {},
  // Added items from numbers 3, 4, 6, & 8
  showNodeList: true,
  showGroupList: true,
  showGroupProperties: false,
  showNodeProperties: true,
  shortcuts: {
    copy: 'Ctrl+C',
    paste: 'Ctrl+V',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
  },
};

export const loadSettings = () => {
  try {
    if (typeof window === 'undefined') {
      return { ...defaultSettings, nodes: [], edges: [], clusters: [] };
    }
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return { ...defaultSettings, nodes: [], edges: [], clusters: [] };
    }
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return { ...defaultSettings, nodes: [], edges: [], clusters: [] };
    }
    return { ...defaultSettings, ...parsed, nodes: [], edges: [], clusters: [] };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { ...defaultSettings, nodes: [], edges: [], clusters: [] };
  }
};

export const saveSettings = (settings) => {
  try {
    const isFreeUser = localStorage.getItem('isFreeUser') === 'true';
    if (!isFreeUser) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export const resetSettings = () => {
  saveSettings(defaultSettings);
  return defaultSettings;
};

export const applySettings = (settings, stateUpdaters) => {
  const {
    setPan,
    setZoom,
    setNodePanelAnchor,
    setNodeListAnchor,
    setDefaultNodeColor,
    setDefaultEdgeColor,
    setToolbarPosition,
    setAutoLayoutType,
    setShowNodeList,
    setShowGroupList,
    setShowGroupProperties,
    setShowNodeProperties,
  } = stateUpdaters;

  if (settings.pan) setPan(settings.pan);
  if (typeof settings.zoom === 'number') setZoom(settings.zoom);
  if (settings.nodeListPanelAnchor) setNodeListAnchor(settings.nodeListPanelAnchor);
  if (settings.nodePropertiesPanelAnchor) setNodePanelAnchor(settings.nodePropertiesPanelAnchor);
  if (settings.defaultNodeColor) setDefaultNodeColor(settings.defaultNodeColor);
  if (settings.defaultEdgeColor) setDefaultEdgeColor(settings.defaultEdgeColor);
  if (settings.toolbarPosition) setToolbarPosition(settings.toolbarPosition);
  if (settings.autoLayoutType) setAutoLayoutType(settings.autoLayoutType);
  if (typeof settings.showNodeList === 'boolean') setShowNodeList(settings.showNodeList);
  if (typeof settings.showGroupList === 'boolean') setShowGroupList(settings.showGroupList);
  if (typeof settings.showGroupProperties === 'boolean') setShowGroupProperties(settings.showGroupProperties);
  if (typeof settings.showNodeProperties === 'boolean') setShowNodeProperties(settings.showNodeProperties);
};
