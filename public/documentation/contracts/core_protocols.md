# Core Protocols

## Purpose
Define non-negotiable invariants for all Twilite graphs, tools, and agents.

These rules are above preference, convenience, and optimization.

## Identity vs Value
- Node IDs represent identity
- Data represents value
- Identity must persist across transformations

## Meaning vs Rendering
- Meaning lives in graph data
- Rendering is a view, not truth
- UI state must never alter meaning

## Mutation Rules
- All mutations must be explicit
- All mutations must be reversible
- Destructive mutations require confirmation
- Batch > scatter

## Persistence Guarantees
- Graphs must load without tools
- Graphs must survive version drift
- Graphs must remain interpretable by agents

## Forbidden Patterns
- Snapshot overwrites
- Delete+recreate masquerading as edit
- UI-only fields in graph data
- Silent schema drift

These protocols define civilization inside the graph.
