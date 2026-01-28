# Skill: CompileGraphArtifact

## Intent
Transform a graph into an external, deterministic artifact.

## Reads
- canonical graph data
- manifest metadata
- compilation options

## Writes
- external artifact
- artifact metadata

## Never Touches
- graph state
- editor state

## Determinism
Yes.

## Scope
Whole graph or declared subgraph.

## Failure Modes
- If compilation fails, emit error artifact
- Never partially emit

## Notes for AI
Compilation is interpretation, not execution.
