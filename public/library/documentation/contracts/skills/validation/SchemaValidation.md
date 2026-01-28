# Skill: SchemaValidation

## Intent
Ensure graph structures conform to declared and versioned schemas before any mutation or execution.

## Reads
- nodes[].type
- nodes[].data
- nodes[].handles
- nodes[].width / height
- edges[].source / target / handles
- schema registry
- schema versions

## Writes
- validationResults.schema
- errorNodes (markdown)

## Never Touches
- graph structure
- node positions
- edges
- IDs

## Determinism
Yes. Pure validation.

## Scope
Whole graph.

## Failure Modes
- If schema missing, mark as error
- If version mismatch, warn and stop mutation

## Notes for AI
Fail fast. Never auto-fix schema violations.
