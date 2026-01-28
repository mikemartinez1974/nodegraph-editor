# Skill: InlineExtract

## Intent
Move structure between abstraction layers to optimize clarity or reuse.

## Reads
- nodes
- edges
- abstraction markers
- reference counts

## Writes
- nodes (inlined or extracted)
- edges (updated)
- abstractionMetadata

## Never Touches
- semantic relationships
- ordering unless explicit

## Determinism
Yes.

## Scope
Declared target only.

## Failure Modes
- If references ambiguous, abort
- If atomic update fails, rollback

## Notes for AI
Update references atomically. Never leave half-states.
