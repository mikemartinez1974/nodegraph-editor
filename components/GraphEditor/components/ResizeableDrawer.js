import React, { useState, useRef } from "react";
import { Drawer } from "@mui/material";

export default function ResizableDrawer({
  open,
  onClose,
  children,
  initialWidth = 800, // increased from 320
  minWidth = 200,
  maxWidth = 1200, // increased from 600
  PaperProps = {}, // <-- accept PaperProps
}) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const handleMouseDown = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!dragging.current) return;
    const delta = startX.current - e.clientX; // drag left/right
    let newWidth = startWidth.current + delta;
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    dragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      PaperProps={{
        ...PaperProps,
        sx: {
          ...PaperProps.sx,
          width,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        },
      }}
    >
      {/* Drag handle on the left edge */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 12, // visible grab area
          cursor: "ew-resize",
          backgroundColor: "rgba(0,0,0,0.2)",
          flexShrink: 0,
          zIndex: 1,
        }}
      />

      {/* Drawer content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
          boxSizing: "border-box",
          height: "100%", // ensure content fills vertical space
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </Drawer>
  );
}
