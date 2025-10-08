// Enhanced history management with capping and batching
export class HistoryManager {
  constructor(maxEntries = 50, batchTimeoutMs = 300) {
    this.maxEntries = maxEntries;
    this.batchTimeoutMs = batchTimeoutMs;
    this.history = [];
    this.currentIndex = -1;
    this.batchTimeout = null;
    this.pendingBatch = null;
  }

  // Add a new entry to history with automatic batching
  addEntry(entry, options = {}) {
    const { 
      batch = true, 
      batchKey = 'default',
      force = false 
    } = options;

    if (batch && !force) {
      this.addToBatch(entry, batchKey);
      return;
    }

    this.commitEntry(entry);
  }

  // Add entry to pending batch
  addToBatch(entry, batchKey) {
    if (!this.pendingBatch || this.pendingBatch.batchKey !== batchKey) {
      // Commit previous batch if it exists
      if (this.pendingBatch) {
        this.commitBatch();
      }

      // Start new batch
      this.pendingBatch = {
        batchKey,
        entries: [entry],
        timestamp: Date.now()
      };
    } else {
      // Add to existing batch
      this.pendingBatch.entries.push(entry);
    }

    // Reset or set batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.commitBatch();
    }, this.batchTimeoutMs);
  }

  // Commit pending batch to history
  commitBatch() {
    if (!this.pendingBatch) return;

    const batchEntry = {
      type: 'batch',
      batchKey: this.pendingBatch.batchKey,
      entries: this.pendingBatch.entries,
      timestamp: this.pendingBatch.timestamp
    };

    this.commitEntry(batchEntry);
    this.pendingBatch = null;

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  // Force commit any pending batch
  flushBatch() {
    if (this.pendingBatch) {
      this.commitBatch();
    }
  }

  // Commit entry to history (internal)
  commitEntry(entry) {
    // Remove any history after current index (when undoing then making new changes)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new entry
    this.history.push({
      ...entry,
      id: this.generateId(),
      timestamp: entry.timestamp || Date.now()
    });

    // Cap history size
    if (this.history.length > this.maxEntries) {
      const removeCount = this.history.length - this.maxEntries;
      this.history.splice(0, removeCount);
      this.currentIndex = Math.max(-1, this.currentIndex - removeCount);
    }

    this.currentIndex = this.history.length - 1;
  }

  // Undo last action
  undo() {
    this.flushBatch(); // Commit any pending batch first

    if (!this.canUndo()) return null;

    const entry = this.history[this.currentIndex];
    this.currentIndex--;
    return entry;
  }

  // Redo next action
  redo() {
    this.flushBatch(); // Commit any pending batch first

    if (!this.canRedo()) return null;

    this.currentIndex++;
    const entry = this.history[this.currentIndex];
    return entry;
  }

  // Check if undo is possible
  canUndo() {
    return this.currentIndex >= 0;
  }

  // Check if redo is possible
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  // Get current history state
  getState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      historyLength: this.history.length,
      currentIndex: this.currentIndex,
      hasPendingBatch: !!this.pendingBatch
    };
  }

  // Clear all history
  clear() {
    this.flushBatch();
    this.history = [];
    this.currentIndex = -1;
  }

  // Generate unique ID for entries
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get history for debugging
  getHistory() {
    return {
      entries: [...this.history],
      currentIndex: this.currentIndex,
      pendingBatch: this.pendingBatch
    };
  }

  // Set history limits
  setLimits(maxEntries, batchTimeoutMs) {
    this.maxEntries = maxEntries;
    this.batchTimeoutMs = batchTimeoutMs;

    // Trim history if necessary
    if (this.history.length > this.maxEntries) {
      const removeCount = this.history.length - this.maxEntries;
      this.history.splice(0, removeCount);
      this.currentIndex = Math.max(-1, this.currentIndex - removeCount);
    }
  }
}

// Hook for using history manager in React components
export function useHistoryManager(maxEntries = 50, batchTimeoutMs = 300) {
  const managerRef = useRef();
  const [state, setState] = useState({
    canUndo: false,
    canRedo: false,
    historyLength: 0,
    currentIndex: -1,
    hasPendingBatch: false
  });

  if (!managerRef.current) {
    managerRef.current = new HistoryManager(maxEntries, batchTimeoutMs);
  }

  const updateState = useCallback(() => {
    setState(managerRef.current.getState());
  }, []);

  const addEntry = useCallback((entry, options) => {
    managerRef.current.addEntry(entry, options);
    updateState();
  }, [updateState]);

  const undo = useCallback(() => {
    const entry = managerRef.current.undo();
    updateState();
    return entry;
  }, [updateState]);

  const redo = useCallback(() => {
    const entry = managerRef.current.redo();
    updateState();
    return entry;
  }, [updateState]);

  const flushBatch = useCallback(() => {
    managerRef.current.flushBatch();
    updateState();
  }, [updateState]);

  const clear = useCallback(() => {
    managerRef.current.clear();
    updateState();
  }, [updateState]);

  // Update state when component mounts
  useEffect(() => {
    updateState();
  }, [updateState]);

  return {
    addEntry,
    undo,
    redo,
    flushBatch,
    clear,
    ...state,
    manager: managerRef.current
  };
}

// Common batch keys for different operation types
export const BATCH_KEYS = {
  NODE_DRAG: 'node_drag',
  NODE_RESIZE: 'node_resize', 
  BULK_DELETE: 'bulk_delete',
  BULK_EDIT: 'bulk_edit',
  EDGE_CREATE: 'edge_create',
  TEXT_EDIT: 'text_edit'
};