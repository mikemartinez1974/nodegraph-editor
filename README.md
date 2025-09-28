# Copy & Paste Node Graphs With Me

A collaborative, LLM-friendly node graph editor for brainstorming, prototyping, and sharing ideas visually.

## Overview

**Copy & Paste Node Graphs With Me** is a powerful, flexible, and beautiful node graph editor designed for seamless use alongside large language models (LLMs) and chat-based workflows. It makes node graph editing accessible to everyone, from novices to power users, and is ideal for:

- Visualizing and developing ideas in real time
- Sharing node graphs via copy & paste in chat
- Collaborative brainstorming and prototyping
- Educational and creative workflows

## Features

- **Intuitive drag-and-drop node/edge editing**
- **Copy & paste support** for sharing graphs in chat
- **Layered architecture** for performance and flexibility
- **Animated handles and smooth UX**
- **Customizable node and edge types**
- **Material-UI theming** for a beautiful, modern look
- **Event bus** for decoupled, extensible event handling
- **Pan & zoom** for large graphs
- **Beginner-friendly**: no prior experience required

## Why?

Node graphs are a powerful way to organize, develop, and communicate ideas. This project aims to make node graph editing as easy as chatting—so you can:

- Build and share graphs with an LLM or a friend
- Copy a graph from chat, paste it into the editor, and keep working
- Lower the barrier for visual thinking and collaborative ideation

## Getting Started

1. **Clone the repo:**
   ```sh
   git clone <repo-url>
   cd nodegraph-editor
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Run the app:**
   ```sh
   npm start
   ```
4. **Open in your browser:**
   Visit [http://localhost:3000](http://localhost:3000)

## Usage

- **Add nodes/edges**: Drag from the sidebar or use the toolbar
- **Connect nodes**: Drag handles to create edges
- **Copy/paste**: Use standard keyboard shortcuts to copy and paste graphs
- **Customize**: Extend node/edge types via props

## Architecture

- **React + Material-UI**
- **Layered rendering**: NodeLayer, EdgeLayer, HandleLayer, PanZoomLayer
- **Event bus** for cross-component communication
- **Hooks** for pan/zoom, handle animation, and more

## Contributing

Contributions are welcome! Please open issues or pull requests to suggest features, report bugs, or improve documentation.

## License

MIT
