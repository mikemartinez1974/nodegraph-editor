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

const VALID_PROPERTY_TYPES = new Set(['text', 'textarea', 'number', 'select', 'toggle', 'color', 'json']);
const VALID_DISPLAY_VARIANTS = new Set(['card', 'stat', 'list']);
const VALID_SANDBOX_TYPES = new Set(['iframe', 'worker']);

const ensureSandboxType = (value) => {
  const candidate = ensureString(value);
  if (!candidate) return null;
  const normalized = candidate.toLowerCase();
  return VALID_SANDBOX_TYPES.has(normalized) ? normalized : null;
};

const ensureIntegrity = (value) => {
  const candidate = ensureString(value);
  if (!candidate) return null;
  const fragments = candidate.split(/\s+/);
  const sriPattern = /^(sha256|sha384|sha512)-[A-Za-z0-9+/=]+$/;
  for (const fragment of fragments) {
    if (sriPattern.test(fragment)) {
      return fragment;
    }
  }
  return null;
};

const normalizeHandleList = (handles, direction, errors, nodeIndex) => {
  if (!Array.isArray(handles) || handles.length === 0) return [];
  return handles
    .map((handle, handleIndex) => {
      if (!handle || typeof handle !== 'object') {
        errors.push(`nodes[${nodeIndex}].definition.handles.${direction}[${handleIndex}] must be an object`);
        return null;
      }
      const id =
        ensureString(handle.id) ||
        ensureString(handle.key) ||
        ensureString(handle.name) ||
        `${direction}-${handleIndex}`;
      if (!id) {
        errors.push(`nodes[${nodeIndex}].definition.handles.${direction}[${handleIndex}] is missing an id/key`);
        return null;
      }
      return {
        id,
        label: ensureString(handle.label) || id,
        direction,
        dataType: ensureString(handle.dataType) || ensureString(handle.type) || 'value',
        description: ensureString(handle.description) || undefined
      };
    })
    .filter(Boolean);
};

const normalizePropertyField = (field, fieldIndex, nodeIndex, errors) => {
  if (!field || typeof field !== 'object') {
    errors.push(`nodes[${nodeIndex}].definition.properties[${fieldIndex}] must be an object`);
    return null;
  }
  const key = ensureString(field.key);
  if (!key) {
    errors.push(`nodes[${nodeIndex}].definition.properties[${fieldIndex}].key is required`);
    return null;
  }
  const type = ensureString(field.type) || 'text';
  if (!VALID_PROPERTY_TYPES.has(type)) {
    errors.push(`nodes[${nodeIndex}].definition.properties[${fieldIndex}].type must be one of ${Array.from(VALID_PROPERTY_TYPES).join(', ')}`);
  }
  let options;
  if (type === 'select') {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      errors.push(`nodes[${nodeIndex}].definition.properties[${fieldIndex}].options must be a non-empty array for select fields`);
    } else {
      options = field.options
        .map((option, optionIndex) => {
          if (!option || typeof option !== 'object') {
            errors.push(`nodes[${nodeIndex}].definition.properties[${fieldIndex}].options[${optionIndex}] must be an object`);
            return null;
          }
          const value = option.value !== undefined ? option.value : ensureString(option.id);
          const label = ensureString(option.label) || ensureString(option.name) || value;
          if (value === null || value === undefined) {
            errors.push(`nodes[${nodeIndex}].definition.properties[${fieldIndex}].options[${optionIndex}].value is required`);
            return null;
          }
          return {
            label: label || String(value),
            value
          };
        })
        .filter(Boolean);
    }
  }
  return {
    key,
    label: ensureString(field.label) || key,
    type,
    helperText: ensureString(field.helperText) || undefined,
    placeholder: ensureString(field.placeholder) || undefined,
    required: Boolean(field.required),
    min:
      typeof field.min === 'number' && Number.isFinite(field.min)
        ? field.min
        : undefined,
    max:
      typeof field.max === 'number' && Number.isFinite(field.max)
        ? field.max
        : undefined,
    step:
      typeof field.step === 'number' && Number.isFinite(field.step)
        ? field.step
        : undefined,
    defaultValue:
      field.defaultValue !== undefined
        ? field.defaultValue
        : field.default !== undefined
        ? field.default
        : undefined,
    options,
    multiline: type === 'textarea' ? true : undefined
  };
};

