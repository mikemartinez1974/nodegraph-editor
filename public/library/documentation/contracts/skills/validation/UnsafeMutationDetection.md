# Skill: UnsafeMutationDetection

## Intent
Prevent destructive operations that damage continuity, history, or trust.

## Reads
- proposed mutations
- diff between states
- operation history
- user confirmation flags

## Writes
- validationResults.safety
- warningNodes (markdown)
- mutationBlocks

## Never Touches
- existing graph state

## Determinism
Yes.

## Scope
All mutations.

## Failure Modes
- If destructive pattern detected, block and require confirmation

## Notes for AI
Protect history. Time is sacred.
