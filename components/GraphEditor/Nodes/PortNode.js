"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import FixedNode from "./FixedNode";
import useNodePortSchema from "../hooks/useNodePortSchema";
import eventBus from "../../NodeGraph/eventBus";
import { parsePortEndpoint, endpointToUrl } from "../utils/portEndpoint";

const DEFAULT_INPUTS = [{ key: "in", label: "In", type: "value" }];
const DEFAULT_OUTPUTS = [{ key: "out", label: "Out", type: "value" }];
const NON_PASSIVE_LISTENER = { passive: false };
const HANDLE_SIZE = 10;
const HANDLE_OFFSET = -4;
const RESIZE_HANDLES = [
  { key: "nw", cursor: "nwse-resize", x: HANDLE_OFFSET, y: HANDLE_OFFSET },
  { key: "n", cursor: "ns-resize", x: "50%", y: HANDLE_OFFSET, transform: "translate(-50%, 0)" },
  { key: "ne", cursor: "nesw-resize", x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: HANDLE_OFFSET },
  {
    key: "e",
    cursor: "ew-resize",
    x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`,
    y: "50%",
    transform: "translate(0, -50%)"
  },
  {
    key: "se",
    cursor: "nwse-resize",
    x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`,
    y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`
  },
  {
    key: "s",
    cursor: "ns-resize",
    x: "50%",
    y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`,
    transform: "translate(-50%, 0)"
  },
  { key: "sw", cursor: "nesw-resize", x: HANDLE_OFFSET, y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)` },
  { key: "w", cursor: "ew-resize", x: HANDLE_OFFSET, y: "50%", transform: "translate(0, -50%)" }
];

const buildTargetLabel = (target = {}) => {
  if (!target || typeof target !== "object") return "No target";
  const label = target.label || target.name || target.nodeLabel;
  if (label) return label;
  if (target.endpoint) return target.endpoint;
  if (target.nodeId) return `node:${target.nodeId}`;
  if (target.graphId) return `graph:${target.graphId}`;
  if (target.url) return target.url;
  return "No target";
};

const PortNode = (props) => {
  const node = useNodePortSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeStateRef = useRef({
    handle: "se",
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startPosX: 0,
    startPosY: 0
  });
  const rafRef = useRef(null);
  const pendingSizeRef = useRef(null);
  const pendingPosRef = useRef(null);
  const MIN_WIDTH = 140;
  const MIN_HEIGHT = 90;
  const target = node?.data?.target || {};
  const targetLabel = buildTargetLabel(target);
  const displayLabel = node?.label || "Port";

  const endpointResult = useMemo(
    () => parsePortEndpoint((target?.endpoint || "").trim()),
    [target?.endpoint]
  );
  const endpointData = endpointResult.ok ? endpointResult.value : null;
  const targetUrl = useMemo(() => {
    if (typeof target.url === "string" && target.url.trim()) return target.url.trim();
    const endpointRaw = typeof target?.endpoint === "string" ? target.endpoint.trim() : "";
    if (endpointData?.filePath) {
      return endpointToUrl(endpointData.filePath);
    }
    // Allow direct URL endpoints even when they omit `:portId`.
    if (/^https?:\/\//i.test(endpointRaw)) {
      return endpointRaw;
    }
    return endpointToUrl(endpointRaw);
  }, [target.url, target?.endpoint, endpointData?.filePath]);

  const handleNavigate = useCallback(
    (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!targetUrl) return;
      try {
        eventBus.emit("fetchUrl", { url: targetUrl, source: "port-node" });
      } catch (err) {
        console.warn("[PortNode] Failed to emit fetchUrl", err);
        if (typeof window !== "undefined") {
          window.location.assign(targetUrl);
        }
      }
    },
    [targetUrl]
  );

  const getPointerPosition = (event) => {
    if (!event) return null;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    if (typeof event.clientX === "number" && typeof event.clientY === "number") {
      return { x: event.clientX, y: event.clientY };
    }
    return null;
  };

  const flushResize = useCallback(() => {
    rafRef.current = null;
    if (!pendingSizeRef.current || !node?.id) return;
    const { width, height } = pendingSizeRef.current;
    eventBus.emit("nodeResize", { id: node.id, width, height });
    if (pendingPosRef.current) {
      eventBus.emit("nodeMove", { id: node.id, position: pendingPosRef.current });
    }
  }, [node?.id]);

  const handleResizeStart = (event, handle) => {
    const point = getPointerPosition(event);
    if (!point) return;
    if (event.stopPropagation) event.stopPropagation();
    if (event.cancelable && event.preventDefault) event.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStateRef.current = {
      handle,
      startX: point.x,
      startY: point.y,
      startWidth: node.width || 220,
      startHeight: node.height || 140,
      startPosX: node.position?.x ?? node.x ?? 0,
      startPosY: node.position?.y ?? node.y ?? 0
    };
    if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore pointer capture errors
      }
    }
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleResizeMove = (event) => {
      if (!isResizingRef.current) return;
      const point = getPointerPosition(event);
      if (!point) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();

      const zoom = props.zoom || 1;
      const state = resizeStateRef.current;
      const dx = (point.x - state.startX) / zoom;
      const dy = (point.y - state.startY) / zoom;
      let newWidth = state.startWidth;
      let newHeight = state.startHeight;
      let newX = state.startPosX;
      let newY = state.startPosY;

      if (state.handle.includes("e")) {
        newWidth = Math.max(MIN_WIDTH, state.startWidth + dx);
      }
      if (state.handle.includes("s")) {
        newHeight = Math.max(MIN_HEIGHT, state.startHeight + dy);
      }
      if (state.handle.includes("w")) {
        newWidth = Math.max(MIN_WIDTH, state.startWidth - dx);
        newX = state.startPosX + (state.startWidth - newWidth);
      }
      if (state.handle.includes("n")) {
        newHeight = Math.max(MIN_HEIGHT, state.startHeight - dy);
        newY = state.startPosY + (state.startHeight - newHeight);
      }

      pendingSizeRef.current = { width: newWidth, height: newHeight };
      pendingPosRef.current = { x: newX, y: newY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushResize);
      }
    };

    const handleResizeEnd = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      flushResize();
      eventBus.emit("nodeResizeEnd", { id: node.id });
    };

    document.addEventListener("pointermove", handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener("pointerup", handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener("pointercancel", handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener("mousemove", handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener("mouseup", handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener("touchmove", handleResizeMove, NON_PASSIVE_LISTENER);
    document.addEventListener("touchend", handleResizeEnd, NON_PASSIVE_LISTENER);
    document.addEventListener("touchcancel", handleResizeEnd, NON_PASSIVE_LISTENER);

    return () => {
      document.removeEventListener("pointermove", handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener("pointerup", handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener("pointercancel", handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener("mousemove", handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener("mouseup", handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener("touchmove", handleResizeMove, NON_PASSIVE_LISTENER);
      document.removeEventListener("touchend", handleResizeEnd, NON_PASSIVE_LISTENER);
      document.removeEventListener("touchcancel", handleResizeEnd, NON_PASSIVE_LISTENER);
    };
  }, [flushResize, isResizing, node.id, props.zoom]);

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        style={{
          position: "absolute",
          inset: 8,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 8,
          pointerEvents: "auto"
        }}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{displayLabel}</div>
          <div
            style={{
              fontSize: 11,
              color: theme.palette.text.secondary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
            title={targetLabel}
          >
            {targetLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={handleNavigate}
          disabled={!targetUrl}
          style={{
            alignSelf: "flex-start",
            borderRadius: 6,
            border: `1px solid ${theme.palette.divider}`,
            background: "transparent",
            color: theme.palette.text.primary,
            padding: "4px 8px",
            fontSize: 11,
            cursor: targetUrl ? "pointer" : "default",
            opacity: targetUrl ? 1 : 0.55
          }}
          title={!targetUrl && target?.endpoint && !endpointResult.ok ? endpointResult.error : ""}
        >
          Navigate
        </button>
      </div>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {RESIZE_HANDLES.map((handle) => (
          <div
            key={handle.key}
            onPointerDown={(event) => handleResizeStart(event, handle.key)}
            onMouseDown={(event) => handleResizeStart(event, handle.key)}
            onTouchStart={(event) => handleResizeStart(event.nativeEvent || event, handle.key)}
            style={{
              position: "absolute",
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              borderRadius: 3,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.paper,
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              cursor: handle.cursor,
              opacity: isResizing ? 1 : 0,
              transition: "opacity 0.2s ease",
              zIndex: 3,
              pointerEvents: "auto",
              touchAction: "none",
              userSelect: "none",
              left: handle.x,
              top: handle.y,
              transform: handle.transform || "none"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isResizing ? "1" : "0";
            }}
          />
        ))}
      </div>
    </FixedNode>
  );
};

export default PortNode;
