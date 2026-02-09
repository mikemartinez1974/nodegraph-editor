const SCHEMA_REGISTRY = new Map();

const DEFAULT_SCHEMA = {
  ports: []
};

export function defineNodeSchema(type, schema = {}) {
  if (!type) return;
  const normalized = {
    type,
    version: schema.version || '1.0',
    ports: Array.isArray(schema.ports) ? schema.ports : [],
    metadata: schema.metadata || {}
  };
  SCHEMA_REGISTRY.set(type, normalized);
  return normalized;
}

export function getNodeSchema(type) {
  return SCHEMA_REGISTRY.get(type) || DEFAULT_SCHEMA;
}

export function getHandlesForNode(type) {
  const schema = getNodeSchema(type);
  return Array.isArray(schema.ports) ? schema.ports : [];
}

export function findHandle(type, handleId) {
  if (!handleId) return null;
  const handles = getHandlesForNode(type);
  return handles.find((handle) => handle && handle.id === handleId) || null;
}

export function validateHandle(type, handleId) {
  return Boolean(findHandle(type, handleId));
}

export function allSchemas() {
  return Array.from(SCHEMA_REGISTRY.values());
}

// Example schemas — expand as needed
defineNodeSchema('markdown', {
  version: '1.0',
  ports: [
    { id: 'in', direction: 'input', side: 'left', description: 'Optional inbound link' },
    { id: 'out', direction: 'output', side: 'right', description: 'Optional outbound link' }
  ],
  metadata: {
    builtin: true
  }
});

defineNodeSchema('default', {
  version: '1.0',
  ports: [
    { id: 'in', direction: 'input', side: 'left' },
    { id: 'out', direction: 'output', side: 'right' }
  ],
  metadata: {
    builtin: true
  }
});
