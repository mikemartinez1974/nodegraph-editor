# Copy/Paste w/ Me - Interactive Node Graph Editor

A production-grade, AI-first visual graph editor built with React, Next.js, and Material-UI. Design, organize, and think visually by collaborating with AI assistants (ChatGPT, Claude, Grok, etc.) through a simple copy/paste workflow.

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
- ✅ **Groups**: Visual node grouping with collapse/expand and drag-to-move-all
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
- **Group List**: Browse and manage all groups
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
- **Performance**: Handles 1000+ nodes smoothly with canvas rendering and virtualization

---

## Architecture

### Layered Rendering
- **EdgeLayer** (Canvas): High-performance bezier curve rendering with hit detection
- **HandleLayer** (Canvas): Connection points with proximity-based activation
- **NodeLayer** (React/DOM): Interactive node components with selection and hover
- **GroupLayer** (SVG): Visual grouping with auto-calculated bounds
- **PanZoomLayer** (SVG): Unified viewport transform with marquee selection

### Event System
- **Event Bus**: Decoupled cross-component communication (`eventBus.js`)
- **Handle System**: Context-aware positioning with real-time drag updates (no React re-renders)
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

See the [User Manual](public/data/UserManual.md) for full documentation.

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

```
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
│   │   ├── PropertiesPanel.js      # Unified properties panel for nodes, edges, and groups
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
│       ├── HandleLayer.js          # Canvas handle rendering
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
  type: "curved"
});

// Get stats
window.graphAPI.getStats();
// { nodeCount: 10, edgeCount: 15, ... }
```

See [GraphAPIdocumentation.md](components/GraphEditor/GraphAPIdocumentation.md) for full API reference.

---

## Theming

29 built-in themes with dark/light mode support:

**Light Themes**: Ocean, Sunset, Forest, Lavender, Coffee, Desert, Emerald, Ruby, Sapphire, Retro, Arctic, Ice, Rose Gold, Jungle, Coral Reef, Peach, Sunrise, Candy

**Dark Themes**: Midnight, Neon, Cyberpunk, Flame, Noir, Twilight, Steel, Galaxy

**Neutral**: Vintage

Custom themes can be added in `components/Header/themes.js`.

---

## Performance Notes

- **Large Graphs**: Tested with 1000+ nodes, 2000+ edges
- **Canvas Rendering**: Edges/handles drawn on canvas (not DOM)
- **RAF Batching**: Drag updates batched via requestAnimationFrame
- **Virtualization**: Node/group list panels use react-window
- **HiDPI Support**: Canvas scaled for retina displays
- **Lazy Rendering**: Handles only rendered when near nodes

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

- **[User Manual](public/data/UserManual.md)**: Complete guide for end users
- **[LLM Onboarding](public/data/OnboardLLM.md)**: Guide for AI assistants
- **[GraphCRUD API](components/GraphEditor/GraphAPIdocumentation.md)**: Programmatic API reference
- **[NodeGraph README](components/NodeGraph/README.md)**: Component architecture
- **[Copilot Instructions](.github/copilot-instructions.md)**: Development guidelines

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
