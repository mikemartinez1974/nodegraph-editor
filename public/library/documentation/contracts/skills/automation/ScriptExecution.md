# Skill: ScriptExecution

## Intent
Execute ScriptNodes to perform constrained, procedural graph mutations safely.

## Reads
- ScriptNodes
- script parameters
- current graph state

## Writes
- graph mutations (transactional)
- execution logs (markdown)
- telemetry metadata

## Never Touches
- schema definitions
- history log
- editor UI state

## Determinism
Depends on script. Must be declared.

## Scope
Declared ScriptNode only.

## Failure Modes
- On error, rollback entire transaction
- If script exceeds limits, abort

## Notes for AI
Scripts are hands, not minds. Keep them constrained.
