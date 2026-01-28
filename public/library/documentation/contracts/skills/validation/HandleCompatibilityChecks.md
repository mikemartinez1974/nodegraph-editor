# Skill: HandleCompatibilityChecks

## Intent
Prevent invalid or meaningless connections between nodes.

## Reads
- edges[].source / target
- edges[].handles
- nodes[].handles
- handle semantic types
- strictness flags

## Writes
- validationResults.handles
- errorNodes (markdown)

## Never Touches
- graph topology
- handles
- edges

## Determinism
Yes.

## Scope
Edges only (existing or proposed).

## Failure Modes
- If handle missing, reject edge
- If type mismatch and strict, reject edge

## Notes for AI
Handles are contracts. Do not invent them.
