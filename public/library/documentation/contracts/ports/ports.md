# Port Contract Template

> **Authority:** This document is normative.
> Any edge created, mutated, rendered, or interpreted by humans, agents, or tools **MUST** conform to a port contract defined using this template.
> Tools and agents may not guess, infer, or invent port behavior.

---

## 0. Metadata

* **Port ID:** `<port-id>`
* **Node type:** `<node-type>`
* **Contract version:** `MAJOR.MINOR.PATCH`
* **Status:** `experimental | stable | deprecated`
* **Defined in:** `contracts/ports/<node-type>.md`

---

## 0.1 Default Root Port (REQUIRED)

Every node exposes a default port named **`root`**, even when no ports are explicitly declared.

Implications:

* Edges without ports attach to `root`.
* `root` provides a portable attachment point for minimal graphs.
* If a node declares ports, `root` still exists unless explicitly forbidden by that node’s contract.

Port contracts apply to declared ports. A dedicated `root` contract is optional but recommended for node types that need strict semantics.

---

## 1. Semantic Meaning (REQUIRED)

Describe **what this port represents** in the domain.

This meaning is portable and invariant across editors, renderers, and agents.

* What kind of relationship does this port express?
* What does it mean when an edge exists here?
* What would be false if this port were misused?

---

## 2. Direction (REQUIRED)

Defines **how meaning flows** through this port.

Allowed values:

* `input`
* `output`
* `bidirectional`

Direction is semantic, not visual.

---

## 3. Semantic Type (REQUIRED)

Defines **what kind of meaning** flows through this port.

Examples:

* text
* control
* data
* graph_ref
* voltage
* constraint
* event

Semantic types are not programming types; they are conceptual contracts.

---

## 4. Multiplicity (REQUIRED)

Defines how many edges may attach to this port.

Allowed values:

* `one`
* `many`

Multiplicity prevents structural ambiguity.

---

## 5. Compatibility Rules (REQUIRED)

Define what this port may connect to.

### Allowed connections

```yaml
- nodeType: <other-node-type>
  portId: <port-id>
  semanticType: <type>
```

### Forbidden connections

```yaml
- reason: <why this is invalid>
  nodeType: <type>
  portId: <port-id>
```

Rules:

* Compatibility must be explicit
* Omitted connections are forbidden
* Wildcards must be declared

---

## 6. Wildcard Policy (REQUIRED)

Defines whether unspecified connections are allowed.

* `forbidden` (default, strict)
* `allowed` (exploratory)

If wildcards are allowed, validators MUST still enforce semanticType matching.

---

## 7. Structural Constraints

Declare structural rules that must never be violated.

Examples:

* No self-loops
* No cycles
* One per cluster
* Must connect before execution
* Must not cross graph boundary

These rules protect meaning and history.

---

## 8. Allowed Mutations

List legal changes to edges attached to this port.

* add edge: allowed
* remove edge: allowed
* rewire edge: forbidden
* change port ID: forbidden

Mutations not listed here are forbidden.

---

## 9. Validation Rules

Validators MUST enforce:

* Direction correctness
* Semantic type compatibility
* Multiplicity limits
* Structural constraints
* Wildcard policy

Validation failure MUST block persistence and execution.

If no port is specified, validators must treat the attachment as `root` (no error).

---

## 10. Examples

### Valid example

```json
{
  "source": "nodeA",
  "sourcePort": "data_out",
  "target": "nodeB",
  "targetPort": "data_in"
}
```

### Invalid example (must fail)

```json
{
  "source": "nodeA",
  "sourcePort": "data_out",
  "target": "nodeA",
  "targetPort": "data_out"
}
```

---

## 11. Migration Notes

Document how this port evolved over time.

### From v0.x → v1.0

* Renamed from `output`
* Multiplicity changed from many → one

Migrations must be explicit and reversible.

---

## 12. Agent Rules (REQUIRED)

Agents MUST:

* Read port contracts before connecting nodes
* Refuse incompatible connections
* Prefer add/remove over rewire
* Emit errors instead of guessing
* Respect multiplicity and structure

---

## 13. Human Notes (OPTIONAL)

Explain intent, edge cases, and design rationale.

Ignored by validators but critical for stewardship.

---

**End of port contract.**
