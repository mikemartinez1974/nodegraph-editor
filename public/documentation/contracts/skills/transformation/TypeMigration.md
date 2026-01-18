# Skill: TypeMigration

## Intent
Safely upgrade or change node types while preserving identity and data.

## Reads
- node.type
- node.data
- target schema
- migration map

## Writes
- node.type
- node.data
- version notes (markdown)

## Never Touches
- node ID
- edges

## Determinism
Yes.

## Scope
Selected nodes only.

## Failure Modes
- If target schema invalid, abort
- If data loss detected, require confirmation

## Notes for AI
Migrate field-by-field. Never replace blindly.
