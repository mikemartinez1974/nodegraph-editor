"use client";

const toBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

export const isGraphReferenceEmbedEnabled = () => {
  if (process.env.NODE_ENV === "development") return true;
  if (toBooleanFlag(process.env.NEXT_PUBLIC_ENABLE_GRAPH_REFERENCE_EMBED)) return true;
  if (typeof window === "undefined") return false;
  if (toBooleanFlag(window.__TWILITE_ENABLE_GRAPH_REFERENCE_EMBED__)) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    return toBooleanFlag(params.get("graphEmbed"));
  } catch {
    return false;
  }
};
