// Enhanced edge types with rich styling options

const edgeTypes = {
  // Hierarchical relationships
  child: {
    label: 'Child',
    description: 'Parent-child hierarchical relationship',
    style: {
      color: undefined, // Use theme default
      width: 2,
      dash: [],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'vertical', // 'vertical' | 'horizontal' | 'auto'
      opacity: 1,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end', // 'start' | 'end' | 'both'
      animation: null,
      gradient: null // { start: '#color1', end: '#color2' }
    }
  },

  peer: {
    label: 'Peer',
    description: 'Peer-to-peer relationship',
    style: {
      color: undefined,
      width: 2,
      dash: [5, 5],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'horizontal',
      opacity: 0.8,
      arrowSize: 6,
      showArrow: false,
      arrowPosition: 'both',
      animation: null,
      gradient: null
    }
  },

  // Data flow relationships
  dataFlow: {
    label: 'Data Flow',
    description: 'Data flowing from source to target',
    style: {
      color: '#2196f3', // Blue
      width: 3,
      dash: [],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 1,
      arrowSize: 10,
      showArrow: true,
      arrowPosition: 'end',
      animation: 'flow', // 'flow' | 'pulse' | 'dash' | null
      animationSpeed: 1,
      gradient: { start: '#2196f3', end: '#03a9f4' }
    }
  },

  dependency: {
    label: 'Dependency',
    description: 'Dependency relationship',
    style: {
      color: '#ff9800', // Orange
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

  reference: {
    label: 'Reference',
    description: 'Reference or link',
    style: {
      color: '#9c27b0', // Purple
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
  },

  // Special relationships
  bidirectional: {
    label: 'Bidirectional',
    description: 'Two-way relationship',
    style: {
      color: '#4caf50', // Green
      width: 2.5,
      dash: [],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 1,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'both',
      animation: null,
      gradient: null
    }
  },

  weak: {
    label: 'Weak Link',
    description: 'Weak or optional relationship',
    style: {
      color: '#9e9e9e', // Gray
      width: 1,
      dash: [2, 4],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 0.5,
      arrowSize: 5,
      showArrow: false,
      animation: null,
      gradient: null
    }
  },

  strong: {
    label: 'Strong Link',
    description: 'Strong or required relationship',
    style: {
      color: '#f44336', // Red
      width: 4,
      dash: [],
      curved: true,
      route: 'orthogonal',
      opacity: 1,
      arrowSize: 10,
      showArrow: true,
      arrowPosition: 'end',
      animation: 'pulse',
      animationSpeed: 0.5,
      gradient: null
    }
  },

  temporal: {
    label: 'Temporal',
    description: 'Time-based relationship',
    style: {
      color: '#00bcd4', // Cyan
      width: 2,
      dash: [10, 5, 2, 5],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'horizontal',
      opacity: 0.9,
      arrowSize: 8,
      showArrow: true,
      arrowPosition: 'end',
      animation: 'dash',
      animationSpeed: 2,
      gradient: null
    }
  },

  // Custom gradient example
  energyFlow: {
    label: 'Energy Flow',
    description: 'Energy or power flow',
    style: {
      color: null, // Will use gradient
      width: 3,
      dash: [],
      curved: true,
      route: 'orthogonal',
      curveDirection: 'auto',
      opacity: 1,
      arrowSize: 10,
      showArrow: true,
      arrowPosition: 'end',
      animation: 'flow',
      animationSpeed: 1.5,
      gradient: { start: '#ffeb3b', end: '#ff5722' } // Yellow to red
    }
  },

  // Canonical structure relationships
  contains: {
    label: 'Contains',
    description: 'Structural containment relationship',
    style: {
      color: '#6d4c41', // Brown
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

  requires: {
    label: 'Requires',
    description: 'Requirement dependency relationship',
    style: {
      color: '#ef6c00', // Deep orange
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
      color: '#00695c', // Teal
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

  derives: {
    label: 'Derives',
    description: 'Derived-from relationship',
    style: {
      color: '#5e35b1', // Deep purple
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
      color: '#d32f2f', // Red
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
      color: '#283593', // Indigo
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
      color: '#37474f', // Blue gray
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
  }
};

// Helper function to get edge style with overrides
export function getEdgeStyle(edgeType, overrides = {}) {
  const baseStyle = edgeTypes[edgeType]?.style || edgeTypes.child.style;
  return {
    ...baseStyle,
    ...overrides
  };
}

// Helper function to merge edge styles
export function mergeEdgeStyles(baseType, customStyle) {
  const base = edgeTypes[baseType]?.style || {};
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
