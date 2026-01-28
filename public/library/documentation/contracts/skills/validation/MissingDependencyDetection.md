# Skill: MissingDependencyDetection

## Intent
Detect graphs that cannot be safely interpreted or executed.

## Reads
- graph manifest
- declared dependencies
- node types present
- available skills registry

## Writes
- validationResults.dependencies
- errorNodes (markdown)

## Never Touches
- graph structure
- execution state

## Determinism
Yes.

## Scope
Whole graph.

## Failure Modes
- If dependency missing, block execution
- If skill missing, block execution

## Notes for AI
A graph that cannot be understood must not run.
