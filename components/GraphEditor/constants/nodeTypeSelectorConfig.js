export const HIDDEN_SYSTEM_SELECTOR_TYPES = new Set([
  "manifest",
  "legend",
  "dictionary"
]);

export const CORE_SELECTOR_TYPES = new Set([
  "markdown",
  "port",
  "script",
  "view",
  "api"
]);

export const shouldShowInTypeSelectors = (type) => {
  if (!type || typeof type !== "string") return false;
  if (HIDDEN_SYSTEM_SELECTOR_TYPES.has(type)) return false;
  return CORE_SELECTOR_TYPES.has(type);
};
