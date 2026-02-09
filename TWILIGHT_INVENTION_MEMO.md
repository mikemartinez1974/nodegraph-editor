# Twilite — Invention Memo (Draft)

Not legal advice. This document is a technical “invention disclosure” style memo intended to capture what may be novel about Twilite and to create a dated internal record of core ideas and workflows.

Date: 2025-12-28  
Project: Twilite (nodegraph-editor)  
Author: Michael Martinez (with assistant drafting)

---

## 1) Problem Statement

Most “AI for development” workflows produce **text** (code, docs, chat logs) and rely on humans to translate intent into stable, shareable artifacts. Existing diagram tools treat graphs as disposable pictures; they are not designed as **persistent, executable workspaces** that can be safely and repeatedly mutated by an AI agent.

Key pain points in existing systems:

- AI output often overwrites or re-creates state rather than applying safe incremental changes.
- Graph formats are either not canonical (exports) or not safe to mutate programmatically (no validation/rollback/ID continuity).
- Edge/port detail can become verbose and brittle, especially in AI-generated payloads.
- Layout and routing degrade quickly as graphs grow, making the artifact hard to share.

---

## 2) Summary of the Proposed Solution

Twilite treats a node graph as a **persistent workspace artifact** (a canonical `.node` file) that evolves by applying **validated state-delta commands** rather than re-emitting full snapshots.

Core principles:

1. **State continuity is default.** IDs are stable and history matters.
2. **Mutations are explicit.** Agents emit `create/update/delete/...` commands (deltas), not whole-graph re-draws.
3. **Validation + rollback are first-class.** Commands can be checked before applying and reverted if rejected.
4. **Ports are functional but optional.** Minimal edges (`source`, `target`) remain meaningful via deterministic attachment + routing.
5. **Professional output by default.** Autolayout + edge routing are built-in so shareable artifacts stay readable as they grow.

---

## 3) Candidate Novel Concepts (What Might Be Protectable)

These are the distinct mechanisms worth considering as “core inventions,” separately or together:

### A0) “Artifact-as-Transmission” on the Web (Claim-Shaped Summary)

This section frames the core idea as a single coherent system, not a loose combination of “graph + web + copy/paste + AI”.

**System overview**

A web-based system in which a URL-addressable graph artifact acts as a canonical workspace, and in which copy/paste-able mutation payloads (often AI-generated) are validated and applied as transactional state deltas with deterministic interpretation, automatic layout/routing, and continuity guarantees.

**Claim-shaped method (high level)**

1. Provide a graph workspace accessible via a web client, where the workspace state is representable as a shareable artifact (e.g., a `.node` document) associated with a stable identifier/address (such as a URL).
2. Accept, via paste or equivalent input, a structured mutation payload describing one or more state transitions using explicit action verbs (e.g., create/update/delete/move/transaction), rather than a full snapshot.
3. Validate the payload against graph constraints and schemas (node types, port schemas, IDs, ordering rules).
4. Interpret omitted optional details deterministically (e.g., missing ports attach by geometry-based boundary selection; missing style/size/position fields hydrate from node-type/document defaults).
5. Apply the mutation to the live graph state and update persistent history/timeline.
6. Present a confirmation UX (toast/dialog/action) that allows acceptance or rollback to the pre-apply state.
7. Render the updated graph using automatic layout and edge routing so minimal payloads produce professional, shareable visuals.

**Key differentiators to emphasize (if preserving IP options)**

- The “transmission” is the **delta protocol** + deterministic interpretation rules, not just shipping a file.
- Continuity guarantees: stable IDs, small diffs, “no overwrite unless explicitly requested”.
- Port-required semantics that preserve correctness while reducing payload size.
- Transactional paste flow with validation + rollback.

**Useful variants (often important for claims)**

- Payload source: pasted JSON, clipboard, URL-fetched command, plugin-generated command, or script output.
- Confirmation: automatic accept with undo, explicit keep/revert, or time-limited accept.
- Storage: local file, git-backed repo, remote storage, or hybrid.
- Layout: on-demand beautify, auto-apply on missing positions, per-group layout, incremental layout.

### A) LLM-to-Graph Delta Protocol for a Persistent Workspace

A system where an LLM emits structured, validated commands that **mutate** a persistent graph artifact, preserving stable IDs and history.

Key aspects:

