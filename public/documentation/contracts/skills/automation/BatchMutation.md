# Skill: BatchMutation

## Intent
Apply many mutations as a single logical, reversible operation.

## Reads
- mutation plan
- current graph state

## Writes
- nodes
- edges
- groups
- batchMetadata

## Never Touches
- history outside batch
- schema definitions

## Determinism
Yes, if plan is static.

## Scope
Explicit batch only.

## Failure Modes
- If any step fails, rollback all
- If validation fails, abort

## Notes for AI
Validate entire plan before execution.
