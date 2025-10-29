import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import eventBus from '../../NodeGraph/eventBus';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import TimerIcon from '@mui/icons-material/Timer';

export default function TimerNode({ 
  node, 
  pan = { x: 0, y: 0 }, 
  zoom = 1, 
  style = {}, 
  isSelected, 
  onMouseDown, 
  onClick, 
  onDoubleClick,
  nodeRefs 
}) {
  const theme = useTheme();
  const nodeRef = useRef(null);
  const intervalRef = useRef(null);
  
  const width = (node?.width || 200) * zoom;
  const height = (node?.height || 140) * zoom;
  
  // Timer state
  const [elapsed, setElapsed] = useState(0);
  const isRunning = node?.data?.isRunning || false;
  const isPaused = node?.data?.isPaused || false;
  const startTime = node?.data?.startTime || null;
  const pausedElapsed = node?.data?.pausedElapsed || 0;

  // Register node ref
  useEffect(() => {
    if (nodeRef.current && nodeRefs) {
      nodeRefs.current.set(node.id, nodeRef.current);
      return () => nodeRefs.current.delete(node.id);
    }
  }, [node.id, nodeRefs]);

  // Update elapsed time
  useEffect(() => {
    if (isRunning && !isPaused && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime + pausedElapsed);
      }, 50);
    } else if (isPaused) {
      setElapsed(pausedElapsed);
    } else {
      setElapsed(0);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isPaused, startTime, pausedElapsed]);

  // Format time as MM:SS.d
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const deciseconds = Math.floor((ms % 1000) / 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${deciseconds}`;
  };

  const handleStart = (e) => {
    e.stopPropagation();
    if (!isRunning) {
      eventBus.emit('nodeUpdate', { 
        id: node.id, 
        updates: { 
          data: { 
            ...node.data, 
            isRunning: true, 
            isPaused: false,
            startTime: Date.now(),
            pausedElapsed: 0
          } 
        } 
      });
    } else if (isPaused) {
      eventBus.emit('nodeUpdate', { 
        id: node.id, 
        updates: { 
          data: { 
            ...node.data, 
            isPaused: false,
            startTime: Date.now()
          } 
        } 
      });
    }
  };

  const handlePause = (e) => {
    e.stopPropagation();
    if (isRunning && !isPaused) {
      eventBus.emit('nodeUpdate', { 
        id: node.id, 
        updates: { 
          data: { 
            ...node.data, 
            isPaused: true,
            pausedElapsed: elapsed
          } 
        } 
      });
    }
  };

  const handleStop = (e) => {
    e.stopPropagation();
    eventBus.emit('nodeUpdate', { 
      id: node.id, 
      updates: { 
        data: { 
          ...node.data, 
          isRunning: false,
          isPaused: false,
          startTime: null,
          pausedElapsed: 0
        } 
      } 
    });
  };

  const nodeColor = node?.color || theme.palette.primary.main;
  const selected_gradient = `linear-gradient(135deg, ${theme.palette.secondary.light}, ${theme.palette.secondary.dark})`;
  const unselected_gradient = `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`;

  const baseLeft = (node?.position?.x || 0) * zoom + pan.x - width / 2;
  const baseTop = (node?.position?.y || 0) * zoom + pan.y - height / 2;

  return (
    <div
      ref={nodeRef}
      className="node-or-handle"
      style={{
        position: 'absolute',
        left: baseLeft,
        top: baseTop,
        width,
        height,
        cursor: 'grab',
        border: isSelected 
          ? `2px solid ${theme.palette.secondary.main}` 
          : `1px solid ${theme.palette.primary.main}`,
        background: isSelected ? selected_gradient : unselected_gradient,
        borderRadius: 8,
        boxSizing: 'border-box',
        padding: 16,
        color: theme.palette.primary.contrastText,
        transition: 'border 0.2s ease',
        zIndex: 100,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        if (onClick) onClick(e);
        eventBus.emit('nodeClick', { id: node.id, event: e });
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick(e);
      }}
      onMouseEnter={e => eventBus.emit('nodeMouseEnter', { id: node.id, event: e })}
      onMouseLeave={e => eventBus.emit('nodeMouseLeave', { id: node.id, event: e })}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        marginBottom: 12
      }}>
        <TimerIcon sx={{ fontSize: 20 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {node?.label || 'Timer'}
        </span>
      </div>

      {/* Time Display */}
      <div style={{
        fontSize: 32,
        fontWeight: 700,
        fontFamily: 'monospace',
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 16,
        textShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        {formatTime(elapsed)}
      </div>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        gap: 8,
        justifyContent: 'center'
      }}>
        <button
          onClick={handleStart}
          disabled={isRunning && !isPaused}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: (isRunning && !isPaused) 
              ? 'rgba(255,255,255,0.2)' 
              : theme.palette.success.main,
            color: 'white',
            cursor: (isRunning && !isPaused) ? 'not-allowed' : 'pointer',
            opacity: (isRunning && !isPaused) ? 0.5 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title={isRunning && isPaused ? "Resume" : "Start"}
        >
          <PlayArrowIcon sx={{ fontSize: 20 }} />
        </button>

        <button
          onClick={handlePause}
          disabled={!isRunning || isPaused}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: (!isRunning || isPaused)
              ? 'rgba(255,255,255,0.2)'
              : theme.palette.warning.main,
            color: 'white',
            cursor: (!isRunning || isPaused) ? 'not-allowed' : 'pointer',
            opacity: (!isRunning || isPaused) ? 0.5 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title="Pause"
        >
          <PauseIcon sx={{ fontSize: 20 }} />
        </button>

        <button
          onClick={handleStop}
          disabled={!isRunning && !isPaused}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: (!isRunning && !isPaused)
              ? 'rgba(255,255,255,0.2)'
              : theme.palette.error.main,
            color: 'white',
            cursor: (!isRunning && !isPaused) ? 'not-allowed' : 'pointer',
            opacity: (!isRunning && !isPaused) ? 0.5 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title="Stop"
        >
          <StopIcon sx={{ fontSize: 20 }} />
        </button>
      </div>

      {/* Status indicator */}
      <div style={{
        marginTop: 12,
        fontSize: 11,
        fontWeight: 500,
        opacity: 0.8,
        textTransform: 'uppercase',
        letterSpacing: 1
      }}>
        {isRunning && !isPaused ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
      </div>
    </div>
  );
}