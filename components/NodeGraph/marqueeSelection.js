// Marquee selection functionality for multi-node selection
import { useRef, useState, useCallback, useEffect } from 'react';

export class MarqueeSelector {
  constructor() {
    this.isSelecting = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.selectionRect = null;
  }

  startSelection(point) {
    this.isSelecting = true;
    this.startPoint = { ...point };
    this.currentPoint = { ...point };
    this.updateSelectionRect();
  }

  updateSelection(point) {
    if (!this.isSelecting) return;
    
    this.currentPoint = { ...point };
    this.updateSelectionRect();
  }

  endSelection() {
    this.isSelecting = false;
    const rect = this.selectionRect;
    this.startPoint = null;
    this.currentPoint = null;
    this.selectionRect = null;
    return rect;
  }

  cancelSelection() {
    this.isSelecting = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.selectionRect = null;
  }

  updateSelectionRect() {
    if (!this.startPoint || !this.currentPoint) return;

    const x1 = Math.min(this.startPoint.x, this.currentPoint.x);
    const y1 = Math.min(this.startPoint.y, this.currentPoint.y);
    const x2 = Math.max(this.startPoint.x, this.currentPoint.x);
    const y2 = Math.max(this.startPoint.y, this.currentPoint.y);

    this.selectionRect = {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1
    };
  }

  getSelectionRect() {
    return this.selectionRect;
  }

  isPointInSelection(point) {
    if (!this.selectionRect) return false;

    return (
      point.x >= this.selectionRect.x &&
      point.x <= this.selectionRect.x + this.selectionRect.width &&
      point.y >= this.selectionRect.y &&
      point.y <= this.selectionRect.y + this.selectionRect.height
    );
  }

  isNodeInSelection(node) {
    if (!this.selectionRect) return false;

    // Check if node bounds intersect with selection rectangle
    const nodeRect = {
      x: node.position.x,
      y: node.position.y,
      width: node.width || 120,
      height: node.height || 60
    };

    return this.rectanglesIntersect(this.selectionRect, nodeRect);
  }

  rectanglesIntersect(rect1, rect2) {
    return !(
      rect1.x + rect1.width < rect2.x ||
      rect2.x + rect2.width < rect1.x ||
      rect1.y + rect1.height < rect2.y ||
      rect2.y + rect2.height < rect1.y
    );
  }

  getSelectedNodes(nodes) {
    if (!this.selectionRect) return [];
    
    return nodes.filter(node => this.isNodeInSelection(node));
  }
}

