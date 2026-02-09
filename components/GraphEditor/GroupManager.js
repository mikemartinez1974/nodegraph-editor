// GroupManager.js - Manages all cluster operations and state management
import { v4 as uuidv4 } from 'uuid';

export class GroupManager {
  constructor() {
    this.clusters = new Map(); // clusterId -> group data
    this.nodeToGroup = new Map(); // nodeId -> clusterId
    this.groupHierarchy = new Map(); // parentGroupId -> Set of childGroupIds
  }

  // Create a new group from selected nodes
  createGroup(nodeIds, options = {}) {
    if (!nodeIds || nodeIds.length < 2) {
      return { success: false, error: 'At least 2 nodes required to create a cluster' };
    }

    const clusterId = options.id || `group-${uuidv4()}`;
    
    // Calculate group bounds
    const bounds = this.calculateGroupBounds(nodeIds, options.nodes || []);
    
    const group = {
      id: clusterId,
      label: options.label || `Cluster ${this.clusters.size + 1}`,
      nodeIds: [...nodeIds],
      bounds,
      style: {
        backgroundColor: options.backgroundColor || 'rgba(25, 118, 210, 0.1)',
        borderColor: options.borderColor || '#1976d2',
        borderWidth: options.borderWidth || 2,
        borderRadius: options.borderRadius || 8,
        ...options.style
      },
      collapsed: false,
      visible: true,
      created: Date.now(),
      ...options
    };

    // Register group and node mappings
    this.clusters.set(clusterId, group);
    nodeIds.forEach(nodeId => {
      this.nodeToGroup.set(nodeId, clusterId);
    });

    return { success: true, data: group };
  }

  // Remove a group (ungroup nodes)
  removeGroup(clusterId) {
    const group = this.clusters.get(clusterId);
    if (!group) {
      return { success: false, error: 'Cluster not found' };
    }

    // Remove node mappings
    group.nodeIds.forEach(nodeId => {
      this.nodeToGroup.delete(nodeId);
    });

    // Remove from hierarchy
    this.groupHierarchy.delete(clusterId);
    
    // Remove group
    this.clusters.delete(clusterId);

    return { success: true, data: group };
  }

  // Add nodes to existing group
  addNodesToGroup(clusterId, nodeIds) {
    const group = this.clusters.get(clusterId);
    if (!group) {
      return { success: false, error: 'Cluster not found' };
    }

    // Add new nodes
    nodeIds.forEach(nodeId => {
      if (!group.nodeIds.includes(nodeId)) {
        group.nodeIds.push(nodeId);
        this.nodeToGroup.set(nodeId, clusterId);
      }
    });

    return { success: true, data: group };
  }

  // Remove nodes from group
  removeNodesFromGroup(clusterId, nodeIds) {
    const group = this.clusters.get(clusterId);
    if (!group) {
      return { success: false, error: 'Cluster not found' };
    }

    // Remove nodes
    nodeIds.forEach(nodeId => {
      group.nodeIds = group.nodeIds.filter(id => id !== nodeId);
      this.nodeToGroup.delete(nodeId);
    });

    // If group becomes empty or has only 1 node, remove it
    if (group.nodeIds.length < 2) {
      return this.removeGroup(clusterId);
    }

    return { success: true, data: group };
  }

  // Calculate bounds for a group based on its nodes
  calculateGroupBounds(nodeIds, allNodes) {
    if (!nodeIds.length || !allNodes.length) {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    const groupNodes = allNodes.filter(node => nodeIds.includes(node.id));
    if (!groupNodes.length) {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    const padding = 20;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    groupNodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const width = node.width || 80;
      const height = node.height || 48;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + (padding * 2),
      height: maxY - minY + (padding * 2)
    };
  }

  // Update group bounds when nodes move
  updateGroupBounds(clusterId, allNodes) {
    const group = this.clusters.get(clusterId);
    if (!group) return { success: false, error: 'Cluster not found' };

    group.bounds = this.calculateGroupBounds(group.nodeIds, allNodes);
    return { success: true, data: group };
  }

  // Get group for a node
  getNodeGroup(nodeId) {
    const clusterId = this.nodeToGroup.get(nodeId);
    return clusterId ? this.clusters.get(clusterId) : null;
  }

  // Get all groups
  getAllGroups() {
    return Array.from(this.clusters.values());
  }

  // Collapse/expand group
  toggleGroupCollapse(clusterId) {
    const group = this.clusters.get(clusterId);
    if (!group) return { success: false, error: 'Cluster not found' };

    group.collapsed = !group.collapsed;
    return { success: true, data: group };
  }

  // Move entire group
  moveGroup(clusterId, deltaX, deltaY, allNodes) {
    const group = this.clusters.get(clusterId);
    if (!group || group.collapsed) {
      return { success: false, error: 'Cluster not found or collapsed' };
    }

    // Update group bounds
    group.bounds.x += deltaX;
    group.bounds.y += deltaY;

    // Return nodes that need to be moved
    const nodesToMove = allNodes.filter(node => group.nodeIds.includes(node.id));
    
    return { 
      success: true, 
      data: { 
        group, 
        nodesToMove: nodesToMove.map(node => ({
          ...node,
          position: {
            x: node.position.x + deltaX,
            y: node.position.y + deltaY
          }
        }))
      }
    };
  }

  // Get groups that contain any of the given nodes
  getGroupsForNodes(nodeIds) {
    const groupIds = new Set();
    nodeIds.forEach(nodeId => {
      const clusterId = this.nodeToGroup.get(nodeId);
      if (clusterId) groupIds.add(clusterId);
    });
    
    return Array.from(groupIds).map(id => this.clusters.get(id)).filter(Boolean);
  }

  // Serialize groups for saving
  serialize() {
    return {
      clusters: Array.from(this.clusters.entries()),
      nodeToGroup: Array.from(this.nodeToGroup.entries()),
      groupHierarchy: Array.from(this.groupHierarchy.entries())
    };
  }

  // Deserialize groups from saved data
  deserialize(data) {
    if (!data) return;
    
    this.clusters = new Map(data.clusters || []);
    this.nodeToGroup = new Map(data.nodeToGroup || []);
    this.groupHierarchy = new Map(data.groupHierarchy || []);
  }

  // Clear all groups
  clear() {
    this.clusters.clear();
    this.nodeToGroup.clear();
    this.groupHierarchy.clear();
  }
}

export default GroupManager;
