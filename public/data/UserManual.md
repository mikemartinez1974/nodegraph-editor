# Copy/Paste w/ Me - User Manual

Welcome! This guide will help you master the graph editor and work efficiently with AI to create amazing visual graphs, create content, understand complex topics, and generally help you *think*.

---

## What Is This App?

**Copy/Paste w/ Me** is a visual graph editor designed for working with AI assistants (ChatGPT, Claude, Grok, etc.). Instead of manually clicking to build graphs, you describe what you want to an AI, and paste the results directly into the app.

### How It Works
1. **You describe** what you want: "Create a graph about solar system planets"
2. **AI generates** JSON graph data for you
3. **You paste** the JSON into this app (Ctrl+V)
4. **Graph appears** instantly - edit, refine, repeat!

---

## Quick Start (Your First Graph in 60 Seconds!)

### Step 1: Set Up Your Workspace
- **Split your screen**: This app on one side, AI chat on the other
- This lets you copy/paste back and forth easily

### Step 2: Onboard Your AI
1. Click the **📋 Onboard LLM** button (first button on the left in the toolbar)
2. Paste that text into your AI chat
3. The AI now knows how to create graphs for you!

### Step 3: Ask for a Graph
Tell your AI what you want:
- "Create a graph showing the water cycle"
- "Make an org chart for a startup"
- "Visualize the steps in making coffee"

### Step 4: Paste & Watch Magic Happen
1. Copy the AI's JSON response
2. Click anywhere in this app
3. Press **Ctrl+V** (or click the **📋 Paste** button, second from left in toolbar)
4. Your graph appears instantly!

---

## Your Toolbar (All the Buttons Explained!)

The main toolbar appears at the top of your screen and can be dragged around. Here are all the buttons from **left to right**:

### Core Actions (First Group, Left Side)
- **📋 Onboard LLM** (1st button): Copy the AI setup guide to clipboard - do this first to teach your AI how to make graphs!
- **📋 Paste** (2nd button): Paste AI's JSON or create a node from plain text (same as Ctrl+V)
- **📋 Copy Selected** (3rd button): Copy just the nodes you've selected (with their connecting edges)
- **📋 Copy Graph** (4th button): Copy the entire graph to clipboard as JSON
- **📖 Copy Manual** (5th button): Copy this entire user manual to clipboard
- **➕ Add Node** (6th button): Create a blank node manually at the center of your view
- **📑 Node List** (7th button): Toggle the node list panel on/off
- **📁 Group List** (8th button): Toggle the group list panel on/off
- **🗑️ Delete** (9th button): Remove selected items (nodes, edges, or groups)
- **👎 Clear Graph** (10th button): Delete everything - clears the entire graph (asks for confirmation)
- **💾 Save** (11th button): Download your graph as a .json file to your computer
- **📂 Load** (12th button): Open a saved graph from your computer

### History Controls (Second Group)
- **↩️ Undo**: Go back to previous state (Ctrl+Z)
- **↪️ Redo**: Go forward to next state (Ctrl+Y)

### Mode Selector (Third Group)
- **✏️ Manual Mode**: Default mode - manually edit and arrange nodes
- **🧭 Nav Mode**: Navigation only - can't edit, just explore (good for presentations!)
- **🔧 Auto-Layout**: Enable automatic graph layout (then select type and click Apply)

### Keyboard Shortcuts
- **Ctrl+X**: Cut selected nodes/edges
- **Ctrl+C**: Copy selected nodes/edges
- **Ctrl+V**: Paste graph JSON
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Delete**: Remove selected items
- **Tab/Shift+Tab**: Navigate between nodes (accessibility)
- **Ctrl+Arrows**: Move selected nodes (1px)
- **Ctrl+Shift+Arrows**: Move selected nodes (10px)

### Using Your Mouse
- **Click a node**: Select it (turns blue)
- **Ctrl+Click**: Select multiple nodes
- **Drag a node**: Move it around
- **Drag empty space**: Pan the whole canvas
- **Scroll wheel**: Zoom in and out
- **Click a line**: Select an edge (connection)
- **Drag from dots**: Create new connections between nodes

---

## Understanding Graph Format (For Power Users)

Your AI generates graphs in JSON format. You don't need to write this yourself, but understanding it helps you ask for exactly what you want:

```json
{
  "nodes": [
    {
      "id": "unique_id",
      "label": "Node Label",
      "position": { "x": 0, "y": 0 },
      "width": 200,
      "height": 100,
      "type": "default",
      "data": {
        "memo": "**Markdown** content here"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "type": "straight",
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "optional label"
    }
  ],
  "groups": []
}
```

