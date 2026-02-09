import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import validatePluginManifest from '../components/GraphEditor/plugins/manifestSchema.js';

const baseManifest = {
  id: 'com.example.widget',
  version: '1.0.0',
  name: 'Example Plugin',
  permissions: ['graph.read', 'graph.mutate'],
  bundle: {
    url: 'https://example.com/plugins/bundle.js',
    sandbox: 'iframe',
    integrity: 'sha256-abc123xyz=',
  },
  nodes: [
    {
      type: 'example.widget',
      entry: 'https://example.com/plugins/node.js#Widget',
      label: 'Widget',
      definition: {
        ports: {
          inputs: [{ id: 'in', label: 'In', dataType: 'value' }],
          outputs: [{ id: 'out', label: 'Out', dataType: 'value' }]
        }
      }
    }
  ],
};

describe('Plugin manifest validation', () => {
  it('accepts a valid manifest and preserves normalized fields', () => {
    const { valid, manifest, errors } = validatePluginManifest(baseManifest);
    assert.equal(valid, true);
    assert.equal(errors?.length || 0, 0);
    assert.equal(manifest.bundle.sandbox, 'iframe');
    assert.equal(manifest.bundle.integrity, 'sha256-abc123xyz=');
    assert.equal(manifest.nodes.length, 1);
  });

  it('rejects manifests with unsupported sandbox targets', () => {
    const invalid = {
      ...baseManifest,
      bundle: { ...baseManifest.bundle, sandbox: 'popup' }
    };
    const { valid, errors } = validatePluginManifest(invalid);
    assert.equal(valid, false);
    assert.match(errors[0], /sandbox must be either "iframe" or "worker"/);
  });

  it('rejects manifest integrity values that are not valid SRI hashes', () => {
    const invalid = {
      ...baseManifest,
      bundle: { ...baseManifest.bundle, integrity: 'not-a-hash' }
    };
    const { valid, errors } = validatePluginManifest(invalid);
    assert.equal(valid, false);
    assert.match(errors[0], /bundle\.integrity must be a valid SRI hash/);
  });
});
