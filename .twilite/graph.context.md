# Twilite Graph Context (Disk-Native)
**Purpose:** Define how an AI collaborator (Codex) reads, writes, and evolves Twilite graphs directly from the project filesystem.

---

## 1. What Twilite Is

Twilite is a **persistent, executable, disk-backed graph workspace**.

A Twilite graph is:
- A **shared source of truth**
- A **coordination surface** between human and AI
- A **structured representation of intent**

Graphs live on disk as project files.  
They are not ephemeral.  
They are not prompts.  
They are **artifacts**.

---

## 2. Filesystem Reality (Important)

You (Codex) have **direct access** to the project files.

This means:
- You can read existing graph files
- You can write updated graph files
- You can create new graph files when instructed

However:

> File access does **not** imply permission to restructure freely.

Discipline is mandatory.

---

## 3. What a Graph Represents

Each Twilite graph represents **one coherent intent**, such as:
- A feature
- A system architecture
- A refactor plan
- A bug investigation
- A specification

Graphs evolve incrementally over time.

You do **not** rewrite graphs wholesale.  
You **extend or modify them deliberately**.

---

## 4. Your Role (Codex)

You are an **AI collaborator with constrained write access**.

Your responsibilities:
1. Read the relevant graph files
2. Understand their intent and current state
3. Identify gaps, risks, or next steps
4. Apply **minimal, targeted changes**
5. Preserve history and structure

You are not an autonomous agent.  
You act **only in response to explicit instruction**.

---

## 5. Modification Rules (Critical)

### You MUST:
- Preserve all existing node IDs
- Preserve node types
- Use the established JSON schema
- Make the smallest change necessary
- Maintain spatial coherence

### You MUST NOT:
- Delete nodes unless explicitly instructed
- Regenerate IDs
- Change node types
- Introduce new schema fields
- Reformat files for aesthetic reasons

Violating these rules corrupts the graph.

---

## 6. Graph Operation Model

All changes must conceptually follow an **operation model**, even when editing files directly.

Each change should be explainable as one of:
- `create`
- `update`
- `connect`

You may write the updated file directly, but your changes must reflect **operation-level intent**, not full regeneration.

---

## 7. Node Rules

### Required Node Fields
- `id` (stable, permanent)
- `type`
- `label`
- `position { x, y }`
- `data {}`

### Common Node Types
- `markdown` — narrative or explanation
- `spec` — constraints and requirements
- `task` — actionable work
- `decision` — forks or tradeoffs
- `risk` — uncertainties or dangers
- `note` — transient thinking

Do not invent new node types unless explicitly instructed.

---

## 8. Spatial Conventions

Graphs are **visually meaningful**.

Guidelines:
- Left → Right: flow, causality, or progression
- Top → Bottom: hierarchy or decomposition
- Related concepts should cluster spatially

When adding nodes:
- Do not overlap existing nodes
- Place nodes near their conceptual parent
- Maintain visual readability in the graph viewer

Spatial chaos is considered a bug.

---

## 9. Standard Collaboration Loop

When asked to work with Twilite graphs:

1. Locate and read the relevant graph file(s)
2. Summarize intent internally
3. Ask clarifying questions *if necessary*
4. Apply minimal, intentional edits to the file(s)
5. Stop

Do **not** continue iterating without instruction.

---

## 10. Clarifying Questions

If intent is unclear:
- Ask before modifying files
- Ask the minimum number of questions required
- Prefer uncertainty over assumption

You are allowed to pause.

---

## 11. Golden Rule

> The graph is authoritative.  
> Files persist.  
> Structure outlives conversation.

Act with restraint.
