# Scripting & Automation HOWTO

## Goal

Allow user-authored scripts to safely read/modify the graph (nodes, edges, groups) without exposing app internals or the DOM. Provide dry-run and mutate modes, timeouts, and audited operations.

## Recommended approach (iframe runner)

1. Create an iframe with `sandbox="allow-scripts"` and a minimal HTML runner loaded from a trusted origin or data URL.
2. Host code posts the script text and a capability token via `postMessage`. The iframe receives the code and runs it in a function wrapper with a very small API object.
3. Communication is RPC-like: each request gets an id; iframe sends responses back.
4. Host proxies API calls (`getNodes`, `createNode`, `updateNode`, `createEdge`, `deleteEdge`, `on`) and validates every mutation.
5. Enforce timeouts and quotas: if the script runs longer than N seconds or exceeds operation/mutation budgets, terminate and recycle the iframe session.

## Minimal `graphApi` surface (example)

- `getNodes(filter?)` → `Promise<Node[]>`
- `getNode(id)` → `Promise<Node>`
- `createNode(nodeData)` → `Promise<Node>`
- `updateNode(id, patch)` → `Promise<{ success: boolean, node?: Node }>`
- `deleteNode(id)` → `Promise<{ success: boolean }>`
- `createEdge(edgeData)` → `Promise<Edge>`
- `deleteEdge(id)` → `Promise<{ success: boolean }>`
- `on(event, handler)` → subscribe to events (limited)
- `log(level, message)`

## Dry-run mode & quotas

- Host provides graph snapshot copy to the script and accepts a list of mutations back instead of applying them.
- Scripts are limited to a safe number of RPC calls and mutations per run (currently 200 RPCs / 100 mutations).
- Script returns an array of operations the host can preview and optionally apply.

## Security notes

- Never `eval` user code in the main window context.
- Limit API capabilities by default (read-only until user explicitly grants write access).
- Sanitize and validate all mutations server- and client-side.
- Keep detailed logs of script activity for auditing and rollback.

## Next steps (implementation)

- Add a minimal iframe runner component and an RPC proxy in `handlers/` or a new `scripting/` folder.
- Provide example scripts and UI in the Script Editor panel (run/dry-run/save/load).

