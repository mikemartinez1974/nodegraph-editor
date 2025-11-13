import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterNodesForPanel } from '../components/GraphEditor/utils/nodeFilters.js';

const sampleNodes = [
  {
    id: 'alpha',
    type: 'default',
    label: 'Alpha Controller',
    visible: true,
    width: 140,
    height: 80,
    data: { memo: 'primary node memo', link: '' },
  },
  {
    id: 'beta',
    type: 'markdown',
    label: 'Beta Panel',
    visible: false,
    width: 220,
    height: 120,
    data: { memo: '', link: 'https://beta.dev' },
  },
  {
    id: 'gamma',
    type: 'default',
    label: 'Gamma Utility',
    visible: true,
    width: 60,
    height: 40,
    data: { memo: 'memo for gamma', link: 'https://gamma.dev' },
  },
];

describe('filterNodesForPanel', () => {
  it('matches free-text searches across multiple node fields', () => {
    const byLabel = filterNodesForPanel(sampleNodes, { text: 'controller' });
    assert.deepEqual(byLabel.map(n => n.id), ['alpha']);

    const byId = filterNodesForPanel(sampleNodes, { text: 'gamma' });
    assert.deepEqual(byId.map(n => n.id).sort(), ['alpha', 'gamma']);

    const byMemo = filterNodesForPanel(sampleNodes, { text: 'memo for gamma' });
    assert.deepEqual(byMemo.map(n => n.id), ['gamma']);

    const byLink = filterNodesForPanel(sampleNodes, { text: 'beta.dev' });
    assert.deepEqual(byLink.map(n => n.id), ['beta']);
  });

  it('filters by type, visibility, and memo/link presence', () => {
    const typeFilter = filterNodesForPanel(sampleNodes, { types: ['markdown'] });
    assert.deepEqual(typeFilter.map(n => n.id), ['beta']);

    const memoOnly = filterNodesForPanel(sampleNodes, { hasMemo: true });
    assert.deepEqual(memoOnly.map(n => n.id).sort(), ['alpha', 'gamma']);

    const linkOnly = filterNodesForPanel(sampleNodes, { hasLink: true });
    assert.deepEqual(linkOnly.map(n => n.id).sort(), ['beta', 'gamma']);

    const hiddenOnly = filterNodesForPanel(sampleNodes, { includeVisible: false, includeHidden: true });
    assert.deepEqual(hiddenOnly.map(n => n.id), ['beta']);
  });

  it('applies width and height thresholds', () => {
    const wideNodes = filterNodesForPanel(sampleNodes, { minWidth: 200 });
    assert.deepEqual(wideNodes.map(n => n.id), ['beta']);

    const compactNodes = filterNodesForPanel(sampleNodes, { maxHeight: 80 });
    assert.deepEqual(compactNodes.map(n => n.id).sort(), ['alpha', 'gamma']);

    const constrained = filterNodesForPanel(sampleNodes, {
      minWidth: 80,
      maxWidth: 200,
      minHeight: 50,
      maxHeight: 100,
    });
    assert.deepEqual(constrained.map(n => n.id), ['alpha']);
  });
});
