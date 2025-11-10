import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react';

/**
 * BackgroundFrame component - renders an iframe and handles RPC communication
 * 
 * Props:
 *   - url: The URL to load in the iframe
 *   - interactive: Whether the iframe should receive pointer events
 *   - onHandshakeComplete: Called when RPC handshake completes with available methods
 * 
 * Ref methods:
 *   - rpc(method, args, timeout): Call an RPC method
 *   - postEvent(event, payload): Post an event to the iframe
 */
const BackgroundFrame = forwardRef(({ url, interactive = false, onHandshakeComplete }, ref) => {
  const iframeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [availableMethods, setAvailableMethods] = useState([]);
  const pendingCalls = useRef(new Map());
  const nextId = useRef(1);

  // Send message to iframe
  const sendMessage = useCallback((msg) => {
    if (!iframeRef.current?.contentWindow) {
      console.warn('[BackgroundFrame] No iframe contentWindow available');
      return;
    }
    
    try {
      iframeRef.current.contentWindow.postMessage(msg, url || '*');
    } catch (err) {
      console.error('[BackgroundFrame] Failed to send message:', err);
    }
  }, [url]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      // Validate origin
      if (url && event.origin !== new URL(url).origin) {
        return;
      }

      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      // Handle handshake response
      if (msg.type === 'handshake' && Array.isArray(msg.methods)) {
        console.log('[BackgroundFrame] Handshake complete, methods:', msg.methods);
        setReady(true);
        setAvailableMethods(msg.methods);
        if (onHandshakeComplete) {
          onHandshakeComplete(msg.methods);
        }
        return;
      }

      // Handle RPC response
      if (msg.type === 'rpc:response' && msg.requestId) {
        const pending = pendingCalls.current.get(msg.requestId);
        if (pending) {
          pendingCalls.current.delete(msg.requestId);
          clearTimeout(pending.timeout);
          
          if (msg.ok) {
            pending.resolve(msg.result);
          } else {
            pending.reject(new Error(msg.error || 'RPC call failed'));
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [url, onHandshakeComplete]);

  // Send handshake probe when iframe loads
  useEffect(() => {
    if (!iframeRef.current || !url) return;

    const handleLoad = () => {
      console.log('[BackgroundFrame] iframe loaded, sending handshake probe...');
      // Small delay to ensure iframe script is ready
      setTimeout(() => {
        sendMessage({ type: 'handshake:probe' });
      }, 100);
    };

    const iframe = iframeRef.current;
    iframe.addEventListener('load', handleLoad);
    
    // Also try immediately if already loaded
    if (iframe.contentWindow) {
      handleLoad();
    }
    
    return () => iframe.removeEventListener('load', handleLoad);
  }, [url, sendMessage]);

  // Expose RPC methods via ref
  useImperativeHandle(ref, () => ({
    rpc: async (method, args = {}, timeout = 10000) => {
      if (!ready) {
        throw new Error('BackgroundFrame not ready - handshake not complete');
      }

      return new Promise((resolve, reject) => {
        const requestId = `rpc_${nextId.current++}`;
        
        const timeoutId = setTimeout(() => {
          pendingCalls.current.delete(requestId);
          reject(new Error(`RPC timeout: ${method}`));
        }, timeout);

        pendingCalls.current.set(requestId, { resolve, reject, timeout: timeoutId });

        sendMessage({
          type: 'rpc:request',
          requestId,
          method,
          args
        });
      });
    },

    postEvent: (event, payload) => {
      sendMessage({ type: 'event', event, payload });
    }
  }), [ready, sendMessage]);

  if (!url) return null;

  return (
    <iframe
      ref={iframeRef}
      src={url}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        pointerEvents: interactive ? 'auto' : 'none',
        zIndex: 0
      }}
      sandbox="allow-scripts allow-same-origin"
      title="Background Document"
    />
  );
});

BackgroundFrame.displayName = 'BackgroundFrame';

export default BackgroundFrame;
