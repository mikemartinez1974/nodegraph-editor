export const DEFAULT_LAYOUT_SETTINGS = {
  mode: 'autoOnMissingPositions',
  defaultLayout: 'hierarchical',
  direction: 'DOWN',
  edgeLaneGapPx: 10,
  serpentine: {
    maxPerRow: 6
  },
  cycleFallback: {
    enabled: true
  }
};

export const EDGE_ROUTING_OPTIONS = [
  { value: 'auto', label: 'Auto (respect edge styles)' },
  { value: 'orthogonal', label: 'Orthogonal (force)' },
  { value: 'straight', label: 'Straight (direct)' },
  { value: 'curved', label: 'Curved (force)' }
];

export const LAYOUT_MODE_OPTIONS = [
  { value: 'autoOnMissingPositions', label: 'Auto (only when positions omitted)' },
  { value: 'manual', label: 'Manual (never auto-layout on paste)' }
];

export const LAYOUT_TYPE_OPTIONS = [
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'serpentine', label: 'Serpentine' },
  { value: 'grid', label: 'Grid' },
  { value: 'radial', label: 'Radial' }
];

export const LAYOUT_DIRECTION_OPTIONS = [
  { value: 'DOWN', label: 'Top-down' },
  { value: 'RIGHT', label: 'Left-right' }
];

export const ELK_ALGORITHM_OPTIONS = [
  { value: 'fixed', label: 'Fixed (reroute only)' },
  { value: 'layered', label: 'Layered / hierarchical' },
  { value: 'radial', label: 'Radial / spoke' },
  { value: 'rectpacking', label: 'Rectpacking / compact' }
];

export const ELK_EDGE_ROUTING_OPTIONS = [
  { value: 'ORTHOGONAL', label: 'Orthogonal' },
  { value: 'POLYLINE', label: 'Polyline (smooth-ish)' }
];

export const ELK_PORT_CONSTRAINT_OPTIONS = [
  { value: 'FIXED_SIDE', label: 'Lock to declared side' },
  { value: 'ANY_SIDE', label: 'Any side (flexible)' }
];

export const DEFAULT_ELK_ROUTING_SETTINGS = {
  algorithm: 'fixed',
  edgeRouting: 'ORTHOGONAL',
  portConstraints: 'FIXED_SIDE',
  nodeSpacing: 120,
  layeredEdgeSpacing: 80
};

export const DEFAULT_GRID_SIZE = 20;
