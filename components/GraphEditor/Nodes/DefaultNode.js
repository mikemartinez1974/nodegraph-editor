"use client";
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import NoteIcon from '@mui/icons-material/Note';
import LinkIcon from '@mui/icons-material/Link';

const DefaultNode = ({ node, pan = { x: 0, y: 0 }, zoom = 1, style = {}, isSelected, onMouseDown, onClick, children, draggingHandle }) => {
    const theme = useTheme();
    const width = (node?.width || 60) * zoom;
    const height = (node?.height || 60) * zoom;
    const left = (typeof node?.position?.x === 'number' ? node.position.x : 0) * zoom + pan.x - width / 2;
    const top = (typeof node?.position?.y === 'number' ? node.position.y : 0) * zoom + pan.y - height / 2;

    const lastMousePos = useRef(null);
    const nodeRef = useRef(null);

    const hasMemo = node?.data?.memo && node.data.memo.trim().length > 0;
    const hasLink = node?.data?.link && node.data.link.trim().length > 0;

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
        const nodeDiv = nodeRef.current;
        if (!nodeDiv) return;
        function handleWheel(e) {
            e.preventDefault();
        }
        nodeDiv.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            nodeDiv.removeEventListener('wheel', handleWheel, { passive: false });
        };
    }, []);

    const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
    const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;
    
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
                border: isSelected ? `2px solid ${theme.palette.secondary.main}` : `1px solid ${theme.palette.primary.main}`,
                background: isSelected ? selected_gradient : unselected_gradient,
                borderRadius: 8,
                boxShadow: isSelected ? `0 0 8px ${theme.palette.primary.main}` : '0 1px 4px #aaa',
                color: isSelected ? `${theme.textColors.dark}` : `${theme.textColors.light}`,
                zIndex: 100,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                ...style
            }}
            tabIndex={0}
            onMouseDown={e => {
                e.stopPropagation();
                if (onMouseDown) onMouseDown(e);
                eventBus.emit('nodeMouseDown', { id: node.id, event: e });
            }}
            onClick={e => {
                e.stopPropagation();
                if (typeof onClick === 'function') onClick(e);
                eventBus.emit('nodeClick', { id: node.id, event: e });
            }}
            onMouseEnter={e => {
                eventBus.emit('nodeMouseEnter', { id: node.id, event: e });
            }}
            onMouseLeave={e => {
                eventBus.emit('nodeMouseLeave', { id: node.id, event: e });
            }}>
            {/* Render node label if present */}
            {node?.label && (
                <div style={{ 
                    textAlign: 'center', 
                    fontWeight: 500, 
                    fontSize: Math.max(12, 14 * zoom), 
                    marginTop: 4,
                    padding: '0 4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%'
                }}>
                    {node.label}
                </div>
            )}
            {/* Data indicators */}
            {(hasMemo || hasLink) && (
                <div style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    display: 'flex',
                    gap: 4,
                    opacity: 0.9
                }}>
                    {hasMemo && (
                        <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                        }}>
                            <NoteIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                        </div>
                    )}
                    {hasLink && (
                        <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                        }}>
                            <LinkIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                        </div>
                    )}
                </div>
            )}
            {children}  
        </div>
    );
};

export default DefaultNode;