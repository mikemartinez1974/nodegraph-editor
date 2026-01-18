# Skill: NormalizeSpacing

## Intent
Enforce consistent visual rhythm without full re-layout.

## Reads
- node positions
- spacing rules
- axis selection

## Writes
- nodes[].position

## Never Touches
- ordering
- locked nodes
- edges

## Determinism
Yes.

## Scope
One axis at a time.

## Failure Modes
- If constraints conflict, skip node

## Notes for AI
Preserve relative ordering always.
