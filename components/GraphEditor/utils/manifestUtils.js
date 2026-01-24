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
  let found = false;
  const next = nodes.map((node) => {
    if (node?.type !== 'manifest') return node;
    found = true;
    const data = node.data && typeof node.data === 'object' ? node.data : {};
    return {
      ...node,
      data: {
        ...data,
        settings
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
