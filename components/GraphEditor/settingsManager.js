// settingsManager.js

const SETTINGS_KEY = 'nodegraph-editor-settings';

const defaultSettings = {
  themeName: 'light',
  backgroundImage: null,
  defaultNodeColor: '#1976d2',
  defaultEdgeColor: '#666666',
  pan: { x: 0, y: 0 },
  zoom: 1,
  toolbarPosition: { x: 0, y: 88 },
  nodeListPanelAnchor: 'left',
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
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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