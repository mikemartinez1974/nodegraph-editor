"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import FixedNode from "./FixedNode";
import useNodePortSchema from "../hooks/useNodePortSchema";
import { endpointToUrl, parsePortEndpoint } from "../utils/portEndpoint";
import eventBus from "../../NodeGraph/eventBus";
import { readExpansionState, resolveExpansionTarget } from "./expansionUtils";

const DEFAULT_INPUTS = [{ key: "in", label: "In", type: "value" }];
const DEFAULT_OUTPUTS = [{ key: "out", label: "Out", type: "value" }];
const DEFAULT_MAX_EMBED_DEPTH = 4;
const NON_PASSIVE_LISTENER = { passive: false };
const HANDLE_SIZE = 10;
const HANDLE_OFFSET = -4;
const RESIZE_HANDLES = [
  { key: "nw", cursor: "nwse-resize", x: HANDLE_OFFSET, y: HANDLE_OFFSET },
  { key: "ne", cursor: "nesw-resize", x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`, y: HANDLE_OFFSET },
  {
    key: "se",
    cursor: "nwse-resize",
    x: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`,
    y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)`
  },
  { key: "sw", cursor: "nesw-resize", x: HANDLE_OFFSET, y: `calc(100% - ${HANDLE_SIZE + HANDLE_OFFSET}px)` }
];

const resolveGraphUrl = (node) => {
  const data = node?.data || {};
  const target = data?.target && typeof data.target === "object" ? data.target : {};
  const explicit =
    (typeof data.ref === "string" && data.ref.trim()) ||
    (typeof data.src === "string" && data.src.trim()) ||
    (typeof data.url === "string" && data.url.trim()) ||
    (typeof data.graphUrl === "string" && data.graphUrl.trim()) ||
    (typeof target.ref === "string" && target.ref.trim()) ||
    (typeof target.url === "string" && target.url.trim()) ||
    "";
  if (explicit) {
    const parsedExplicit = parsePortEndpoint(explicit);
    if (parsedExplicit.ok && parsedExplicit.value?.filePath) {
      return endpointToUrl(parsedExplicit.value.filePath);
    }
    if (/^(https?:\/\/|github:\/\/|local:\/\/|tlz:\/\/)/i.test(explicit) || explicit.startsWith("/")) return explicit;
    return `/${explicit}`;
  }

  const endpoint =
    (typeof data.endpoint === "string" && data.endpoint.trim()) ||
    (typeof data.target?.endpoint === "string" && data.target.endpoint.trim()) ||
    "";
  if (!endpoint) return "";
  const parsed = parsePortEndpoint(endpoint);
  if (parsed.ok && parsed.value?.filePath) return endpointToUrl(parsed.value.filePath);
  if (/^(https?:\/\/|github:\/\/|local:\/\/|tlz:\/\/)/i.test(endpoint)) return endpoint;
  return endpointToUrl(endpoint);
};

const GraphReferenceNode = (props) => {
  const theme = useTheme();
  const node = useNodePortSchema(props.node, DEFAULT_INPUTS, DEFAULT_OUTPUTS);
  const graphUrl = useMemo(() => resolveGraphUrl(node), [node]);
  const parentOrigin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    []
  );
  const inheritedEmbedState = useMemo(() => {
    if (typeof window === "undefined") {
      return { depth: 0, maxDepth: DEFAULT_MAX_EMBED_DEPTH, path: [] };
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const depthRaw = Number(params.get("embedDepth"));
      const maxDepthRaw = Number(params.get("embedMaxDepth"));
      const depth = Number.isFinite(depthRaw) && depthRaw >= 0 ? depthRaw : 0;
      const maxDepth =
        Number.isFinite(maxDepthRaw) && maxDepthRaw > 0
          ? Math.floor(maxDepthRaw)
          : DEFAULT_MAX_EMBED_DEPTH;
      const path = params.getAll("embedPath").filter((value) => typeof value === "string" && value.trim());
      return { depth, maxDepth, path };
    } catch {
      return { depth: 0, maxDepth: DEFAULT_MAX_EMBED_DEPTH, path: [] };
    }
  }, []);
  const embedToken = useMemo(
    () => `twilite_embed_${node?.id || "graph"}_${Math.random().toString(36).slice(2, 10)}`,
    [node?.id]
  );
  const viewMode = String(node?.data?.mode || "preview").toLowerCase();
  const interactive = viewMode === "interactive";
  const expansionTarget = useMemo(() => resolveExpansionTarget(node?.data || {}), [node?.data]);
  const canExpand = expansionTarget.mode === "expand" && Boolean(expansionTarget.ref);
  const [expansionBusy, setExpansionBusy] = useState(false);
  const [expansionState, setExpansionState] = useState({ expanded: false, expansionId: null, expansionKey: "" });
  const [expansionError, setExpansionError] = useState("");
  const iframeRef = useRef(null);
  const [frameState, setFrameState] = useState("idle");
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
  const MIN_WIDTH = 260;
  const MIN_HEIGHT = 180;
  const maxDepthOverride = Number(node?.data?.maxDepth);
  const maxDepth =
    Number.isFinite(maxDepthOverride) && maxDepthOverride > 0
      ? Math.floor(maxDepthOverride)
      : inheritedEmbedState.maxDepth;
  const isCycleBlocked = Boolean(graphUrl) && inheritedEmbedState.path.includes(graphUrl);
  const isDepthBlocked = inheritedEmbedState.depth >= maxDepth;
  const blockReason = isCycleBlocked
    ? "Blocked: cycle detected in embedded graph path."
    : isDepthBlocked
    ? `Blocked: max embed depth (${maxDepth}) reached.`
    : "";

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

  const handleToggleExpansion = useCallback(
    async (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!node?.id || !canExpand || expansionBusy) return;
      const api = readGraphApi();
      if (!api) return;
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
    [canExpand, expansionBusy, expansionState.expanded, expansionState.expansionId, expansionTarget, node?.id, readGraphApi, refreshExpansionState]
  );

  const embedSrc = useMemo(() => {
    if (!graphUrl) return "";
    if (isCycleBlocked || isDepthBlocked) return "";
    const params = new URLSearchParams();
    params.set("doc", graphUrl);
    params.set("context", node?.id || "");
    params.set("embedDepth", String(inheritedEmbedState.depth + 1));
    params.set("embedMaxDepth", String(maxDepth));
    inheritedEmbedState.path.forEach((entry) => params.append("embedPath", entry));
    params.append("embedPath", graphUrl);
    params.set("embedToken", embedToken);
    if (parentOrigin) params.set("parentOrigin", parentOrigin);
    return `/embed?${params.toString()}`;
  }, [
    graphUrl,
    node?.id,
    embedToken,
    parentOrigin,
    inheritedEmbedState.depth,
    inheritedEmbedState.path,
    maxDepth,
    isCycleBlocked,
    isDepthBlocked
  ]);

  useEffect(() => {
    if (embedSrc) setFrameState("loading");
    else setFrameState("idle");
  }, [embedSrc]);

  useEffect(() => {
    const handleMessage = (event) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.source !== iframeWindow) return;
      if (parentOrigin && event.origin !== parentOrigin) return;
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.token !== embedToken) return;
      if (message.type === "twilite:embed-ready") {
        setFrameState("ready");
      } else if (message.type === "twilite:embed-error") {
        setFrameState("error");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [embedToken, parentOrigin]);

  const getPointerPosition = (event) => {
    if (!event) return null;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    if (typeof event.clientX === "number" && typeof event.clientY === "number") {
      return { x: event.clientX, y: event.clientY };
    }
    return null;
  };

  const flushResize = () => {
    rafRef.current = null;
    if (!pendingSizeRef.current || !node?.id) return;
    const { width, height } = pendingSizeRef.current;
    eventBus.emit("nodeResize", { id: node.id, width, height });
    if (pendingPosRef.current) {
      eventBus.emit("nodeMove", { id: node.id, position: pendingPosRef.current });
    }
  };

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
      startWidth: node.width || 420,
      startHeight: node.height || 300,
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
  }, [isResizing, node?.id, node.height, node.position?.x, node.position?.y, node.width, props.zoom]);

  return (
    <FixedNode {...props} node={node} hideDefaultContent>
      <div
        style={{
          position: "absolute",
          inset: 8,
          borderRadius: 10,
          border: `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "34px 1fr",
          background: theme.palette.background.default
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "6px 8px",
            borderBottom: `1px solid ${theme.palette.divider}`,
            background: theme.palette.background.paper
          }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 18,
                padding: "0 6px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.2,
                textTransform: "uppercase",
                background:
                  viewMode === "interactive"
                    ? theme.palette.secondary.main
                    : theme.palette.primary.main,
                color:
                  viewMode === "interactive"
                    ? theme.palette.secondary.contrastText
                    : theme.palette.primary.contrastText
              }}
            >
              {viewMode}
            </span>
            {canExpand && expansionState.expanded ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 18,
                  padding: "0 6px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                  background: theme.palette.success.main,
                  color: theme.palette.success.contrastText
                }}
              >
                expanded
              </span>
            ) : null}
            {canExpand && expansionError ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 18,
                  padding: "0 6px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  background: theme.palette.error.main,
                  color: theme.palette.error.contrastText,
                  maxWidth: 180,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
                title={expansionError}
              >
                {expansionError}
              </span>
            ) : null}
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0
              }}
              title={graphUrl || "Set data.src or data.endpoint"}
            >
              {graphUrl || "No graph source configured"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {embedSrc ? (
              <>
                <button
                  type="button"
                  title="Reload child graph"
                  onClick={(event) => {
                    event.stopPropagation();
                    const iframe = iframeRef.current;
                    if (iframe) {
                      setFrameState("loading");
                      iframe.src = embedSrc;
                    }
                  }}
                  style={{
                    border: `1px solid ${theme.palette.divider}`,
                    background: "transparent",
                    color: theme.palette.text.secondary,
                    borderRadius: 6,
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                >
                  <RefreshIcon sx={{ fontSize: 14 }} />
                </button>
                {canExpand ? (
                  <button
                    type="button"
                    title={expansionState.expanded ? "Collapse expanded branch" : "Expand referenced fragment"}
                    onClick={handleToggleExpansion}
                    disabled={expansionBusy}
                    style={{
                      border: `1px solid ${theme.palette.divider}`,
                      background: "transparent",
                      color: theme.palette.text.secondary,
                      borderRadius: 6,
                      minWidth: 62,
                      height: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 8px",
                      cursor: expansionBusy ? "default" : "pointer",
                      opacity: expansionBusy ? 0.65 : 1,
                      fontSize: 11
                    }}
                  >
                    {expansionBusy ? "..." : expansionState.expanded ? "Collapse" : "Expand"}
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Edit node"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!node?.id) return;
                    eventBus.emit("toggleNodeEditorPanel", { nodeId: node.id, source: "graph-reference-edit" });
                  }}
                  style={{
                    border: `1px solid ${theme.palette.divider}`,
                    background: "transparent",
                    color: theme.palette.text.secondary,
                    borderRadius: 6,
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </button>
                <button
                  type="button"
                  title="Open source graph in Twilite"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!graphUrl) return;
                    try {
                      eventBus.emit("fetchUrl", { url: graphUrl, source: "graph-reference-node" });
                    } catch (err) {
                      console.warn("[GraphReferenceNode] Failed to emit fetchUrl", err);
                      if (typeof window !== "undefined") {
                        window.location.assign(graphUrl);
                      }
                    }
                  }}
                  style={{
                    border: `1px solid ${theme.palette.divider}`,
                    background: "transparent",
                    color: theme.palette.text.secondary,
                    borderRadius: 6,
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div
          data-graph-ref-root
          style={{
            position: "relative",
            background: theme.palette.background.default
          }}
        >
          {embedSrc ? (
            <iframe
              ref={iframeRef}
              title={`graph-reference-${node?.id || "child"}`}
              src={embedSrc}
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => setFrameState("ready")}
              onError={() => setFrameState("error")}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                pointerEvents: interactive ? "auto" : "none",
                background: "transparent"
              }}
            />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: theme.palette.text.secondary,
                padding: 12,
                textAlign: "center"
              }}
            >
              {blockReason || "Set `data.src` (or `data.endpoint`) to embed a child graph."}
            </div>
          )}
          {embedSrc && frameState !== "ready" ? (
            <div
              style={{
                position: "absolute",
                right: 8,
                bottom: 8,
                fontSize: 11,
                color: theme.palette.text.secondary,
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 6,
                padding: "2px 6px"
              }}
            >
              {frameState === "error" ? `Embed failed: ${embedSrc}` : `Loading: ${embedSrc}`}
            </div>
          ) : null}
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
                top: handle.y
              }}
            />
          ))}
        </div>
      </div>
    </FixedNode>
  );
};

export default GraphReferenceNode;
