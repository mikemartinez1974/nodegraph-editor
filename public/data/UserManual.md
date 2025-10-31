# Copy/Paste w/ Me - User Manual

Welcome to **Copy/Paste w/ Me**, your interactive graph editor for creating, editing, and visualizing ideas. This manual will guide you through the app’s features, helping you make the most of its powerful tools.

---

## What Is This App?

**Copy/Paste w/ Me** is a visual graph editor designed to work seamlessly with AI assistants (e.g., ChatGPT, Claude). Describe your ideas to an AI, paste the generated JSON into the app, and watch your graph come to life.

### Key Features
- **Interactive Graph Editing**: Add, edit, and connect nodes and edges.
- **AI Integration**: Paste AI-generated JSON to create graphs instantly.
- **Scripting**: Automate tasks and analyze graphs with custom scripts.
- **Customizable Nodes and Edges**: Use different types, styles, and properties.
- **Groups**: Organize nodes into collapsible groups.
- **Advanced Layouts**: Auto-layout options for clean and professional graphs.

---

## Quick Start

### Step 1: Set Up Your Workspace
- Open this app and your AI chat side by side.
- This makes it easy to copy/paste between them.

### Step 2: Onboard Your AI
1. Click the **📋 Onboard LLM** button in the toolbar.
2. Paste the onboarding text into your AI chat.
3. The AI now knows how to create graphs for you!

### Step 3: Ask for a Graph
Tell your AI what you want:
- "Create a graph showing the water cycle."
- "Make an org chart for a startup."
- "Visualize the steps in making coffee."

### Step 4: Paste & Watch Magic Happen
1. Copy the AI's JSON response.
2. Click anywhere in this app.
3. Press **Ctrl+V** or click the **📋 Paste** button.
4. Your graph appears instantly!

---

## Toolbar Overview

The toolbar provides quick access to all major features. Here’s what each button does:

### Core Actions
- **📋 Onboard LLM**: Copy the AI setup guide to clipboard.
- **📋 Paste**: Paste AI-generated JSON or create a node from plain text.
- **📋 Copy Selected**: Copy selected nodes and edges.
- **📋 Copy Graph**: Copy the entire graph as JSON.
- **📖 Copy Manual**: Copy this user manual to clipboard.
- **➕ Add Node**: Create a blank node manually.
- **📑 Node List**: Toggle the node list panel.
- **📁 Group List**: Toggle the group list panel.
- **🗑️ Delete**: Remove selected items.
- **👎 Clear Graph**: Delete everything in the graph.
- **💾 Save**: Download your graph as a .json file.
- **📂 Load**: Open a saved graph from your computer.

### History Controls
- **↩️ Undo**: Revert the last action.
- **↪️ Redo**: Redo the last undone action.

### Layout and Modes
- **✏️ Manual Mode**: Default mode for editing and arranging nodes.
- **🧭 Nav Mode**: Explore the graph without editing.
- **🔧 Auto-Layout**: Automatically arrange nodes for a clean layout.

---

## Scripting Features

### ScriptPanel
- Write, run, and manage custom scripts.
- Automate tasks, analyze graph data, and create nodes/edges programmatically.
- Save, import, and export scripts.

### ScriptRunner
- Executes scripts in a secure, sandboxed environment.
- Provides an API for interacting with the graph:
  - `api.getNodes()`, `api.getEdges()`
  - `api.createNode(data)`, `api.createEdge(data)`
  - `api.updateNode(id, patch)`, `api.deleteNode(id)`

---

## Node, Edge, and Group Properties

### PropertiesPanel
- Edit properties for nodes, edges, and groups.
- Change labels, colors, positions, sizes, and more.
- Use the advanced options for gradients, animations, and custom styles.

### Node Types

This app supports a variety of node types, each designed for specific use cases. Below is an overview of the available node types:

- **DefaultNode**
  - General-purpose, resizable node with label, memo/link indicators, and built-in styling derived from the MUI theme.
  - Key Features: Resize handle, label rendering, optional memo/link icons, theme-aware color/gradient support.

- **DivNode**
  - Renders arbitrary HTML or memo content inside a resizable DefaultNode shell.
  - Key Features: Markdown rendering, optional raw HTML fragments, inherits resizing/interaction from DefaultNode.

- **FixedNode**
  - Like DefaultNode but not resizable (fixed size). Useful for icons, small labels, or items that should remain stable.

