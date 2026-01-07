# Hello from the Twilite Zone Plugin

This folder contains a minimal plugin that exercises the Plugin Platform Phase 3 contract. Load it through the Plugin Manager by pasting `http://localhost:3000/plugins/Twilite-hello/manifest.json` while running the dev server.

## Manifest definition

The manifest describes the node declaratively:

- `definition.handles` seeds the node with an input trigger and greeting output.
- `definition.properties` lists the editable fields that appear inside the Properties Panel (greeting, tagline, mood select, emphasis toggle).
- `definition.display` controls how the placeholder renders on the canvas (card variant with badges + footer).

Because of this schema the editor can render the node UI and property controls with zero custom React code.

## Runtime bundle

`helloPlugin.js` uses the injected `NodeGraphPluginSDK` (`/plugins/sdk/runtime.js`) to participate in the sandbox handshake. The runtime:

```js
const sdk = window.NodeGraphPluginSDK;
const runtime = sdk.createPluginRuntime({
  capabilities: { runtime: 'Twilite-hello', version: '0.1.0' }
});

runtime.registerMethod('plugin:getInfo', async () => {
  const selection = await runtime.callHost('selection:get');
  return { id: 'com.Twilite.hello', selection };
});
```

It also keeps the `plugin:listNodes` method for backwards-compatible discovery and leaves `plugin:ping` in place for diagnostics.

The bundle requests `graph.read` + `selection.read` so it can query the current selection metadata when responding to RPC calls.

## Renderer bundle

`helloRenderer.js` runs inside each node’s sandboxed iframe via `NodeGraphPluginRenderer.createRenderer`. It receives `{ data, nodeId }` props from the host and renders a simple heading/tagline.

`canvasRenderer.js` shows how to render a fully custom canvas UI inside the sandbox. It draws a waveform/barchart directly on a `<canvas>` element so the plugin node looks identical to the native `CanvasNode` (no default chrome, handles pinned close to the content).

Because the iframe is sandboxed, UI bugs or crashes never impact the main editor—falling back to the placeholder if the renderer reports an error.
