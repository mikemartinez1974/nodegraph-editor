import React from 'react';

const HandleLayer = ({ handles, pan = { x: 0, y: 0 }, zoom = 1, onHandleEvent, onHandleDragStart, isDraggingHandle }) => {
    return (
        <div style={{ pointerEvents: 'none' }}>
            {handles.map(handle => {
                const scaledRadius = handle.radius * zoom;
                const left = handle.x * zoom + pan.x - scaledRadius;
                const top = handle.y * zoom + pan.y - scaledRadius;
                const isFullyExtended = handle.progress === 1;
                const pointerEvents = handle.pointerEvents || (isFullyExtended ? 'all' : 'none');
                return (
                    <div
                        key={handle.id}
                        style={{
                            position: 'absolute',
                            left,
                            top,
                            width: scaledRadius * 2,
                            height: scaledRadius * 2,
                            borderRadius: '50%',
                            background: handle.color || '#888',
                            opacity: handle.progress !== undefined ? handle.progress : 1,
                            pointerEvents,
                            transition: 'opacity 0.2s',
                            boxShadow: handle.isActive ? '0 0 8px #00f' : undefined,
                            cursor: isFullyExtended ? 'pointer' : 'default',
                            zIndex: 10
                        }}
                        onMouseEnter={() => {
                            if (isFullyExtended && !isDraggingHandle) onHandleEvent && onHandleEvent(handle);
                        }}
                        onMouseLeave={() => {
                            if (isFullyExtended && !isDraggingHandle) onHandleEvent && onHandleEvent(null);
                        }}
                        onMouseDown={e => {
                            if (isFullyExtended) {
                                if (onHandleDragStart) {
                                    onHandleDragStart(e, handle);
                                } else if (onHandleEvent) {
                                    onHandleEvent(handle, 'dragStart');
                                }
                            }
                        }}
                    />
                );
            })}
        </div>
    );
};

export default HandleLayer;