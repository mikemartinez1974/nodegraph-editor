# Node Type Schema Contract Template

> **Authority:** This document is normative.
> Any node created, mutated, rendered, or interpreted by humans, agents, or tools **MUST** conform to one of the schemas defined using this template.
> Editors and agents may not invent fields, infer structure, or guess missing data.

---

## 0. Metadata

* **Type name:** `<type>`
* **Schema version:** `MAJOR.MINOR.PATCH`
* **Status:** `experimental | stable | deprecated`
* **Defined in:** `contracts/nodes/<type>.md`

---

## 1. Semantic Meaning (REQUIRED)

Describe **what this node represents** and **what it must mean everywhere**.

This meaning is portable across tools, editors, and renderers.

* What domain concept does this node embody?
* Why does this node exist?
* What would be lost if this node type did not exist?

---

## 2. Required Fields (REQUIRED)

These fields MUST be present on every node of this type.

```json
{
  "id": "string (uuid)",
  "type": "<type>",
  "label": "string",
  "width": "number",
  "height": "number",
  "data": {}
}
```

Field definitions:

| Field  | Type   | Description                  |
| ------ | ------ | ---------------------------- |
| id     | string | Stable, immutable identifier |
| type   | string | Node type (immutable)        |
| label  | string | Human-readable name          |
| width  | number | Canonical width for layout   |
| height | number | Canonical height for layout  |
| data   | object | Type-specific payload        |

---

## 3. Optional Fields (OPTIONAL)

These fields MAY be present but MUST conform if used.

* `position`
* `color`
* `handles`
* `inputs / outputs`
* `groupId`
* `extensions`

Unknown optional fields are forbidden.

---

## 4. Data Shape (REQUIRED)

Define the exact structure of the `data` object.

### Required keys

```json
{
  "exampleKey": "string"
}
```

### Optional keys

```json
{
  "optionalKey": "string | null"
}
```

Rules:

* All keys must be documented
* No free-form blobs
* Defaults must be explicit
* Nullability must be explicit

---

## 5. Handles (IF APPLICABLE)

If this node exposes handles, each must be declared here.

### Handle definition

| Field        | Description              |           |               |
| ------------ | ------------------------ | --------- | ------------- |
| id           | Stable handle identifier |           |               |
| direction    | input                    | output    | bidirectional |
| semanticType | Meaning of data flow     |           |               |
| multiplicity | one                      | many      |               |
| wildcard     | allowed                  | forbidden |               |

### Handle list

```md
- id: <handle-id>
  direction: input
  semanticType: <type>
  multiplicity: one
  wildcard: forbidden
```

---

## 6. Allowed Mutations

List mutations that are legal for this node type.

* label: allowed
* data.<field>: allowed
* width/height: allowed
* type: forbidden
* id: forbidden

Mutations not listed here are forbidden.

---

## 7. Forbidden Mutations

Explicitly illegal operations:

* Changing node type
* Deleting required fields
* Adding undocumented fields
* Modifying handle IDs
* Recreating node instead of updating

---

## 8. Validation Rules

Rules that MUST pass before mutation or persistence.

* Required fields present
* Data shape valid
* Handles valid
* Version compatible
* No forbidden mutations

Validation failures MUST block execution.

---

## 9. Examples

### Minimal valid example

```json
{
  "id": "uuid",
  "type": "<type>",
  "label": "Example",
  "width": 300,
  "height": 200,
  "data": {}
}
```

### Full valid example

```json
{
  "id": "uuid",
  "type": "<type>",
  "label": "Example",
  "width": 320,
  "height": 220,
  "position": {"x": 0, "y": 0},
  "data": {},
  "handles": []
}
```

### Invalid example (must fail)

```json
{
  "id": "uuid",
  "type": "<type>",
  "data": {}
}
```

---

## 10. Migration Notes

Document all prior versions and upgrade rules.

### From v0.x → v1.0

* Field X renamed to Y
* Default added for Z

Migrations must be deterministic and reversible.

---

## 11. Agent Rules (REQUIRED)

Agents MUST:

* Read this schema before creating nodes
* Refuse unknown types
* Refuse undocumented fields
* Prefer update over recreate
* Emit errors instead of guessing

---

## 12. Human Notes (OPTIONAL)

Add explanatory notes for human readers.

These notes are ignored by validators but useful for onboarding.

---

**End of schema.**
