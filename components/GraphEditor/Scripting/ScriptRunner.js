import React, { useEffect, useRef, useState } from 'react';

const DEFAULT_TIMEOUT = 8000;

const bootstrapSrcDoc = `<!doctype html><html><head><meta charset="utf-8"/></head><body><script>
(function(){
  const pending = new Map();
  let seq = 1;

  function hostCall(method, args) {
    return new Promise((resolve, reject) => {
      const id = String(seq++);
      pending.set(id, { resolve, reject });
      parent.postMessage({ type: 'rpcRequest', id, method, args }, '*');
    });
  }

  window.addEventListener('message', (ev) => {
    try {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'rpcResponse') {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.error) p.reject(msg.error); else p.resolve(msg.result);
      }

      if (msg.type === 'runScript') {
        (async () => {
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
            parent.postMessage({ type: 'scriptResult', success: true, result }, '*');
          } catch (err) {
            parent.postMessage({ type: 'scriptResult', success: false, error: String(err && err.stack ? err.stack : err) }, '*');
          }
        })();
      }

    } catch (e) { }
  }, false);

  parent.postMessage({ type: 'runnerReady' }, '*');
})();
</script></body></html>`;

export default function ScriptRunner({ onRequest, timeoutMs = DEFAULT_TIMEOUT }) {
  const iframeRef = useRef(null);
  const readyRef = useRef(false);
  const waitersRef = useRef([]);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    function handleMessage(ev) {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'runnerReady') {
        readyRef.current = true;
        waitersRef.current.forEach(fn => fn());
        waitersRef.current = [];
        return;
      }

      if (msg.type === 'rpcRequest' && typeof onRequest === 'function') {
        const { id, method, args } = msg;
        Promise.resolve().then(() => onRequest(method, args)).then(result => {
          iframeRef.current?.contentWindow?.postMessage({ type: 'rpcResponse', id, result }, '*');
        }).catch(err => {
          iframeRef.current?.contentWindow?.postMessage({ type: 'rpcResponse', id, result: null, error: String(err) }, '*');
        });
        return;
      }

      if (msg.type === 'scriptResult') {
        setLastResult(msg);
        window.dispatchEvent(new CustomEvent('scriptRunnerResult', { detail: msg }));
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRequest]);

  const ensureReady = () => {
    if (readyRef.current) return Promise.resolve();
    return new Promise(resolve => waitersRef.current.push(resolve));
  };

  async function runScript(scriptText = '') {
    // Ensure the iframe element is mounted
    if (!iframeRef.current) {
      // Wait a tick so React can mount it
      await new Promise(r => setTimeout(r, 0));
    }

    await ensureReady();

    return new Promise(resolve => {
      let finished = false;
      const onResult = (ev) => {
        const msg = ev.detail || ev.data;
        if (!msg || msg.type !== 'scriptResult') return;
        finished = true;
        window.removeEventListener('scriptRunnerResult', onResult);
        resolve(msg);
      };

      window.addEventListener('scriptRunnerResult', onResult);
      iframeRef.current?.contentWindow?.postMessage({ type: 'runScript', script: scriptText }, '*');

      setTimeout(() => {
        if (!finished) {
          window.removeEventListener('scriptRunnerResult', onResult);
          resolve({ success: false, error: 'Script timed out' });
        }
      }, timeoutMs);
    });
  }

  useEffect(() => {
    window.__scriptRunner = { run: runScript, lastResult };
    return () => { if (window.__scriptRunner) delete window.__scriptRunner; };
  }, [lastResult]);

  return (
    <iframe
      ref={iframeRef}
      title="script-runner"
      sandbox="allow-scripts"
      srcDoc={bootstrapSrcDoc}
      style={{ display: 'none' }}
    />
  );
}