- **MarkdownNode**
  - Optimized for rich content and documentation. Renders `node.data.memo` as markdown in a larger default size.
  - Key Features: Markdown rendering with remark/rehype, theme-aware styling for blackboard/whiteboard mode.

- **SvgNode**
  - Renders an SVG graphic provided in `node.data.svg`. Use for icons, small diagrams, or visual indicators.

- **APINode**
  - Makes HTTP requests to APIs and displays the response.
  - Key Features: URL, method, headers, and body input; fetch/cancel buttons; displays status and response preview.

- **CounterNode**
  - Simple counter with increment, decrement, and reset controls.
  - Key Features: Displays count, step, min/max limits, emits value changes via eventBus.

- **DelayNode**
  - Delays output after receiving input, useful for timing and scheduling.
  - Key Features: Configurable delay, queueing, manual trigger/cancel, status display.

- **GateNode**
  - Logical gate (AND, OR, NOT, XOR, NAND, NOR) for boolean operations.
  - Key Features: Editable inputs, operator selection, output display.

- **ScriptNode**
  - Runs user-defined scripts from a library and displays results.
  - Key Features: Script selection, run/dry-run, mutation control, result display.

- **TimerNode**
  - Timer with start, pause, and stop controls, displays elapsed time.
  - Key Features: Time formatting, control buttons, status indicator.

- **ToggleNode**
  - Boolean toggle switch with ON/OFF states.
  - Key Features: Toggle button, state indicator, emits value changes via eventBus.

### Edge Types

This app supports a variety of edge types, each designed for specific relationships and visual styles. Below is an overview of the available edge types:

- **Child**
  - Description: Parent-child hierarchical relationship.
  - Key Features: Curved, vertical direction, arrow at the end.

- **Parent**
  - Description: Reverse parent relationship.
  - Key Features: Curved, vertical direction, arrow at the start.

- **Peer**
  - Description: Peer-to-peer relationship.
  - Key Features: Curved, horizontal direction, dashed line, no arrow.

- **Data Flow**
  - Description: Data flowing from source to target.
  - Key Features: Curved, gradient color, arrow at the end, animated flow.

- **Dependency**
  - Description: Dependency relationship.
  - Key Features: Straight, dashed line, arrow at the end.

- **Reference**
  - Description: Reference or link.
  - Key Features: Curved, dashed line, arrow at the end.

- **Bidirectional**
  - Description: Two-way relationship.
  - Key Features: Curved, arrows at both ends.

- **Weak Link**
  - Description: Weak or optional relationship.
  - Key Features: Curved, dashed line, low opacity, no arrow.

- **Strong Link**
  - Description: Strong or required
- **Use Markdown Nodes**: Add formatted text for instructions or descriptions.
- **Group Related Nodes**: Keep your graph organized.
- **Save Often**: Download your graph regularly to avoid data loss.
- **Experiment Freely**: Undo (Ctrl+Z) is your friend!

---

### Groups
- Organize nodes into collapsible groups.
- Edit group labels, styles, and visibility.

---

## Keyboard Shortcuts

- **Ctrl+X**: Cut selected nodes/edges.
- **Ctrl+C**: Copy selected nodes/edges.
- **Ctrl+V**: Paste JSON or text.
- **Ctrl+Z**: Undo.
- **Ctrl+Y**: Redo.
- **Delete**: Remove selected items.
- **Scroll**: Zoom in/out.
- **Ctrl+Arrows**: Move selected nodes (1px).
- **Ctrl+Shift+Arrows**: Move selected nodes (10px).

---

## Troubleshooting

### Common Issues
- **Invalid JSON**: Ensure the JSON is properly formatted.
- **Overlapping Nodes**: Ask the AI to "spread them out more."
- **Graph Not Visible**: Zoom out or center the graph.
- **Paste Not Working**: Ensure you copied the full JSON block.

---

## Pro Tips

- **Start Small**: Begin with 5-10 nodes and expand.
- **Use Markdown Nodes**: Add formatted text for instructions or descriptions.
- **Group Related Nodes**: Keep your graph organized.
- **Save Often**: Download your graph regularly to avoid data loss.
- **Experiment Freely**: Undo (Ctrl+Z) is your friend!

---

## Examples

### Example 1: Solar System
**Prompt:** "Create a graph showing the solar system with the sun and 3 planets."

### Example 2: Project Timeline
**Prompt:** "Create a timeline for a software project from start to launch."

### Example 3: Educational Diagram
**Prompt:** "Create a graph explaining photosynthesis with a markdown node for details."

---

**Happy graphing!** 🎨📊✨