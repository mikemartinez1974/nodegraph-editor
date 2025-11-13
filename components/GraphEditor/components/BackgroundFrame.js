import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState, useMemo } from 'react';

const DEFAULT_ALLOWED_ORIGINS =
  typeof window !== 'undefined' && window.location?.origin
    ? [window.location.origin]
    : [];

const generateToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * BackgroundFrame component - renders an iframe and handles RPC communication
 *
 * Props:
 *   - url: The URL to load in the iframe
 *   - interactive: Whether the iframe should receive pointer events
 *   - onHandshakeComplete: Called when RPC handshake completes with available methods
 *   - allowedOrigins: Array of permitted iframe origins (defaults to current origin)
 *
 * Ref methods:
 *   - rpc(method, args, timeout): Call an RPC method
 *   - postEvent(event, payload): Post an event to the iframe
 */
const BackgroundFrame = forwardRef(
  ({ url, interactive = false, onHandshakeComplete, allowedOrigins = DEFAULT_ALLOWED_ORIGINS }, ref) => {
    const iframeRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [availableMethods, setAvailableMethods] = useState([]);
    const pendingCalls = useRef(new Map());
    const nextId = useRef(1);
    const [sessionToken, setSessionToken] = useState(() => generateToken());
    const normalizedAllowedOrigins = Array.isArray(allowedOrigins)
      ? allowedOrigins
      : allowedOrigins
      ? [allowedOrigins]
      : [];

    useEffect(() => {
      setSessionToken(generateToken());
      setReady(false);
      setAvailableMethods([]);
      pendingCalls.current.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject?.(new Error('Background frame reloaded'));
      });
      pendingCalls.current.clear();
    }, [url]);

    const allowedOriginSet = useMemo(() => {
      const set = new Set();
      normalizedAllowedOrigins.forEach(origin => {
        if (origin) set.add(origin);
      });

      if (url) {
        try {
          const resolved = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
          set.add(resolved.origin);
          if (resolved.protocol === 'data:' || resolved.protocol === 'blob:') {
            set.add('null');
          }
        } catch {
          set.add('null');
        }
      } else {
        set.add('null');
      }

      if (set.size === 0 && typeof window !== 'undefined' && window.location?.origin) {
        set.add(window.location.origin);
      }

      return set;
    }, [normalizedAllowedOrigins, url]);

    const getTargetOrigin = useCallback(() => {
      if (!url) return '*';
      try {
        const resolved = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
        if (resolved.protocol === 'data:' || resolved.protocol === 'blob:') {
          return '*';
        }
        return resolved.origin;
      } catch {
        return '*';
      }
    }, [url]);

    const isAllowedOrigin = useCallback(
      (origin) => {
        if (origin === 'null') {
          return allowedOriginSet.has('null');
        }
        return allowedOriginSet.has(origin);
      },
      [allowedOriginSet]
    );

    // Send message to iframe
    const sendMessage = useCallback(
      (msg) => {
        if (!iframeRef.current?.contentWindow) {
          console.warn('[BackgroundFrame] No iframe contentWindow available');
          return;
        }

        try {
          iframeRef.current.contentWindow.postMessage({ ...msg, token: sessionToken }, getTargetOrigin());
        } catch (err) {
          console.error('[BackgroundFrame] Failed to send message:', err);
        }
      },
      [getTargetOrigin, sessionToken]
    );

    // Handle messages from iframe
    useEffect(() => {
      const handleMessage = (event) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        if (!isAllowedOrigin(event.origin)) return;

        const msg = event.data;
        if (!msg || typeof msg !== 'object' || msg.token !== sessionToken) return;

        if (msg.type === 'handshake' && Array.isArray(msg.methods)) {
          setReady(true);
          setAvailableMethods(msg.methods);
          if (onHandshakeComplete) {
            onHandshakeComplete(msg.methods);
          }
          return;
        }

        if (msg.type === 'rpc:response' && msg.requestId) {
          const pending = pendingCalls.current.get(msg.requestId);
          if (pending) {
            pendingCalls.current.delete(msg.requestId);
            clearTimeout(pending.timeout);

            if (msg.ok !== false && !msg.error) {
              pending.resolve(msg.result);
            } else {
              pending.reject(new Error(msg.error || 'RPC call failed'));
            }
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [isAllowedOrigin, onHandshakeComplete, sessionToken]);

    // Send handshake probe when iframe loads
    useEffect(() => {
      if (!iframeRef.current || !url) return;

      const handleLoad = () => {
        // Small delay to ensure iframe script is ready
        setTimeout(() => {
          sendMessage({ type: 'handshake:probe' });
        }, 100);
      };

      const iframe = iframeRef.current;
      iframe.addEventListener('load', handleLoad);

      if (iframe.contentWindow) {
        handleLoad();
      }

      return () => iframe.removeEventListener('load', handleLoad);
    }, [url, sendMessage]);

    useEffect(() => {
      return () => {
        pendingCalls.current.forEach(({ reject, timeout }) => {
          clearTimeout(timeout);
          reject?.(new Error('Background frame unmounted'));
        });
        pendingCalls.current.clear();
      };
    }, []);

    // Expose RPC methods via ref
    useImperativeHandle(
      ref,
      () => ({
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
      }),
      [ready, sendMessage]
    );

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
  }
);

BackgroundFrame.displayName = 'BackgroundFrame';

export default BackgroundFrame;