// React hook for marquee selection
export function useMarqueeSelection({ nodes, pan, zoom, setSelectedNodeIds, setSelectedEdgeIds, onNodeClick, containerRef }) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null);
  const marqueeStartRef = useRef(null);
  const marqueeEndRef = useRef(null);

  const startSelection = useCallback((e) => {
    if (!e.shiftKey) return false;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return false;

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    marqueeStartRef.current = { x: startX, y: startY };
    marqueeEndRef.current = { x: startX, y: startY };
    setIsSelecting(true);

    console.log('startSelection: Selection started at', { x: startX, y: startY }); // Debug log

    return true;
  }, [containerRef]);

  const updateSelection = useCallback((e) => {
    if (!isSelecting) return;

    console.log('updateSelection: Mouse moved, updating selection rectangle'); // Debug log

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
        console.log('updateSelection: Container rect not found'); // Debug log
        return;
    }

    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    marqueeEndRef.current = { x: endX, y: endY };

    const minX = Math.min(marqueeStartRef.current.x, endX);
    const minY = Math.min(marqueeStartRef.current.y, endY);
    const width = Math.abs(endX - marqueeStartRef.current.x);
    const height = Math.abs(endY - marqueeStartRef.current.y);

    setSelectionRect({ x: minX, y: minY, width, height });

    console.log('updateSelection: Updated selection rectangle to', { x: minX, y: minY, width, height }); // Debug log
  }, [isSelecting, containerRef]);

  const endSelection = useCallback((e) => {
    if (!isSelecting) return;

    console.log('endSelection: Ending selection process'); // Debug log

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
        console.log('endSelection: Container rect not found'); // Debug log
        return;
    }

    const bounds = {
      x: (Math.min(marqueeStartRef.current.x, marqueeEndRef.current.x) - pan.x) / zoom,
      y: (Math.min(marqueeStartRef.current.y, marqueeEndRef.current.y) - pan.y) / zoom,
      width: Math.abs(marqueeEndRef.current.x - marqueeStartRef.current.x) / zoom,
      height: Math.abs(marqueeEndRef.current.y - marqueeStartRef.current.y) / zoom
    };

    console.log('endSelection: Calculated bounds', bounds); // Debug log

    const selectedNodes = nodes.filter(node => {
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const nodeWidth = node.width || 120;
      const nodeHeight = node.height || 60;

      return !(
        nodeX + nodeWidth < bounds.x ||
        nodeX > bounds.x + bounds.width ||
        nodeY + nodeHeight < bounds.y ||
        nodeY > bounds.y + bounds.height
      );
    });

    if (selectedNodes.length > 0 && setSelectedNodeIds) {
      setSelectedNodeIds(selectedNodes.map(node => node.id));
      if (setSelectedEdgeIds) setSelectedEdgeIds([]);

      console.log('endSelection: Selected nodes:', selectedNodes.map(node => node.id)); // Debug log

      if (onNodeClick && selectedNodes.length === 1) {
        onNodeClick(selectedNodes[0].id, e);
      }
    } else {
      console.log('endSelection: No nodes selected'); // Debug log
    }

    setIsSelecting(false);
    marqueeStartRef.current = null;
    marqueeEndRef.current = null;
    setSelectionRect(null);

    console.log('endSelection: Selection process completed'); // Debug log
  }, [isSelecting, pan, nodes, zoom, setSelectedNodeIds, setSelectedEdgeIds, onNodeClick, containerRef]);

  return {
    isSelecting,
    selectionRect,
    startSelection,
    updateSelection,
    endSelection
  };
}

// Utility function to get point from mouse/touch event
function getEventPoint(event) {
  // Handle both mouse and touch events
  const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
  const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
  
  return { x: clientX, y: clientY };
}

// Component for rendering marquee selection rectangle
export function MarqueeOverlay({ selectionRect, theme, className = "" }) {
  if (!selectionRect) return null;

  const style = {
    position: "absolute",
    left: selectionRect.x,
    top: selectionRect.y,
    width: selectionRect.width,
    height: selectionRect.height,
    border: `2px dashed ${theme?.palette?.primary?.main || "#1976d2"}`,
    backgroundColor: `${theme?.palette?.primary?.main || "#1976d2"}20`,
    pointerEvents: "none",
    zIndex: 1000,
    boxSizing: "border-box",
  };

  return <div className={`marquee-selection ${className}`} style={style} />;
}

// Advanced selection utilities
export class SelectionManager {
  constructor() {
    this.selectedIds = new Set();
    this.lastSelectedId = null;
    this.selectionHistory = [];
  }

  // Set single selection
  selectSingle(id) {
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.lastSelectedId = id;
    this.addToHistory('single', [id]);
  }

  // Add to selection
  addToSelection(ids) {
    const newIds = Array.isArray(ids) ? ids : [ids];
    newIds.forEach(id => this.selectedIds.add(id));
    this.lastSelectedId = newIds[newIds.length - 1];
    this.addToHistory('add', newIds);
  }

  // Remove from selection
  removeFromSelection(ids) {
    const removeIds = Array.isArray(ids) ? ids : [ids];
    removeIds.forEach(id => this.selectedIds.delete(id));
    this.addToHistory('remove', removeIds);
  }

