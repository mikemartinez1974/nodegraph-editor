# Skill: AvoidCollisions

## Intent
Resolve overlaps while preserving spatial trust.

## Reads
- node bounds
- cluster bounds
- spacing rules

## Writes
- nodes[].position

## Never Touches
- edge routes
- cluster membership
- locked nodes

## Determinism
Mostly. Depends on conflict order.

## Scope
Local neighborhoods only.

## Failure Modes
- If resolution impossible, stop early
- Never teleport nodes

## Notes for AI
Prefer small incremental moves.
