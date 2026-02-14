"use client";

const NON_CONTENT_NODE_TYPES = new Set(["manifest", "legend", "dictionary"]);

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const isExplicitRootNode = (node) => {
  if (!node || typeof node !== "object") return false;
  if (node.isRoot === true) return true;
  const data = node.data && typeof node.data === "object" ? node.data : {};
  return data.isRoot === true || data.root === true;
};

export const getGraphRootNode = (nodes = []) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  const contentNodes = nodes.filter((node) => node && !NON_CONTENT_NODE_TYPES.has(node.type));
  if (!contentNodes.length) return null;
  const explicit = contentNodes.find((node) => isExplicitRootNode(node));
  if (explicit) return explicit;
  return contentNodes[0] || null;
};

export const centerViewportOnNode = ({ node, zoom = 1, setPan, containerId = "graph-canvas" }) => {
  if (!node || typeof setPan !== "function") return false;

  const width = toNumber(node.width, 160);
  const height = toNumber(node.height, 80);
  const posX = toNumber(node.position?.x ?? node.x, 0);
  const posY = toNumber(node.position?.y ?? node.y, 0);
  const nodeCenterX = posX + width / 2;
  const nodeCenterY = posY + height / 2;

  let viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  let viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  if (typeof document !== "undefined") {
    const container = document.getElementById(containerId);
    if (container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) viewportWidth = rect.width;
      if (rect.height > 0) viewportHeight = rect.height;
    }
  }

  setPan({
    x: viewportWidth / 2 - nodeCenterX * zoom,
    y: viewportHeight / 2 - nodeCenterY * zoom
  });
  return true;
};

