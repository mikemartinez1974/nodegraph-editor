# Skill: AlignDistribute

## Intent
Normalize alignment and spacing on explicit user selection.

## Reads
- selected nodes[].position
- alignment mode
- grid settings

## Writes
- selected nodes[].position

## Never Touches
- unselected nodes
- edges
- clusters

## Determinism
Yes.

## Scope
Explicit selection only.

## Failure Modes
- If <2 nodes selected, no-op

## Notes for AI
Do not infer intent from proximity.
