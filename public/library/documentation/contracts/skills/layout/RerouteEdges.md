# Skill: RerouteEdges

## Intent
Improve readability by recomputing edge paths without altering relationships.

## Reads
- edges[].source / target
- edges[].ports
- node bounds
- cluster bounds
- routingOptions

## Writes
- edges[].edgeRoutes
- edges[].waypoints
- routingMetadata

## Never Touches
- node positions
- edge endpoints
- edge IDs
- semantic labels

## Determinism
Yes.

## Scope
Selected edges or all edges.

## Failure Modes
- If routing fails, preserve previous routes
- If ports missing, abort

## Notes for AI
Ports are law. Never guess.
