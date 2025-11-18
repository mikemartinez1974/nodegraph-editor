import { ValidationGuard } from '../../NodeGraph/validationGuards';

const DEFAULT_GUARD_OPTIONS = {
  allowAutoFix: true
};

const VALIDATION_SCOPES = {
  NODE: 'node',
  EDGE: 'edge',
  GROUP: 'group'
};

const DEFAULT_BOUNDS = { x: 0, y: 0, width: 0, height: 0 };

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createGuard = () => new ValidationGuard(DEFAULT_GUARD_OPTIONS);

const guardErrorToMessage = (errors = []) => {
  if (!errors || errors.length === 0) return 'Invalid data';
  return errors.map((err) => err.message || String(err)).join('; ');
};

const makeError = (scope, index, entity, message) => ({
  scope,
  index,
  id: isPlainObject(entity) ? entity.id : undefined,
  message
});

export function validateNodes(nodes = []) {
  if (!Array.isArray(nodes)) {
    return {
      valid: [],
      errors: [
        makeError(
          VALIDATION_SCOPES.NODE,
          -1,
          null,
          'Nodes payload must be an array'
        )
      ]
    };
  }

  const guard = createGuard();
  const valid = [];
  const errors = [];

  nodes.forEach((candidate, index) => {
    if (!isPlainObject(candidate)) {
      errors.push(
        makeError(
          VALIDATION_SCOPES.NODE,
          index,
          candidate,
          'Node must be an object'
        )
      );
      return;
    }

    const validation = guard.validateNode(candidate, valid);
    if (validation.isValid) {
      valid.push(validation.sanitized);
    } else {
      errors.push(
        makeError(
          VALIDATION_SCOPES.NODE,
          index,
          candidate,
          guardErrorToMessage(validation.errors)
        )
      );
    }
  });

  return { valid, errors };
}

const buildNodeContext = (nodes = [], edges = []) => {
  const context = Array.isArray(nodes) ? [...nodes] : [];
  const knownIds = new Set(context.map((node) => node.id).filter(Boolean));

  edges.forEach((edge) => {
    if (typeof edge?.source === 'string' && !knownIds.has(edge.source)) {
      knownIds.add(edge.source);
      context.push({ id: edge.source, position: { x: 0, y: 0 } });
    }
    if (typeof edge?.target === 'string' && !knownIds.has(edge.target)) {
      knownIds.add(edge.target);
      context.push({ id: edge.target, position: { x: 0, y: 0 } });
    }
  });

  return context;
};

export function validateEdges(edges = [], nodeContext = []) {
  if (!Array.isArray(edges)) {
    return {
      valid: [],
      errors: [
        makeError(
          VALIDATION_SCOPES.EDGE,
          -1,
          null,
          'Edges payload must be an array'
        )
      ]
    };
  }

  const guard = createGuard();
  const valid = [];
  const errors = [];
  const nodesForValidation = buildNodeContext(nodeContext, edges);

  edges.forEach((candidate, index) => {
    if (!isPlainObject(candidate)) {
      errors.push(
        makeError(
          VALIDATION_SCOPES.EDGE,
          index,
          candidate,
          'Edge must be an object'
        )
      );
      return;
    }

    const validation = guard.validateEdge(
      candidate,
      nodesForValidation,
      valid
    );
    if (validation.isValid) {
      valid.push(validation.sanitized);
    } else {
      errors.push(
        makeError(
          VALIDATION_SCOPES.EDGE,
          index,
          candidate,
          guardErrorToMessage(validation.errors)
        )
      );
    }
  });

  return { valid, errors };
}

const sanitizeBounds = (bounds) => {
  if (!isPlainObject(bounds)) return { ...DEFAULT_BOUNDS };
  const sanitized = { ...DEFAULT_BOUNDS };
  sanitized.x = typeof bounds.x === 'number' ? bounds.x : DEFAULT_BOUNDS.x;
  sanitized.y = typeof bounds.y === 'number' ? bounds.y : DEFAULT_BOUNDS.y;
  sanitized.width =
    typeof bounds.width === 'number' ? bounds.width : DEFAULT_BOUNDS.width;
  sanitized.height =
    typeof bounds.height === 'number' ? bounds.height : DEFAULT_BOUNDS.height;
  return sanitized;
};

const sanitizeNodeIds = (nodeIds) => {
  if (!Array.isArray(nodeIds)) return [];
  const seen = new Set();
  const sanitized = [];
  nodeIds.forEach((id) => {
    if (typeof id === 'string' && id.trim() && !seen.has(id)) {
      seen.add(id);
      sanitized.push(id);
    }
  });
  return sanitized;
};

export function validateGroups(groups = []) {
  if (!Array.isArray(groups)) {
    return {
      valid: [],
      errors: [
        makeError(
          VALIDATION_SCOPES.GROUP,
          -1,
          null,
          'Groups payload must be an array'
        )
      ]
    };
  }

  const valid = [];
  const errors = [];
  const seenIds = new Set();

  groups.forEach((candidate, index) => {
    if (!isPlainObject(candidate)) {
      errors.push(
        makeError(
          VALIDATION_SCOPES.GROUP,
          index,
          candidate,
          'Group must be an object'
        )
      );
      return;
    }

    const id =
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : null;
    if (!id) {
      errors.push(
        makeError(
          VALIDATION_SCOPES.GROUP,
          index,
          candidate,
          'Group must have a string id'
        )
      );
      return;
    }
    if (seenIds.has(id)) {
      errors.push(
        makeError(
          VALIDATION_SCOPES.GROUP,
          index,
          candidate,
          `Duplicate group id '${id}'`
        )
      );
      return;
    }

    const nodeIds = sanitizeNodeIds(candidate.nodeIds);
    if (nodeIds.length < 2) {
      errors.push(
        makeError(
          VALIDATION_SCOPES.GROUP,
          index,
          candidate,
          'Group must reference at least two nodes'
        )
      );
      return;
    }

    const sanitizedGroup = {
      id,
      label: typeof candidate.label === 'string' ? candidate.label : '',
      nodeIds,
      bounds: sanitizeBounds(candidate.bounds),
      visible: candidate.visible !== false,
      style: isPlainObject(candidate.style) ? candidate.style : {},
      extensions: isPlainObject(candidate.extensions)
        ? candidate.extensions
        : undefined
    };

    seenIds.add(id);
    valid.push(sanitizedGroup);
  });

  return { valid, errors };
}

export function summarizeValidationErrors(errors = []) {
  if (!errors || errors.length === 0) return '';

  const counts = errors.reduce((acc, error) => {
    const scope = error.scope || 'item';
    acc[scope] = (acc[scope] || 0) + 1;
    return acc;
  }, {});

  const parts = Object.entries(counts).map(([scope, count]) => {
    const label = scope.endsWith('s')
      ? scope
      : `${scope}${count === 1 ? '' : 's'}`;
    return `${count} ${label}`;
  });

  const example = errors[0];
  const detail = example?.message
    ? ` Example: ${capitalizeScope(example.scope)}${
        example.id ? ` '${example.id}'` : ''
      } – ${example.message}`
    : '';

  return `Skipped ${parts.join(', ')} due to validation errors.${detail}`;
}

const capitalizeScope = (scope = 'item') => {
  const text = scope.toString();
  if (!text.length) return 'Item';
  return text.charAt(0).toUpperCase() + text.slice(1);
};
