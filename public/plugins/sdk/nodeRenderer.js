(function initNodeGraphPluginRenderer(globalContext) {
  const root =
    globalContext ||
    (typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
      ? self
      : undefined);
  if (!root) return;

  const createRenderer = (options = {}) => {
    if (typeof options.render !== 'function') {
      throw new Error('[NodeGraphPluginRenderer] render(options) callback is required');
    }
    const render = options.render;
    const onError = typeof options.onError === 'function' ? options.onError : null;
    const onReady = typeof options.onReady === 'function' ? options.onReady : null;
    const autoHeight = options.autoHeight !== false;

    let sessionToken = null;
    let latestPayload = null;

    const postMessage = (payload) => {
      if (!sessionToken) return;
      try {
        root.parent.postMessage({ ...payload, token: sessionToken }, '*');
      } catch (err) {
        console.error('[NodeGraphPluginRenderer] Failed to post message', err);
      }
    };

    const emitReady = () => {
      postMessage({ type: 'renderer:ready' });
      if (onReady) {
        try {
          onReady(latestPayload);
        } catch (err) {
          console.error('[NodeGraphPluginRenderer] onReady error', err);
        }
      }
    };

    const emitError = (error) => {
      const message = typeof error === 'string' ? error : error?.message || 'Renderer error';
      postMessage({ type: 'renderer:error', error: message });
      if (onError) {
        try {
          onError(message);
        } catch (err) {
          console.error('[NodeGraphPluginRenderer] onError callback failed', err);
        }
      }
    };

    const updateHeight = () => {
      if (!autoHeight) return;
      try {
        const height = document.body?.scrollHeight || document.documentElement?.scrollHeight;
        if (height) {
          postMessage({ type: 'renderer:height', height });
        }
      } catch (err) {
        /* ignore */
      }
    };

    const handlePayload = (payload) => {
      latestPayload = payload;
      try {
        render(payload, { updateHeight, emitEvent: (event, detail) => postMessage({ type: 'renderer:event', event, detail }) });
        updateHeight();
      } catch (err) {
        emitError(err);
      }
    };

    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'node:init') {
        sessionToken = msg.token;
        handlePayload(msg.payload || {});
        emitReady();
        return;
      }
      if (msg.token !== sessionToken) return;
      if (msg.type === 'node:update') {
        handlePayload(msg.payload || {});
        return;
      }
    };

    root.addEventListener('message', handleMessage);
    postMessage({ type: 'renderer:hello' });

    return {
      destroy() {
        root.removeEventListener('message', handleMessage);
      }
    };
  };

  root.NodeGraphPluginRenderer = {
    createRenderer
  };
})(typeof window !== 'undefined' ? window : undefined);
