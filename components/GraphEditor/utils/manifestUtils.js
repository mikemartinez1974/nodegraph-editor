export const getManifestNode = (nodes = []) => {
  if (!Array.isArray(nodes)) return null;
  return nodes.find((node) => node?.type === 'manifest') || null;
};

export const getManifestSettings = (nodes = []) => {
  const manifest = getManifestNode(nodes);
  const settings = manifest?.data?.settings;
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    return settings;
  }
  return null;
};

export const setManifestSettings = (nodes = [], settings) => {
  if (!Array.isArray(nodes) || !settings || typeof settings !== 'object') {
    return nodes;
  }
  const mergeSettings = (base, patch) => {
    const current = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
    const next = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
    const merged = { ...current };
    Object.keys(next).forEach((key) => {
      const prevValue = merged[key];
      const nextValue = next[key];
      if (
        prevValue &&
        typeof prevValue === 'object' &&
        !Array.isArray(prevValue) &&
        nextValue &&
        typeof nextValue === 'object' &&
        !Array.isArray(nextValue)
      ) {
        merged[key] = { ...prevValue, ...nextValue };
        return;
      }
      merged[key] = nextValue;
    });
    return merged;
  };
  let found = false;
  const next = nodes.map((node) => {
    if (node?.type !== 'manifest') return node;
    found = true;
    const data = node.data && typeof node.data === 'object' ? node.data : {};
    const existingSettings = data.settings && typeof data.settings === 'object' ? data.settings : {};
    return {
      ...node,
      data: {
        ...data,
        settings: mergeSettings(existingSettings, settings)
      }
    };
  });
  return found ? next : nodes;
};

export const getManifestDocumentUrl = (nodes = []) => {
  const manifest = getManifestNode(nodes);
  const url = manifest?.data?.document?.url;
  return typeof url === 'string' ? url : null;
};

export const setManifestDocumentUrl = (nodes = [], url) => {
  if (!Array.isArray(nodes)) return nodes;
  let found = false;
  const next = nodes.map((node) => {
    if (node?.type !== 'manifest') return node;
    found = true;
    const data = node.data && typeof node.data === 'object' ? node.data : {};
    const document = data.document && typeof data.document === 'object' ? data.document : {};
    return {
      ...node,
      data: {
        ...data,
        document: {
          ...document,
          url: typeof url === 'string' ? url : ''
        }
      }
    };
  });
  return found ? next : nodes;
};
