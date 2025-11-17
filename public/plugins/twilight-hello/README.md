# Hello from the Twilight Zone Plugin

This folder contains a minimal plugin that can be loaded with the new plugin manager. The manifest lives at `/plugins/twilight-hello/manifest.json`, so in development you can install it by pasting `http://localhost:3000/plugins/twilight-hello/manifest.json` into the Plugin Manager panel.

The bundle (`helloPlugin.js`) currently responds to the BackgroundFrame handshake protocol and exposes the following RPC methods:

- `plugin:getInfo` – returns plugin id/version
- `plugin:listNodes` – returns metadata for the sample `twilight-hello` node
- `plugin:ping` – diagnostic ping/pong

Once the runtime loader is wired up, the host can call `plugin:listNodes` to register the custom node and render it like any other node type.
