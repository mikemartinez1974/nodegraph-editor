# NodeClassContract v1 Runtime Mapping

This maps `NodeClassContract.v1` fields to current Twilite code paths and highlights gaps.

## Coverage Summary

- Implemented now:
  - apply-time validation for dictionary edits in both UIs
  - canonical class/view refs persisted through dictionary
  - node/editor view resolution through dictionary
- Partial:
  - resolver behavior exists but not fully centralized as a NodeClass runtime
- Missing:
  - load-time contract validation on graph open/import
  - instance-data validation against `dataSchema`
  - strict override enforcement at bind/update time
  - lifecycle hook execution model

## Field -> Code Path Mapping

### Identity and Source

- `nodeType`, `classRef`, `classVersion`, `source`
  - Authoring/apply:
    - `components/GraphEditor/components/SystemNodesPanel.js`
    - `components/GraphEditor/components/DocumentPropertiesDialog.js`
  - Validation:
    - `components/GraphEditor/utils/nodeClassContract.js` (`validateDictionaryAgainstNodeClassContract`)

### View Bindings

- `views.node`, `views.editor`
  - Dictionary lookup and resolution:
    - `components/GraphEditor/GraphEditorContent.js`
      - `resolveDictionaryForNode`
      - `resolveViewEntry`
      - `resolveViewDefinitionForNode`
  - Rendering:
    - `components/GraphEditor/Nodes/DynamicViewNode.js`

### Defaults and Ports

- `defaults.data`, `defaults.ports`, `defaults.size`, `defaults.label`
  - Current state:
    - not enforced as contract defaults during class instance creation
    - instances mostly rely on node creation payload / existing defaults
  - Related code:
    - node create/update flows in `components/GraphEditor/GraphEditorContent.js`
    - node property editing in `components/GraphEditor/components/PropertiesPanel.js`

### Validation Block

- `validation.requiredDataKeys`, `validation.rules`, `validation.onError`
  - Current state:
    - contract shape validated at dictionary apply-time only
    - rules are not yet executed against node instances
  - Related:
    - generic graph invariant validator:
      - `components/GraphEditor/validators/validateGraphInvariants.js`

### Overrides

- `overrides.allow*`, `overrides.dataMode`
  - Current state:
    - validated for shape at apply-time
    - not enforced at runtime mutation boundaries

### Lifecycle

- `lifecycle.hooks`
  - Current state:
    - contract shape exists in schema/example
    - no centralized lifecycle runtime execution path yet

## Immediate Next TODO (ordered)

1. Add **load-time** dictionary class contract validation in `GraphEditorContent` during dictionary resolve/import.
2. Add a `resolveNodeClassContract(nodeType)` helper and return normalized runtime contract object.
3. Enforce defaults/overrides in one bind path (node creation + update), not ad hoc.
4. Add instance-data validation pass (`dataSchema` + `validation.rules`) on save/apply.
5. Add lifecycle hook design with explicit guards (timeout + error policy).

## Acceptance Checkpoint

After steps 1-4, a third-party class should:
- fail fast with actionable diagnostics if malformed
- render deterministically (`node.web`/`editor.web`)
- apply defaults and overrides consistently
- validate instance data before persistence
