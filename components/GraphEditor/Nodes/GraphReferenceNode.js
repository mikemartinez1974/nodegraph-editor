"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import FixedNode from "./FixedNode";
import useNodePortSchema from "../hooks/useNodePortSchema";
import { endpointToUrl, parsePortEndpoint } from "../utils/portEndpoint";

const DEFAULT_INPUTS = [{ key: "in", label: "In", type: "value" }];
const DEFAULT_OUTPUTS = [{ key: "out", label: "Out", type: "value" }];
const DEFAULT_MAX_EMBED_DEPTH = 4;

const resolveGraphUrl = (node) => {
  const data = node?.data || {};
  const explicit =
    (typeof data.src === "string" && data.src.trim()) ||
    (typeof data.url === "string" && data.url.trim()) ||
    (typeof data.ref === "string" && data.ref.trim()) ||
    (typeof data.graphUrl === "string" && data.graphUrl.trim()) ||
    "";
  if (explicit) {
    const parsedExplicit = parsePortEndpoint(explicit);
    if (parsedExplicit.ok && parsedExplicit.value?.filePath) {
      return endpointToUrl(parsedExplicit.value.filePath);
    }
    if (/^https?:\/\//i.test(explicit) || explicit.startsWith("/")) return explicit;
    return `/${explicit}`;
  }

  const endpoint =
    (typeof data.endpoint === "string" && data.endpoint.trim()) ||
    (typeof data.target?.endpoint === "string" && data.target.endpoint.trim()) ||
    "";
  if (!endpoint) return "";
  const parsed = parsePortEndpoint(endpoint);
  if (parsed.ok && parsed.value?.filePath) return endpointToUrl(parsed.value.filePath);
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
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
  const mode = String(node?.data?.mode || "preview").toLowerCase();
  const interactive = mode === "interactive";
  const iframeRef = useRef(null);
  const [frameState, setFrameState] = useState("idle");
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
                  mode === "interactive"
                    ? theme.palette.secondary.main
                    : theme.palette.primary.main,
                color:
                  mode === "interactive"
                    ? theme.palette.secondary.contrastText
                    : theme.palette.primary.contrastText
              }}
            >
              {mode}
            </span>
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
                <a
                  href={graphUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open source graph"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.secondary,
                    borderRadius: 6,
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </a>
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
      </div>
    </FixedNode>
  );
};

export default GraphReferenceNode;
