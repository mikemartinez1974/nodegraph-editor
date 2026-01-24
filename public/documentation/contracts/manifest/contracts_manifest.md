# Manifest Contract

This document defines the **required structure, meaning, and authority** of a Manifest node.

Every Twilite graph **must** contain exactly one Manifest node that conforms to this contract.  
Graphs without a valid Manifest are **not portable, not safe, and not executable**.

The Manifest is the highest authority in a graph.  
No editor, agent, or tool may override it.

---

## 1. Required Node Type

```json
{
  "type": "manifest"
}
```

There MUST be exactly **one** Manifest node per graph.

---

## 2. Identity Section (REQUIRED)

Defines what this graph **is**.

```json
{
  "identity": {
    "graphId": "uuid-v4",
    "name": "Human readable name",
    "version": "semver",
    "description": "Short description of purpose",
    "createdAt": "ISO-8601 timestamp",
    "updatedAt": "ISO-8601 timestamp"
  }
}
```

### Rules
- `graphId` is immutable forever
- `version` must follow semver
- `updatedAt` must change on any mutation
- Tools may read identity, never rewrite it (except `updatedAt`)

---

## 3. Intent & Scope Section (REQUIRED)

Declares **how this graph is meant to be interpreted**.

```json
{
  "intent": {
    "kind": "documentation | workflow | simulation | circuit | knowledge-map | contract | executable | other",
    "scope": "human | agent | tool | mixed",
    "description": "Optional clarification of intent"
  }
}
```

### Rules
- Intent constrains interpretation, not rendering
- Editors MUST NOT guess intent
- Agents MUST respect intent when acting
- Unknown intent values are allowed but must be treated as opaque

---

## 4. Dependencies & Requirements Section (REQUIRED)

Declares what must exist for this graph to be valid.

```json
{
  "dependencies": {
    "nodeTypes": ["markdown", "default", "script", "customType"],
    "handleContracts": ["core", "breadboard"],
    "skills": ["auto-layout", "schema-validation", "batch-mutation"],
    "schemaVersions": {
      "nodes": ">=1.0.0",
      "handles": ">=1.0.0"
    },
    "optional": []
  }
}
```

### Rules
- Missing required dependencies MUST invalidate execution
- Editors may warn but must not silently degrade
- Agents must refuse to act if dependencies are unmet
- Skill dependencies are mandatory and must include any skills declared by node definitions
- Optional dependencies must never be assumed

---

## 5. Authority & Mutation Policy Section (REQUIRED)

Defines **what is allowed to change** and by whom.

```json
{
  "authority": {
    "mutation": {
      "allowCreate": true,
      "allowUpdate": true,
      "allowDelete": false,
      "appendOnly": true
    },
    "actors": {
      "humans": true,
      "agents": true,
      "tools": true
    },
    "styleAuthority": "descriptive | authoritative | ignored",
    "history": {
      "rewriteAllowed": false,
      "squashAllowed": false
    }
  }
}
```

### Rules
- If `appendOnly` is true, deletes are forbidden
- If `allowDelete` is false, tools must block deletion
- If agents are disabled, they may only read
- History rules must be enforced by editors and agents
- Style authority controls whether renderers must obey style nodes

---

## 6. Validation Rules

A Manifest is valid only if:
- Exactly one exists
- All required sections exist
- All required fields exist
- Dependency sets are closed
- Mutation policy is internally consistent
- Version format is valid semver
- UUIDs are valid RFC 4122 v4

Invalid Manifests invalidate the entire graph.

---

## 7. Document Reference (OPTIONAL)

Documents are part of the graph’s portable definition.

```json
{
  "document": {
    "url": "https://example.com/background.html"
  }
}
```

### Rules
- Stored inside the Manifest node as `data.document.url`
- If omitted, there is no external document
- Renderers may treat this as a background/host document when available

---

## 8. Document Settings (OPTIONAL)

Settings define **how the graph should be presented by default**.  
These are editor-facing defaults and may be overridden by a renderer.

```json
{
  "settings": {
    "theme": null,
    "backgroundImage": null,
    "defaultNodeColor": "#1976d2",
    "defaultEdgeColor": "#666666",
    "snapToGrid": false,
    "gridSize": 20,
    "edgeRouting": "auto",
    "layout": null,
    "github": null,
    "autoSave": false
  }
}
```

### Rules
- Settings live inside the Manifest node as `data.settings`
- If settings are omitted, renderers must fall back to their own defaults
- Settings must never override Manifest authority rules

---

## 9. Forbidden Patterns

Manifest nodes MUST NOT:
- Be duplicated
- Be deleted
- Be silently modified
- Be inferred
- Be auto-generated without explicit user intent
- Be ignored by tools

---

## 10. Example Minimal Manifest Node

```json
{
  "type": "manifest",
  "data": {
    "identity": {
      "graphId": "b6f1c9d4-8a3f-4e2b-9c47-2f8a1e6b7c3d",
      "name": "Example Graph",
      "version": "1.0.0",
      "description": "Minimal valid graph",
      "createdAt": "2026-01-18T00:00:00Z",
      "updatedAt": "2026-01-18T00:00:00Z"
    },
    "intent": {
      "kind": "documentation",
      "scope": "mixed"
    },
    "dependencies": {
      "nodeTypes": ["markdown"],
      "handleContracts": ["core"],
      "skills": [],
      "schemaVersions": {
        "nodes": ">=1.0.0",
        "handles": ">=1.0.0"
      }
    },
    "authority": {
      "mutation": {
        "allowCreate": true,
        "allowUpdate": true,
        "allowDelete": false,
        "appendOnly": true
      },
      "actors": {
        "humans": true,
        "agents": true,
        "tools": true
      },
      "styleAuthority": "descriptive",
      "history": {
        "rewriteAllowed": false,
        "squashAllowed": false
      }
    }
  }
}
```

---

## Final Rule (Non-Negotiable)

If a tool or agent does not understand this Manifest,  
it must **refuse to act**.

Silence is corruption.  
Refusal is safety.
