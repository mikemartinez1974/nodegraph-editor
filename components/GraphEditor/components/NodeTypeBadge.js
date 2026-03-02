"use client";

import React from "react";
import { alpha, useTheme } from "@mui/material/styles";
import * as Icons from "@mui/icons-material";
import { getNodeTypeMetadata } from "../nodeTypeRegistry";

const resolveIcon = (type) => {
  const meta = getNodeTypeMetadata(type);
  const iconName = meta?.icon;
  if (iconName && Icons[iconName]) return Icons[iconName];
  return Icons.Extension;
};

export default function NodeTypeBadge({ type }) {
  const theme = useTheme();
  const safeType = String(type || "node").trim() || "node";
  const Icon = resolveIcon(safeType);

  return (
    <div
      title={safeType}
      style={{
        position: "absolute",
        top: 6,
        left: 6,
        zIndex: 5,
        pointerEvents: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 999,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        background: alpha(theme.palette.background.paper, 0.75),
        color: theme.palette.text.secondary,
        fontSize: 10,
        lineHeight: 1.2,
        fontWeight: 700,
        letterSpacing: 0.2
      }}
    >
      <Icon sx={{ fontSize: 12 }} />
      <span>{safeType}</span>
    </div>
  );
}

