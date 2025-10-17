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
1. Click the **📋 Onboard LLM** button (top-left toolbar)
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
3. Press **Ctrl+V** (or click 📄 Paste button)
4. Your graph appears instantly!

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
- **label** (required): Short display name
- **position** (required): `{ x: number, y: number }` coordinates
- **width**: Node width in pixels (default: 200)
- **height**: Node height in pixels (default: 100)
- **type**: "default" | "resizable" | "custom"
- **data.memo**: Markdown-formatted notes (supports **bold**, *italic*, lists, etc.)

### Edge Types
- **child/parent**: Vertical hierarchy (top/bottom handles)
- **peer**: Horizontal relationships (left/right handles)

### When Asking Your AI
- **"Space them out more"** - If nodes overlap
- **"Make it horizontal/vertical"** - Control layout direction
- **"Add markdown notes"** - Include formatted text in nodes
- **"Use curved edges"** - Make graphs prettier

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

## Your Toolbar (All the Buttons Explained!)

### Main Toolbar (Top-Left, You Can Drag It!)
- **📋 Onboard LLM**: Copy setup guide for your AI (do this first!)
- **📄 Paste**: Paste AI's JSON (or just press Ctrl+V)
- **📋 Copy Selected**: Copy just the nodes you've selected
- **📋 Copy Graph**: Copy the entire graph JSON to share or save
- **➕ Add Node**: Create a blank node manually
- **📑 Node List**: Browse all your nodes in a side panel
- **📁 Group List**: See all your groups
- **🗑️ Delete**: Remove selected items
- **🗑️ Clear Graph**: Delete everything
- **💾 Save**: Download your graph as a .json file
- **📥 Load File**: Open a saved graph from your computer
- **↩️ Undo / ↪️ Redo**: Made a mistake? Go back in time!

### Mode Buttons (Control How You Interact)
- **✏️ Manual Mode**: Default mode - manually edit and arrange nodes
- **🧭 Nav Mode**: Navigation only - can't edit, just explore (good for presentations!)
- **🔧 Auto-Layout**: Automatically arrange your graph (experimental)

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
- **default**: Fixed size, simple
- **resizable**: User can drag corners to resize
- **custom**: Advanced custom rendering

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
- Try the 📄 Paste button instead

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
- Click 💾 Save often
- Your browser won't auto-save
- Download .json files to keep your graphs

### Making Beautiful Graphs

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
- Hover over nodes to see the full markdown content

---

## Real Examples (Try These!)

### Example 1: Your First Graph
**Say to AI:** "Create a simple graph showing the solar system with the sun and 3 planets"

**What you'll get:** A visual showing the sun in the center with planets connected to it. Each node can have emojis (⭐🌍) and details!

### Example 2: Planning a Project
**Say to AI:** "Create a timeline for a software project from start to launch"

**What you'll get:** A horizontal flow showing phases of a project. Perfect for planning anything with steps!

### Example 3: Learning Concepts
**Say to AI:** "Create a graph explaining how photosynthesis works"

**What you'll get:** An educational diagram breaking down complex topics into connected concepts.

---

## Frequently Asked Questions

**Q: Will my graphs be saved automatically?**  
A: No! Click 💾 Save to download .json files. Save often!

**Q: Can I edit nodes manually?**  
A: Yes! Click a node, then click the properties panel to edit labels and notes.

**Q: What if I make a mistake?**  
A: Press Ctrl+Z to undo! The app remembers your history.

**Q: Can I share my graphs?**  
A: Yes! Save as .json and share the file. Others can load it with 📥 Load File.

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
1. Click 📋 Onboard LLM
2. Paste into AI chat
3. Ask AI to create a graph
4. Copy & paste result
5. Done!

**Making Changes:**
- **Add stuff**: "Add more nodes about X"
- **Change stuff**: "Update node Y to say Z"
- **Fix layout**: "Spread them out more"
- **Save your work**: Click 💾 Save

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

*Need the onboarding guide for your AI? Click 📋 Onboard LLM in the toolbar!*