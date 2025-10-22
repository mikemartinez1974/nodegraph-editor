// GraphCRUD.js
// LLM-friendly CRUD API for graph manipulation
import { v4 as uuidv4 } from 'uuid';

/**
 * CRUD API for Node Graph Editor
 * All functions return { success: boolean, data?: any, error?: string }
 */

function deduplicateNodes(nodes) {
  const seen = new Set();
  return nodes.filter(node => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

export default class GraphCRUD {
  constructor(getNodes, setNodes, getEdges, setEdges, saveToHistory) {
    this.getNodes = getNodes;
    this.setNodes = setNodes;
    this.getEdges = getEdges;
    this.setEdges = setEdges;
    this.saveToHistory = saveToHistory;
  }

  // ==================== NODE CRUD ====================

  /**
   * Create a new node
   * @param {Object} options - Node creation options
   * @param {string} options.id - Optional custom ID (auto-generated if not provided)
   * @param {string} options.type - Node type (default, display, list)
   * @param {string} options.label - Node label
   * @param {Object} options.position - {x, y} coordinates
   * @param {Object} options.data - {memo, link} data object
   * @param {number} options.width - Node width
   * @param {number} options.height - Node height
   * @returns {Object} Result with created node
   */
  createNode({ id, type = 'default', label = '', position = { x: 100, y: 100 }, data = {}, width, height } = {}) {
    try {
      const currentNodes = this.getNodes();
      let nodeId;
      do {
        nodeId = id || this._generateId();
      } while (currentNodes.some(n => n.id === nodeId));
      const newNode = {
        id: nodeId,
        type,
        label,
        position,
        width: width !== undefined ? width : 80,
        height: height !== undefined ? height : 48,
        data: {
          memo: data.memo || '',
          link: data.link || ''
        },
        resizable: true,
        handlePosition: 'center',
        showLabel: true
      };
      const updatedNodes = deduplicateNodes([...currentNodes, newNode]);
      this.setNodes(updatedNodes);
      this.saveToHistory(updatedNodes, this.getEdges());
      return { success: true, data: newNode };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Read/Get node(s)
   * @param {string} id - Optional node ID. If omitted, returns all nodes
   * @returns {Object} Result with node(s)
   */
  readNode(id) {
    try {
      const nodes = this.getNodes();
      if (id) {
        const node = nodes.find(n => n.id === id);
        if (!node) return { success: false, error: `Node ${id} not found` };
        return { success: true, data: node };
      }
      return { success: true, data: nodes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a node
   * @param {string} id - Node ID
   * @param {Object} updates - Properties to update
   * @returns {Object} Result with updated node
   */
  updateNode(id, updates) {
    try {
      const currentNodes = this.getNodes();
      const nodeIndex = currentNodes.findIndex(n => n.id === id);
      
      if (nodeIndex === -1) {
        return { success: false, error: `Node ${id} not found` };
      }

      const updatedNodes = currentNodes.map(node => {
        if (node.id === id) {
          return {
            ...node,
            ...updates,
            data: updates.data ? { ...node.data, ...updates.data } : node.data,
            position: updates.position ? { ...node.position, ...updates.position } : node.position
          };
        }
        return node;
      });

      this.setNodes(updatedNodes);
      this.saveToHistory(updatedNodes, this.getEdges());

      return { success: true, data: updatedNodes[nodeIndex] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a node (and connected edges)
   * @param {string} id - Node ID
   * @returns {Object} Result
   */
  deleteNode(id) {
    try {
      const currentNodes = this.getNodes();
      const currentEdges = this.getEdges();
      
      const nodeExists = currentNodes.some(n => n.id === id);
      if (!nodeExists) {
        return { success: false, error: `Node ${id} not found` };
      }

      const updatedNodes = currentNodes.filter(n => n.id !== id);
      const updatedEdges = currentEdges.filter(e => e.source !== id && e.target !== id);
      
      this.setNodes(updatedNodes);
      this.setEdges(updatedEdges);
      this.saveToHistory(updatedNodes, updatedEdges);

      return { success: true, data: { deletedNodeId: id, affectedEdges: currentEdges.length - updatedEdges.length } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== EDGE CRUD ====================

  /**
   * Create a new edge
   * @param {Object} options - Edge creation options
   * @param {string} options.id - Optional custom ID
   * @param {string} options.source - Source node ID
   * @param {string} options.target - Target node ID
   * @param {string} options.type - Edge type (child, peer, etc)
   * @param {string} options.label - Edge label
   * @param {Object} options.style - {width, dash, curved, color}
   * @returns {Object} Result with created edge
   */
  createEdge({ id, source, target, type = 'child', label = '', style = {} } = {}) {
    try {
      if (!source || !target) {
        return { success: false, error: 'Source and target are required' };
      }

      // Get fresh node state to ensure we have the latest nodes
      const nodes = this.getNodes();
      console.log('Available nodes for edge creation:', nodes.map(n => n.id));
      console.log('Looking for source:', source, 'target:', target);
      const sourceExists = nodes.some(n => n.id === source);
      const targetExists = nodes.some(n => n.id === target);

      if (!sourceExists) return { success: false, error: `Source node ${source} not found` };
      if (!targetExists) return { success: false, error: `Target node ${target} not found` };

      const edgeId = id || this._generateId();
      const newEdge = {
        id: edgeId,
        source,
        target,
        type,
        label,
        showLabel: false,
        style: {
          width: style.width || 2,
          dash: style.dash || [],
          curved: style.curved !== undefined ? style.curved : true,
          color: style.color
        }
      };

      const currentEdges = this.getEdges();
      const updatedEdges = [...currentEdges, newEdge];
      this.setEdges(updatedEdges);
      this.saveToHistory(this.getNodes(), updatedEdges);

      return { success: true, data: newEdge };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Read/Get edge(s)
   * @param {string} id - Optional edge ID. If omitted, returns all edges
   * @returns {Object} Result with edge(s)
   */
  readEdge(id) {
    try {
      const edges = this.getEdges();
      if (id) {
        const edge = edges.find(e => e.id === id);
        if (!edge) return { success: false, error: `Edge ${id} not found` };
        return { success: true, data: edge };
      }
      return { success: true, data: edges };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an edge
   * @param {string} id - Edge ID
   * @param {Object} updates - Properties to update
   * @returns {Object} Result with updated edge
   */
  updateEdge(id, updates) {
    try {
      const currentEdges = this.getEdges();
      const edgeIndex = currentEdges.findIndex(e => e.id === id);
      
      if (edgeIndex === -1) {
        return { success: false, error: `Edge ${id} not found` };
      }

      const updatedEdges = currentEdges.map(edge => {
        if (edge.id === id) {
          return {
            ...edge,
            ...updates,
            style: updates.style ? { ...edge.style, ...updates.style } : edge.style
          };
        }
        return edge;
      });

      this.setEdges(updatedEdges);
      this.saveToHistory(this.getNodes(), updatedEdges);

      return { success: true, data: updatedEdges[edgeIndex] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an edge
   * @param {string} id - Edge ID
   * @returns {Object} Result
   */
  deleteEdge(id) {
    try {
      const currentEdges = this.getEdges();
      const edgeExists = currentEdges.some(e => e.id === id);
      
      if (!edgeExists) {
        return { success: false, error: `Edge ${id} not found` };
      }

      const updatedEdges = currentEdges.filter(e => e.id !== id);
      this.setEdges(updatedEdges);
      this.saveToHistory(this.getNodes(), updatedEdges);

      return { success: true, data: { deletedEdgeId: id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Create multiple nodes at once
   * @param {Array} nodesArray - Array of node options
   * @returns {Object} Result with created nodes
   */
  createNodes(nodesArray) {
    try {
      const results = nodesArray.map(opts => this.createNode(opts));
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      // Deduplicate after batch creation
      const allCreated = successful.map(r => r.data);
      const updatedNodes = deduplicateNodes([...this.getNodes(), ...allCreated]);
      this.setNodes(updatedNodes);
      this.saveToHistory(updatedNodes, this.getEdges());
      return {
        success: failed.length === 0,
        data: {
          created: allCreated,
          failed: failed.map(r => r.error)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create multiple edges at once
   * @param {Array} edgesArray - Array of edge options
   * @returns {Object} Result with created edges
   */
  createEdges(edgesArray) {
    try {
      const results = edgesArray.map(opts => this.createEdge(opts));
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return {
        success: failed.length === 0,
        data: {
          created: successful.map(r => r.data),
          failed: failed.map(r => r.error)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear entire graph
   * @returns {Object} Result
   */
  clearGraph() {
    try {
      this.setNodes([]);
      this.setEdges([]);
      this.saveToHistory([], []);
      return { success: true, data: { message: 'Graph cleared' } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== QUERY OPERATIONS ====================

  /**
   * Find nodes by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Object} Result with matching nodes
   */
  findNodes(criteria) {
    try {
      let nodes = this.getNodes();

      if (criteria.type) {
        nodes = nodes.filter(n => n.type === criteria.type);
      }
      if (criteria.label) {
        nodes = nodes.filter(n => n.label && n.label.includes(criteria.label));
      }
      if (criteria.hasMemo !== undefined) {
        nodes = nodes.filter(n => criteria.hasMemo ? (n.data?.memo || '').length > 0 : !n.data?.memo);
      }
      if (criteria.hasLink !== undefined) {
        nodes = nodes.filter(n => criteria.hasLink ? (n.data?.link || '').length > 0 : !n.data?.link);
      }

      return { success: true, data: nodes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find edges by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Object} Result with matching edges
   */
  findEdges(criteria) {
    try {
      let edges = this.getEdges();

      if (criteria.type) {
        edges = edges.filter(e => e.type === criteria.type);
      }
      if (criteria.source) {
        edges = edges.filter(e => e.source === criteria.source);
      }
      if (criteria.target) {
        edges = edges.filter(e => e.target === criteria.target);
      }

      return { success: true, data: edges };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get graph statistics
   * @returns {Object} Result with statistics
   */
  getStats() {
    try {
      const nodes = this.getNodes();
      const edges = this.getEdges();

      return {
        success: true,
        data: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          nodeTypes: [...new Set(nodes.map(n => n.type))],
          edgeTypes: [...new Set(edges.map(e => e.type))],
          nodesWithMemo: nodes.filter(n => n.data?.memo).length,
          nodesWithLink: nodes.filter(n => n.data?.link).length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== HELPER METHODS ====================

  _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return uuidv4();
  }
}

// Export createNode as a standalone function for convenience
export function createNode(nodeData) {
  // Always assign a unique id if not provided
  const id = nodeData.id || uuidv4();
  return {
    ...nodeData,
    id,
  };
}

// Example usage for LLM:
/*
const crud = new GraphCRUD(getNodes, setNodes, getEdges, setEdges, saveToHistory);

// Create a node
crud.createNode({
  label: "My Node",
  position: { x: 200, y: 150 },
  data: { memo: "Important note" }
});

// Create an edge
crud.createEdge({
  source: "node1",
  target: "node2",
  type: "child"
});

// Update node
crud.updateNode("node1", {
  label: "Updated Label",
  data: { memo: "New memo" }
});

// Query
crud.findNodes({ type: "default", hasMemo: true });

// Get stats
crud.getStats();
*/