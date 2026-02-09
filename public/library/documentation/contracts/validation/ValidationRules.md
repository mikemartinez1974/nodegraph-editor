# Contract: Validation Rules

## Purpose
Define global and local invariants that guarantee graph safety and interpretability.

## Validation Order
1. Schema validation
2. Port compatibility
3. Manifest validation
4. Dependency validation
5. Structural integrity
6. Safety & mutation rules
7. Intent validation

## Error Conditions (hard stop)
- schema violation
- invalid port reference
- missing dependency
- forbidden mutation
- identity loss
- intent/content mismatch (semantic contradiction)

## Warning Conditions
- orphaned nodes
- deprecated schema usage
- unused ports
- redundant structures
- missing position or size (presentation gaps)
- missing optional ports (inferred)

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
Semantic coherence beats presentation polish.
