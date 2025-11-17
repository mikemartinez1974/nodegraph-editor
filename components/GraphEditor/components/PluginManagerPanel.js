"use client";

import React, { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import usePluginRegistry from '../hooks/usePluginRegistry';

export default function PluginManagerPanel({ open, onClose }) {
  const [manifestUrl, setManifestUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const { plugins, status, installFromUrl, togglePlugin, removePlugin, refresh } = usePluginRegistry();

  const handleInstall = async () => {
    if (!manifestUrl.trim()) return;
    setInstalling(true);
    const result = await installFromUrl(manifestUrl.trim());
    if (!result?.success) {
      console.error('[PluginManager] Failed to install plugin:', result?.error);
    } else {
      console.info('[PluginManager] Installed plugin:', result?.data?.id);
    }
    setInstalling(false);
    setManifestUrl('');
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, display: 'flex', flexDirection: 'column' } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="h2">
          Plugin Manager
        </Typography>
        <Box>
          <IconButton onClick={refresh} size="small" aria-label="Refresh plugins">
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={onClose} size="small" aria-label="Close plugin manager">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Install from URL
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            variant="outlined"
            size="small"
            fullWidth
            placeholder="https://example.com/plugin-manifest.json"
            value={manifestUrl}
            onChange={(e) => setManifestUrl(e.target.value)}
            disabled={installing || status.installing}
          />
          <Button
            variant="contained"
            onClick={handleInstall}
            disabled={!manifestUrl.trim() || installing || status.installing}
          >
            Install
          </Button>
        </Box>
        {(installing || status.installing) && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Installing plugin…
          </Typography>
        )}
        {status.error && (
          <Typography variant="caption" color="error" sx={{ mt: 1 }}>
            {status.error}
          </Typography>
        )}
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List dense disablePadding>
          {plugins.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No plugins installed yet.
            </Typography>
          )}
          {plugins.map((plugin) => (
            <React.Fragment key={plugin.id}>
              <ListItem>
                <ListItemText
                  primary={`${plugin.name || plugin.id} ${plugin.enabled ? '' : '(Disabled)'}`}
                  secondary={
                    <>
                      <Typography component="span" variant="caption">
                        {plugin.description || 'No description'} <br />
                        Version {plugin.version}
                      </Typography>
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={plugin.enabled !== false}
                    onChange={(e) => togglePlugin(plugin.id, e.target.checked)}
                    inputProps={{ 'aria-label': `Toggle plugin ${plugin.name || plugin.id}` }}
                  />
                  <IconButton
                    edge="end"
                    aria-label={`Remove plugin ${plugin.name || plugin.id}`}
                    onClick={() => removePlugin(plugin.id)}
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}
