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
