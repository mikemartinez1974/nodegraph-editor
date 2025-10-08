// introGraph.js - The first graph users see
export const introGraph = {
  "nodes": [
    {
      "id": "welcome",
      "type": "default",
      "label": "👋 Welcome!",
      "position": { "x": 0, "y": -150 },
      "width": 120,
      "height": 60,
      "data": {
        "memo": "# Welcome to Your Graph Editor!\n\nThis is a **node** - the building block of your thinking.\n\n## What you can do:\n- **Single click** to select\n- **Double click** to open properties\n- **Drag** to move around\n- **Click handles** to create connections\n\nStart exploring by clicking the nodes below! 👇",
        "link": ""
      },
      "showLabel": true
    },
    {
      "id": "basic-usage",
      "type": "default",
      "label": "📚 Basic Usage",
      "position": { "x": -200, "y": 50 },
      "width": 110,
      "height": 60,
      "data": {
        "memo": "# How to Use This Tool\n\n## Creating Nodes\n- Click **Add Node** in toolbar\n- Or drag from a handle to create connected nodes\n\n## Selecting & Editing\n- **Single click** = Select node\n- **Double click** = Edit properties\n- **Ctrl + Click** = Multi-select\n\n## Connecting Nodes\n- Hover over a node to see **handles**\n- Drag a handle to another node\n- Or drag to empty space to create a new node\n\n## Navigation\n- **Mouse wheel** = Zoom\n- **Click & drag background** = Pan\n- Use **Nav mode** for auto-organization\n\n## Keyboard Shortcuts\n- `Ctrl+A` = Select all\n- `Delete` = Delete selected\n- `Esc` = Clear selection\n- `Ctrl+Z` / `Ctrl+Y` = Undo/Redo",
        "link": ""
      },
      "showLabel": true
    },
    {
      "id": "llm-instructions",
      "type": "default",
      "label": "🤖 For AI/LLMs",
      "position": { "x": 0, "y": 50 },
      "width": 110,
      "height": 60,
      "data": {
        "memo": "# Instructions for AI/LLM\n\nWhen a user shares this graph with you:\n\n## Your Role\n1. **Understand the structure** - Nodes represent concepts, edges show relationships\n2. **Respect the memo field** - This contains detailed context\n3. **Follow edge directions** - Child edges show hierarchy, peer edges show relationships\n4. **Suggest improvements** - New nodes, missing connections, better organization\n\n## How to Help Users\n- Summarize complex subgraphs\n- Find logical gaps or contradictions\n- Suggest new nodes to add\n- Identify clusters and themes\n- Help reorganize for clarity\n- Expand on specific nodes\n\n## Response Format\nWhen analyzing graphs:\n1. Acknowledge the overall structure\n2. Highlight key insights\n3. Suggest specific additions/changes\n4. Provide node/edge definitions for new elements\n\n**This graph is a thinking tool. Help users think better!**",
        "link": ""
      },
      "showLabel": true
    },
    {
      "id": "llm-workflow",
      "type": "default",
      "label": "🔄 LLM Workflow",
      "position": { "x": 200, "y": 50 },
      "width": 110,
      "height": 60,
      "data": {
        "memo": "# Working with AI\n\n## The Process\n\n### 1. Build Your Graph\nCreate nodes and connections representing your thinking.\n\n### 2. Export\n- Click **Save** button\n- Copy the JSON\n\n### 3. Share with AI\nPaste into ChatGPT, Claude, or any LLM with:\n> *\"Here's a graph representing my thinking. Please analyze it and suggest improvements.\"*\n\n### 4. Iterate\n- AI suggests new nodes/connections\n- Add them to your graph\n- Repeat!\n\n## Why This Works\nGraphs capture:\n- **Structure** - How ideas relate\n- **Hierarchy** - What's important\n- **Context** - Details in memos\n- **Gaps** - What's missing\n\n## Pro Tips\n- Use **groups** for major themes\n- Add **links** to sources\n- Write detailed **memos** for key nodes\n- Use **edge types** meaningfully (child vs peer)",
        "link": ""
      },
      "showLabel": true
    },
    {
      "id": "try-it",
      "type": "default",
      "label": "✨ Try It Now!",
      "position": { "x": 0, "y": 200 },
      "width": 110,
      "height": 60,
      "data": {
        "memo": "# Your Turn!\n\n## Quick Start Challenge\n\n1. **Double-click me** to see this memo\n2. **Edit this text** - make it your own\n3. **Hover over me** to see handles appear\n4. **Drag a handle** to create a new node\n5. **Connect nodes** to show relationships\n\n## What to Build\nTry creating a graph about:\n- A project you're working on\n- Something you're learning\n- A decision you need to make\n- A problem you're solving\n\n## Then Try This\n1. **Save your graph** (Save button in toolbar)\n2. **Copy the JSON**\n3. **Paste into ChatGPT/Claude** with:\n   > \"This graph represents my thinking about [topic]. What am I missing? What connections should I explore?\"\n\n**You'll be amazed at what AI can help you discover!**\n\n---\n\n*Ready? Delete this intro graph (Clear button) and start your own!*",
        "link": ""
      },
      "showLabel": true
    },
    {
      "id": "modes",
      "type": "default",
      "label": "🎨 Layout Modes",
      "position": { "x": -200, "y": 200 },
      "width": 110,
      "height": 60,
      "data": {
        "memo": "# Layout Modes\n\nChoose how your graph arranges itself:\n\n## 🖐️ Manual Mode\n- **You control everything**\n- Drag nodes wherever you want\n- Best for precise layouts\n\n## 🧭 Nav Mode (Recommended!)\n- **Physics-based layout**\n- Nodes organize automatically\n- Connected nodes cluster together\n- Selected node stays centered\n- **Perfect for exploration!**\n\n## 🤖 Auto Mode\n- **Algorithmic layouts**\n- Choose: Hierarchical, Radial, or Grid\n- Click \"Apply Layout\" to organize\n- Great for presentations\n\n💡 **Tip:** Start in Nav mode to explore, then switch to Manual for fine-tuning!",
        "link": ""
      },
      "showLabel": true
    },
    {
      "id": "features",
      "type": "default",
      "label": "⚡ Power Features",
      "position": { "x": 200, "y": 200 },
      "width": 110,
      "height": 60,
      "data": {
        "memo": "# Advanced Features\n\n## 📝 Rich Memos\n- **Markdown support** - Headers, lists, links, code\n- **Preview mode** - Toggle between edit/view\n- **Emoji picker** 😊 - Click the smile icon\n\n## 🔗 Links\n- Add URLs to nodes\n- Click \"Open link\" to visit\n- Great for references and sources\n\n## 👥 Groups\n1. Select multiple nodes (Ctrl+Click)\n2. Press `Ctrl+G` to group\n3. Drag groups to move all nodes together\n4. Collapse/expand with the toggle\n\n## 🎯 Multi-Select\n- `Ctrl+Click` nodes to select multiple\n- `Ctrl+A` to select all\n- Delete multiple at once\n\n## 📋 Node List Panel\n- See all nodes in one place\n- Filter by type or content\n- Click to focus on a node\n- Shows memo/link indicators\n\n## 💾 Save/Load\n- Graphs save as `.json` files\n- Easy to backup and share\n- Version control friendly",
        "link": ""
      },
      "showLabel": true
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "welcome",
      "target": "basic-usage",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-2",
      "source": "welcome",
      "target": "llm-instructions",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-3",
      "source": "welcome",
      "target": "llm-workflow",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-4",
      "source": "basic-usage",
      "target": "modes",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-5",
      "source": "llm-workflow",
      "target": "features",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-6",
      "source": "basic-usage",
      "target": "try-it",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-7",
      "source": "llm-instructions",
      "target": "try-it",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-8",
      "source": "llm-workflow",
      "target": "try-it",
      "type": "child",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [],
        "curved": true
      }
    },
    {
      "id": "edge-9",
      "source": "modes",
      "target": "try-it",
      "type": "peer",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [3, 3],
        "curved": true
      }
    },
    {
      "id": "edge-10",
      "source": "features",
      "target": "try-it",
      "type": "peer",
      "label": "",
      "showLabel": false,
      "style": {
        "color": undefined,
        "width": 2,
        "dash": [3, 3],
        "curved": true
      }
    }
  ]
};