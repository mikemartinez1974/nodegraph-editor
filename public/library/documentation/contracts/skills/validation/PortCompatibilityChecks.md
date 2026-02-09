# Skill: PortCompatibilityChecks

## Intent
Prevent invalid or meaningless connections between nodes.

## Reads
- edges[].source / target
- edges[].ports
- nodes[].ports
- port semantic types
- strictness flags

## Writes
- validationResults.ports
- errorNodes (markdown)

## Never Touches
- graph topology
- ports
- edges

## Determinism
Yes.

## Scope
Edges only (existing or proposed).

## Failure Modes
- If port missing, reject edge
- If type mismatch and strict, reject edge

## Notes for AI
Ports are contracts. Do not invent them.