  // Toggle selection
  toggleSelection(ids) {
    const toggleIds = Array.isArray(ids) ? ids : [ids];
    const toAdd = [];
    const toRemove = [];

    toggleIds.forEach(id => {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
        toRemove.push(id);
      } else {
        this.selectedIds.add(id);
        toAdd.push(id);
      }
    });

    this.lastSelectedId = toAdd[toAdd.length - 1] || this.lastSelectedId;
    this.addToHistory('toggle', { added: toAdd, removed: toRemove });
  }

  // Select multiple (replace current selection)
  selectMultiple(ids) {
    this.selectedIds.clear();
    ids.forEach(id => this.selectedIds.add(id));
    this.lastSelectedId = ids[ids.length - 1];
    this.addToHistory('multiple', ids);
  }

  // Select all
  selectAll(allIds) {
    this.selectedIds.clear();
    allIds.forEach(id => this.selectedIds.add(id));
    this.lastSelectedId = allIds[allIds.length - 1];
    this.addToHistory('all', allIds);
  }

  // Clear selection
  clearSelection() {
    const wasSelected = Array.from(this.selectedIds);
    this.selectedIds.clear();
    this.lastSelectedId = null;
    this.addToHistory('clear', wasSelected);
  }

  // Get current selection
  getSelection() {
    return Array.from(this.selectedIds);
  }

  // Check if item is selected
  isSelected(id) {
    return this.selectedIds.has(id);
  }

  // Get selection count
  getSelectionCount() {
    return this.selectedIds.size;
  }

  // Add to history (for undo functionality)
  addToHistory(action, data) {
    this.selectionHistory.push({
      action,
      data,
      timestamp: Date.now(),
      previousSelection: Array.from(this.selectedIds)
    });

    // Keep history limited
    if (this.selectionHistory.length > 50) {
      this.selectionHistory.shift();
    }
  }

  // Get selection statistics
  getStats() {
    return {
      count: this.selectedIds.size,
      lastSelected: this.lastSelectedId,
      historyLength: this.selectionHistory.length
    };
  }
}

// Hook for selection manager
export function useSelectionManager() {
  const managerRef = useRef(new SelectionManager());
  const [, forceUpdate] = useState({});
  
  const update = useCallback(() => {
    forceUpdate({});
  }, []);

  const selectSingle = useCallback((id) => {
    managerRef.current.selectSingle(id);
    update();
  }, [update]);

  const addToSelection = useCallback((ids) => {
    managerRef.current.addToSelection(ids);
    update();
  }, [update]);

  const removeFromSelection = useCallback((ids) => {
    managerRef.current.removeFromSelection(ids);
    update();
  }, [update]);

  const toggleSelection = useCallback((ids) => {
    managerRef.current.toggleSelection(ids);
    update();
  }, [update]);

  const selectMultiple = useCallback((ids) => {
    managerRef.current.selectMultiple(ids);
    update();
  }, [update]);

  const selectAll = useCallback((allIds) => {
    managerRef.current.selectAll(allIds);
    update();
  }, [update]);

  const clearSelection = useCallback(() => {
    managerRef.current.clearSelection();
    update();
  }, [update]);

  return {
    selectedIds: managerRef.current.getSelection(),
    selectionCount: managerRef.current.getSelectionCount(),
    lastSelectedId: managerRef.current.lastSelectedId,
    isSelected: managerRef.current.isSelected.bind(managerRef.current),
    selectSingle,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    selectMultiple,
    selectAll,
    clearSelection,
    manager: managerRef.current
  };
}

// Helper function to handle marquee start
export function handleMarqueeStart({ e, startSelection }) {
  if (!e.shiftKey) return false;

  console.log('handleMarqueeStart: Shift key detected, attempting to start marquee selection'); // Debug log
  const started = startSelection(e);
  console.log('handleMarqueeStart: Marquee selection started:', started); // Debug log

  return started; // Ensure it returns true when marquee selection starts
}