### Node Properties
- **id** (required): Unique string identifier
- **label** (required): Short display name (shown on default nodes, not on markdown nodes)
- **type**: "default" | "markdown" | "resizable" | "legacy"
  - `default`: Standard resizable node showing label (most common)
  - `markdown`: Display node rendering memo content as formatted text on a blackboard/whiteboard
  - `legacy`: Old-style fixed-size node
- **position** (required): `{ x: number, y: number }` coordinates
- **width**: Node width in pixels (default: 200)
- **height**: Node height in pixels (default: 100)
- **color**: Node background color (supports hex colors, rgb, rgba, and CSS gradients)
  - Hex: `"#2e7d32"` or `"rgb(46, 125, 50)"`
  - Gradient: `"linear-gradient(135deg, #667eea 0%, #764ba2 100%)"`
  - If omitted, uses your default color preference
- **data.memo**: Markdown-formatted notes (renders as formatted text in markdown nodes, appears in properties panel for all nodes)
- **data.link**: Optional URL

### Edge Types
- **child/parent**: Vertical hierarchy (top/bottom handles)
- **peer**: Horizontal relationships (left/right handles)

### Edge Properties
- **color**: Edge line color (supports hex colors, rgb, and CSS gradients)
  - Hex: `"#ff5722"` or `"rgb(255, 87, 34)"`
  - Gradient: `"linear-gradient(90deg, #667eea 0%, #764ba2 100%)"`
  - If omitted, uses your default edge color preference
- Use colors to differentiate relationship types or importance

### When Asking Your AI
- **"Space them out more"** - If nodes overlap
- **"Make it horizontal/vertical"** - Control layout direction
- **"Add markdown notes"** - Include formatted text in nodes
- **"Use curved edges"** - Make graphs prettier
- **"Add a documentation node"** - Create a markdown-type node for instructions or reference
- **"Put the description in a markdown node"** - Display rich formatted text directly on the canvas
- **"Color the important nodes red"** - Add visual emphasis with colors
- **"Use a gradient for the title node"** - Make key nodes stand out with gradients

---

## What You Can Do

### 1. Start From Scratch
**Say to AI:** "Create a graph about [topic]"
- Be specific: "Create a graph showing the steps in brewing coffee"
- AI generates a complete graph
- Paste it in and see your idea visualized!

### 2. Add to Your Graph
**Say to AI:** "Add more nodes about X"
- AI adds new nodes without replacing everything
- Builds on what you already have
- Keep iterating until it's perfect!

### 3. Modify Existing Parts
**Say to AI:** "Update the 'Earth' node to include more details"
- AI changes just that node
- Everything else stays the same
- Fine-tune individual pieces

### 4. Create Hierarchies
**Say to AI:** "Create an org chart for a tech company"
- AI uses special top-to-bottom connections
- Perfect for family trees, taxonomies, reporting structures
- Clean vertical layouts

---

## Advanced Features

### Groups
Users can group related nodes:
```json
{
  "groups": [
    {
      "id": "group1",
      "label": "Category A",
      "nodeIds": ["node1", "node2", "node3"],
      "collapsed": false,
      "visible": true
    }
  ]
}
```

### Node Types
- **default**: Resizable node with label displayed at top
- **markdown**: Display node showing formatted memo content (looks like a blackboard in dark mode, whiteboard in light mode)
- **svg**: Display node showing an SVG graphic (pass SVG markup in `data.svg`)
- **legacy**: Old fixed-size nodes (not recommended for new graphs)

SVG nodes let you display custom graphics, diagrams, or icons directly on the graph. To use, set `type: "svg"` and provide SVG markup in `data.svg`.

#### Example SVG Node
```json
{
  "id": "node_svg_1",
  "type": "svg",
  "label": "SVG Example",
  "position": { "x": 200, "y": 200 },
  "width": 120,
  "height": 120,
  "data": {
    "svg": "<svg viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='#1976d2'/><text x='50' y='55' font-size='22' text-anchor='middle' fill='white'>SVG</text></svg>"
  }
}
```

### Edge Routing
- **straight**: Best for simple connections
- **curved**: Good for avoiding visual clutter
- **orthogonal**: Professional diagrams
- **child/parent**: Top-to-bottom hierarchy
- **peer**: Side-by-side relationships

---

## When Things Go Wrong (Troubleshooting)

### "Invalid graph format" Error
**What happened:** The JSON isn't formatted correctly  
**Fix it:** Tell your AI "That didn't work, can you check the format?" - they'll fix it!

### Nodes Are Overlapping
**What happened:** AI packed nodes too close together  
**Fix it:** Say "Spread them out more" - AI will space them better

### Can't See My Graph
**What happened:** Graph might be way off to the side  
**Fix it:** 
- Zoom out with scroll wheel
- Or tell AI "Center the graph around (0, 0)"

### Line Won't Connect
**What happened:** Edge references wrong node IDs  
**Fix it:** Tell AI "The connection isn't working" - they'll fix the IDs

