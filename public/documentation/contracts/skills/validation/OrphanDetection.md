# Skill: OrphanDetection

## Intent
Identify disconnected or abandoned structures that may indicate incomplete thought.

## Reads
- nodes
- edges
- groups
- scratchpad flags

## Writes
- validationResults.orphans
- warningNodes (markdown)

## Never Touches
- graph structure
- edges
- groups

## Determinism
Yes.

## Scope
Whole graph.

## Failure Modes
- None. This skill never blocks, only warns.

## Notes for AI
Offer repair suggestions. Never auto-delete.
