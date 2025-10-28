# Contributing — GraphEditor

## Welcome

Thanks for helping improve the GraphEditor. This document describes how to contribute, run the project locally, and follow conventions for new features or fixes.

## Local development

- Install dependencies: `npm install` (or `yarn`)
- Start dev server: `npm run dev`
- Lint: `npm run lint`
- Tests: `npm run test` (if tests exist)

## Code style & guidelines

- Follow existing patterns: layered rendering, hooks usage, and `eventBus` for cross-component communication.
- Prefer small focused PRs with one behavioral change.
- Document public APIs (hooks, handlers, created events) in the docs under `components/GraphEditor` and `components/NodeGraph`.

## Adding node types

- Add component to `components/GraphEditor/Nodes` and register in `nodeTypeRegistry.js`.
- Prefer composing with `DefaultNode` for consistent UX.

## Testing

- Add unit tests for parsing/utility functions under `components/NodeGraph/utils` or hooks.
- For component changes, add minimal integration tests where feasible.

## Pull request checklist

- [ ] Code builds and lint passes
- [ ] Relevant docs updated (README or topic docs)
- [ ] Tests added or updated when applicable

## Communication

- Describe the problem, approach, and any compatibility concerns in the PR description.
- Keep changes backwards compatible where possible.

