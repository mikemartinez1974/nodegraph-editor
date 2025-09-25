import React, { useEffect, useRef, useState } from 'react';
import Paper from '@mui/material/Paper';

const Toolbar = ({ theme }) => {
  const palette = theme?.palette || {};
  const primary = palette.primary || {};
  const [pos, setPos] = useState({ x: 0, y: 88 }); // initial position
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPos({ x: window.innerWidth - 272, y: 88 });
    }
  }, []);

  const onMouseDown = e => {
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = e => {
    if (!dragging.current) return;
    setPos({
      x: Math.max(0, Math.min(e.clientX - offset.current.x, window.innerWidth - 240)),
      y: Math.max(0, Math.min(e.clientY - offset.current.y, window.innerHeight - 56)),
    });
  };

  const onMouseUp = () => {
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        minWidth: 240,
        height: 56,
        backgroundColor: primary.main,
        color: primary.contrastText,
        display: 'flex',
        alignItems: 'center',
        px: 3,
        borderRadius: 2,
        zIndex: 1200,
        fontWeight: 600,
        fontSize: 18,
        pointerEvents: 'auto',
        userSelect: 'none',
        cursor: 'move',
        transition: 'background-color 0.2s, color 0.2s',
      }}
      tabIndex={0}
      onMouseDown={onMouseDown}
    >
      Floating Toolbar
      {/* Add MUI buttons/controls here */}
    </Paper>
  );
};

export default Toolbar;