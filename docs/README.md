# Twilite Node Browser Documentation Compendium

This single file aggregates the primary README content from across the repo so you (or another AI assistant) can search and reference everything without hunting through directories.

---
## Source: `README.md`

# Twilite Node Browser

A production-grade, AI-first visual graph editor/browser built with React, Next.js, and Material-UI. Design, organize, and think visually by collaborating with AI assistants (ChatGPT, Claude, Grok, etc.) through a simple copy/paste workflow.

**Live Demo:** [cpwith.me](https://cpwith.me)

---

## What Makes This Different

Instead of manually clicking and dragging to build graphs:

1. **Describe** what you want to an AI assistant
2. **AI generates** graph JSON for you
3. **Paste** into the app (Ctrl+V)
4. **Graph appears** instantly

Think of it as "Figma meets ChatGPT" for visual thinking and knowledge organization.

---

## Features

### Core Functionality

- ✅ **AI-First Workflow**: Copy/paste JSON directly from AI assistants
- ✅ **Drag & Drop**: Smooth 60fps node dragging with RAF batching
- ✅ **Pan & Zoom**: Mouse wheel zoom, drag-to-pan, HiDPI canvas support
- ✅ **Multi-Select**: Marquee selection (Shift+drag) with bulk operations
- ✅ **Undo/Redo**: Full history management (Ctrl+Z/Y)
- ✅ **Clusters**: Visual node grouping with collapse/expand and drag-to-move-all
- ✅ **Node Types**: Default, Resizable, with extensible custom types
- ✅ **Edge Types**: Straight, curved, child/parent (vertical), peer (horizontal)
- ✅ **Markdown Support**: Rich formatted text in node memos
- ✅ **Accessibility**: ARIA labels, keyboard navigation (Tab, Ctrl+Arrows), focus management

### Modes

- **Manual Mode**: Full editing control (default)
- **Nav Mode**: Navigation-only with physics simulation for exploration
- **Auto-Layout Mode**: Hierarchical, radial, or grid layouts (GSAP-powered)

### Panels & UI

- **Properties Panel**: Edit labels, markdown memos, links, emoji picker, edge type, style, width, curvature, group membership, styling, visibility
- **Node List**: Virtualized list with search and filtering (react-window)
- **Group List**: Browse and manage all clusters
- **Draggable Toolbar**: Floating toolbar with all essential actions

### Keyboard Shortcuts

- **Ctrl+C/X/V**: Copy, cut, paste nodes/edges
- **Ctrl+Z/Y**: Undo, redo
- **Ctrl+G**: Create group from selection
- **Ctrl+Shift+G**: Ungroup
- **Ctrl+A**: Select all
- **Ctrl+Q**: Resize all nodes to 80x48
- **Delete**: Remove selected
- **Escape**: Clear selection
- **Ctrl+Arrows**: Move selected nodes (1px)
- **Ctrl+Shift+Arrows**: Move selected nodes (10px)

### Advanced Features

- **GraphCRUD API**: Global JavaScript API for programmatic graph manipulation (`window.graphAPI`)
- **Plain Text → Node**: Paste any text to auto-create a node
- **Theme System**: 29 built-in themes with dark/light mode support
- **Background Art**: Customizable canvas backgrounds (tiled, stretched, centered)
- **Auto-save Ready**: JSON export/import for persistence
- **Performance**: Ports 1000+ nodes smoothly with canvas rendering and virtualization

---

## Architecture

### Layered Rendering

- **EdgeLayer** (Canvas): High-performance bezier curve rendering with hit detection
- **HandleLayer** (Canvas): Port connection points with proximity-based activation
- **NodeLayer** (React/DOM): Interactive node components with selection and hover
- **GroupLayer** (SVG): Visual grouping with auto-calculated bounds
- **PanZoomLayer** (SVG): Unified viewport transform with marquee selection

### Event System

- **Event Bus**: Decoupled cross-component communication (`eventBus.js`)
- **Port System**: Context-aware port positioning with real-time drag updates (no React re-renders)
- **Physics Simulation**: Force-directed layout in Nav Mode (attraction, repulsion, damping)

### State Management

- **History**: Undo/redo with debounced batching
- **Refs**: Transient state for 60fps drag performance
- **LocalStorage**: Panel positions, theme preferences, background settings

---

## Quick Start

### For Users

1. **Visit** [cpwith.me](https://cpwith.me)
2. **Click** 📋 Onboard LLM button (top-left)
3. **Paste** the guide into your AI chat (ChatGPT, Claude, etc.)
4. **Ask AI** to create a graph: "Create a graph showing the water cycle"
5. **Copy** the JSON from AI
6. **Paste** into the app (Ctrl+V)
7. **Done!** Your graph appears instantly

See the [User Manual](public/documentation/UserManual.md) for full documentation.

### For Developers

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## Technology Stack

- **Framework**: Next.js 14 (React 18)
- **UI**: Material-UI (MUI) with custom theming
- **Canvas**: Native Canvas API for performance-critical rendering
- **Animation**: GSAP for layout transitions
- **Markdown**: react-markdown + remark-gfm
- **Virtualization**: react-window for large lists
- **Icons**: MUI Icons + emoji-picker-react

---

## Project Structure

```text
nodegraph-editor/
├── components/
│   ├── Header/
│   │   ├── ThemeDrawer.js         # Theme switcher UI
│   │   └── themes.js               # 29 theme definitions
│   ├── Toolbar.js                  # Floating toolbar with all actions
│   ├── GraphEditor/
│   │   ├── Nodes/
│   │   │   ├── DefaultNode.js      # Standard node component
│   │   │   └── ResizableNode.js    # Resizable node variant
│   │   ├── PropertiesPanel.js      # Unified properties panel for nodes, edges, and clusters
│   │   ├── NodeListPanel.js        # Virtualized node list
│   │   ├── GroupListPanel.js       # Group browser
│   │   ├── useGraphHistory.js      # Undo/redo hook
│   │   ├── useGraphModes.js        # Mode management + physics
│   │   ├── useGraphShortcuts.js    # Keyboard shortcuts
│   │   └── useSelection.js         # Multi-select logic
│   └── NodeGraph/
│       ├── NodeGraph.js            # Main orchestrator
│       ├── EdgeLayer.js            # Canvas edge rendering
│       ├── NodeLayer.js            # React node rendering
│       ├── HandleLayer.js          # Canvas port rendering
│       ├── GroupLayer.js           # SVG group rendering
│       ├── PanZoomLayer.js         # Viewport + marquee
│       ├── eventBus.js             # Event system
│       ├── canvasUtils.js          # Canvas helpers (HiDPI, etc.)
│       ├── edgeUtils.js            # Edge path calculation
│       ├── dragHandlers.js         # Drag event handlers
│       └── marqueeSelection.js     # Rectangular selection
├── public/
│   └── data/
│       ├── OnboardLLM.md           # AI assistant guide
│       └── UserManual.md           # End-user documentation
└── app/
    └── page.js                     # Main application entry
```

---

## GraphCRUD API

Global JavaScript API available at `window.graphAPI`:

```javascript
// Create nodes
window.graphAPI.createNode({
  label: "New Node",
  position: { x: 100, y: 100 },
  data: { memo: "Some notes" }
});

// Query nodes
window.graphAPI.findNodes({ type: "default", hasMemo: true });

// Create edges
window.graphAPI.createEdge({
  source: "node1",
  target: "node2",
  sourcePort: "out",
  targetPort: "in",
  type: "curved"
});

// Get stats
window.graphAPI.getStats();
// { nodeCount: 10, edgeCount: 15, ... }
```

> ℹ️ Edge creation now requires `sourcePort`/`targetPort` keys. Use the node's `outputs`/`inputs` arrays (or the default `out`/`in` ports) to pick the correct connection points.

See [GraphAPIdocumentation.md](components/GraphEditor/GraphAPIdocumentation.md) for full API reference.

---

## Theming

29 built-in themes with dark/light mode support:

**Light Themes**: Ocean, Sunset, Forest, Lavender, Coffee, Desert, Emerald, Ruby, Sapphire, Retro, Arctic, Ice, Rose Gold, Jungle, Coral Reef, Peach, Sunrise, Candy

**Dark Themes**: Midnight, Neon, Cyberpunk, Flame, Noir, Twilite, Steel, Galaxy

**Neutral**: Vintage

Custom themes can be added in `components/Header/themes.js`.

---

## Performance Notes

- **Large Graphs**: Tested with 1000+ nodes, 2000+ edges
- **Canvas Rendering**: Edges/ports drawn on canvas (not DOM)
- **RAF Batching**: Drag updates batched via requestAnimationFrame
- **Virtualization**: Node/group list panels use react-window
- **HiDPI Support**: Canvas scaled for retina displays
- **Lazy Rendering**: Ports only rendered when near nodes

---

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Shift+Tab)
- Focus management with visible focus indicators
- Screen reader support for node/edge selection
- High contrast mode compatible

---

## Browser Support

- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

Requires JavaScript enabled. Canvas API and Clipboard API required for full functionality.

---

## Documentation

Use these docs as a launchpad when working with other assistants—the descriptions call out exactly what each file covers:

| Doc | Purpose |
| --- | --- |
| **[User Manual](public/documentation/UserManual.md)** | End-user playbook for Twilite Node Browser (AI workflow, toolbar, shortcuts). |
| **[LLM Onboarding](public/documentation/OnboardLLM.md)** | Prompt you can paste into ChatGPT/Claude/etc. so they emit valid graph JSON. |
| **[GraphCRUD API](components/GraphEditor/GraphAPIdocumentation.md)** | Reference for `window.graphAPI` with create/update/delete/find examples. |
| **[NodeGraph README](components/NodeGraph/README.md)** | Deep dive into the layered renderer (EdgeLayer, HandleLayer, PanZoomLayer). |
| **[Node Logic System](.github/NodeLogicSystem.md)** | Schema + execution model for ports, edges, and trigger/data flow. |
| **[Copilot Instructions](.github/copilot-instructions.md)** | Contributor guidelines and expectations for AI/code reviewers. |

---

## Use Cases

- **Visual Thinking**: Brainstorm and organize ideas with AI assistance
- **Knowledge Graphs**: Map concepts, relationships, and hierarchies
- **Project Planning**: Create timelines, workflows, and org charts
- **Learning**: Build diagrams to understand complex topics
- **Research**: Organize notes, citations, and connections
- **Storytelling**: Map narrative structures and character relationships

---

## Contributing

This is a personal project, but feedback and suggestions are welcome! Open an issue to discuss potential changes or improvements.

---

## License

MIT License - see LICENSE file for details

---

## Acknowledgments

Built with:

- React & Next.js
- Material-UI
- GSAP Animation
- react-markdown
- react-window
- emoji-picker-react

Special thanks to the AI assistants (ChatGPT, Claude) that helped iterate on this project's design and features.

---

## Contact

Questions or feedback? Open an issue or reach out via the repo.

**Live Demo**: [cpwith.me](https://cpwith.me)

---
## Source: `components/Browser/README.md`

# Header components

## Overview

This folder contains the top-level header and theme controls for the NodeGraph editor. It provides the application header bar, a theme selector group, and a theme drawer for advanced theme settings.

## Files

- `Header.js` — The main header bar component. Typically contains the app title, primary actions, and theme controls.
- `ThemeButtonGroup.js` — Compact button group for switching between predefined themes (light/dark/custom). Use for quick theme toggles.
- `ThemeDrawer.js` — Drawer UI that exposes advanced theme settings and preferences. Can be used to adjust palette colors, toggles, and persist theme choices.
- `themes.js` — Defines available theme presets and utilities for creating MUI theme objects.

## Usage

- Import `Header.js` into your app layout and place it at the top of the page. The header reads and mutates theme via context or props depending on your app setup.
- `ThemeButtonGroup` exposes simple callbacks (`onChange`) to switch theme presets.
- `ThemeDrawer` can be toggled from `Header` and provides finer-grained theme customization.

## Extension points

- Add new theme presets in `themes.js` and wire them into `ThemeButtonGroup`.
- Persist theme changes to `localStorage` or user settings in `settingsManager`.
- Add accessibility attributes and keyboard shortcuts to Header controls.

## Notes

- Keep MUI theme creation centralized in `themes.js` to ensure consistent palette and typography across the app.
- When adding new controls to the header, use small, focused components and register actions via the GraphEditor `eventBus` where appropriate.

---
## Source: `components/GraphEditor/README.md`

# Graph Editor

## Overview

This folder implements a highly-interactive node/edge graph editor built with React and Material-UI (MUI). The editor supports pan/zoom, layered rendering (nodes, edges, ports), draggable nodes, resizable nodes, and an event bus for cross-component communication.

## Purpose

Use this editor to visually build and manipulate node graphs (workflows, diagrams, outlines). The components are modular so you can extend node and edge types, add UI panels, or hook in scripting and automation.

## Key Concepts

- Nodes: Rendered via per-type node components (`DefaultNode`, `MarkdownNode`, `DivNode`, `SvgNode`, `FixedNode`). Nodes hold layout (position, width, height) and data (memo, html, svg, text).
- Edges: Simple connection objects with type and optional styling.
- Layers: Rendering is split into layers (Pan/Zoom, EdgeLayer, NodeLayer, HandleLayer) for clarity and performance.
- Event Bus: A lightweight pub/sub (`eventBus`) is used for decoupled events like selection, resizing, node/edge lifecycle events.
- Hooks: Custom hooks encapsulate pan/zoom, editor state, selection, history, and keyboard shortcuts.

## Where to look (key files)

- `GraphEditor.js` — Main orchestrator and integration point.
- `nodeTypeRegistry.js` — Maps node types to components.
- `DefaultNode.js` — Base node UI (resizing, labels, styles).
- `DivNode.js`, `MarkdownNode.js`, `SvgNode.js`, `FixedNode.js` — Built-in node implementations.
- `eventBus.js` — Pub/sub used throughout the editor.
- `hooks/` — Reusable hooks (useGraphEditorState, useGraphHistory, usePanZoom, useSelection, etc.).
- `components/` — UI panels (NodePropertiesPanel, EdgePropertiesPanel, GroupManager, Toolbar, etc.).
- `handlers/` — GraphEditor event and paste handlers.

## Node types and behaviour

- `default`: Resizable node with label and optional memo icons. Emits `nodeResize`/`nodeResizeEnd` events when resized.
- `fixed`: Same as default but not resizable.
- `markdown`: Renders stored memo as Markdown (safe, read-only display).
- `div`: Renders HTML or memo content (uses sanitization and markdown rendering where appropriate).
- `svg`: Renders raw SVG from `node.data.svg`.

## Security & sanitization

Nodes that render raw HTML or Markdown use rehype/remark sanitization to prevent XSS. The sanitize schema can be extended where needed (e.g., allow a custom protocol). Avoid storing executable scripts in node content — the application intentionally strips JS/event attributes.

## Resizing & Persistence

`DefaultNode` exposes an interactive resize handle. During resize it emits `nodeResize` events with width/height (in node space). The GraphEditor (or host) should listen and persist size changes (typically on `nodeResizeEnd`).

## Extending the editor

- Add a node type: create a component under `Nodes/`, register it in `nodeTypeRegistry.js`, and follow the existing props/positioning conventions.
- Add a new panel: add a component in `components/` and wire it into `GraphEditor.js` or the `Toolbar`.
- Customize appearance: `DefaultNode` uses MUI theme and supports gradients/colors via `node.color`.

## Scripting & automation (design notes)

For user scripts that operate on graphs, prefer a sandboxed runner (iframe or web worker) exposing a limited API such as `getNodes`, `updateNode`, `createEdge`, `deleteNode`, `on(event)`. Host-side validation, timeouts, and dry-run modes are recommended to keep scripts safe and reversible.

## Developer notes

- Use the provided hooks for editor state and to avoid duplicating logic.
- `nodeRefs` is a `Map`-like ref that registers node DOM elements for measurements and port positioning.
- Keep heavy DOM parsing (markdown/html) memoized or performed at save-time to avoid render-time performance hits.

## Troubleshooting

- If links or HTML render as plain text, confirm the node type and that content is stored in `node.data.html` or `node.data.memo`.
- If sanitization strips needed attributes, extend the sanitize schema in the node component carefully.

## License & Contributing

This project follows the repository's standard license. Contributions are welcome — open issues for feature requests or submit PRs for bug fixes and new node types.

---
## Source: `components/GraphEditor/components/README.md`

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
  - Panel for editing group properties: label, style, visibility, and node membership. Allows adding/removing nodes and ungrouping.

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
  - Main panel for editing node, edge, and group properties. Consolidates all property editing into a single UI.

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

---
## Source: `components/GraphEditor/Nodes/README.md`

# Nodes — README

## Overview

This folder contains the built-in node components used by the graph editor. Each node component renders a specific kind of content and follows the same positioning/props conventions so they can be used interchangeably via the nodeType registry.

## Node components

- **DefaultNode**

  - Purpose: General-purpose, resizable node with label, memo/link indicators, and built-in styling derived from the MUI theme.
  - Key features: resize handle (emits `nodeResize`/`nodeResizeEnd` via `eventBus`), label rendering, optional memo/link icons, theme-aware color/gradient support.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `children`, `draggingHandle`, `nodeRefs`.
  - Notes: Emits resize events; ensure the host persists `width`/`height` on `nodeResizeEnd`.

- **DivNode**

  - Purpose: Render arbitrary HTML or memo content inside a resizable DefaultNode shell.
  - Key features: Markdown rendering (ReactMarkdown + remark-gfm), optional raw HTML fragments rendered via `rehypeRaw` + `rehypeSanitize`, link handling via `TlzLink`, inherits resizing/interaction from `DefaultNode`.
  - Props: same as DefaultNode plus `node.data.html` / `node.data.memo`.
  - Security: HTML content is sanitized; the sanitize schema can be extended if specific tags/attributes are required.

- **FixedNode**

  - Purpose: Like DefaultNode but not resizable (fixed size). Useful for icons, small labels, or items that should remain stable.
  - Key features: same visual style as DefaultNode but no resize handle and no emitted resize events.
  - Props: same basic props as DefaultNode.

- **MarkdownNode**

  - Purpose: Display-only node optimized for rich content and documentation. Renders `node.data.memo` as markdown in a larger default size.
  - Key features: Markdown rendering with remark/rehype, read-only (no resize handle by default in this implementation), theme-aware styling for blackboard/whiteboard mode.
  - Props: same standard props; content driven primarily by `node.data.memo`.

- **SvgNode**

  - Purpose: Render an SVG graphic provided in `node.data.svg`. Use for icons, small diagrams, or visual indicators.
  - Key features: Renders raw SVG markup (be careful to sanitize or validate SVG input), responds to theme colors if implemented.
  - Props: same standard props plus `node.data.svg`.

- **APINode**

  - Purpose: Make HTTP requests to APIs and display the response.
  - Key features: URL, method, headers, and body input; fetch/cancel buttons; displays status and response preview; emits output and persists state via eventBus.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `nodeRefs`.

- **CounterNode**

  - Purpose: Simple counter with increment, decrement, and reset controls.
  - Key features: Displays count, step, min/max limits, emits value changes via eventBus, range indicator.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `nodeRefs`.

- **DelayNode**

  - Purpose: Delays output after receiving input, useful for timing and scheduling.
  - Key features: Configurable delay, queueing, manual trigger/cancel, status display, emits output and persists state via eventBus.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `nodeRefs`.

- **GateNode**

  - Purpose: Logical gate (AND, OR, NOT, XOR, NAND, NOR) for boolean operations.
  - Key features: Editable inputs, operator selection, output display, emits output and persists state via eventBus.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `nodeRefs`.

- **ScriptNode**

  - Purpose: Run user-defined scripts from a library and display results.
  - Key features: Script selection, run/dry-run, mutation control, result display, emits output and persists state via eventBus.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `nodeRefs`.

- **TimerNode**

  - Purpose: Timer with start, pause, and stop controls, displays elapsed time.
  - Key features: Time formatting, control buttons, status indicator, emits output and persists state via eventBus.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `nodeRefs`.

- **ToggleNode**

  - Purpose: Boolean toggle switch with ON/OFF states.
  - Key features: Toggle button, state indicator, emits value changes via eventBus.
  - Props: `node`, `pan`, `zoom`, `style`, `isSelected`, `onMouseDown`, `onClick`, `onDoubleClick`, `nodeRefs`.

## Common conventions

- Positioning: All nodes expect `node.position {x,y}` in graph coordinates. Node components apply the same pan/zoom transforms and center the node on that position.
- Sizing: `width`/`height` are stored on node (user-resizable for DefaultNode). Default fallback sizes exist when `width`/`height` are missing.
- Interaction: Nodes must call `eventBus` events for selection and pointer interactions (`nodeMouseDown`, `nodeClick`, `nodeMouseEnter`, `nodeMouseLeave`) to keep editor state in sync.
- `nodeRefs`: Many nodes register their DOM ref in `nodeRefs` (a Map-like ref) so the editor can measure nodes for edge and port placement.
- Sanitization: Any node type that renders HTML or SVG should sanitize input to prevent XSS. Default implementations use rehype/remark sanitizers; extend cautiously.

## Extending nodes

- To add a new node type, create a component in this folder, follow the props/positioning conventions, and register it in the nodeType registry (`components/GraphEditor/nodeTypeRegistry.js`).
- Prefer composing with `DefaultNode` for consistent sizing, resizing, and interaction behavior.
- If you need custom resize behavior (edge-resize, aspect-locking), implement the handlers and emit `nodeResize` events consistent with `DefaultNode` so the rest of the system can react.

## Troubleshooting

- No content shown: verify content is stored in `node.memo`, `node.data.memo`, `node.data.html`, or `node.data.text` depending on the node type.
- Links render as plain text: ensure markdown/html rendering is enabled for the node type and that rehype/remark plugins are configured.
- Resizing not persisted: make sure GraphEditor listens for `nodeResizeEnd` and updates `node.width`/`node.height` in state.

---
## Source: `components/GraphEditor/Scripting/README.md`

# Scripting Features — README

## Overview

The scripting system lets you write, run, and manage custom JavaScript scripts that interact with your node graph. Scripts can automate tasks, analyze graph data, create or update nodes/edges, and more—all from a secure, sandboxed environment.

## ScriptPanel

- The ScriptPanel is a draggable, resizable editor for managing your script library.
- You can create, edit, duplicate, delete, import, and export scripts.
- Each script has a name, tags, and source code.
- Scripts are persisted in localStorage and can be imported/exported as JSON.
- You can run scripts directly from the panel, with options for dry run and mutation control.
- Results, errors, and proposed changes are displayed after execution.

## ScriptRunner

- ScriptRunner securely executes scripts in a sandboxed iframe.
- Scripts run asynchronously and have access to a limited API for interacting with the graph.
- The runner prevents scripts from accessing the main app’s internals or the DOM.
- Script execution is limited by a timeout (default: 8 seconds).

## Script API

Scripts receive an `api` object with the following methods:
- `api.getNodes()` — Returns an array of all nodes.
- `api.getNode(id)` — Returns a node by ID.
- `api.getEdges()` — Returns an array of all edges.
- `api.createNode(data)` — Creates a new node.
- `api.updateNode(id, patch)` — Updates a node’s data.
- `api.deleteNode(id)` — Deletes a node.
- `api.createEdge(data)` — Creates a new edge.
- `api.deleteEdge(id)` — Deletes an edge.
- `api.log(level, message)` — Logs a message (level: info, warn, error).

All API methods are asynchronous and should be called with `await` inside your script.

### Safety Limits

- Each script run is isolated with a one-time capability token. Messages that do not include this token are ignored.
- Scripts are limited to a maximum of 200 RPC invocations per run and a bounded number of mutation calls. Hitting the limit aborts execution with an error.
- When a script exceeds the configured timeout (default: 8 seconds), the runner iframe is recycled to ensure no background work continues.
- API responses are deep-cloned before being returned so scripts cannot mutate shared state accidentally.

## Example Script

```js
// Count all nodes in the graph
const nodes = await api.getNodes();
return { count: nodes.length };
```

## Proposals and Mutations

- Scripts can return proposals for changes (e.g., new nodes, updates).
- If a script returns proposals, you’ll see an “Apply Changes” button in the ScriptPanel.
- You can choose to apply or cancel these changes.
- The “Allow mutations” option controls whether scripts can make changes directly.
- “Dry run” mode lets you preview results without applying changes.

## Tips & Troubleshooting

- Use `await` for all API calls.
- Scripts run in a sandbox; no access to DOM or global variables.
- If a script times out or fails, check for infinite loops or missing awaits.
- Use tags to organize your script library.
- Export your library regularly for backup.

## Keyboard Shortcuts

- Ctrl+S: Save script
- Ctrl+Enter: Run script

## Security

- Scripts are executed in a sandboxed iframe for safety.
- Only the provided API is available; scripts cannot access the main app or browser environment.
- Every run uses a short-lived token, per-run operation quotas, and enforced timeouts.

---
For more details, see ScriptPanel.js and ScriptRunner.js in the Scripting folder.

---
## Source: `components/NodeGraph/README.md`

# NodeGraph Component

A production-grade, interactive node/edge graph visualization component built with React, Canvas API, and Material-UI. Designed for high-performance rendering of large graphs (1000+ nodes) with smooth drag-and-drop, pan/zoom, and extensible node/edge types.

## Architecture

**Layered rendering system** for optimal performance:
- **EdgeLayer** (Canvas): High-performance edge rendering with bezier curves, hit detection, and label support
- **HandleLayer** (Canvas): Port connection point visualization with proximity-based activation and drag preview
- **NodeLayer** (React/DOM): Interactive node components with selection, hover, and resize support
- **GroupLayer** (SVG): Visual grouping with auto-calculated bounds, collapse/expand, and drag-to-move
- **PanZoomLayer** (SVG overlay): Unified viewport transform with mouse/touch support and marquee selection

**Event Bus**: Decoupled cross-layer communication via `eventBus.js` for clean separation of concerns.

**Port System**: Context-aware port positioning with real-time updates during drag operations (no React re-renders).

## Features

### Core Functionality
- ✅ **Drag & Drop**: Smooth 60fps node dragging with RAF batching and DOM transform manipulation
- ✅ **Pan & Zoom**: Mouse wheel zoom, drag-to-pan, with HiDPI canvas support
- ✅ **Multi-Select**: Marquee selection (Shift+drag) with bulk operations
- ✅ **Undo/Redo**: Full history management with debounced batching
- ✅ **Clusters**: Visual node grouping with collapse/expand and drag-to-move-all
- ✅ **Edge Types**: Straight, curved, child/parent (vertical), peer (horizontal), orthogonal
- ✅ **Port Animation**: Smooth extension/retraction with progress-based rendering
- ✅ **Accessibility**: ARIA labels, keyboard navigation (Tab, Ctrl+Arrows), focus management

### Performance Optimizations
- Canvas rendering for edges and ports (not React)
- Transient DOM transforms during drag (React state only on drop)
- Virtualized node/group lists for large graphs
- RAF-batched redraws and debounced state updates
- Proximity-based port sensor activation (pointer-events optimization)

### Customization
- Theme-aware (inherits MUI theme or accepts `theme` prop)
- Extensible node types via `nodeTypes` prop
- Custom edge styles (color, width, dash patterns, labels)
- Resizable nodes with drag ports
- Markdown support in node memos

## Props

### Required
- **`nodes`** (array): Node objects with:
  ```javascript
  {
    id: string,              // Unique identifier
    label: string,           // Display text
    position: { x, y },      // World coordinates
    width: number,           // Optional, defaults to 60
    height: number,          // Optional, defaults to 60
    type: 'default' | string, // Node type for custom rendering
    data: {                  // Optional metadata
      memo: string,          // Markdown-formatted notes
      link: string,          // URL link
    }
  }
  ```

- **`edges`** (array): Edge objects with:
  ```javascript
  {
    id: string,              // Optional, auto-generated if missing
    source: string,          // Source node id
    target: string,          // Target node id
    type: 'curved' | 'straight' | 'child' | 'parent' | 'peer',
    label: string,           // Optional display label
    style: {                 // Optional styling
      color: string,
      width: number,
      dash: [number, number],
    }
  }
  ```

### Optional
- **`clusters`** (array): Group objects for visual organization
- **`edgeTypes`** (object): Edge type configuration with style defaults
- **`nodeTypes`** (object): Custom node component mapping
- **`selectedNodeId`** (string): Currently selected node
- **`selectedEdgeId`** (string): Currently selected edge
- **`hoveredNodeId`**, **`hoveredEdgeId`** (string): Hover state
- **`onNodeClick`**, **`onEdgeClick`**, **`onBackgroundClick`** (functions): Event handlers
- **`onNodeMove`**, **`onNodeDragStart`**, **`onNodeDragEnd`** (functions): Drag callbacks
- **`pan`**, **`zoom`**, **`setPan`**, **`setZoom`**: Viewport state (or use internal state)
- **`draggingInfoRef`**: Ref for tracking active drag operations
- **`draggingGroupId`**, **`groupDragOffset`**: Group drag state

## Example Usage

```jsx
import NodeGraph from './components/NodeGraph/NodeGraph';
import DefaultNode from './components/NodeGraph/nodes/DefaultNode';

const edgeTypes = {
  child: { style: { color: '#1976d2' } },
  peer: { style: { color: '#9c27b0' } },
};

const nodeTypes = {
  default: DefaultNode,
  // Add custom node types here
};

<NodeGraph
  nodes={nodes}
  edges={edges}
  clusters={clusters}
  edgeTypes={edgeTypes}
  nodeTypes={nodeTypes}
  selectedNodeId={selectedNodeId}
  onNodeClick={handleNodeClick}
  onEdgeClick={handleEdgeClick}
  onNodeMove={handleNodeMove}
  pan={pan}
  zoom={zoom}
  setPan={setPan}
  setZoom={setZoom}
/>
```

## Event Bus

Use the event bus for cross-component communication:

```javascript
import eventBus from './components/NodeGraph/eventBus';

// Emit events
eventBus.emit('nodeClick', { nodeId });
eventBus.emit('edgeHover', { edgeId });

// Listen to events
eventBus.on('handleDrop', ({ sourceNode, targetNode, edgeType }) => {
  // Create new edge
});
```

**Available events**: `nodeClick`, `edgeClick`, `backgroundClick`, `nodeHover`, `edgeHover`, `handleDragStart`, `handleDragEnd`, `handleDrop`, `nodeProximity`

## Extending NodeGraph

### Custom Node Types
Create a custom node component and register it:

```jsx
// MyCustomNode.js
export default function MyCustomNode({ node, isSelected, isHovered, theme }) {
  return (
    <div style={{ 
      width: node.width, 
      height: node.height,
      backgroundColor: theme.palette.primary.main 
    }}>
      {node.label}
    </div>
  );
}

// Register it
const nodeTypes = { custom: MyCustomNode };
<NodeGraph nodeTypes={nodeTypes} nodes={[{ type: 'custom', ... }]} />
```

### Custom Edge Styles
Configure edge appearance via `edgeTypes`:

```javascript
const edgeTypes = {
  important: { 
    style: { 
      color: '#ff0000', 
      width: 3,
      dash: [10, 5],
    } 
  },
};
```

## Theming

NodeGraph inherits MUI theme via `useTheme()`:
- **Palette**: Node backgrounds, edge colors, text colors
- **Dark mode**: Automatically adjusts based on `theme.palette.mode`
- **Custom colors**: Use `theme.palette.primary`, `secondary`, etc.

## Performance Notes

- **Large graphs**: Tested with 1000+ nodes, 2000+ edges
- **Canvas rendering**: Edges/ports drawn on canvas (not DOM)
- **RAF batching**: Drag updates batched via requestAnimationFrame
- **Virtualization**: Node/group list panels use react-window
- **HiDPI support**: Canvas scaled for retina displays
- **Lazy rendering**: Ports only rendered when near nodes

## Files

### Core Components
- `NodeGraph.js` - Main orchestrator, state management, event coordination
- `EdgeLayer.js` - Canvas-based edge rendering with hit detection
- `NodeLayer.js` - React-based node rendering with drag/resize
- `HandleLayer.js` - Canvas-based port rendering with proximity activation
- `GroupLayer.js` - SVG-based group visualization with bounds calculation
- `PanZoomLayer.js` - Viewport transform and marquee selection

### Utilities
- `eventBus.js` - Event emitter for cross-component communication
- `canvasUtils.js` - Canvas helpers (HiDPI setup, context management)
- `edgeUtils.js` - Edge path calculation (bezier, straight, orthogonal)
- `dragHandlers.js` - Drag event handlers with RAF batching
- `marqueeSelection.js` - Rectangular selection logic
- `historyManager.js` - Undo/redo state management

## Best Practices

1. **Use the event bus** for cross-layer communication (don't pass callbacks through 5 layers)
2. **Keep state in GraphEditor** (or parent), NodeGraph is a presentation component
3. **Batch updates** - Use history manager's `saveToHistory()` instead of updating on every keystroke
4. **Clean up listeners** - Always remove global mouse/wheel listeners on unmount
5. **Theme-aware colors** - Use `theme.palette` instead of hardcoded hex values
6. **Refs for real-time updates** - Use refs for drag offsets that change 60fps, React state for final positions

# NodeGraph Overview

This folder contains the core rendering and interaction logic for the node/edge graph: pan/zoom, layered rendering (canvas/SVG/DOM), selection, port/edge dragging, marquee selection, and event dispatching.

## Primary responsibilities

- Render nodes and edges efficiently using separate layers (NodeLayer, EdgeLayer, HandleLayer, PanZoomLayer).
- Manage user interactions: dragging nodes, creating/dragging edges, resizing nodes, marquee multi-select, and keyboard shortcuts.
- Provide a stable, testable event bus and helper hooks for other components to subscribe to editor events.

## Key files

- `NodeGraph.js` — Main orchestrator: composes layers and wires hooks and event handlers.
- `NodeLayer.js` — Renders node components and manages node DOM refs for measurement and hit-testing.
- `EdgeLayer.js` — Canvas/SVG drawing for edges with performance-oriented utilities.
- `HandleLayer.js` — Renders ports and manages drag interactions for connections.
- `PanZoomLayer.js` — Provides pan/zoom transforms and pointer handling.
- `eventBus.js` — Pub/sub used for decoupled communication between nodes, UI panels, and other systems.
- `utils/coords.js`, `edgeUtils.js`, `dragUtils.js` — Geometry and interaction utilities used across the graph.

## Hooks

- `usePanZoom` — Manage viewport pan/zoom state and provides helper transforms to convert coordinates between graph space and screen space.
- `useCanvasSize` — High-DPI aware canvas sizing helpers.
- `useNodeHover`, `useEdgeHover`, `useHandleProgress` — Encapsulate hover/animation logic.
- `useNodeGraphEvents`, `useEventBusHandlers` — Register and handle higher-level editor events.

## Extension points

- Register new node types in the nodeType registry (`components/GraphEditor/nodeTypeRegistry.js`).
- Add custom edge styles by extending `edgeStyleUtils` and passing types into the `EdgeLayer`.
- Subscribe to events via `eventBus` to implement custom tooling (pan-to-node, selection sync, telemetry).

## Performance considerations

- Use canvas for large numbers of edges; keep node DOMs lightweight.
- Avoid heavyweight parsing (markdown/html) in render loop — do it on save or memoize results.
- Use `requestAnimationFrame` for animations and batch DOM reads/writes.

## Security & sanitization

- Node content that renders HTML/Markdown is sanitized (rehype/remark). Do not allow raw scripts in node content.

## Troubleshooting

- If hit-testing seems off, check nodeRefs registration and pan/zoom transforms.
- If edges look clipped or blurry, verify canvas scaling via `useHiDPICanvas`.

## Contributing

Follow existing hooks and utilities; register new functionality through the event bus and nodeType registry for minimal coupling.

---

_End of compendium._
