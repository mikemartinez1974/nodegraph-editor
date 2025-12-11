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
- Update `tests/pluginManifest.test.js` whenever you modify the plugin manifest contract so `npm test` keeps the validator hardening covered.

## Plugin manifest QA

- Respect the manifest schema: `bundle.sandbox` must be `iframe` or `worker`, `bundle.url` must resolve to `http`/`https`, and `bundle.integrity` (when provided) must be a valid SRI hash (`sha256`, `sha384`, or `sha512`).
- Document schema expectations in `components/GraphEditor/GraphAPIdocumentation.md` so new authors know the required fields, and mention any additional rollout notes in the Plugin Manager docs.
- `npm test` now runs both GraphCRUD and plugin manifest validation suites (`tests/*.test.js`), so add coverage when introducing runtime/validation adjustments and keep the CLI docs and QA steps up to date.

## Pull request checklist

- [ ] Code builds and lint passes
- [ ] Relevant docs updated (README or topic docs)
- [ ] Tests added or updated when applicable

## Communication

- Describe the problem, approach, and any compatibility concerns in the PR description.
- Keep changes backwards compatible where possible.

