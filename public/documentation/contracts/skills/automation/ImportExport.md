# Skill: ImportExport

## Intent
Move graphs across systems safely and reversibly.

## Reads
- external graph data
- schemas
- import/export options

## Writes
- create-deltas (import)
- exported artifacts
- portabilityMetadata

## Never Touches
- existing graph unless declared
- history without log

## Determinism
Yes, when inputs fixed.

## Scope
Declared import/export target.

## Failure Modes
- If schema invalid, abort
- If ID collision, require fork

## Notes for AI
Import as deltas, never snapshots.