### Graph Feels Cluttered
**What happened:** Too much in one view  
**Fix it:**
- Ask AI to group related nodes
- Request curved edges instead of straight
- Break into multiple smaller graphs

### Paste Isn't Working
**What happened:** Might not have copied correctly  
**Fix it:**
- Make sure you copied the full JSON block
- Click in the app first, then Ctrl+V
- Try the **📋 Paste** button (2nd button from left) instead

---

## Pro Tips & Best Practices

### Getting Great Results From Your AI

**Start Small**
- Ask for 5-10 nodes first
- It's easier to add more than fix a mess!

**Be Specific**
- "Create a flowchart" → "Create a flowchart showing how to make a sandwich"
- More details = better results

**Iterate Freely**
- Don't worry about perfection on first try
- "Make it better" and "Add more" are valid requests!
- Use Undo (Ctrl+Z) fearlessly

**Save Your Work**
- Click **💾 Save** (11th button from left) often
- Your browser won't auto-save
- Download .json files to keep your graphs

### Making Beautiful Graphs

**Use the Right Node Type**
- Default nodes for tasks, items, concepts
- Markdown nodes for instructions, documentation, or reference material
- Say "Put that in a markdown node" for formatted content

**Good Spacing**
- If nodes overlap, ask AI to "spread them out more"
- Breathing room makes graphs easier to read

**Use Curved Edges**
- They look cleaner than straight lines
- Say "Use curved edges" when requesting graphs

**Group Related Items**
- "Put all the planet nodes in a group called Solar System"
- Groups keep complex graphs organized

**Add Descriptions**
- "Include details in the node notes"
- Markdown nodes show the content directly
- Other nodes show content in the properties panel when selected

---

## Real Examples (Try These!)

### Example 1: Your First Graph
**Say to AI:** "Create a simple graph showing the solar system with the sun and 3 planets"

**What you'll get:** A visual showing the sun in the center with planets connected to it. Each node can have emojis (⭐🌍) and details!

### Example 2: Planning a Project
**Say to AI:** "Create a timeline for a software project from start to launch"

**What you'll get:** A horizontal flow showing phases of a project. Perfect for planning anything with steps!

### Example 3: Learning Concepts
**Say to AI:** "Create a graph explaining how photosynthesis works, with a markdown node containing the detailed explanation"

**What you'll get:** An educational diagram breaking down complex topics into connected concepts, with a formatted reference card showing the full explanation.

---

## Frequently Asked Questions

**Q: Will my graphs be saved automatically?**  
A: No! Click **💾 Save** (11th button from left) to download .json files. Save often!

**Q: Can I edit nodes manually?**  
A: Yes! Click a node, then click the properties panel to edit labels and notes.

**Q: What if I make a mistake?**  
A: Press Ctrl+Z to undo, or use the **↩️ Undo** button! The app remembers your history.

**Q: Can I share my graphs?**  
A: Yes! Save as .json using **💾 Save** button and share the file. Others can load it with **📂 Load**.

**Q: Do I need to know JSON?**  
A: Nope! Your AI handles all the technical stuff. Just describe what you want.

**Q: What browsers work?**  
A: Any modern browser: Chrome, Firefox, Safari, Edge. JavaScript must be enabled.

**Q: Can I use this offline?**  
A: The app works offline once loaded, but you need internet to talk to your AI.

**Q: How many nodes can I have?**  
A: The app handles 1000+ nodes smoothly! But start small and grow your graph.

---

## Quick Cheat Sheet

**Essential Shortcuts:**
- **Ctrl+X**: Cut selected nodes/edges
- **Ctrl+C**: Copy selected nodes/edges
- **Ctrl+V**: Paste AI's graph
- **Ctrl+Z**: Undo
- **Delete**: Remove selected items
- **Scroll**: Zoom in/out

**First Time Setup:**
1. Click **📋 Onboard LLM** (1st button, far left)
2. Paste into AI chat
3. Ask AI to create a graph
4. Copy & paste result
5. Done!

**Making Changes:**
- **Add stuff**: "Add more nodes about X"
- **Change stuff**: "Update node Y to say Z"
- **Fix layout**: "Spread them out more"
- **Save your work**: Click **💾 Save** (11th button)

---

## What's Next?

Now that you know the basics:

1. **Try it!** Ask your AI to create a simple 3-node graph
2. **Experiment** with different topics and layouts
3. **Iterate** - keep refining until it's perfect
4. **Share** - save and show off your creations!

The best way to learn is by doing. Don't be afraid to try things - Undo is your friend!

---

**Happy graphing!** 🎨📊✨

*Need the onboarding guide for your AI? Click **📋 Onboard LLM** (first button on the left) in the toolbar!*