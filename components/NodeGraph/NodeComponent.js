"use client";
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from './eventBus';

const NodeComponent = ({ node, pan = { x: 0, y: 0 }, zoom = 1, style = {}, isSelected, onMouseDown, onClick, children, draggingHandle }) => {
    const theme = useTheme();
    const width = (node?.width || 60) * zoom;
    const height = (node?.height || 60) * zoom;
    const left = node?.position?.x * zoom + pan.x - width / 2;
    const top = node?.position?.y * zoom + pan.y - height / 2;

    const lastMousePos = useRef(null);
    const nodeRef = useRef(null);

    useEffect(() => {
        function handleMouseMove(e) {
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
        if (draggingHandle) {
            window.addEventListener('mousemove', handleMouseMove);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [draggingHandle]);

    useEffect(() => {
        if (draggingHandle === null && lastMousePos.current) {
            // Removed debug log
        }
    }, [draggingHandle]);

    useEffect(() => {
        const nodeDiv = nodeRef.current;
        if (!nodeDiv) return;
        function handleWheel(e) {
            // Prevent default only if needed (e.g., custom zoom/pan logic)
            e.preventDefault();
            // You can add your custom wheel logic here
        }
        nodeDiv.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            nodeDiv.removeEventListener('wheel', handleWheel, { passive: false });
        };
    }, []);

    return (
        <div
            ref={nodeRef}
            className="node-or-handle"
            style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                cursor: 'grab',
                border: isSelected ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
                background: isSelected ? theme.palette.action.selected : theme.palette.background.paper,
                borderRadius: 8,
                boxShadow: isSelected ? `0 0 8px ${theme.palette.primary.main}` : '0 1px 4px #aaa',
                color: theme.palette.text.primary,
                zIndex: 100,
                pointerEvents: 'auto',
                ...style
            }}
            tabIndex={0}
            onMouseDown={e => {
                if (onMouseDown) onMouseDown(e);
                eventBus.emit('nodeMouseDown', { id: node.id, event: e });
            }}
            onClick={e => {
                e.stopPropagation();
                if (typeof onClick === 'function') onClick(e);
                eventBus.emit('nodeClick', { id: node.id, event: e });
            }}
            onMouseEnter={e => {
                console.log('Node mouse enter:', node.id);
                eventBus.emit('nodeMouseEnter', { id: node.id, event: e });
            }}
            onMouseLeave={e => eventBus.emit('nodeMouseLeave', { id: node.id, event: e })}
        >
            {/* Render node label if present */}
            {node?.label && (
                <div style={{ textAlign: 'center', fontWeight: 500, fontSize: 14, marginTop: 8 }}>
                    {node.label}
                </div>
            )}
            {children}
        </div>
    );
};

export default NodeComponent;
