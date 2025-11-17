// components/GraphEditor/plugins/manifestSchema.js
// Basic manifest validator used by the plugin registry (Phase 1)

const ensureString = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const ensureUrl = (value) => {
  const url = ensureString(value);
  if (!url) return null;
  try {
    let parsed;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      parsed = new URL(url);
    } else if (typeof window !== 'undefined' && window.location) {
      parsed = new URL(url, window.location.origin);
    } else {
      return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizePermissions = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((perm) => ensureString(perm))
    .filter(Boolean)
    .map((perm) => perm.toLowerCase());
};

const normalizeNodeEntry = (node, index) => {
  if (!node || typeof node !== 'object') {
    return { errors: [`nodes[${index}] must be an object`] };
  }
  const type = ensureString(node.type);
  const entry = ensureString(node.entry);
  const label = ensureString(node.label) || type;
  const errors = [];
  if (!type) errors.push(`nodes[${index}].type is required`);
  if (!entry) errors.push(`nodes[${index}].entry is required`);
  return {
    errors,
    value: {
      type,
      entry,
      label,
      description: ensureString(node.description) || '',
      category: ensureString(node.category) || 'custom',
      icon: ensureString(node.icon) || 'ExtensionPuzzle',
      defaultWidth:
        typeof node.defaultWidth === 'number' && node.defaultWidth > 0
          ? node.defaultWidth
          : undefined,
      defaultHeight:
        typeof node.defaultHeight === 'number' && node.defaultHeight > 0
          ? node.defaultHeight
          : undefined
    }
  };
};

export function validatePluginManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be an object'] };
  }

  const id = ensureString(manifest.id);
  const version = ensureString(manifest.version);
  const name = ensureString(manifest.name) || id;
  const description = ensureString(manifest.description) || '';

  if (!id) errors.push('Manifest id is required');
  if (!version) errors.push('Manifest version is required');

  const bundle = manifest.bundle && typeof manifest.bundle === 'object' ? manifest.bundle : null;
  if (!bundle) {
    errors.push('Manifest bundle is required');
  }
  const bundleUrl = bundle ? ensureUrl(bundle.url) : null;
  const sandbox = bundle ? ensureString(bundle.sandbox) : null;
  if (!bundleUrl) errors.push('Manifest bundle.url must be a valid URL');
  if (!sandbox) errors.push('Manifest bundle.sandbox must indicate "iframe" or "worker"');

  const permissions = normalizePermissions(manifest.permissions);

  const nodes = Array.isArray(manifest.nodes) ? manifest.nodes : [];
  const normalizedNodes = [];
  nodes.forEach((node, index) => {
    const { errors: nodeErrors, value } = normalizeNodeEntry(node, index);
    if (nodeErrors.length) {
      errors.push(...nodeErrors);
    } else {
      normalizedNodes.push(value);
    }
  });

  if (normalizedNodes.length === 0) {
    errors.push('Manifest must declare at least one node type');
  }

  const panels = Array.isArray(manifest.panels)
    ? manifest.panels
        .map((panel, index) => {
          if (!panel || typeof panel !== 'object') {
            errors.push(`panels[${index}] must be an object`);
            return null;
          }
          const id = ensureString(panel.id);
          const slot = ensureString(panel.slot);
          const entry = ensureString(panel.entry);
          if (!id) errors.push(`panels[${index}].id is required`);
          if (!slot) errors.push(`panels[${index}].slot is required`);
          if (!entry) errors.push(`panels[${index}].entry is required`);
          return {
            id,
            slot,
            entry,
            label: ensureString(panel.label) || id,
            description: ensureString(panel.description) || ''
          };
        })
        .filter(Boolean)
    : [];

  const metadata = {
    homepage: ensureString(manifest.homepage) || undefined,
    license: ensureString(manifest.license) || undefined,
    author:
      manifest.author && typeof manifest.author === 'object'
        ? {
            name: ensureString(manifest.author.name) || '',
            url: ensureString(manifest.author.url) || undefined
          }
        : undefined
  };

  if (errors.length) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    manifest: {
      id,
      version,
      name,
      description,
      permissions,
      bundle: {
        url: bundleUrl,
        sandbox,
        integrity: ensureString(bundle.integrity) || undefined
      },
      nodes: normalizedNodes,
      panels,
      metadata
    }
  };
}

export default validatePluginManifest;
