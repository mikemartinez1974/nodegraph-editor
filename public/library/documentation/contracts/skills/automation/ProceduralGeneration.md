# Skill: ProceduralGeneration

## Intent
Generate large graph structures from compact, parameterized intent.

## Reads
- generation parameters
- templates
- seed values

## Writes
- nodes
- edges
- clusters
- generationMetadata

## Never Touches
- existing semantic structures unless declared

## Determinism
Yes, when seed is fixed.

## Scope
Declared generation target only.

## Failure Modes
- If template invalid, abort
- If ID collision, regenerate deterministically

## Notes for AI
Document inputs and outputs always.
