// Safe accessor for cross-frame graphAPI reads. Use this instead of directly
// referencing window.parent.graphAPI or window.top.graphAPI to avoid
// cross-origin SecurityError exceptions.

export function getSafeGraphAPI() {
  try {
    // Prefer a local graphAPI if present (injected by host SDK), otherwise try
    // parent/top with defensive chaining.
    return (
      (typeof window !== 'undefined' && window.graphAPI) ||
      (typeof window !== 'undefined' && window.parent && window.parent.graphAPI) ||
      (typeof window !== 'undefined' && window.top && window.top.graphAPI) ||
      null
    );
  } catch (err) {
    // Accessing window.parent/window.top on cross-origin frames throws.
    // Fall back to a local graphAPI if the host injected one (via the SDK proxy).
    try {
      return (typeof window !== 'undefined' && window.graphAPI) || null;
    } catch (e) {
      return null;
    }
  }
}

export default getSafeGraphAPI;
