"use client";

import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import usePluginRegistry from '../hooks/usePluginRegistry';
import { pluginGallery } from '../data/pluginGallery';
import { fetchManifest } from '../plugins/pluginRegistry';
import validatePluginManifest from '../plugins/manifestSchema';

export default function PluginManagerPanel({ open, onClose }) {
  const [manifestUrl, setManifestUrl] = useState('');
  const [activeTab, setActiveTab] = useState('installed');
  const [gallerySearch, setGallerySearch] = useState('');
  const [previewState, setPreviewState] = useState({ open: false, manifest: null, manifestUrl: '', existing: null });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [confirmingInstall, setConfirmingInstall] = useState(false);
  const [updates, setUpdates] = useState({});
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const { plugins, installManifest, togglePlugin, removePlugin, pinPlugin, refresh } = usePluginRegistry();

const filteredGallery = useMemo(() => {
    const query = gallerySearch.trim().toLowerCase();
    if (!query) return pluginGallery;
    return pluginGallery.filter((entry) => {
      const haystack = [
        entry.name,
        entry.description,
        entry.tags?.join(' '),
        entry.permissions?.join(' '),
        entry.maintainer
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
}, [gallerySearch]);

const compareVersions = (a = '', b = '') => {
  const parse = (value) => value.split('.').map((part) => Number(part) || 0);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  if (a3 !== b3) return a3 - b3;
  return 0;
};

  const resetPreview = () => {
    setPreviewState({ open: false, manifest: null, manifestUrl: '', existing: null });
    setPreviewError(null);
  };

  const fetchManifestPreview = async (url) => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { data, manifestUrl: resolvedUrl } = await fetchManifest(url);
      const validation = validatePluginManifest(data);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }
      const normalized = validation.manifest;
      const existing = plugins.find((plugin) => plugin.id === normalized.id) || null;
      setPreviewState({ open: true, manifest: normalized, manifestUrl: resolvedUrl, existing });
    } catch (err) {
      setPreviewError(err?.message || 'Failed to load manifest');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleInstallFromUrlClick = async () => {
    if (!manifestUrl.trim()) return;
    await fetchManifestPreview(manifestUrl.trim());
  };

  const handleGalleryInstallClick = async (entry) => {
    if (!entry?.manifestUrl) return;
    await fetchManifestPreview(entry.manifestUrl);
  };

  const handleConfirmInstall = async () => {
    if (!previewState.manifest) return;
    setConfirmingInstall(true);
    const result = await installManifest(previewState.manifest, previewState.manifestUrl);
    if (!result?.success) {
      setPreviewError(result?.error || 'Failed to install plugin');
    } else {
      setUpdates((prev) => {
        const next = { ...prev };
        if (previewState.manifest?.id) {
          delete next[previewState.manifest.id];
        }
        return next;
      });
      resetPreview();
      setManifestUrl('');
    }
    setConfirmingInstall(false);
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateError(null);
    const nextUpdates = {};
    try {
      for (const plugin of plugins) {
        if (!plugin.manifestUrl) continue;
        try {
          const { data, manifestUrl: resolvedUrl } = await fetchManifest(plugin.manifestUrl);
          const validation = validatePluginManifest(data);
          if (!validation.valid) continue;
          if (plugin.pinnedVersion) {
            continue;
          }
          const manifest = validation.manifest;
          if (compareVersions(manifest.version, plugin.version) > 0) {
            nextUpdates[plugin.id] = { manifest, manifestUrl: resolvedUrl };
          }
        } catch (err) {
          console.warn('[PluginManager] Failed to check update for', plugin.id, err);
        }
      }
      setUpdates(nextUpdates);
    } catch (err) {
      setUpdateError(err?.message || 'Failed to check for updates');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const previewManifestData = previewState.manifest;
  const existingPermissionsSet = useMemo(() => new Set(previewState.existing?.permissions || []), [previewState.existing]);
  const permissionEntries = (previewManifestData?.permissions || []).map((perm) => ({
    perm,
    isNew: !existingPermissionsSet.has(perm)
  }));
  const versionLabel = previewManifestData
    ? previewState.existing?.version
      ? previewState.existing.version === previewManifestData.version
        ? `Reinstall version ${previewManifestData.version}`
        : `Update ${previewState.existing.version} → ${previewManifestData.version}`
      : `Install version ${previewManifestData.version}`
    : '';

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
          <Button size="small" onClick={handleCheckUpdates} disabled={checkingUpdates} sx={{ mr: 1 }}>
            {checkingUpdates ? 'Checking…' : 'Check updates'}
          </Button>
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
            disabled={previewLoading || confirmingInstall}
          />
          <Button
            variant="contained"
            onClick={handleInstallFromUrlClick}
            disabled={!manifestUrl.trim() || previewLoading || confirmingInstall}
          >
            Install
          </Button>
        </Box>
        {(previewLoading || checkingUpdates) && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            {previewLoading ? 'Resolving manifest…' : 'Checking for updates…'}
          </Typography>
        )}
        {(previewError && !previewState.open) || updateError ? (
          <Alert
            severity="error"
            sx={{ mt: 1 }}
            onClose={() => {
              setPreviewError(null);
              setUpdateError(null);
            }}
          >
            {previewError || updateError}
          </Alert>
        ) : null}
      </Box>
      <Divider />
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        variant="fullWidth"
        sx={{ borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
      >
        <Tab value="installed" label={`Installed (${plugins.length})`} />
        <Tab value="gallery" label="Browse Gallery" />
      </Tabs>
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'installed' ? (
          <List dense disablePadding>
            {plugins.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No plugins installed yet.
              </Typography>
            )}
            {plugins.map((plugin) => (
              <React.Fragment key={plugin.id}>
                <ListItem alignItems="flex-start">
                  <ListItemText
                    disableTypography
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600} component="span">
                          {plugin.name || plugin.id}
                        </Typography>
                        {plugin.enabled === false && (
                          <Chip label="Disabled" size="small" color="default" />
                        )}
                        {plugin.pinnedVersion && (
                          <Chip label={`Pinned ${plugin.pinnedVersion}`} size="small" color="primary" variant="outlined" />
                        )}
                        {updates[plugin.id] && (
                          <Chip label={`Update ${updates[plugin.id].manifest.version}`} size="small" color="warning" />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Box component="div" sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                          {plugin.description || 'No description'}
                        </Typography>
                        <Typography variant="caption" component="div">
                          Version {plugin.version}
                          {plugin.manifestUrl ? ` · ${plugin.manifestUrl}` : ''}
                        </Typography>
                        {plugin.permissions?.length > 0 && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                            {plugin.permissions.map((perm) => (
                              <Chip key={`${plugin.id}-${perm}`} label={perm} size="small" color="info" variant="outlined" />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => pinPlugin(plugin.id, plugin.pinnedVersion ? null : plugin.version)}
                      >
                        {plugin.pinnedVersion ? 'Unpin' : 'Pin version'}
                      </Button>
                      {updates[plugin.id] && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() =>
                            setPreviewState({
                              open: true,
                              manifest: updates[plugin.id].manifest,
                              manifestUrl: updates[plugin.id].manifestUrl,
                              existing: plugin
                            })
                          }
                        >
                          Review update
                        </Button>
                      )}
                    </Stack>
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
        ) : (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              placeholder="Search gallery"
              value={gallerySearch}
              onChange={(e) => setGallerySearch(e.target.value)}
              size="small"
            />
            {filteredGallery.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No plugins match your search.
              </Typography>
            )}
            {filteredGallery.map((entry) => {
              const isInstalled = plugins.some((plugin) => plugin.id === entry.id);
              return (
                <Card key={entry.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6" component="div" sx={{ fontSize: 16 }}>
                        {entry.name}
                      </Typography>
                      {entry.status && <Chip label={entry.status} size="small" color="success" variant="outlined" />}
                    </Stack>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {entry.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Version {entry.version}
                      {entry.maintainer ? ` · ${entry.maintainer}` : ''}
                    </Typography>
                    {entry.tags?.length > 0 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                        {entry.tags.map((tag) => (
                          <Chip key={`${entry.id}-${tag}`} label={tag} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    )}
                    {entry.permissions?.length > 0 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                        {entry.permissions.map((perm) => (
                          <Chip key={`${entry.id}-perm-${perm}`} label={perm} size="small" color="info" />
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between' }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleGalleryInstallClick(entry)}
                      disabled={isInstalled || previewLoading || confirmingInstall}
                    >
                      {isInstalled ? 'Installed' : 'Install'}
                    </Button>
                    {entry.homepage && (
                      <Button
                        size="small"
                        component="a"
                        href={entry.homepage}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Learn more
                      </Button>
                    )}
                  </CardActions>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>
      {previewState.open && previewManifestData && (
        <Dialog open={previewState.open} onClose={confirmingInstall ? undefined : resetPreview} fullWidth maxWidth="sm">
          <DialogTitle>Review plugin install</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" component="div">
                  {previewManifestData.name || previewManifestData.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {previewManifestData.description || 'No description provided.'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">Details</Typography>
                <Typography variant="body2">{versionLabel}</Typography>
                {previewState.manifestUrl && (
                  <Typography variant="caption" color="text.secondary">
                    {previewState.manifestUrl}
                  </Typography>
                )}
                {previewManifestData.metadata?.homepage && (
                  <Typography variant="caption" color="text.secondary">
                    Homepage: {previewManifestData.metadata.homepage}
                  </Typography>
                )}
              </Box>
              <Box>
                <Typography variant="subtitle2">Requested permissions</Typography>
                {permissionEntries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    This plugin does not request any permissions.
                  </Typography>
                ) : (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {permissionEntries.map(({ perm, isNew }) => (
                      <Chip
                        key={`perm-${perm}`}
                        label={perm}
                        size="small"
                        color={isNew ? 'warning' : 'default'}
                        variant={isNew ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Stack>
                )}
                {previewState.existing && permissionEntries.some((entry) => entry.isNew) && (
                  <Typography variant="caption" color="warning.main">
                    New permissions highlighted in yellow.
                  </Typography>
                )}
              </Box>
              {previewManifestData.metadata?.changelog && (
                <Box>
                  <Typography variant="subtitle2">Changelog</Typography>
                  <Typography
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: 'action.hover'
                    }}
                  >
                    {previewManifestData.metadata.changelog}
                  </Typography>
                </Box>
              )}
            </Stack>
            {previewError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {previewError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={resetPreview} disabled={confirmingInstall}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmInstall}
              disabled={confirmingInstall}
            >
              {previewState.existing ? 'Update plugin' : 'Install plugin'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Drawer>
  );
}
