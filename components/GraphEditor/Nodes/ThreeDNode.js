// filepath: c:\Users\Michael\Desktop\My App\nodegraph-editor\components\GraphEditor\Nodes\ThreeDNode.js
"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import eventBus from '../../NodeGraph/eventBus';
import FixedNode from './FixedNode';

// Unified handle schema for display nodes
const DEFAULT_INPUTS = [
  { key: 'set', label: 'Set', type: 'value' }
];
const DEFAULT_OUTPUTS = [
  { key: 'value', label: 'Value', type: 'value' }
];

const ThreeDNode = React.memo((props) => {
  // Ensure node has inputs/outputs for handle system
  const node = {
    ...props.node,
    inputs: Array.isArray(props.node?.inputs) && props.node.inputs.length > 0 ? props.node.inputs : DEFAULT_INPUTS,
    outputs: Array.isArray(props.node?.outputs) && props.node.outputs.length > 0 ? props.node.outputs : DEFAULT_OUTPUTS,
  };
  const { zoom = 1, isSelected } = props;
  const theme = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const cubeRef = useRef(null);
  const animationIdRef = useRef(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear any existing canvas first
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    const width = Math.max(100, (node.width || 300) - 16);
    const height = Math.max(100, (node.height || 300) - 40);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.palette.mode === 'dark' ? 0x1a1a1a : 0xf5f5f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Critical: ensure canvas is visible and fills container
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Force initial render
    renderer.render(scene, camera);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhongMaterial({
      color: theme.palette.primary.main,
      shininess: 100
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    cubeRef.current = cube;

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ 
        color: theme.palette.mode === 'dark' ? 0xffffff : 0x000000 
      })
    );
    cube.add(line);

    function animate() {
      animationIdRef.current = requestAnimationFrame(animate);
      
      if (cubeRef.current) {
        cubeRef.current.rotation.x += 0.01;
        cubeRef.current.rotation.y += 0.01;
      }
      
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current) rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    
    animate();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      if (rendererRef.current) {
        const canvas = rendererRef.current.domElement;
        rendererRef.current.dispose();
        rendererRef.current = null;
        if (containerRef.current && canvas && containerRef.current.contains(canvas)) {
          containerRef.current.removeChild(canvas);
        }
      }
      sceneRef.current = null;
      cameraRef.current = null;
      cubeRef.current = null;
    };
  }, [theme.palette.mode, theme.palette.primary.main]);

  // RESIZE ONLY
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;
    const width = Math.max(100, (node.width || 300) - 16);
    const height = Math.max(100, (node.height || 300) - 40);
    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }, [node.width, node.height]);

  // Resize handlers
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: node.width || 200, height: node.height || 200 };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e) => {
      const dx = (e.clientX - resizeStartPos.current.x) / zoom;
      const dy = (e.clientY - resizeStartPos.current.y) / zoom;
      const newWidth = Math.max(150, resizeStartSize.current.width + dx);
      const newHeight = Math.max(150, resizeStartSize.current.height + dy);
      
      eventBus.emit('nodeResize', { id: node.id, width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      eventBus.emit('nodeResizeEnd', { id: node.id });
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, node.id, zoom]);

  return (
    <FixedNode {...props} node={node} hideDefaultContent={true}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          bottom: '24px',
          overflow: 'hidden',
          borderRadius: '4px',
          pointerEvents: 'auto'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          opacity: isSelected ? 0.7 : 0.3,
          transition: 'opacity 0.2s ease',
          zIndex: 2
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = isSelected ? '0.7' : '0.3'; }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M 16,0 L 16,16 L 0,16"
            fill="none"
            stroke={theme.palette.text.secondary}
            strokeWidth="2"
          />
        </svg>
      </div>
    </FixedNode>
  );
});

export default ThreeDNode;
