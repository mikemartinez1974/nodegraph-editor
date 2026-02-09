# Skill: AutoLayoutELK

## Intent
Recompute spatial arrangement for global readability without altering meaning.

## Reads
- nodes[].position
- nodes[].width / height
- edges[].source / target / ports
- clusters[].bounds
- document.layoutOptions

## Writes
- nodes[].position
- layoutMetadata.elkGraph

## Never Touches
- node IDs
- edge IDs
- edges[].source / target
- cluster membership
- semantic labels

## Determinism
Yes. Same graph + same options = same layout.

## Scope
Whole graph or selected subgraph.

## Failure Modes
- If ELK fails, preserve previous layout
- If constraints conflict, relax spacing only

## Notes for AI
Rebuild ELK graph from scratch. Never mutate meaning.
