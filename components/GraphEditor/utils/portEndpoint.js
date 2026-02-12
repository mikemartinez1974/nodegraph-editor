"use client";

export function parsePortEndpoint(endpoint) {
  if (typeof endpoint !== "string") {
    return { ok: false, error: "Endpoint must be a string." };
  }
  const raw = endpoint.trim();
  if (!raw) {
    return { ok: false, error: "Endpoint is required." };
  }

  const colonIndex = raw.lastIndexOf(":");
  if (colonIndex <= 0 || colonIndex === raw.length - 1) {
    return { ok: false, error: "Endpoint must match 'filePath:portId' or 'filePath#nodeId:portId'." };
  }

  const addressPart = raw.slice(0, colonIndex).trim();
  const portId = raw.slice(colonIndex + 1).trim();
  if (!addressPart || !portId) {
    return { ok: false, error: "Endpoint filePath and portId must be non-empty." };
  }

  const hashIndex = addressPart.indexOf("#");
  let filePath = addressPart;
  let nodeId = "";
  if (hashIndex >= 0) {
    filePath = addressPart.slice(0, hashIndex).trim();
    nodeId = addressPart.slice(hashIndex + 1).trim();
    if (!nodeId) {
      return { ok: false, error: "Endpoint nodeId cannot be empty when '#' is used." };
    }
  }

  if (!filePath) {
    return { ok: false, error: "Endpoint filePath cannot be empty." };
  }

  return {
    ok: true,
    value: {
      endpoint: raw,
      filePath,
      nodeId: nodeId || null,
      portId
    }
  };
}

export function endpointToUrl(filePath) {
  if (typeof filePath !== "string" || !filePath.trim()) return "";
  const trimmed = filePath.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
