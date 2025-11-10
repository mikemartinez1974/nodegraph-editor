import { useRef, useCallback, useState } from 'react';

/**
 * Hook for managing BackgroundFrame RPC
 * 
 * Usage:
 *   const { bgRef, rpc, postEvent, isReady, methods } = useBackgroundRpc();
 *   <BackgroundFrame ref={bgRef} url={...} />
 *   const result = await rpc('methodName', { arg: value });
 */
export function useBackgroundRpc() {
  const bgRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [methods, setMethods] = useState([]);

  const handleHandshakeComplete = useCallback((availableMethods) => {
    setIsReady(true);
    setMethods(availableMethods);
  }, []);

  const rpc = useCallback(async (method, args = {}, timeout = 10000) => {
    if (!bgRef.current) {
      throw new Error('BackgroundFrame ref not set');
    }
    return bgRef.current.rpc(method, args, timeout);
  }, []);

  const postEvent = useCallback((event, payload) => {
    if (!bgRef.current) {
      console.warn('BackgroundFrame ref not set');
      return;
    }
    bgRef.current.postEvent(event, payload);
  }, []);

  return {
    bgRef,
    rpc,
    postEvent,
    isReady,
    methods,
    handleHandshakeComplete
  };
}
