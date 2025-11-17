"use client";

import React from 'react';
import { Box, Typography } from '@mui/material';

export default function PluginNodePlaceholder({ data, label }) {
  const greeting =
    data?.greeting ||
    data?.message ||
    'Plugin node placeholder — runtime loader not yet connected.';

  return (
    <Box
      sx={{
        p: 1.5,
        fontSize: 12,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'text.secondary'
      }}
    >
      <Typography variant="body2" fontWeight={600} gutterBottom>
        {label || 'Plugin Node'}
      </Typography>
      <Typography variant="caption">{greeting}</Typography>
    </Box>
  );
}
