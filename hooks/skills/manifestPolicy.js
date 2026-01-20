const DEFAULT_POLICY = {
  allowCreate: true,
  allowUpdate: true,
  allowDelete: true,
  appendOnly: false
};

export const getManifestMutationPolicy = (graphAPI) => {
  const nodes = typeof graphAPI?.getNodes === 'function' ? graphAPI.getNodes() : [];
  const manifest = nodes.find((node) => node?.type === 'manifest') || null;
  if (!manifest) {
    return { hasManifest: false, policy: { ...DEFAULT_POLICY } };
  }

  const mutation = manifest?.data?.authority?.mutation;
  if (!mutation || typeof mutation !== 'object') {
    return {
      hasManifest: true,
      policy: { ...DEFAULT_POLICY },
      warning: 'Manifest authority.mutation is missing or invalid; using permissive defaults.'
    };
  }

  return {
    hasManifest: true,
    policy: {
      allowCreate: mutation.allowCreate !== false,
      allowUpdate: mutation.allowUpdate !== false,
      allowDelete: mutation.allowDelete !== false,
      appendOnly: mutation.appendOnly === true
    }
  };
};

export const assertMutationAllowed = (graphAPI, action) => {
  const { policy, warning } = getManifestMutationPolicy(graphAPI);
  if (action === 'create' && policy.allowCreate === false) {
    return { error: 'Manifest forbids create operations.', warning };
  }
  if (action === 'update' && policy.allowUpdate === false) {
    return { error: 'Manifest forbids update operations.', warning };
  }
  if (action === 'delete' && (policy.allowDelete === false || policy.appendOnly === true)) {
    return { error: 'Manifest forbids delete operations (append-only enforced).', warning };
  }
  return { warning };
};
