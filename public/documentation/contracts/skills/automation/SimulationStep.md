# Skill: SimulationStep

## Intent
Advance graph state through reversible, time-based execution.

## Reads
- simulation rules
- current state
- previous state snapshot

## Writes
- updated state
- state history
- simulationMetadata

## Never Touches
- source definitions
- schemas

## Determinism
Yes, if rules are pure.

## Scope
Declared simulation scope.

## Failure Modes
- If step invalid, rollback
- If state corrupt, halt simulation

## Notes for AI
Mark transient vs persistent state clearly.
