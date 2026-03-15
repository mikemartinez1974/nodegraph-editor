"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import FixedNode from "./FixedNode";
import useNodePortSchema from "../hooks/useNodePortSchema";
import eventBus from "../../NodeGraph/eventBus";
import { parsePortEndpoint, endpointToUrl } from "../utils/portEndpoint";
import { readExpansionState, resolveExpansionTarget } from "./expansionUtils";

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
  if (target.ref) return target.ref;
  if (target.nodeId) return `node:${target.nodeId}`;
  if (target.graphId) return `graph:${target.graphId}`;
  if (target.url) return target.url;
  return "No target";
};

const PortNode = (props) => {
  const node = useNodePortSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const { isSelected } = props;
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
  const fallbackTarget = {
    label: node?.data?.label || node?.data?.name || "",
    endpoint: node?.data?.endpoint || "",
    ref: node?.data?.ref || node?.data?.src || node?.data?.graphUrl || "",
    url: node?.data?.url || ""
  };
  const targetLabel = buildTargetLabel(target) !== "No target"
    ? buildTargetLabel(target)
    : buildTargetLabel(fallbackTarget);
  const displayLabel = node?.label || "Port";
  const semanticLevel = String(node?.data?._semanticLevel || "detail").trim().toLowerCase();
  const isCompactSemantic = semanticLevel === "summary" || semanticLevel === "icon";
  const expansionTarget = useMemo(() => resolveExpansionTarget(node?.data || {}), [node?.data]);
  const canExpand = expansionTarget.mode === "expand" && expansionTarget.kind === "fragment" && Boolean(expansionTarget.ref);
  const canNavigate = expansionTarget.mode !== "expand";
  const [expansionBusy, setExpansionBusy] = useState(false);
  const [expansionState, setExpansionState] = useState({ expanded: false, expansionId: null, expansionKey: "" });
  const [expansionError, setExpansionError] = useState("");
  const [compatibility, setCompatibility] = useState(null);

  const readGraphApi = useCallback(() => {
    if (typeof window === "undefined") return null;
    return window.graphAPI?._raw || window.graphAPIRaw || window.graphAPI || null;
  }, []);

  const refreshExpansionState = useCallback(() => {
    if (!node?.id || !canExpand) {
      setExpansionState({ expanded: false, expansionId: null, expansionKey: "" });
      return;
    }
    const api = readGraphApi();
    setExpansionState(readExpansionState(api, node.id, expansionTarget));
  }, [canExpand, expansionTarget, node?.id, readGraphApi]);

  useEffect(() => {
    refreshExpansionState();
  }, [refreshExpansionState]);

  useEffect(() => {
    const handleExpansionStateChanged = (payload = {}) => {
      if (!node?.id) return;
      if (payload?.sourceNodeId && payload.sourceNodeId !== node.id) return;
      refreshExpansionState();
    };
    eventBus.on("expansionStateChanged", handleExpansionStateChanged);
    return () => eventBus.off("expansionStateChanged", handleExpansionStateChanged);
  }, [node?.id, refreshExpansionState]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!node?.id || !canExpand) {
        setCompatibility(null);
        return;
      }
      const api = readGraphApi();
      if (!api || typeof api.assessContextCompatibility !== "function") {
        setCompatibility(null);
        return;
      }
      try {
        const result = await api.assessContextCompatibility({
          sourceNodeId: node.id,
          target: expansionTarget
        });
        if (cancelled) return;
        if (result?.success) {
          setCompatibility(result.data || null);
        } else {
          setCompatibility({
            status: "incompatible",
            summary: result?.error || result?.data?.message || "Compatibility check failed"
          });
        }
      } catch (error) {
        if (cancelled) return;
        setCompatibility({
          status: "incompatible",
          summary: error?.message || "Compatibility check failed"
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [canExpand, expansionTarget, node?.id, readGraphApi]);

  const compatibilityStatus = compatibility?.status || null;
  const canExecuteExpand =
    canExpand &&
    (
      expansionState.expanded ||
      compatibilityStatus === null ||
      compatibilityStatus === "compatible" ||
      compatibilityStatus === "compatible-with-downgrades"
    );

  const handleToggleExpansion = useCallback(
    async (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!node?.id || !canExpand || expansionBusy) return;
      const api = readGraphApi();
      if (!api) return;
      if (!expansionState.expanded && compatibilityStatus === "incompatible") {
        setExpansionError(compatibility?.summary || "Expansion is blocked by compatibility policy");
        return;
      }
      setExpansionBusy(true);
      try {
        setExpansionError("");
        if (expansionState.expanded && expansionState.expansionId && typeof api.collapseExpansion === "function") {
          const result = await api.collapseExpansion({ expansionId: expansionState.expansionId, sourceNodeId: node.id });
          if (result && result.success === false) {
            setExpansionError(result.error || result.data?.message || "Collapse failed");
          }
        } else if (typeof api.expandReference === "function") {
          const result = await api.expandReference({
            sourceNodeId: node.id,
            target: expansionTarget,
            options: { layout: "attach-right", dedupe: true }
          });
          if (result && result.success === false) {
            setExpansionError(result.error || result.data?.message || "Expansion failed");
          } else if (result?.entryNodeId) {
            window.setTimeout(() => {
              try {
                eventBus.emit("focusNode", { nodeId: result.entryNodeId, source: "expandReference" });
              } catch {}
            }, 0);
          }
        }
      } finally {
        setExpansionBusy(false);
        refreshExpansionState();
      }
    },
    [
      canExpand,
      compatibility?.summary,
      compatibilityStatus,
      expansionBusy,
      expansionState.expanded,
      expansionState.expansionId,
      expansionTarget,
      node?.id,
      readGraphApi,
      refreshExpansionState
    ]
  );

  const endpointResult = useMemo(
    () => parsePortEndpoint((target?.endpoint || "").trim()),
    [target?.endpoint]
  );
  const endpointData = endpointResult.ok ? endpointResult.value : null;
  const targetUrl = useMemo(() => {
    if (typeof target.ref === "string" && target.ref.trim()) return endpointToUrl(target.ref.trim());
    if (typeof node?.data?.src === "string" && node.data.src.trim()) return endpointToUrl(node.data.src.trim());
    if (typeof node?.data?.graphUrl === "string" && node.data.graphUrl.trim()) return endpointToUrl(node.data.graphUrl.trim());
    if (typeof node?.data?.ref === "string" && node.data.ref.trim()) return endpointToUrl(node.data.ref.trim());
    if (typeof node?.data?.url === "string" && node.data.url.trim()) return node.data.url.trim();
    if (typeof target.url === "string" && target.url.trim()) return target.url.trim();
    if (typeof node?.data?.endpoint === "string" && node.data.endpoint.trim()) {
      const parsedNodeEndpoint = parsePortEndpoint(node.data.endpoint.trim());
      if (parsedNodeEndpoint.ok && parsedNodeEndpoint.value?.filePath) {
        return endpointToUrl(parsedNodeEndpoint.value.filePath);
      }
      if (/^https?:\/\//i.test(node.data.endpoint.trim())) {
        return node.data.endpoint.trim();
      }
      return endpointToUrl(node.data.endpoint.trim());
    }
    const endpointRaw = typeof target?.endpoint === "string" ? target.endpoint.trim() : "";
    if (endpointData?.filePath) {
      return endpointToUrl(endpointData.filePath);
    }
    // Allow direct URL endpoints even when they omit `:portId`.
    if (/^https?:\/\//i.test(endpointRaw)) {
      return endpointRaw;
    }
    return endpointToUrl(endpointRaw);
  }, [
    target.ref,
    target.url,
    target?.endpoint,
    node?.data?.src,
    node?.data?.graphUrl,
    node?.data?.ref,
    node?.data?.url,
    node?.data?.endpoint,
    endpointData?.filePath
  ]);

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

  const handleOpenEditor = useCallback(
    (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!node?.id) return;
      eventBus.emit("toggleNodeEditorPanel", { nodeId: node.id, source: "port-node-edit" });
    },
    [node?.id]
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

  if (isCompactSemantic) {
    const modeLabel = canExpand ? "exp" : "nav";
    return (
      <FixedNode {...props} node={node} hideDefaultContent={true} disableChrome={true} hideChromeOverlays={true}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: semanticLevel === "icon" ? "8px 10px" : "12px 14px",
            boxSizing: "border-box",
            pointerEvents: "none"
          }}
        >
          <div
            style={{
              maxWidth: "100%",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: semanticLevel === "icon" ? "6px 10px" : "8px 12px",
              borderRadius: 999,
              background: isSelected ? "rgba(25,118,210,0.18)" : "rgba(255,255,255,0.10)",
              border: `1px solid ${isSelected ? "rgba(25,118,210,0.45)" : "rgba(255,255,255,0.22)"}`,
              color: "#fff",
              fontSize: semanticLevel === "icon" ? 11 : 12,
              fontWeight: 700,
              letterSpacing: 0.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 28,
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.16)",
                fontSize: 10,
                textTransform: "uppercase"
              }}
            >
              {modeLabel}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayLabel}
            </span>
          </div>
        </div>
      </FixedNode>
    );
  }

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          top: 28,
          bottom: 8,
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
          {canExpand && expansionState.expanded ? (
            <div
              style={{
                fontSize: 10,
                lineHeight: 1.2,
                color: theme.palette.success.main,
                fontWeight: 600
              }}
            >
              Expanded branch
            </div>
          ) : null}
          {canExpand && compatibilityStatus && !expansionState.expanded ? (
            <div
              style={{
                fontSize: 10,
                lineHeight: 1.2,
                color:
                  compatibilityStatus === "compatible"
                    ? theme.palette.success.main
                    : compatibilityStatus === "compatible-with-downgrades"
                    ? theme.palette.warning.main
                    : theme.palette.error.main,
                fontWeight: 600
              }}
              title={compatibility?.summary || ""}
            >
              {compatibilityStatus === "compatible"
                ? "Compatible"
                : compatibilityStatus === "compatible-with-downgrades"
                ? "Downgrade required"
                : "Incompatible"}
            </div>
          ) : null}
          {canExpand && expansionError ? (
            <div
              style={{
                fontSize: 10,
                lineHeight: 1.2,
                color: theme.palette.error.main,
                fontWeight: 600
              }}
              title={expansionError}
            >
              {expansionError}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {canExpand ? (
            <button
              type="button"
              onClick={handleToggleExpansion}
              disabled={expansionBusy || !canExecuteExpand}
              style={{
                borderRadius: 6,
                border: `1px solid ${theme.palette.divider}`,
                background: "transparent",
                color: theme.palette.text.primary,
                padding: "4px 8px",
                fontSize: 11,
                cursor: expansionBusy || !canExecuteExpand ? "default" : "pointer",
                opacity: expansionBusy || !canExecuteExpand ? 0.6 : 1
              }}
              title={
                expansionState.expanded
                  ? "Collapse expanded branch"
                  : !canExecuteExpand
                  ? (compatibility?.summary || "Expand is blocked")
                  : "Expand referenced fragment"
              }
            >
              {expansionBusy ? "..." : expansionState.expanded ? "Collapse" : "Expand"}
            </button>
          ) : null}
          {canNavigate ? (
            <button
              type="button"
              onClick={handleNavigate}
              disabled={!targetUrl}
              style={{
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
          ) : null}
          <button
            type="button"
            onClick={handleOpenEditor}
            style={{
              borderRadius: 6,
              border: `1px solid ${theme.palette.divider}`,
              background: "transparent",
              color: theme.palette.text.primary,
              width: 26,
              height: 24,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
            title="Edit node"
          >
            <EditIcon sx={{ fontSize: 14 }} />
          </button>
        </div>
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
