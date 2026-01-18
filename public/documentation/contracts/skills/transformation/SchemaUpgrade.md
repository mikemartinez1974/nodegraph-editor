# Skill: SchemaUpgrade

## Intent
Upgrade graph to newer schema versions safely and replayably.

## Reads
- current schema version
- upgrade transforms
- graph state

## Writes
- nodes
- edges
- schema version metadata

## Never Touches
- semantic intent
- history log

## Determinism
Yes, when transforms are versioned.

## Scope
Whole graph or declared scope.

## Failure Modes
- If intermediate version missing, abort
- If transform fails, rollback

## Notes for AI
Never skip versions. Always allow dryRun.
