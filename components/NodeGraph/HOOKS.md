# Hooks Reference

## usePanZoom

**Signature:**

```js
const { pan, zoom, setPan, setZoom, toScreen, toGraph } = usePanZoom(initialPan, initialZoom)
```

**Description:**

Manages viewport pan/zoom state and provides helper transforms to convert coordinates between graph space and screen space.

**Example:**

```js
const { pan, zoom, toScreen } = usePanZoom({ x: 0, y: 0 }, 1)
const screenPos = toScreen({ x: node.position.x, y: node.position.y })
```

## useCanvasSize

**Signature:**

```js
const { width, height, scale } = useCanvasSize(canvasRef)
```

**Description:**

Returns high-DPI adjusted canvas size and scale factor for drawing crisp edges on canvas.

## useNodeHover / useEdgeHover

**Signature:**

```js
const isHovered = useNodeHover(nodeId)
```

**Description:**

Subscribe to hover state for nodes or edges. Useful for showing ports, highlights, or tooltips.

## useHandleProgress / useHandleAnimation

**Signature:**

```js
const progress = useHandleProgress(nodeId, handleId)
```

**Description:**

Provides an animated progress value `[0..1]` for handle extension/retraction to animate ports.

## useNodeGraphEvents

**Signature:**

```js
useNodeGraphEvents(handlerMap)
```

**Description:**

Register multiple event handlers (map of `eventName => fn`) on mount and auto-unsubscribe on unmount. Helpful for panels listening to editor events.

## Notes

- All hooks are documented with in-file JSDoc in their implementations under `components/NodeGraph/hooks/` — use those for full parameter detail and TS signatures when available.
- Prefer the provided hooks over duplicating logic in components for consistent behavior.
