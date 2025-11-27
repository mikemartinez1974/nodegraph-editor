import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_TIMEOUT = 8000;
const MAX_CALLS_PER_RUN = 200;

const createBootstrapSrcDoc = (token) => `<!doctype html><html><head><meta charset="utf-8"/></head><body><script>
(function(){
  const pending = new Map();
  let seq = 1;
  const SESSION_TOKEN = "${token}";
  window.__runMeta = null;

  function post(msg) {
    try {
      parent.postMessage({ ...msg, token: SESSION_TOKEN }, '*');
    } catch (err) {
      console.error('[ScriptRunner] failed to post message', err);
    }
  }

  function hostCall(method, args) {
    return new Promise((resolve, reject) => {
      const id = String(seq++);
      pending.set(id, { resolve, reject });
      post({ type: 'rpcRequest', id, method, args, meta: window.__runMeta });
    });
  }

  window.addEventListener('message', (ev) => {
    try {
      if (ev.source !== parent) return;
      const msg = ev.data;
      if (!msg || typeof msg !== 'object' || msg.token !== SESSION_TOKEN) return;

      if (msg.type === 'rpcResponse') {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.error) p.reject(msg.error); else p.resolve(msg.result);
      }

      if (msg.type === 'runScript') {
        (async () => {
          window.__runMeta = msg.meta || null;
          const scriptText = msg.script || '';
          const api = {
            getNodes: (...a)=>hostCall('getNodes', a),
            getNode: (...a)=>hostCall('getNode', a),
            getEdges: (...a)=>hostCall('getEdges', a),
            createNode: (...a)=>hostCall('createNode', a),
            updateNode: (...a)=>hostCall('updateNode', a),
            deleteNode: (...a)=>hostCall('deleteNode', a),
            createEdge: (...a)=>hostCall('createEdge', a),
            deleteEdge: (...a)=>hostCall('deleteEdge', a),
            log: (...a)=>hostCall('log', a)
          };

          try {
            const userFn = new Function('api', '"use strict"; return (async (api)=>{ ' + scriptText + ' })(api);');
            const result = await userFn(api);
            post({ type: 'scriptResult', success: true, result, runId: msg.meta?.runId || null });
          } catch (err) {
            post({ type: 'scriptResult', success: false, error: String(err && err.stack ? err.stack : err), runId: msg.meta?.runId || null });
          } finally {
            window.__runMeta = null;
          }
        })();
      }
    } catch (e) {
      post({ type: 'scriptResult', success: false, error: 'Runner error: ' + e, runId: null });
    }
  }, false);

  post({ type: 'runnerReady' });
})();
</script></body></html>`;

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ScriptRunner({ onRequest, timeoutMs = DEFAULT_TIMEOUT }) {
  const iframeRef = useRef(null);
  const readyRef = useRef(false);
  const waitersRef = useRef([]);
  const [lastResult, setLastResult] = useState(null);
  const [runnerKey, setRunnerKey] = useState(0);
  const activeRunRef = useRef(null);
  const pendingTimeoutRef = useRef(null);
  const callCountRef = useRef(0);

  const sessionToken = useMemo(() => generateToken(), [runnerKey]);
  const srcDoc = useMemo(() => createBootstrapSrcDoc(sessionToken), [sessionToken]);

  useEffect(() => {
    readyRef.current = false;
    waitersRef.current = [];
    activeRunRef.current = null;
    callCountRef.current = 0;
  }, [sessionToken]);

  useEffect(() => {
    function handleMessage(ev) {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const msg = ev.data;
      if (!msg || typeof msg !== 'object' || msg.token !== sessionToken) return;

      if (msg.type === 'runnerReady') {
        readyRef.current = true;
        waitersRef.current.forEach(fn => fn());
        waitersRef.current = [];
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          try {
            window.dispatchEvent(new CustomEvent('scriptRunnerReady'));
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[ScriptRunner] Failed to dispatch readiness event:', err);
          }
        }
        return;
      }

      if (msg.type === 'rpcRequest' && typeof onRequest === 'function') {
        if (activeRunRef.current && msg.meta?.runId !== activeRunRef.current) {
          iframeRef.current?.contentWindow?.postMessage({ type: 'rpcResponse', id: msg.id, error: 'Run aborted', token: sessionToken }, '*');
          return;
        }

        callCountRef.current += 1;
        if (callCountRef.current > MAX_CALLS_PER_RUN) {
          iframeRef.current?.contentWindow?.postMessage({ type: 'rpcResponse', id: msg.id, error: 'Operation limit exceeded', token: sessionToken }, '*');
          return;
        }

        const { id, method, args, meta } = msg;
        Promise.resolve()
          .then(() => onRequest(method, args, meta))
          .then(result => {
            iframeRef.current?.contentWindow?.postMessage({ type: 'rpcResponse', id, result, token: sessionToken }, '*');
          })
          .catch(err => {
            iframeRef.current?.contentWindow?.postMessage({ type: 'rpcResponse', id, result: null, error: String(err), token: sessionToken }, '*');
          });
        return;
      }

      if (msg.type === 'scriptResult') {
        if (activeRunRef.current && msg.runId && msg.runId !== activeRunRef.current) {
          return;
        }
        activeRunRef.current = null;
        if (pendingTimeoutRef.current) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
        setLastResult(msg);
        callCountRef.current = 0;
        window.dispatchEvent(new CustomEvent('scriptRunnerResult', { detail: msg }));
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRequest, sessionToken]);

  const ensureReady = () => {
    if (readyRef.current) return Promise.resolve();
    return new Promise(resolve => waitersRef.current.push(resolve));
  };

  const resetRunner = (reason) => {
    readyRef.current = false;
    waitersRef.current = [];
    activeRunRef.current = null;
    callCountRef.current = 0;
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    setRunnerKey(key => key + 1);
    window.dispatchEvent(new CustomEvent('scriptRunnerResult', { detail: { type: 'scriptResult', success: false, error: reason || 'Script runner reset', runId: null } }));
  };

  async function runScript(scriptText = '', meta = {}) {
    if (!iframeRef.current) {
      await new Promise(r => setTimeout(r, 0));
    }

    await ensureReady();

    return new Promise(resolve => {
      const runId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      activeRunRef.current = runId;
      callCountRef.current = 0;

      const onResult = (ev) => {
        const msg = ev.detail || ev.data;
        if (!msg || msg.type !== 'scriptResult') return;
        if (msg.runId && msg.runId !== runId) return;
        window.removeEventListener('scriptRunnerResult', onResult);
        resolve(msg);
      };

      window.addEventListener('scriptRunnerResult', onResult);
      iframeRef.current?.contentWindow?.postMessage({ type: 'runScript', script: scriptText, meta: { ...meta, runId }, token: sessionToken }, '*');

      pendingTimeoutRef.current = setTimeout(() => {
        if (activeRunRef.current === runId) {
          window.removeEventListener('scriptRunnerResult', onResult);
          resolve({ success: false, error: 'Script timed out', runId });
          resetRunner('Script timed out');
        }
      }, timeoutMs);
    });
  }

  useEffect(() => {
    window.__scriptRunner = { run: runScript, reset: resetRunner, lastResult };
    return () => { if (window.__scriptRunner) delete window.__scriptRunner; };
  }, [lastResult, sessionToken]);

  return (
    <iframe
      key={runnerKey}
      ref={iframeRef}
      title="script-runner"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ display: 'none' }}
    />
  );
}
