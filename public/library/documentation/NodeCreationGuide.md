# Twilite Node Creation Guide

This guide explains how to create node types in Twilite with the current runtime and editor behavior.

Use this as the canonical reference for:
- creating a new node class graph,
- registering it in a host graph,
- validating it,
- and working with LLM copy/paste constraints.

---

## 1) Mental Model

In Twilite, there are two different things:

- **Node instance**: a concrete node in a host graph (`type`, `label`, `data`, `ports`, `position`).
- **Node class**: a graph document that defines how a type behaves/renders (manifest/legend/dictionary/views/etc).

The host graph uses `dictionary.nodeDefs` to map a type key to a node class reference.

---

## 2) What Makes a Type Available in the Palette

A type appears as usable when the host graph dictionary contains a valid `nodeDefs` entry:

```json
{
  "key": "my-node-type",
  "ref": "/library/classes/nodes/my-node.node-class.node",
  "source": "local",
  "version": ">=0.1.0"
}
```

Important:
- `key` must match the `type` you create on instance nodes.
- `ref` must resolve from the current document context.
- You do **not** need to declare every view in `dictionary.views` for basic type availability.

---

## 3) Node Class Graph Minimum Shape

A class graph should contain at least:

1. `manifest` node
2. `legend` node
3. `dictionary` node
4. at least one `view` node for `node.web`
5. optional `view` node for `editor.web`
6. optional `markdown` notes node

Recommended identity:
- `data.identity.graphId`: stable class ID
- `data.intent.kind`: `"definition"`
- `data.intent.scope`: `"node"`

Legend entry should document:
- what the type means
- what view payloads it provides

Dictionary in class graph should contain entries for class-local keys if needed, but the host graph still needs its own dictionary registration for usage.

---

## 4) View Semantics (Current Behavior)

- `node.web`: render behavior in-canvas for the node instance.
- `editor.web`: edit UI behavior for the node instance.

Notes:
- If editor behavior appears without explicit `views` entries in host dictionary, that is runtime resolution behavior; do not rely on undocumented side effects across versions without a smoke test.
- Keep `data` schema stable and documented in your class notes.

---

## 5) Ports and Edges for New Types

For instance nodes:
- Declare `ports` explicitly when the node is intended for graph flow.
- If omitted, `root` is treated as the default virtual port path in many flows.

For edges:
- Always persist both `sourcePort` and `targetPort`.
- If unspecified, set both to `"root"`.

Example edge:

```json
{
  "id": "edge-uuid",
  "source": "node-a",
  "sourcePort": "root",
  "target": "node-b",
  "targetPort": "root",
  "type": "relates"
}
```

---

## 6) LLM Copy/Paste Workflow (Critical)

Because many LLM workflows can only safely emit one artifact at a time, use this protocol:

### Pass 1: Create class file
- Output full class graph JSON only.
- Save to `/library/classes/nodes/<name>.node-class.node`.

### Pass 2: Update host dictionary
- Output only host graph mutation (`update` or small `transaction`) adding `nodeDefs` entry.
- Do not mix unrelated graph rewrites in same pass.

### Pass 3: Smoke instance
- Output `createNodes` (and optional `createEdges`) that creates one instance of the new type.
- Verify create/edit/save/reload behavior.

Do not ask the LLM to create class file + update host + create instances in one huge paste command.

---

## 7) Path and Reference Rules

Use one of these `ref` styles:

- local absolute path in Twilite-hosted content:
  - `"/library/classes/nodes/my.node-class.node"`
- fully qualified remote URL:
  - `"https://twilite.zone/library/classes/nodes/my.node-class.node"`

Avoid ambiguous strings without leading slash/scheme when possible.

---

## 8) Validation Checklist Before You Trust a New Type

1. Dictionary:
- `nodeDefs` has your `key`.
- `ref` resolves.

2. Instance:
- Can create from palette.
- Node renders expected `node.web` behavior.
- Edit flow works (properties or editor view).

3. Persistence:
- Save, reload, and verify:
  - `type` unchanged,
  - `data` unchanged,
  - `ports` preserved,
  - edges preserved with explicit ports.

4. Cross-surface:
- Verify in web and VS Code plugin if both are target runtimes.

---

## 9) Recommended Starter Pattern for New Types

Start simple:

- version `0.1.0`
- one required `data` field
- one `node.web` rendering path
- optional `editor.web` for ergonomics
- no script side effects until basic persistence is stable

Then iterate:

1. add richer data schema,
2. add editor controls,
3. add script/runtime behavior,
4. add integration edges/ports.

---

## 10) Common Failure Modes

- Type key mismatch between instance `type` and dictionary `nodeDefs.key`.
- Broken `ref` path (wrong prefix, wrong case, wrong folder).
- Class graph missing required system nodes.
- Edge creation without explicit ports.
- Single giant transaction trying to mutate multiple files/contexts at once.

---

## 11) Quick Templates

### Host dictionary entry

```json
{
  "key": "node",
  "ref": "/library/classes/nodes/node.node-class.node",
  "source": "local",
  "version": ">=0.1.0"
}
```

### Instance node

```json
{
  "id": "uuid-v4",
  "type": "node",
  "label": "My Node",
  "position": { "x": 200, "y": 120 },
  "width": 360,
  "height": 220,
  "data": {
    "content": "# Hello"
  }
}
```

### Root edge fallback

```json
{
  "id": "uuid-v4",
  "source": "a",
  "sourcePort": "root",
  "target": "b",
  "targetPort": "root",
  "type": "relates"
}
```

---

## 12) Decision Rule: Which Primitive to Use

- Need a new reusable type: create a **node class**.
- Need direct navigation/action endpoint: use a **port node**.
- Need embedded child graph runtime: use **graph-reference**.
- Need one-off text link: use **markdown + tlz://**.
- Need custom executable extension: use **plugin/script** with explicit trust model.

