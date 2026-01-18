# Contract: Schema Versioning & Migration

## Purpose
Define how schemas evolve without breaking existing graphs, agents, or history.

## Versioning Rules
- Use semantic versioning: MAJOR.MINOR.PATCH
- MAJOR: breaking structural change
- MINOR: additive, backward-compatible
- PATCH: clarifications, defaults, docs only
- Every node schema MUST declare its version

## Allowed Upgrade Paths
- Only forward upgrades are allowed
- Never skip intermediate MAJOR versions
- MINOR upgrades may be batched
- PATCH upgrades are implicit

## Migration Units
- One transform per version step
- Pure functions only
- Input: graph@vN → Output: graph@vN+1
- Must emit migration metadata

## Execution Rules
- dryRun required before commit
- atomic commit required
- rollback on failure required
- never mutate source snapshot

## Deprecation Policy
- Mark deprecated fields explicitly
- Warn for at least one MINOR version
- Remove only on MAJOR bump

## Notes for AI
Never invent migrations. Never skip versions. Never drop data silently.
