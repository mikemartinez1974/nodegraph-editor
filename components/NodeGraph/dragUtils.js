// Handle drag cancellation utilities
export function useCancelableDrag(onCancel) {
  const isDraggingRef = useRef(false);
  
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);
  
  return {
    setDragging: (dragging) => {
      isDraggingRef.current = dragging;
    },
    isDragging: () => isDraggingRef.current
  };
}

// Enhanced drag state management
export class DragStateManager {
  constructor() {
    this.state = {
      isDragging: false,
      dragType: null, // 'node', 'handle', 'edge', etc.
      startPosition: null,
      currentPosition: null,
      dragData: null
    };
    
    this.cancelCallbacks = [];
    this.setupKeyboardListeners();
  }
  
  setupKeyboardListeners() {
    this.handleKeyDown = (e) => {
      if (e.key === 'Escape' && this.state.isDragging) {
        e.preventDefault();
        e.stopPropagation();
        this.cancel();
      }
    };
    
    document.addEventListener('keydown', this.handleKeyDown);
  }
  
  startDrag(type, position, data = null) {
    this.state = {
      isDragging: true,
      dragType: type,
      startPosition: { ...position },
      currentPosition: { ...position },
      dragData: data
    };
  }
  
  updateDrag(position) {
    if (!this.state.isDragging) return;
    
    this.state.currentPosition = { ...position };
  }
  
  endDrag() {
    this.state = {
      isDragging: false,
      dragType: null,
      startPosition: null,
      currentPosition: null,
      dragData: null
    };
  }
  
  cancel() {
    if (!this.state.isDragging) return;
    
    // Call all registered cancel callbacks
    this.cancelCallbacks.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in drag cancel callback:', error);
      }
    });
    
    this.endDrag();
  }
  
  onCancel(callback) {
    this.cancelCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.cancelCallbacks.indexOf(callback);
      if (index > -1) {
        this.cancelCallbacks.splice(index, 1);
      }
    };
  }
  
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.cancelCallbacks = [];
  }
  
  getState() {
    return { ...this.state };
  }
}

// Hook for using drag state manager
export function useDragStateManager() {
  const managerRef = useRef();
  
  if (!managerRef.current) {
    managerRef.current = new DragStateManager();
  }
  
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, []);
  
  return managerRef.current;
}