- A well-defined mutation grammar (verbs, entities, ordering rules).
- A “never overwrite unless explicitly asked” contract to protect continuity.
- Small diffs suitable for version control and collaboration.

### B) Deterministic Edge Attachment When Ports Are Omitted

Edges remain valid and render deterministically even when `sourcePort/targetPort` are absent:

- Side selection derived from geometry (source→target direction) rather than requiring explicit port keys.
- Stable slotting along node edges to avoid stacking for multi-edge cases.
- Explicit ports override fallback behavior for precision wiring when needed.

This reduces AI payload size while keeping graphs functional.

### C) Validation, Confirmation, and Rollback for “Paste-to-Execute” Commands

A UI-driven workflow where users paste a command payload and the system:

- Parses and validates the intent.
- Applies changes to the live graph.
- Confirms the mutation (toast/dialog/action buttons).
- Reverts if rejected.

This treats “AI output” as a controlled transaction rather than a blind import.

### D) Timeline + Milestones as First-Class Graph Events

A timeline model in which graph snapshots/milestones are captured and surfaced as part of the workspace, enabling:

- Storytelling vs debugging views of a project’s evolution.
- User-labeled “milestones” that mark meaningful state transitions.
- Restoration and navigation of graph history.

### E) Editor-Side Hydration to Minimize LLM Bandwidth

A system where the editor fills in missing details from node-type defaults and document settings:

- Omit redundant node fields from commands (size/style/ports/positions).
- Allow minimal “intent payloads” while still producing professional renderings.
- Apply autolayout/reroute/incremental growth policies to keep outputs readable.

---

## 4) Key User Workflows

### Workflow 1 — Safe Mutation of an Existing Graph (Delta-Based)

1. User opens an existing `.node` graph (persistent state).
2. LLM proposes a small command payload that mutates state.
3. Twilite validates, applies, records history, and updates the UI.

### Workflow 2 — Minimal Edge Creation Without Ports

1. LLM creates nodes and connects them with edges that omit ports.
2. Twilite attaches edges deterministically to node boundaries (directional).
3. ELK-based routing (or equivalent) renders orthogonal routes by default.

### Workflow 3 — Confirm/Revert Transactional Paste

1. LLM emits a command that changes document theme or layout.
2. Twilite applies and displays a “Keep/Revert” confirmation.
3. User can revert the change instantly; history remains coherent.

---

## 5) Concrete Examples (Illustrative)

### Example: Create Two Nodes + Connect (No Ports)

```json
{
  "action": "create",
  "nodes": [
    { "id": "11111111-1111-4111-8111-111111111111", "type": "default", "label": "A", "position": { "x": 0, "y": 0 } },
    { "id": "22222222-2222-4222-8222-222222222222", "type": "default", "label": "B", "position": { "x": 400, "y": 0 } }
  ],
  "edges": [
    { "id": "33333333-3333-4333-8333-333333333333", "source": "11111111-1111-4111-8111-111111111111", "target": "22222222-2222-4222-8222-222222222222" }
  ]
}
```

Expected behavior:

- Edge attaches on the boundary sides that match A→B direction (right side of A, left side of B).
- Edge routes orthogonally by default.
- No explicit ports are required for a readable result.

### Example: Precision Wiring With Explicit Ports (Optional Upgrade)

```json
{
  "action": "createEdges",
  "edges": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "source": "node-logic",
      "sourcePort": "out.true",
      "target": "node-gate",
      "targetPort": "in.condition",
      "label": "true"
    }
  ]
}
```

Expected behavior:

- Explicit ports override boundary fallback.
- Validation checks port existence when ports are specified.

---

## 6) Non-Goals / Known Prior Art Areas

This memo does not claim novelty in generic ideas such as:

- Node graph editors, draggable nodes, edges/ports as a concept.
- Auto-layout and orthogonal routing in general.
- Git-based storage of project artifacts.
- “AI-assisted editing” as a broad concept.

The potential novelty is in the **specific combination** and system design: persistent graph workspace + delta mutation protocol + validation/rollback UX + port-required semantics + hydration/layout to minimize AI payload.

---

## 7) Next Steps (If You Want to Preserve Options)

- Keep this memo updated with screenshots/graphs demonstrating the workflows.
- Maintain dated notes for major design decisions (ports optionality, deterministic fallback, rollback UX, timeline semantics).
- If pursuing IP protection later: convert the “Candidate Novel Concepts” into a short set of method/system descriptions with diagrams and variants.
