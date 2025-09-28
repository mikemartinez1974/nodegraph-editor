// nodeEdgeBase.js

// Base Node class
export class Node {
  constructor({ id, label = '', position = { x: 0, y: 0 }, type = 'default', width = 60, height = 60, resizable = false, handlePosition = 'center', showLabel = false }) {
    this.id = id;
    this.label = label;
    this.position = position;
    this.type = type;
    this.width = width;
    this.height = height;
    this.resizable = resizable;
    this.handlePosition = handlePosition;
    this.showLabel = showLabel;
  }
}

// Base Edge class
export class Edge {
  constructor({ id, source, target, label = '', type = 'default', showLabel = false, style = {} }) {
    this.id = id;
    this.source = source;
    this.target = target;
    this.label = label;
    this.type = type;
    this.showLabel = showLabel;
    this.style = {
      color: style.color || undefined, // Let EdgeLayer use theme if undefined
      width: style.width || 2,
      dash: style.dash || [],
      curved: style.curved || false
    };
  }
}

// Node factory
export function createNode(props) {
  // Remove data property if present
  const { data, ...rest } = props;
  return new Node(rest);
}

// Edge factory
export function createEdge(props) {
  // Remove data property if present
  const { data, ...rest } = props;
  return new Edge(rest);
}
