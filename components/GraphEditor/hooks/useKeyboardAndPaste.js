// ============================================
// 4. GraphEditor/useKeyboardAndPaste.js
// Keyboard navigation and paste handling
// ============================================
import { useEffect, useCallback } from 'react';
import eventBus from '../../NodeGraph/eventBus';
import { pasteFromClipboardUnified } from '../handlers/pasteHandler';

export function useKeyboardAndPaste(state, handlers, historyHook) {
  const {
    nodesRef, setNodes, edgesRef,
    selectedNodeIds, setSelectedNodeIds, setSelectedEdgeIds,
    pan, zoom
  } = state;
  
  const { saveToHistory } = historyHook;
  
  // Keyboard navigation and undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      
      // Undo (Ctrl/Cmd+Z)
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        eventBus.emit('undo');
        return;
      }

      // Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)
      if ((mod && (e.key === 'y' || e.key === 'Y')) || (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault();
        eventBus.emit('redo');
        return;
      }
      
      // Tab navigation for nodes
      if (e.key === 'Tab' && selectedNodeIds.length > 0) {
        e.preventDefault();
        const currentIndex = nodesRef.current.findIndex(n => n.id === selectedNodeIds[0]);
        const nextIndex = e.shiftKey 
          ? (currentIndex - 1 + nodesRef.current.length) % nodesRef.current.length
          : (currentIndex + 1) % nodesRef.current.length;
        
        if (nodesRef.current[nextIndex]) {
          setSelectedNodeIds([nodesRef.current[nextIndex].id]);
          setSelectedEdgeIds([]);
        }
      }
      
      // Arrow keys to move selected nodes (with Ctrl modifier)
      if (e.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const moveAmount = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -moveAmount : e.key === 'ArrowRight' ? moveAmount : 0;
        const dy = e.key === 'ArrowUp' ? -moveAmount : e.key === 'ArrowDown' ? moveAmount : 0;
        
        setNodes(prev => {
          const next = prev.map(node => {
            if (selectedNodeIds.includes(node.id)) {
              return {
                ...node,
                position: {
                  x: node.position.x + dx,
                  y: node.position.y + dy
                }
              };
            }
            return node;
          });
          nodesRef.current = next;
          return next;
        });
        
        saveToHistory(nodesRef.current, edgesRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, setSelectedNodeIds, setSelectedEdgeIds, setNodes, saveToHistory, nodesRef, edgesRef]);

  // Paste handler
  const handlePaste = useCallback(async (e) => {
    const activeElement = document.activeElement;
    const isTextInput = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable ||
      activeElement.getAttribute('contenteditable') === 'true'
    );
    
    if (isTextInput) return;

    try {
      // Read clipboard via navigator.clipboard for parity with toolbar paste
      const text = await navigator.clipboard.readText();
      
      if (!text?.trim()) return;

      // Try to parse as JSON
      try {
        JSON.parse(text);
        // Delegate to unified handler so behavior matches toolbar
        await pasteFromClipboardUnified({ handlers, state: { setNodes, nodesRef, edgesRef, pan, zoom }, historyHook, onShowMessage: state.setSnackbar ? (msg, sev='info') => state.setSnackbar({ open: true, message: msg, severity: sev, copyToClipboard: true }) : null });
       } catch (jsonError) {
        // Not JSON - create a resizable node from text
        const lines = text.trim().split('\n');
        const label = lines[0].substring(0, 50);
        const memo = text.trim();
        
        const width = Math.max(200, Math.min(600, label.length * 8 + 100));
        const height = Math.max(100, Math.min(400, lines.length * 20 + 50));
        
        const centerX = (window.innerWidth / 2 - pan.x) / zoom;
        const centerY = (window.innerHeight / 2 - pan.y) / zoom;
        
        const newNode = {
          id: `node_${Date.now()}`,
          label: label,
          type: 'default',
          position: { x: centerX, y: centerY },
          width: width,
          height: height,
          resizable: true,
          data: { memo: memo }
        };
        
        setNodes(prev => {
          const next = [...prev, newNode];
          nodesRef.current = next;
          return next;
        });
        
        saveToHistory(nodesRef.current, edgesRef.current);
        state.setSnackbar({ open: true, message: 'Created resizable node from pasted text', severity: 'success', copyToClipboard: true });
       }
    } catch (error) {
      console.error('Error handling paste:', error);
    }
  }, [nodesRef, setNodes, saveToHistory, state, pan, zoom, handlers, edgesRef, historyHook]);

  // Register paste handler
  useEffect(() => {
    const handlePasteEvent = (e) => {
      const activeElement = document.activeElement;
      const isTextInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      if (isTextInput) return;
      
      // Prevent default and invoke the unified clipboard reader (navigator.clipboard)
      e.preventDefault();
      handlePaste();
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [handlePaste]);
}
