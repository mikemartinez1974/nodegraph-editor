/**
 * IframeRpcListener - Add this component to any React/Next page that will be embedded
 * 
 * It implements the RPC protocol and responds to requests from the host.
 * 
 * Usage in embedded page:
 *   import IframeRpcListener from './IframeRpcListener';
 *   
 *   function MyEmbeddedPage() {
 *     return (
 *       <>
 *         <IframeRpcListener />
 *         <div>Your page content</div>
 *       </>
 *     );
 *   }
 */

import { useEffect } from 'react';

export default function IframeRpcListener({ allowedOrigins = [] }) {
  useEffect(() => {
    // Default allowed origins - customize based on your deployment
    const ALLOWED_PARENT_ORIGINS = allowedOrigins.length > 0 
      ? allowedOrigins 
      : [
          'http://localhost:3000',
          'https://localhost:3000',
          // Add your production domain here
          // 'https://your-app.example.com'
        ];

    // Methods this iframe exposes to the parent
    // Add your custom methods here - keep them safe and limited
    const methods = {
      /**
       * Example: Get current state
       */
      getState: () => {
        return {
          title: document.title,
          url: window.location.href,
          timestamp: Date.now()
        };
      },

      /**
       * Example: Get document info
       */
      getDocumentInfo: () => {
        return {
          title: document.title,
          readyState: document.readyState,
          width: window.innerWidth,
          height: window.innerHeight
        };
      },

      /**
       * Example: Echo back the input
       */
      echo: ({ message }) => {
        return { echo: message, timestamp: Date.now() };
      }

      // Add more methods as needed:
      // setLight: ({ on }) => { ... },
      // getValue: ({ key }) => { ... },
      // etc.
    };

    function postResponse(target, requestId, ok, result, error) {
      try {
        target.postMessage(
          { type: 'rpc:response', requestId, ok, result, error },
          '*' // Origin is validated on receive, not send
        );
      } catch (err) {
        console.error('[IframeRpcListener] Failed to post response:', err);
      }
    }

    function handleMessage(e) {
      // Strict origin validation
      if (!ALLOWED_PARENT_ORIGINS.includes(e.origin)) {
        console.warn('[IframeRpcListener] Message from disallowed origin:', e.origin);
        return;
      }

      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;

      // Handshake probe - advertise available methods
      if (msg.type === 'handshake:probe') {
        try {
          e.source.postMessage(
            { type: 'handshake', methods: Object.keys(methods) },
            e.origin
          );
          console.log('[IframeRpcListener] Handshake sent to', e.origin);
        } catch (err) {
          console.error('[IframeRpcListener] Failed to send handshake:', err);
        }
        return;
      }

      // RPC request
      if (msg.type === 'rpc:request' && msg.requestId && typeof msg.method === 'string') {
        const fn = methods[msg.method];
        
        if (!fn) {
          postResponse(e.source, msg.requestId, false, null, 'Method not found');
          return;
        }

        // Execute method and return result
        Promise.resolve()
          .then(() => fn(msg.args || {}))
          .then(result => {
            postResponse(e.source, msg.requestId, true, result, null);
          })
          .catch(err => {
            postResponse(e.source, msg.requestId, false, null, String(err));
          });
        return;
      }

      // One-way event from parent
      if (msg.type === 'event' && msg.event) {
        console.log('[IframeRpcListener] Received event:', msg.event, msg.payload);
        // Handle events here if needed
        // Example: if (msg.event === 'navigate') { window.location.href = msg.payload.url; }
        return;
      }
    }

    window.addEventListener('message', handleMessage);
    console.log('[IframeRpcListener] Listening for messages from:', ALLOWED_PARENT_ORIGINS);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [allowedOrigins]);

  return null; // This component renders nothing
}
