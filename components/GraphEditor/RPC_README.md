# BackgroundFrame RPC System

A secure postMessage-based RPC (Remote Procedure Call) system for communicating between the host app and embedded iframes.

## Features

- ✅ **Secure**: Origin validation, handshake protocol, no DOM injection
- ✅ **Type-safe**: Request/response pattern with timeout handling
- ✅ **Simple API**: Clean async/await interface
- ✅ **Sandboxed**: No allow-same-origin by default
- ✅ **Event-based**: Both RPC calls and one-way events supported

## Quick Start

### 1. Using BackgroundFrame in your app

```javascript
import BackgroundFrame from './components/BackgroundFrame';
import { useBackgroundRpc } from './hooks/useBackgroundRpc';

function MyComponent() {
  const { bgRef, rpc, isReady, methods } = useBackgroundRpc();

  const handleTestRpc = async () => {
    try {
      const result = await rpc('echo', { message: 'Hello!' });
      console.log('Result:', result);
    } catch (err) {
      console.error('RPC failed:', err);
    }
  };

  return (
    <>
      <BackgroundFrame
        ref={bgRef}
        url="http://localhost:3000/rpc-test.html"
        interactive={false}
        onHandshakeComplete={(methods) => {
          console.log('Available methods:', methods);
        }}
      />
      <button onClick={handleTestRpc} disabled={!isReady}>
        Test RPC
      </button>
    </>
  );
}
```

### 2. Adding RPC support to an embedded page

For React/Next pages:

```javascript
import IframeRpcListener from './components/IframeRpcListener';

export default function MyEmbeddedPage() {
  return (
    <>
      <IframeRpcListener />
      <div>Your page content</div>
    </>
  );
}
```

For plain HTML pages, add the script from `/public/rpc-test.html`.

### 3. Defining custom methods

Edit `IframeRpcListener.js` to add your methods:

```javascript
const methods = {
  // Your custom method
  setLight: ({ on }) => {
    // Perform action
    return { success: true, on };
  },
  
  getValue: ({ key }) => {
    // Read state
    return { value: localStorage.getItem(key) };
  }
};
```

## Testing

1. Start your dev server: `npm run dev`
2. Open the main app: `http://localhost:3000`
3. In the Document Properties, set background URL to: `http://localhost:3000/rpc-test.html`
4. Open browser console and run:

```javascript
// Check RPC status
window.backgroundRpcStatus()

// Test echo method
window.testBackgroundRpc('echo', { message: 'Hello from host!' })

// Test getState method
window.testBackgroundRpc('getState')

// Test getDocumentInfo method
window.testBackgroundRpc('getDocumentInfo')
```

**Note**: Make sure to use the correct URL with `.html` extension (not `.htm`)

## Security Notes

- **Origin validation**: Messages are only accepted from whitelisted origins
- **Handshake required**: No RPC calls allowed until handshake completes
- **Method whitelist**: Only advertised methods can be called
- **Sandboxing**: Default sandbox is `allow-scripts allow-forms` (no same-origin access)
- **Timeout protection**: All RPC calls timeout after 10 seconds by default

## API Reference

### BackgroundFrame Props

- `url` (string): URL to load in iframe
- `interactive` (boolean): Enable pointer events (default: false)
- `allowedMethods` (string[]): Whitelist of allowed methods (optional)
- `onEvent` (function): Handler for unsolicited events from iframe
- `onHandshakeComplete` (function): Called when handshake succeeds

### RPC Methods

```javascript
// Call a method
await bgRef.current.rpc(method, args, timeout);

// Send one-way event
bgRef.current.postEvent(eventName, payload);

// Check if ready
const ready = bgRef.current.isReady();

// Get available methods
const methods = bgRef.current.getMethods();
```

## Use Cases

- **VR Wall Controls**: Embed a React control panel in a virtual room
- **Live Dashboards**: Display real-time data from external sources
- **Interactive Documents**: Embed HTML docs with scriptable UI
- **Remote Automation**: Control embedded pages programmatically

## Future Enhancements

- [ ] MessageChannel for private communication
- [ ] Batch RPC calls
- [ ] Streaming responses
- [ ] Authentication/authorization layer
- [ ] Method permissions per origin

## Files

- `components/GraphEditor/components/BackgroundFrame.js` - Main component
- `components/GraphEditor/components/IframeRpcListener.js` - Embedded page listener
- `components/GraphEditor/hooks/useBackgroundRpc.js` - React hook
- `public/rpc-test.html` - Test page
- `handlers/graphEditorHandlers.js` - Integration with handlers
