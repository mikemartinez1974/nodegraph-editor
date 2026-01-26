// Canonical edge taxonomy with semantic primitives + attributes (flow/strength/etc.)

const canonicalEdgeTypes = {
  relates: {
    label: 'Relates',
    description: 'Generic association',
    style: {
      color: undefined,
      width: 2,
      dash: [],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.9,
      arrowSize: 7,
      showArrow: false,
      arrowPosition: 'both',
      animation: null,
      gradient: null
    }
  },
  contains: {
    label: 'Contains',
    description: 'Structural containment relationship',
    style: {
      color: '#6d4c41',
      width: 2,
      dash: [],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.9,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  dependsOn: {
    label: 'Depends On',
    description: 'Soft dependency relationship',
    style: {
      color: '#ff9800',
      width: 2,
      dash: [8, 4],
      curved: true,
      route: 'orthogonal',
      opacity: 0.9,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  requires: {
    label: 'Requires',
    description: 'Hard dependency relationship',
    style: {
      color: '#ef6c00',
      width: 2,
      dash: [6, 4],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.95,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  precedes: {
    label: 'Precedes',
    description: 'Sequential ordering relationship',
    style: {
      color: '#00695c',
      width: 2,
      dash: [4, 4],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'horizontal',
      opacity: 0.9,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  derivesFrom: {
    label: 'Derives From',
    description: 'Derived-from relationship',
    style: {
      color: '#5e35b1',
      width: 2,
      dash: [8, 3],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.9,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  constrains: {
    label: 'Constrains',
    description: 'Constraint relationship',
    style: {
      color: '#d32f2f',
      width: 2,
      dash: [2, 6],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.85,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  governs: {
    label: 'Governs',
    description: 'Authority or governance relationship',
    style: {
      color: '#283593',
      width: 2,
      dash: [],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'vertical',
      opacity: 0.95,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  equivalentTo: {
    label: 'Equivalent To',
    description: 'Equivalence relationship',
    style: {
      color: '#37474f',
      width: 2,
      dash: [3, 3],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.85,
      arrowSize: 7,
      showArrow: false,
      arrowPosition: 'both',
      animation: null,
      gradient: null
    }
  },
  transformsTo: {
    label: 'Transforms To',
    description: 'Change-of-form relationship',
    style: {
      color: '#7e57c2',
      width: 2,
      dash: [6, 3],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.9,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  },
  conflictsWith: {
    label: 'Conflicts With',
    description: 'Contradiction or competition',
    style: {
      color: '#c62828',
      width: 2,
      dash: [2, 4],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.9,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'both',
      animation: null,
      gradient: null
    }
  },
  references: {
    label: 'References',
    description: 'Graph-internal citation',
    style: {
      color: '#9c27b0',
      width: 1.5,
      dash: [3, 3],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.7,
      arrowSize: 6,
      showArrow: true,
      arrowPosition: 'end',
      animation: null,
      gradient: null
    }
  }
};

const legacyEdgeTypes = {
  child: {
    label: 'Child (legacy)',
    description: 'Legacy: use contains',
    deprecated: true,
    aliasTo: 'contains'
  },
  peer: {
    label: 'Peer (legacy)',
    description: 'Legacy: use relates + direction=bidirectional',
    deprecated: true,
    aliasTo: 'relates'
  },
  dataFlow: {
    label: 'Data Flow (legacy)',
    description: 'Legacy: use relates + flow=data',
    deprecated: true,
    aliasTo: 'relates'
  },
  dependency: {
    label: 'Dependency (legacy)',
    description: 'Legacy: use dependsOn',
    deprecated: true,
    aliasTo: 'dependsOn'
  },
  reference: {
    label: 'Reference (legacy)',
    description: 'Legacy: use references',
    deprecated: true,
    aliasTo: 'references'
  },
  bidirectional: {
    label: 'Bidirectional (legacy)',
    description: 'Legacy: use relates + direction=bidirectional',
    deprecated: true,
    aliasTo: 'relates'
  },
  weak: {
    label: 'Weak (legacy)',
    description: 'Legacy: use relates + strength=weak',
    deprecated: true,
    aliasTo: 'relates'
  },
  strong: {
    label: 'Strong (legacy)',
    description: 'Legacy: use relates + strength=strong',
    deprecated: true,
    aliasTo: 'relates'
  },
  temporal: {
    label: 'Temporal (legacy)',
    description: 'Legacy: use precedes',
    deprecated: true,
    aliasTo: 'precedes'
  },
  energyFlow: {
    label: 'Energy Flow (legacy)',
    description: 'Legacy: use relates + flow=energy',
    deprecated: true,
    aliasTo: 'relates'
  },
  derives: {
    label: 'Derives (legacy)',
    description: 'Legacy: use derivesFrom',
    deprecated: true,
    aliasTo: 'derivesFrom'
  }
};

const edgeTypes = {
  ...canonicalEdgeTypes,
  ...legacyEdgeTypes
};

// Helper function to get edge style with overrides
const resolveEdgeStyle = (edgeType) => {
  const meta = edgeTypes[edgeType] || edgeTypes.relates;
  if (meta?.style) return meta.style;
  if (meta?.aliasTo && edgeTypes[meta.aliasTo]?.style) return edgeTypes[meta.aliasTo].style;
  return edgeTypes.relates.style;
};

export function getEdgeStyle(edgeType, overrides = {}) {
  const baseStyle = resolveEdgeStyle(edgeType);
  return {
    ...baseStyle,
    ...overrides
  };
}

// Helper function to merge edge styles
export function mergeEdgeStyles(baseType, customStyle) {
  const base = resolveEdgeStyle(baseType) || {};
  return {
    ...base,
    ...customStyle,
    // Deep merge gradient if present
    gradient: customStyle.gradient ?
      { ...base.gradient, ...customStyle.gradient } :
      base.gradient
  };
}

export default edgeTypes;