const normalizeDisplayDefinition = (display, nodeIndex, errors) => {
  if (!display) return undefined;
  if (typeof display !== 'object') {
    errors.push(`nodes[${nodeIndex}].definition.display must be an object`);
    return undefined;
  }
  const variant = ensureString(display.variant) || 'card';
  if (!VALID_DISPLAY_VARIANTS.has(variant)) {
    errors.push(
      `nodes[${nodeIndex}].definition.display.variant must be one of ${Array.from(VALID_DISPLAY_VARIANTS).join(', ')}`
    );
  }
  return {
    variant,
    primaryField: ensureString(display.primaryField) || undefined,
    secondaryField: ensureString(display.secondaryField) || undefined,
    badgeField: ensureString(display.badgeField) || undefined,
    listField: ensureString(display.listField) || undefined,
    footerField: ensureString(display.footerField) || undefined,
    emptyState: ensureString(display.emptyState) || undefined
  };
};

const normalizeRendererDefinition = (renderer, nodeIndex) => {
  if (!renderer) return { errors: [], value: undefined };
  if (typeof renderer !== 'object') {
    return { errors: [`nodes[${nodeIndex}].renderer must be an object if provided`], value: undefined };
  }
  const entry = ensureUrl(renderer.entry) || ensureUrl(renderer.url) || ensureString(renderer.entry);
  if (!entry) {
    return { errors: [`nodes[${nodeIndex}].renderer.entry must be a valid URL or path`], value: undefined };
  }
  return {
    errors: [],
    value: {
      entry,
      integrity: ensureString(renderer.integrity) || undefined,
      sandbox: ensureString(renderer.sandbox) || undefined
    }
  };
};

const normalizeNodeDefinition = (definition, nodeIndex) => {
  if (definition === undefined) {
    return { errors: [], value: undefined };
  }
  if (!definition || typeof definition !== 'object') {
    return { errors: [`nodes[${nodeIndex}].definition must be an object`], value: undefined };
  }
  const errors = [];
  const size =
    definition.size && typeof definition.size === 'object'
      ? {
          width:
            typeof definition.size.width === 'number' && definition.size.width > 0
              ? definition.size.width
              : undefined,
          height:
            typeof definition.size.height === 'number' && definition.size.height > 0
              ? definition.size.height
              : undefined
        }
      : undefined;
  const inputHandles = normalizeHandleList(definition.handles?.inputs, 'input', errors, nodeIndex);
  const outputHandles = normalizeHandleList(definition.handles?.outputs, 'output', errors, nodeIndex);
  const properties = Array.isArray(definition.properties)
    ? definition.properties
        .map((field, fieldIndex) => normalizePropertyField(field, fieldIndex, nodeIndex, errors))
        .filter(Boolean)
    : [];
  const display = normalizeDisplayDefinition(definition.display, nodeIndex, errors);
  return {
    errors,
    value: {
      size,
      handles: {
        inputs: inputHandles,
        outputs: outputHandles
      },
      properties,
      display
    }
  };
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
  let defaultData = undefined;
  if (node.defaultData !== undefined) {
    if (node.defaultData && typeof node.defaultData === 'object' && !Array.isArray(node.defaultData)) {
      defaultData = { ...node.defaultData };
    } else {
      errors.push(`nodes[${index}].defaultData must be an object when provided`);
    }
  }
  let extensions = undefined;
  if (node.extensions !== undefined) {
    if (node.extensions && typeof node.extensions === 'object' && !Array.isArray(node.extensions)) {
      extensions = { ...node.extensions };
    } else {
      errors.push(`nodes[${index}].extensions must be an object when provided`);
    }
  }
  const { errors: definitionErrors, value: definition } = normalizeNodeDefinition(node.definition, index);
  if (definitionErrors.length) {
    errors.push(...definitionErrors);
  }
  const { errors: rendererErrors, value: renderer } = normalizeRendererDefinition(node.renderer, index);
  if (rendererErrors.length) {
    errors.push(...rendererErrors);
  }
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
          : undefined,
      defaultData,
      extensions,
      definition,
      renderer
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
  const sandbox = bundle ? ensureSandboxType(bundle.sandbox) : null;
  const integrity = bundle ? ensureIntegrity(bundle.integrity) : null;
  if (!bundleUrl) errors.push('Manifest bundle.url must be a valid URL');
  if (!sandbox) errors.push('Manifest bundle.sandbox must be either "iframe" or "worker"');
  if (bundle?.integrity && !integrity) {
    errors.push('Manifest bundle.integrity must be a valid SRI hash (sha256/384/512)');
  }

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
    changelog: ensureString(manifest.changelog) || undefined,
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
        integrity: integrity || undefined
      },
      nodes: normalizedNodes,
      panels,
      metadata
    }
  };
}

export default validatePluginManifest;
