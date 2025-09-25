import React, { useState, useRef, useEffect } from 'react';

const [pos, setPos] = useState({ x: 0, y: 88 }); // initial position
const dragging = useRef(false);
const offset = useRef({ x: 0, y: 0 });

useEffect(() => {
  setPos({ x: window.innerWidth - 272, y: 88 });
}, []);