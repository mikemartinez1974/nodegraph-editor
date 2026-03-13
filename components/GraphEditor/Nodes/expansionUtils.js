"use client";

import { parsePortEndpoint, endpointToUrl } from "../utils/portEndpoint";

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const resolveExpansionTarget = (data = {}) => {
  const target = data?.target && typeof data.target === "object" ? data.target : {};
  const endpoint = firstNonEmpty(target.endpoint, data.endpoint);
  let ref = firstNonEmpty(target.ref, target.url, data.ref, data.src, data.graphUrl, data.url);
  let entryPort = firstNonEmpty(target.entryPort, target.portId, target.handleId, "root");
  if (!ref && endpoint) {
    const parsed = parsePortEndpoint(endpoint);
    if (parsed.ok && parsed.value?.filePath) {
      ref = endpointToUrl(parsed.value.filePath);
      if (parsed.value.portId) entryPort = parsed.value.portId;
    } else {
      ref = endpointToUrl(endpoint);
    }
  }
  const mode = firstNonEmpty(target.mode, data.mode, "expand").toLowerCase();
  const kind = firstNonEmpty(target.kind, data.kind, "fragment").toLowerCase();
  return { ref, entryPort, mode, kind };
};

export const buildExpansionKey = (sourceNodeId, target = {}) => {
  const source = typeof sourceNodeId === "string" ? sourceNodeId.trim() : "";
  const ref = typeof target.ref === "string" ? target.ref.trim() : "";
  const entryPort = typeof target.entryPort === "string" && target.entryPort.trim() ? target.entryPort.trim() : "root";
  const mode = typeof target.mode === "string" && target.mode.trim() ? target.mode.trim() : "expand";
  if (!source || !ref) return "";
  return [source, ref, entryPort, mode].join("::");
};

export const readExpansionState = (graphApi, sourceNodeId, target = {}) => {
  const expansionKey = buildExpansionKey(sourceNodeId, target);
  if (!graphApi || typeof graphApi.getNodes !== "function" || !expansionKey) {
    return { expanded: false, expansionId: null, expansionKey };
  }
  const nodes = Array.isArray(graphApi.getNodes()) ? graphApi.getNodes() : [];
  const match = nodes.find((node) => node?.data?._expansion?.expandKey === expansionKey);
  return {
    expanded: Boolean(match),
    expansionId: match?.data?._expansion?.expansionId || null,
    expansionKey
  };
};

