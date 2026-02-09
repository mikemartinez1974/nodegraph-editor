# GraphEditor Components — README

This folder contains reusable UI components and panels for the node graph editor. Each component is designed for a specific aspect of the editor’s interface, property editing, or workflow.

## Components Overview

- **AddNodeMenu.js**
  - Menu for adding new nodes to the graph. Supports node type selection and quick creation.

- **BackgroundControls.js**
  - Controls for setting the background document/image. Allows entering a URL and toggling interactivity.

- **ColorPickerInput.js**
  - UI for picking solid or gradient colors. Includes presets and a custom color input.

- **EdgePropertiesPanel.js**
  - Panel for editing edge properties: type, label, style, color, gradient, arrow, animation, and more.

- **GroupListPanel.js**
  - Lists all clusters in the graph. Supports selection, visibility toggling, focusing, and deletion.

- **GroupPropertiesPanel.js**
  - Panel for editing cluster properties: label, style, visibility, and node membership. Allows adding/removing nodes and unclustering.

- **MarkdownRenderer.js**
  - Renders markdown content in nodes or panels. Uses ReactMarkdown and supports custom link handling.

- **NodeListPanel.js**
  - Lists all nodes with search, filter, and selection. Supports focusing on nodes and multi-select.

- **NodePropertiesPanel.js**
  - Panel for editing node properties (label, type, color, position, size, memo). May be deprecated in favor of ConsolidatedPropertiesPanel.

- **NodeTypeSelector.js**
  - UI for selecting node types from the registry. Used in node creation and editing dialogs.

- **PreferencesDialog.js**
  - Dialog for global editor preferences: default colors, background image, and more. Persists settings to localStorage.

- **PropertiesPanel.js**
  - Main panel for editing node, edge, and cluster properties. Consolidates all property editing into a single UI.

- **ResizeableDrawer.js**
  - Drawer component with resize support. Used for side panels and lists.

- **TlzLink.js**
  - Custom link handler for tlz:// protocol and external links. Emits events for internal navigation and opens external links in new tabs.

- **Toolbar.js**
  - Main toolbar for graph actions: add/delete nodes, undo/redo, save/load, copy/paste, preferences, and more. Supports bookmarks, minimap, and snap-to-grid toggles.

## Usage

Import and use these components in your editor UI as needed. Most panels expect props for the selected entity, update handlers, theme, and other context.

For details on props and integration, see each component’s source file.

---
For questions or to extend these components, follow the established patterns for state, event handling, and theming in the project.
