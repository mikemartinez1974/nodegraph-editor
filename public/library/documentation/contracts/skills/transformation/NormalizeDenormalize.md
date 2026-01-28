# Skill: NormalizeDenormalize

## Intent
Shift between compact and expanded representations without semantic loss.

## Reads
- nodes
- duplicated structures
- source-of-truth annotations

## Writes
- nodes (added/removed)
- references
- normalizationMetadata

## Never Touches
- semantic meaning
- ordering unless explicit

## Determinism
Yes, if rules are explicit.

## Scope
Declared subgraph only.

## Failure Modes
- If no source-of-truth, abort
- If denormalizing, require renormalization path

## Notes for AI
Never denormalize without a return path.
