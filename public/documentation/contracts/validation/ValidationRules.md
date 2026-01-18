# Contract: Validation Rules

## Purpose
Define global and local invariants that guarantee graph safety and interpretability.

## Validation Order
1. Schema validation
2. Handle compatibility
3. Manifest validation
4. Dependency validation
5. Structural integrity
6. Safety & mutation rules
7. Intent validation

## Error Conditions (hard stop)
- schema violation
- invalid handle reference
- missing dependency
- forbidden mutation
- identity loss

## Warning Conditions
- orphaned nodes
- deprecated schema usage
- unused handles
- redundant structures

## Auto-fixable Conditions
- spacing normalization
- missing optional defaults
- ordering normalization

## Validator Guarantees
- deterministic order
- no mutation during validation
- idempotent
- replayable

## Notes for AI
Validation never changes meaning.
Validation never creates structure.
Validation only reports.
