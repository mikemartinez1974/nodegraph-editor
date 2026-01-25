import React, { useEffect, useState } from 'react';
import DefaultNode from '../GraphEditor/Nodes/DefaultNode';
import PluginNodeRenderer from '../GraphEditor/Nodes/PluginNodeRenderer';
import eventBus from './eventBus';

function deduplicateNodes(nodes) {
  const seen = new Set();
  return nodes.filter(node => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

const NodeLayer = ({ 
    containerRef,
    nodeRefs,
    nodes, 
    pan = { x: 0, y: 0 }, 
    zoom = 1, 
    selectedNodeId, 
    selectedNodeIds = [], 
    draggingNodeId, 
    onNodeEvent, 
    onNodeDoubleClick,
    onNodeContextMenu,
    onNodeDragStart, 
    onNodeMouseEnter, // Add this
    onNodeMouseLeave, // Add this
    onNodeHover,
    nodeTypes = { default: DefaultNode },
    resolveNodeComponent,
    suppressClickRef
}) => {
    // Deduplicate nodes before rendering
    const uniqueNodes = deduplicateNodes(nodes);
    
    // Runtime check for duplicate node ids
    const idSet = new Set();
    const duplicates = [];
    uniqueNodes.forEach(node => {
        if (idSet.has(node.id)) {
            duplicates.push(node.id);
        } else {
            idSet.add(node.id);
        }
    });
    if (duplicates.length > 0) {
        console.warn('Duplicate node ids detected in NodeLayer:', duplicates);
        console.log('Full nodes array with duplicates:', uniqueNodes);
    }

    // Force re-render on mount to ensure nodes appear
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const shouldSkipDrag = (target) => {
      if (!target || typeof target.closest !== 'function') return false;
      const markdownContent = target.closest('.markdown-content');
      if (!markdownContent) return false;
      if (markdownContent.dataset.allowTouchScroll === 'true') {
        const canScroll =
          markdownContent.scrollHeight > markdownContent.clientHeight + 2 ||
          markdownContent.scrollWidth > markdownContent.clientWidth + 2;
        if (canScroll) {
          return true;
        }
      }
      return false;
    };

    const visibleNodes = uniqueNodes.filter(node => node.visible !== false);
    return (
        <div ref={containerRef} style={{ pointerEvents: 'none', width: '100vw', height: '100vh', position: 'absolute', left: 0, top: 0, zIndex: 30 }}>
            {visibleNodes.map(node => {
                let NodeComponent = nodeTypes[node.type];
                let resolvedProps = null;
                if (!NodeComponent && typeof resolveNodeComponent === 'function') {
                  const resolved = resolveNodeComponent(node);
                  if (resolved) {
                    if (typeof resolved === 'function') {
                      NodeComponent = resolved;
                    } else if (resolved.component) {
                      NodeComponent = resolved.component;
                      resolvedProps = resolved.props || null;
                    }
                  }
                }
                if (!NodeComponent) {
                  if (typeof node?.type === 'string' && node.type.includes(':')) {
                    NodeComponent = PluginNodeRenderer;
                  } else {
                    NodeComponent = DefaultNode;
                  }
                }
                const isSelected = selectedNodeIds.includes(node.id);
                const isMultiSelect = selectedNodeIds.length > 1;

                return (
                    <div
                      key={node.id}
                      onMouseEnter={() => {
                        // console.log('NodeLayer: Mouse entered node', node.id);
                        if (onNodeHover) onNodeHover(node.id);
                        onNodeMouseEnter && onNodeMouseEnter(node.id); // Add this
                      }}
                      onMouseLeave={() => {
                        // console.log('NodeLayer: Mouse left node', node.id);
                        if (onNodeHover) onNodeHover(node.id);
                        onNodeMouseLeave && onNodeMouseLeave(node.id); // Add this
                      }}
                    >
                      <NodeComponent
                        node={node}
                        {...(resolvedProps || {})}
                        pan={pan}
                        zoom={zoom}
                        isSelected={isSelected}
                        selected={selectedNodeId === node.id}
                        isMultiSelect={isMultiSelect}
                        selectedCount={selectedNodeIds.length}
                        draggingHandle={draggingNodeId === node.id}
                        onMouseDown={e => {
                          if (e.button !== 0) return;
                          const target = e.target;
                          if (shouldSkipDrag(target)) return;
                          if (e.preventDefault) e.preventDefault();
                          if (e.stopPropagation) e.stopPropagation();
                          onNodeDragStart && onNodeDragStart(e.nativeEvent || e, node);
                        }}
                        onTouchStart={(e) => {
                          if (e.touches && e.touches.length > 1) return;
                          const target = e.target;
                          if (shouldSkipDrag(target)) return;
                          const native = e.nativeEvent || e;
                          if (native.preventDefault) native.preventDefault();
                          if (native.stopPropagation) native.stopPropagation();
                          if (native.stopImmediatePropagation) native.stopImmediatePropagation();
                          onNodeDragStart && onNodeDragStart(native, node);
                        }}
                        onClick={e => {
                            try {
                              const sel = window.getSelection && window.getSelection();
                              if (sel && sel.toString && sel.toString().length > 0) {
                                return;
                              }
                            } catch (err) {}
                            // Don't trigger click if we just finished dragging
                            if (suppressClickRef && suppressClickRef.current) {
                              return;
                            }
                            onNodeEvent && onNodeEvent(node.id, e);
                        }}
                        onDoubleClick={onNodeDoubleClick ? (e) => {
                            e.stopPropagation();
                            onNodeDoubleClick(node.id);
                        } : undefined}
                        onContextMenu={onNodeContextMenu ? (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onNodeContextMenu(node.id, e);
                        } : undefined}
                        onMouseEnter={() => {
                            const nodeId = node.id;
                            eventBus.emit('nodeHover', { id: nodeId });
                        }}
                        onMouseLeave={() => eventBus.emit('nodeUnhover', { id: node.id })}
                        nodeRefs={nodeRefs}
                        type={node?.type}
                      />
                    </div>
                 );
            })}
        </div>
    );
};

export default NodeLayer;
