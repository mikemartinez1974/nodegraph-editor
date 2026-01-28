# Skill: RefactorSplitMerge

## Intent
Restructure graph shape while preserving semantics and identity where possible.

## Reads
- nodes
- edges
- schemas
- semantic annotations

## Writes
- nodes (new or updated)
- edges (rewired)
- redirects / notes (markdown)
- refactorMetadata

## Never Touches
- semantic meaning
- external references without redirect
- history log

## Determinism
Mostly. Depends on split boundaries.

## Scope
Explicit selection or declared refactor target.

## Failure Modes
- If schemas incompatible, abort
- If identity must change, emit redirect

## Notes for AI
Refactor shape, not meaning. Preserve IDs when possible.
