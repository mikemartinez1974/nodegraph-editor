# Hello from the Twilight Zone Plugin

This folder contains a minimal plugin that can be loaded with the plugin manager. The manifest lives at `/plugins/twilight-hello/manifest.json`, so in development you can install it by pasting `http://localhost:3000/plugins/twilight-hello/manifest.json` into the Plugin Manager panel.

The bundle (`helloPlugin.js`) now runs inside the hardened sandbox loader, participates in the `handshake:probe`/`rpc:request` protocol, and demonstrates how to call back into the host through the `host:rpc` bridge. It requests the `graph.read` and `selection.read` permissions so it can ask the host for the current selection metadata.

### RPC methods exposed to the host

- `plugin:getInfo` – returns plugin id/version plus the current host selection snapshot (via `selection:get`).
- `plugin:listNodes` – returns metadata for the sample `twilight-hello` node.
- `plugin:ping` – diagnostic ping/pong.

With the runtime loader enabled the host can call `plugin:listNodes` to register the custom node and later stream in rendered output from the plugin runtime.
