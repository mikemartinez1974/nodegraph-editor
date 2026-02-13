"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import FixedNode from "./FixedNode";
import useNodePortSchema from "../hooks/useNodePortSchema";
import eventBus from "../../NodeGraph/eventBus";
import { parsePortEndpoint, endpointToUrl } from "../utils/portEndpoint";

const DEFAULT_INPUTS = [{ key: "in", label: "In", type: "value" }];
const DEFAULT_OUTPUTS = [{ key: "out", label: "Out", type: "value" }];

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
  const target = node?.data?.target || {};
  const mode = target?.mode || "navigate";
  const targetLabel = buildTargetLabel(target);
  const intent = node?.data?.intent || node?.data?.type || "port";

  const [endpointDraft, setEndpointDraft] = useState(target.endpoint || "");
  const [modeDraft, setModeDraft] = useState(mode);
  const lastSyncedRef = useRef({ endpoint: target.endpoint || "", mode });

  useEffect(() => {
    const next = { endpoint: target.endpoint || "", mode };
    if (
      next.endpoint !== lastSyncedRef.current.endpoint ||
      next.mode !== lastSyncedRef.current.mode
    ) {
      setEndpointDraft(next.endpoint);
      setModeDraft(next.mode);
      lastSyncedRef.current = next;
    }
  }, [target.endpoint, mode]);

  const endpointResult = useMemo(
    () => parsePortEndpoint((endpointDraft || "").trim()),
    [endpointDraft]
  );
  const endpointData = endpointResult.ok ? endpointResult.value : null;
  const targetUrl = useMemo(() => {
    if (typeof target.url === "string" && target.url.trim()) return target.url.trim();
    return endpointToUrl(endpointData?.filePath || "");
  }, [target.url, endpointData?.filePath]);

  const isDirty = endpointDraft !== (target.endpoint || "") || modeDraft !== mode;

  const commitTarget = useCallback(
    (nextEndpoint, nextMode) => {
      const normalizedEndpoint = (nextEndpoint || "").trim();
      const parsed = parsePortEndpoint(normalizedEndpoint);
      const nextTarget = {
        ...(target || {}),
        endpoint: normalizedEndpoint,
        mode: nextMode || "navigate"
      };

      if (parsed.ok) {
        nextTarget.portId = parsed.value.portId;
      }

      eventBus.emit("nodeUpdate", {
        id: node.id,
        updates: {
          data: {
            ...node.data,
            target: nextTarget
          }
        }
      });
    },
    [node.data, node.id, target]
  );

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

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        style={{
          position: "absolute",
          inset: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          pointerEvents: "auto"
        }}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: theme.palette.primary.main,
              boxShadow: `0 0 0 3px ${theme.palette.action.selected}`
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 14 }}>Port</div>
          <div
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 999,
              background:
                theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              color: theme.palette.text.secondary
            }}
          >
            {intent}
          </div>
          <div
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 999,
              background:
                theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              color: theme.palette.text.secondary
            }}
          >
            {modeDraft}
          </div>
        </div>

        <div style={{ fontSize: 12, color: theme.palette.text.secondary }}>{targetLabel}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
          <input
            value={endpointDraft}
            placeholder="root.node:root"
            onChange={(event) => {
              const nextEndpoint = event.target.value;
              setEndpointDraft(nextEndpoint);
              commitTarget(nextEndpoint, modeDraft);
            }}
            onBlur={() => {
              if (isDirty) commitTarget(endpointDraft, modeDraft);
            }}
            style={{
              width: "100%",
              minWidth: 0,
              borderRadius: 6,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.paper,
              color: theme.palette.text.primary,
              padding: "6px 8px",
              fontSize: 11
            }}
          />
          <select
            value={modeDraft}
            onChange={(event) => {
              const nextMode = event.target.value;
              setModeDraft(nextMode);
              commitTarget(endpointDraft, nextMode);
            }}
            style={{
              borderRadius: 6,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.paper,
              color: theme.palette.text.primary,
              padding: "6px 8px",
              fontSize: 11
            }}
          >
            <option value="navigate">navigate</option>
            <option value="bridge">bridge</option>
            <option value="boundary">boundary</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
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
          >
            Open
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              commitTarget(endpointDraft, modeDraft);
            }}
            disabled={!isDirty}
            style={{
              borderRadius: 6,
              border: `1px solid ${theme.palette.divider}`,
              background: "transparent",
              color: theme.palette.text.primary,
              padding: "4px 8px",
              fontSize: 11,
              cursor: isDirty ? "pointer" : "default",
              opacity: isDirty ? 1 : 0.55
            }}
          >
            Save
          </button>
        </div>

        {(target.endpoint || target.url || target.graphId || target.nodeId) ? (
          <div
            style={{
              fontSize: 11,
              color: theme.palette.text.secondary,
              border: `1px dashed ${theme.palette.divider}`,
              borderRadius: 6,
              padding: "4px 6px",
              background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#fafafa"
            }}
          >
            {target.endpoint ? `endpoint: ${target.endpoint}` : null}
            {target.url ? `url: ${target.url}` : null}
            {target.graphId ? `${target.endpoint || target.url ? " • " : ""}graph: ${target.graphId}` : null}
            {target.nodeId
              ? `${target.endpoint || target.url || target.graphId ? " • " : ""}node: ${target.nodeId}`
              : null}
            {target.portId
              ? `${target.endpoint || target.url || target.graphId || target.nodeId ? " • " : ""}port: ${target.portId}`
              : null}
          </div>
        ) : null}

        {endpointData ? (
          <div style={{ fontSize: 11, color: theme.palette.text.secondary }}>
            {endpointData.filePath}
            {endpointData.nodeId ? ` #${endpointData.nodeId}` : ""}
            {` :${endpointData.portId}`}
          </div>
        ) : null}

        {!endpointResult.ok && endpointDraft ? (
          <div style={{ fontSize: 11, color: theme.palette.error.main }}>{endpointResult.error}</div>
        ) : null}
      </div>
    </FixedNode>
  );
};

export default PortNode;
