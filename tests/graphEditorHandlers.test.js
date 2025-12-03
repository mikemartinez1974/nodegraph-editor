import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphEditorHandlers } from '../components/GraphEditor/handlers/graphEditorHandlers.js';

const createStateStub = () => {
  const nodes = [];
  const edges = [];
  const groups = [];
  const nodesRef = { current: nodes };
  const edgesRef = { current: edges };
  return {
    nodes,
    setNodes: () => {},
    nodesRef,
    edges,
    setEdges: () => {},
    edgesRef,
    groups,
    setGroups: () => {},
    pan: { x: 0, y: 0 },
    zoom: 1,
    selectedNodeIds: [],
    setSelectedNodeIds: () => {},
    selectedEdgeIds: [],
    setSelectedEdgeIds: () => {},
    selectedGroupIds: [],
    setSelectedGroupIds: () => {},
    groupManager: { current: { groups: new Map(), nodeToGroup: new Map() } },
    setSnackbar: () => {},
    setLoading: () => {},
    showNodeList: false,
    setShowNodeList: () => {},
    showGroupList: false,
    setShowGroupList: () => {},
    showGroupProperties: false,
    setShowGroupProperties: () => {},
    nodePanelAnchor: 'left',
    nodeListAnchor: 'right',
    defaultNodeColor: '#1976d2',
    defaultEdgeColor: '#666666'
  };
};

const createHandlers = ({ backgroundRpc, backgroundRpcReady }) => {
  const state = createStateStub();
  const historyHook = { saveToHistory: () => {} };
  const groupManagerHook = {};
  const selectionHook = {};
  const modesHook = {};
  return createGraphEditorHandlers({
    graphAPI: null,
    state,
    historyHook,
    groupManagerHook,
    selectionHook,
    modesHook,
    backgroundRpc,
    backgroundRpcReady
  });
};

describe('createGraphEditorHandlers RPC guard', () => {
  it('refuses to call RPC when readiness is false', async () => {
    let rpcInvoked = false;
    const backgroundRpc = async () => {
      rpcInvoked = true;
      return 'ok';
    };
    const setSnackbarCalls = [];
    const handlers = createGraphEditorHandlers({
      graphAPI: null,
      state: { ...createStateStub(), setSnackbar: (payload) => setSnackbarCalls.push(payload) },
      historyHook: { saveToHistory: () => {} },
      groupManagerHook: {},
      selectionHook: {},
      modesHook: {},
      backgroundRpc,
      backgroundRpcReady: false
    });

    const result = await handlers.handleCallBackgroundMethod('test', { hello: 'world' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'RPC not ready');
    assert.strictEqual(rpcInvoked, false, 'RPC should not be invoked when not ready');
    assert.deepEqual(setSnackbarCalls, [{ open: true, message: 'Background not ready', severity: 'warning' }]);
  });

  it('invokes RPC when readiness callback returns true', async () => {
    let receivedArgs = null;
    const backgroundRpc = async (method, args) => {
      receivedArgs = { method, args };
      return { status: 'ok' };
    };

    const handlers = createGraphEditorHandlers({
      graphAPI: null,
      state: createStateStub(),
      historyHook: { saveToHistory: () => {} },
      groupManagerHook: {},
      selectionHook: {},
      modesHook: {},
      backgroundRpc,
      backgroundRpcReady: () => true
    });

    const result = await handlers.handleCallBackgroundMethod('doIt', { payload: 1 });
    assert.strictEqual(result.success, true);
    assert.deepEqual(result.result, { status: 'ok' });
    assert.deepEqual(receivedArgs, { method: 'doIt', args: { payload: 1 } });
  });

  it('reports errors when RPC invocation rejects', async () => {
    const backgroundRpc = async () => {
      throw new Error('boom');
    };
    const handlers = createHandlers({
      backgroundRpc,
      backgroundRpcReady: true
    });
    const result = await handlers.handleCallBackgroundMethod('boom', {});
    assert.strictEqual(result.success, false);
    assert.match(result.error, /boom/);
  });
});
