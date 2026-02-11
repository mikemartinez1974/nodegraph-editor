import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Select,
  MenuItem,
  Slider,
  Typography,
  Box,
  Tabs,
  Tab,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Avatar,
  InputAdornment
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { loadSettings, saveSettings, resetSettings } from '../settingsManager';
import eventBus from '../../NodeGraph/eventBus';
import BackgroundControls from './BackgroundControls';
import ThemeBuilder from './ThemeBuilder';
import ThemeButtonGroup from '../../Browser/ThemeButtonGroup';
import themeMap from '../../Browser/themes';
import { themeConfigFromMuiTheme } from '../utils/themeUtils';
import {
  DEFAULT_LAYOUT_SETTINGS,
  DEFAULT_ELK_ROUTING_SETTINGS
} from '../layoutSettings';
import useIntentEmitter from '../hooks/useIntentEmitter';
import { useGraphEditorStateContext } from '../providers/GraphEditorContext';
import { summarizeContracts } from '../contracts/contractManager';
import {
  createDefaultManifestNode,
  createDefaultLegendNode,
  createDefaultDictionaryNode,
  findSystemNode
} from '../utils/systemNodeDefaults';

const formatTimestamp = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const mapProjectMeta = (meta = {}, fallbackLink = '') => {
  const collaborators = Array.isArray(meta?.collaborators)
    ? meta.collaborators.map((collab) => ({ ...collab }))
    : [];

  if (!collaborators.length) {
    collaborators.push({ id: 'owner', name: 'You', email: 'you@example.com', role: 'Owner' });
  }

  return {
    title: meta?.title || 'Untitled Project',
    description: meta?.description || '',
    tags: Array.isArray(meta?.tags) ? [...meta.tags] : [],
    shareLink: meta?.shareLink || fallbackLink,
    allowComments: typeof meta?.allowComments === 'boolean' ? meta.allowComments : true,
    allowEdits: typeof meta?.allowEdits === 'boolean' ? meta.allowEdits : true,
    collaborators,
    createdAt: meta?.createdAt || null,
    lastModified: meta?.lastModified || null
  };
};

const uniqueCollaboratorId = () => `collab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function StringListEditor({ label, items = [], onChange, helperText }) {
  const [input, setInput] = useState('');
  const handleAdd = () => {
    const value = input.trim();
    if (!value) return;
    if (items.includes(value)) return;
    onChange([...items, value]);
    setInput('');
  };
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{label}</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {items.map((item) => (
          <Chip
            key={item}
            label={item}
            onDelete={() => onChange(items.filter((entry) => entry !== item))}
            size="small"
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          label={`Add ${label}`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          fullWidth
        />
        <Button variant="outlined" onClick={handleAdd}>
          Add
        </Button>
      </Stack>
      {helperText && (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      )}
    </Stack>
  );
}

const wrapLayoutWithElk = (layout = {}) => ({
  ...DEFAULT_LAYOUT_SETTINGS,
  ...layout,
  elk: {
    ...DEFAULT_ELK_ROUTING_SETTINGS,
    ...(layout.elk || {})
  },
  serpentine: {
    ...(DEFAULT_LAYOUT_SETTINGS.serpentine || {}),
    ...(layout.serpentine || {})
  },
  cycleFallback: {
    ...(DEFAULT_LAYOUT_SETTINGS.cycleFallback || {}),
    ...(layout.cycleFallback || {})
  }
});

export default function DocumentPropertiesDialog({
  open,
  onClose,
  host = 'browser',
  backgroundUrl = '',
  documentSettings,
  onDocumentSettingsChange,
  projectMeta,
  onProjectMetaChange,
  onResetProjectMeta,
  graphStats,
  recentSnapshots = [],
  storySnapshots = []
}) {
  const currentTheme = useTheme();
  const isMobile = useMediaQuery(currentTheme.breakpoints.down('sm'));
  const defaultShareLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, []);

  const [settings, setSettings] = useState(loadSettings());
  const [activeTab, setActiveTab] = useState('overview');
  const [meta, setMeta] = useState(mapProjectMeta(projectMeta, defaultShareLink));
  const [docSettings, setDocSettings] = useState(documentSettings || {});
  const [browserThemeName, setBrowserThemeName] = useState('default');
  const [tagInput, setTagInput] = useState('');
  const [newCollaborator, setNewCollaborator] = useState({ name: '', email: '', role: 'Editor' });
  const [githubPat, setGithubPat] = useState('');
  const [githubCommitMessage, setGithubCommitMessage] = useState('');
  const [storySnapshotIndex, setStorySnapshotIndex] = useState(0);
  const [storyMilestoneLabel, setStoryMilestoneLabel] = useState('');
  const [liveStorySnapshots, setLiveStorySnapshots] = useState([]);
  const [liveRecentSnapshots, setLiveRecentSnapshots] = useState([]);
  const wasOpenRef = useRef(false);

  const handleBrowserThemeChange = useCallback((nextThemeName) => {
    if (!nextThemeName) return;
    setBrowserThemeName(nextThemeName);
    eventBus.emit('applyBrowserTheme', { themeName: nextThemeName });
    if (host === 'vscode') {
      const muiTheme = themeMap[nextThemeName] || themeMap.default;
      const themeConfig = themeConfigFromMuiTheme(muiTheme);
      if (themeConfig) {
        setSettings((prev) => {
          const next = { ...prev, theme: themeConfig };
          saveSettings(next);
          return next;
        });
        eventBus.emit('updateEditorTheme', themeConfig);
      }
    }
  }, [host]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('themeName');
      if (stored) {
        setBrowserThemeName(stored);
      }
    } catch (err) {
      // ignore storage errors
    }
  }, [open]);
  const { nodes = [], edges = [], setNodes } = useGraphEditorStateContext();
  const implicitManifestRef = useRef(null);
  const implicitLegendRef = useRef(null);
  const implicitDictionaryRef = useRef(null);
  if (!implicitManifestRef.current) {
    implicitManifestRef.current = createDefaultManifestNode({ kind: 'fragment' });
  }
  if (!implicitLegendRef.current) {
    implicitLegendRef.current = createDefaultLegendNode();
  }
  if (!implicitDictionaryRef.current) {
    implicitDictionaryRef.current = createDefaultDictionaryNode();
  }

  const manifestInfo = useMemo(() => {
    const node = findSystemNode(nodes, 'manifest');
    return { node: node || implicitManifestRef.current, implicit: !node };
  }, [nodes]);

  const legendInfo = useMemo(() => {
    const node = findSystemNode(nodes, 'legend');
    return { node: node || implicitLegendRef.current, implicit: !node };
  }, [nodes]);

  const dictionaryInfo = useMemo(() => {
    const node = findSystemNode(nodes, 'dictionary');
    return { node: node || implicitDictionaryRef.current, implicit: !node };
  }, [nodes]);

  const [manifestError, setManifestError] = useState('');
  const [legendError, setLegendError] = useState('');
  const [dictionaryError, setDictionaryError] = useState('');
  const [manifestDraft, setManifestDraft] = useState({
    identity: { graphId: '', name: '', version: '', description: '', createdAt: '', updatedAt: '' },
    intent: { kind: 'graph', scope: 'mixed', description: '' },
    dependencies: { nodeTypes: [], portContracts: [], skills: [], optional: [] }
  });
  const [legendDraft, setLegendDraft] = useState({ entries: [] });
  const [dictionaryDraft, setDictionaryDraft] = useState({ nodeDefs: [], skills: [], views: [] });
  const legendCount = legendDraft.entries.length;
  const dictionaryCounts = {
    nodeDefs: dictionaryDraft.nodeDefs.length,
    skills: dictionaryDraft.skills.length,
    views: dictionaryDraft.views.length
  };

  useEffect(() => {
    if (!open) return;
    const manifestData = manifestInfo.node?.data || {};
    setManifestDraft({
      identity: {
        graphId: manifestData.identity?.graphId || '',
        name: manifestData.identity?.name || '',
        version: manifestData.identity?.version || '',
        description: manifestData.identity?.description || '',
        createdAt: manifestData.identity?.createdAt || '',
        updatedAt: manifestData.identity?.updatedAt || ''
      },
      intent: {
        kind: manifestData.intent?.kind || 'graph',
        scope: manifestData.intent?.scope || 'mixed',
        description: manifestData.intent?.description || ''
      },
      dependencies: {
        nodeTypes: Array.isArray(manifestData.dependencies?.nodeTypes) ? manifestData.dependencies.nodeTypes : [],
        portContracts: Array.isArray(manifestData.dependencies?.portContracts) ? manifestData.dependencies.portContracts : [],
        skills: Array.isArray(manifestData.dependencies?.skills) ? manifestData.dependencies.skills : [],
        optional: Array.isArray(manifestData.dependencies?.optional) ? manifestData.dependencies.optional : []
      }
    });
    const legendData = legendInfo.node?.data || {};
    setLegendDraft({
      entries: Array.isArray(legendData.entries) ? legendData.entries.map((entry) => ({ ...entry })) : []
    });
    const dictData = dictionaryInfo.node?.data || {};
    setDictionaryDraft({
      nodeDefs: Array.isArray(dictData.nodeDefs) ? dictData.nodeDefs.map((entry) => ({ ...entry })) : [],
      skills: Array.isArray(dictData.skills) ? dictData.skills.map((entry) => ({ ...entry })) : [],
      views: Array.isArray(dictData.views) ? dictData.views.map((entry) => ({ ...entry })) : []
    });
    setManifestError('');
    setLegendError('');
    setDictionaryError('');
  }, [open, manifestInfo.node?.id, legendInfo.node?.id, dictionaryInfo.node?.id]);

  const contractSummary = useMemo(() => {
    return summarizeContracts({ nodes, edges, documentSettings });
  }, [nodes, edges, documentSettings]);

  const handleSideSummary = useMemo(() => {
    const bySide = contractSummary.handleSummary?.handleBySide || {};
    const entries = Object.entries(bySide);
    if (!entries.length) return 'None';
    return entries.map(([side, count]) => `${side}: ${count}`).join(', ');
  }, [contractSummary]);

  useEffect(() => {
    const handleStorySnapshotsUpdated = ({ snapshots } = {}) => {
      if (Array.isArray(snapshots)) {
        setLiveStorySnapshots(snapshots);
      }
    };
    const handleRecentSnapshotsUpdated = ({ snapshots } = {}) => {
      if (Array.isArray(snapshots)) {
        setLiveRecentSnapshots(snapshots);
      }
    };
    eventBus.on('storySnapshotsUpdated', handleStorySnapshotsUpdated);
    eventBus.on('recentSnapshotsUpdated', handleRecentSnapshotsUpdated);
    return () => {
      eventBus.off('storySnapshotsUpdated', handleStorySnapshotsUpdated);
      eventBus.off('recentSnapshotsUpdated', handleRecentSnapshotsUpdated);
    };
  }, []);

  const resolvedStorySnapshots = storySnapshots.length > 0 ? storySnapshots : liveStorySnapshots;
  const resolvedRecentSnapshots = recentSnapshots.length > 0 ? recentSnapshots : liveRecentSnapshots;

  const safeStats = useMemo(() => ({
    nodeCount: graphStats?.nodeCount ?? 0,
    edgeCount: graphStats?.edgeCount ?? 0,
    groupCount: graphStats?.groupCount ?? 0,
    snapshotCount: graphStats?.snapshotCount ?? 0,
    historyIndex: graphStats?.historyIndex ?? 0
  }), [graphStats]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = true;

    setSettings(loadSettings());
    setMeta(mapProjectMeta(projectMeta, defaultShareLink));
    setDocSettings(documentSettings || {});
    if (!wasOpen) {
      setActiveTab('overview');
      setTagInput('');
      setNewCollaborator({ name: '', email: '', role: 'Editor' });
    }
    try {
      if (typeof window !== 'undefined') {
        setGithubPat(localStorage.getItem('githubPat') || '');
      }
    } catch (err) {
      setGithubPat('');
    }
  }, [open, projectMeta, defaultShareLink, documentSettings]);

  useEffect(() => {
    if (!resolvedStorySnapshots.length) return;
    setStorySnapshotIndex(resolvedStorySnapshots.length - 1);
  }, [resolvedStorySnapshots.length]);

  const handleSettingsChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleMetaChange = (key, value) => {
    setMeta((prev) => ({ ...prev, [key]: value }));
  };

  const handleDocSettingsChange = (key, value) => {
    if (key === 'edgeRouting') {
      emitEdgeIntent('edgeRoutingChange', { value });
    }
    setDocSettings((prev) => ({ ...prev, [key]: value }));
  };

  const { emitEdgeIntent } = useIntentEmitter();

  const handleGithubSettingsChange = (updates = {}) => {
    setDocSettings((prev) => ({
      ...prev,
      github: {
        ...(prev.github || {}),
        ...updates
      }
    }));
  };

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    setMeta((prev) => {
      if (prev.tags.includes(value)) return prev;
      return { ...prev, tags: [...prev.tags, value] };
    });
    setTagInput('');
  };

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      handleAddTag();
    } else if (event.key === 'Backspace' && !tagInput) {
      setMeta((prev) => {
        if (!prev.tags.length) return prev;
        const nextTags = prev.tags.slice(0, -1);
        return { ...prev, tags: nextTags };
      });
    }
  };

  const handleCollaboratorRoleChange = (id, role) => {
    setMeta((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((collab) =>
        collab.id === id ? { ...collab, role } : collab
      )
    }));
  };

  const handleRemoveCollaborator = (id) => {
    setMeta((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((collab) => collab.id !== id)
    }));
  };

  const handleAddCollaborator = () => {
    if (!newCollaborator.email.trim()) return;
    setMeta((prev) => {
      const exists = prev.collaborators.some(
        (collab) => collab.email.toLowerCase() === newCollaborator.email.trim().toLowerCase()
      );
      if (exists) return prev;
      const collaborator = {
        id: uniqueCollaboratorId(),
        name: newCollaborator.name.trim() || newCollaborator.email.trim(),
        email: newCollaborator.email.trim(),
        role: newCollaborator.role
      };
      return { ...prev, collaborators: [...prev.collaborators, collaborator] };
    });
    setNewCollaborator({ name: '', email: '', role: 'Editor' });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(meta.shareLink);
    } catch (err) {
      console.warn('Failed to copy share link:', err);
    }
  };

  const handleToggleScriptPanel = () => {
    try {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('toggleScriptPanel');
      }
    } catch (err) {
      console.warn('Failed to emit toggleScriptPanel via eventBus:', err);
    }

    try {
      const ev = new CustomEvent('toggleScriptPanel');
      window.dispatchEvent(ev);
    } catch (err) {
      console.warn('Failed to dispatch window CustomEvent toggleScriptPanel:', err);
    }

    try {
      window.postMessage({ type: 'toggleScriptPanel' }, '*');
    } catch (err) {
      console.warn('Failed to postMessage toggleScriptPanel:', err);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    try {
      if (typeof window !== 'undefined') {
        if (settings.backgroundImage) {
          localStorage.setItem('backgroundImage', settings.backgroundImage);
        } else {
          localStorage.removeItem('backgroundImage');
        }
      }
      eventBus.emit('backgroundChanged', { backgroundImage: settings.backgroundImage || null });
    } catch (err) {
      console.warn('Failed to persist background image preference:', err);
    }

    const sanitizedTags = meta.tags.map((tag) => tag.trim()).filter(Boolean);
    if (onProjectMetaChange) {
      onProjectMetaChange({
        ...meta,
        tags: Array.from(new Set(sanitizedTags)),
        lastModified: new Date().toISOString()
      });
    }

    if (typeof onDocumentSettingsChange === 'function') {
      onDocumentSettingsChange((prev) => ({
        ...prev,
        ...docSettings
      }));
    }

    onClose();
  };

  const handleReset = () => {
    const defaultSettings = resetSettings();
    setSettings(defaultSettings);
    if (onResetProjectMeta) {
      onResetProjectMeta();
    }
    setMeta(mapProjectMeta({}, meta.shareLink || defaultShareLink));
    const layout = wrapLayoutWithElk();
    setDocSettings((prev) => ({
      ...prev,
      edgeRouting: 'auto',
      layout
    }));
  };

  const contentPadding = isMobile ? { px: 2, pb: 4 } : { px: 3, pb: 4 };
  const sectionSpacing = 3;

  const applySystemNodeData = useCallback((type, data, setError, defaultsRef) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      setError('Data must be an object');
      return;
    }
    setError('');
    if (typeof setNodes !== 'function') return;
    setNodes((prev = []) => {
      const existing = findSystemNode(prev, type);
      if (existing) {
        return prev.map((node) =>
          node?.id === existing.id
            ? { ...node, data }
            : node
        );
      }
      const template = defaultsRef.current;
      const materialized = { ...template, data };
      return [...prev, materialized];
    });
  }, [setNodes]);

  const materializeSystemNode = useCallback((type, defaultsRef) => {
    if (typeof setNodes !== 'function') return;
    setNodes((prev = []) => {
      const existing = findSystemNode(prev, type);
      if (existing) return prev;
      return [...prev, defaultsRef.current];
    });
  }, [setNodes]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      PaperProps={isMobile ? { sx: { m: 0 } } : undefined}
    >
      <DialogTitle>Editor Settings</DialogTitle>
      <DialogContent sx={isMobile ? { p: 0, flex: '1 1 auto', overflowY: 'auto' } : {}}>
        <Box sx={{ px: isMobile ? 2 : 3, pt: isMobile ? 2 : 3, pb: 2 }}>
          <Typography variant="h6">{meta.title || 'Untitled Project'}</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage project metadata, sharing options, activity, and appearance from a single place.
          </Typography>
        </Box>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant={isMobile ? 'scrollable' : 'standard'}
          allowScrollButtonsMobile
          sx={{ px: isMobile ? 1 : 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" value="overview" />
          <Tab label="System Nodes" value="system" />
          <Tab label="Activity" value="activity" />
          <Tab label="Appearance" value="appearance" />
          <Tab label="GitHub" value="github" />
        </Tabs>

        {activeTab === 'overview' && (
          <Stack spacing={sectionSpacing} sx={contentPadding}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                Project Details
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Project title"
                  value={meta.title}
                  onChange={(event) => handleMetaChange('title', event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Description"
                  value={meta.description}
                  onChange={(event) => handleMetaChange('description', event.target.value)}
                  fullWidth
                  multiline
                  minRows={isMobile ? 4 : 3}
                />
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Tags
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    {meta.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        onDelete={() =>
                          setMeta((prev) => ({
                            ...prev,
                            tags: prev.tags.filter((existing) => existing !== tag)
                          }))
                        }
                        size="small"
                        sx={{ mb: 1 }}
                      />
                    ))}
                  </Stack>
                  <TextField
                    label="Add tag"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    helperText="Press Enter to add a tag"
                    fullWidth
                  />
                </Box>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                At a Glance
              </Typography>
              <Grid container spacing={2}>
                <Grid xs={6} md={3}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Nodes
                    </Typography>
                    <Typography variant="h6">{safeStats.nodeCount}</Typography>
                  </Stack>
                </Grid>
                <Grid xs={6} md={3}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Edges
                    </Typography>
                    <Typography variant="h6">{safeStats.edgeCount}</Typography>
                  </Stack>
                </Grid>
                <Grid xs={6} md={3}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Clusters
                    </Typography>
                    <Typography variant="h6">{safeStats.groupCount}</Typography>
                  </Stack>
                </Grid>
                <Grid xs={6} md={3}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Snapshots
                    </Typography>
                    <Typography variant="h6">{safeStats.snapshotCount}</Typography>
                  </Stack>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">{formatTimestamp(meta.createdAt)}</Typography>
                </Grid>
                <Grid xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Last modified
                  </Typography>
                  <Typography variant="body2">{formatTimestamp(meta.lastModified)}</Typography>
                </Grid>
              </Grid>
              <Box
                sx={{
                  mt: 2,
                  px: 2,
                  py: 1.25,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Contract summary
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Version {contractSummary.version}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ports defined: {contractSummary.handleSummary.total || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nodes with ports: {contractSummary.handleSummary.withHandles || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Edges: {contractSummary.edgeCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sides: {handleSideSummary}
                </Typography>
              </Box>
            </Paper>
          </Stack>
        )}

        {activeTab === 'system' && (
          <Stack spacing={sectionSpacing} sx={contentPadding}>
            <Typography variant="body2" color="text.secondary">
              System nodes are grouped below. Expand only what you need while editing.
            </Typography>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1">Manifest</Typography>
                  <Chip
                    size="small"
                    label={manifestInfo.implicit ? 'Implicit' : 'Explicit'}
                    color={manifestInfo.implicit ? 'warning' : 'success'}
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    If missing, a fragment import uses implicit defaults until materialized.
                  </Typography>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Identity</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        <TextField
                          label="Graph ID"
                          value={manifestDraft.identity.graphId}
                          onChange={(event) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              identity: { ...prev.identity, graphId: event.target.value }
                            }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Name"
                          value={manifestDraft.identity.name}
                          onChange={(event) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              identity: { ...prev.identity, name: event.target.value }
                            }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Version"
                          value={manifestDraft.identity.version}
                          onChange={(event) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              identity: { ...prev.identity, version: event.target.value }
                            }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Description"
                          value={manifestDraft.identity.description}
                          onChange={(event) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              identity: { ...prev.identity, description: event.target.value }
                            }))
                          }
                          multiline
                          minRows={2}
                          fullWidth
                        />
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Intent</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                          <TextField
                            label="Kind"
                            value={manifestDraft.intent.kind}
                            onChange={(event) =>
                              setManifestDraft((prev) => ({
                                ...prev,
                                intent: { ...prev.intent, kind: event.target.value }
                              }))
                            }
                            fullWidth
                          />
                          <TextField
                            label="Scope"
                            value={manifestDraft.intent.scope}
                            onChange={(event) =>
                              setManifestDraft((prev) => ({
                                ...prev,
                                intent: { ...prev.intent, scope: event.target.value }
                              }))
                            }
                            fullWidth
                          />
                        </Stack>
                        <TextField
                          label="Intent description"
                          value={manifestDraft.intent.description}
                          onChange={(event) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              intent: { ...prev.intent, description: event.target.value }
                            }))
                          }
                          multiline
                          minRows={2}
                          fullWidth
                        />
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Dependencies</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        <StringListEditor
                          label="Node types"
                          items={manifestDraft.dependencies.nodeTypes}
                          onChange={(next) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              dependencies: { ...prev.dependencies, nodeTypes: next }
                            }))
                          }
                        />
                        <StringListEditor
                          label="Port contracts"
                          items={manifestDraft.dependencies.portContracts}
                          onChange={(next) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              dependencies: { ...prev.dependencies, portContracts: next }
                            }))
                          }
                        />
                        <StringListEditor
                          label="Skills"
                          items={manifestDraft.dependencies.skills}
                          onChange={(next) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              dependencies: { ...prev.dependencies, skills: next }
                            }))
                          }
                        />
                        <StringListEditor
                          label="Optional"
                          items={manifestDraft.dependencies.optional}
                          onChange={(next) =>
                            setManifestDraft((prev) => ({
                              ...prev,
                              dependencies: { ...prev.dependencies, optional: next }
                            }))
                          }
                        />
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Stack direction="row" spacing={1}>
                    {manifestInfo.implicit && (
                      <Button
                        variant="outlined"
                        onClick={() => materializeSystemNode('manifest', implicitManifestRef)}
                      >
                        Materialize
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      onClick={() =>
                        applySystemNodeData(
                          'manifest',
                          {
                            ...(manifestInfo.node?.data || {}),
                            identity: manifestDraft.identity,
                            intent: manifestDraft.intent,
                            dependencies: manifestDraft.dependencies
                          },
                          setManifestError,
                          implicitManifestRef
                        )
                      }
                    >
                      Apply
                    </Button>
                  </Stack>
                  {manifestError && (
                    <Typography variant="caption" color="error">
                      {manifestError}
                    </Typography>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1">Legend</Typography>
                  <Chip
                    size="small"
                    label={legendInfo.implicit ? 'Implicit' : 'Explicit'}
                    color={legendInfo.implicit ? 'warning' : 'success'}
                  />
                  <Chip size="small" label={`${legendCount} entries`} variant="outlined" />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {legendDraft.entries.map((entry, index) => (
                    <Paper key={`legend-${index}`} variant="outlined" sx={{ p: 2 }}>
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">Entry {index + 1}</Typography>
                          <IconButton
                            size="small"
                            onClick={() =>
                              setLegendDraft((prev) => ({
                                ...prev,
                                entries: prev.entries.filter((_, i) => i !== index)
                              }))
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <TextField
                          label="Key"
                          value={entry.key || ''}
                          onChange={(event) =>
                            setLegendDraft((prev) => ({
                              ...prev,
                              entries: prev.entries.map((item, i) =>
                                i === index ? { ...item, key: event.target.value } : item
                              )
                            }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Intent"
                          value={entry.intent || ''}
                          onChange={(event) =>
                            setLegendDraft((prev) => ({
                              ...prev,
                              entries: prev.entries.map((item, i) =>
                                i === index ? { ...item, intent: event.target.value } : item
                              )
                            }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Implementation"
                          value={entry.implementation || ''}
                          onChange={(event) =>
                            setLegendDraft((prev) => ({
                              ...prev,
                              entries: prev.entries.map((item, i) =>
                                i === index ? { ...item, implementation: event.target.value } : item
                              )
                            }))
                          }
                          fullWidth
                        />
                        <TextField
                          label="Dictionary key"
                          value={entry.dictionaryKey || ''}
                          onChange={(event) =>
                            setLegendDraft((prev) => ({
                              ...prev,
                              entries: prev.entries.map((item, i) =>
                                i === index ? { ...item, dictionaryKey: event.target.value } : item
                              )
                            }))
                          }
                          fullWidth
                        />
                      </Stack>
                    </Paper>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={() =>
                      setLegendDraft((prev) => ({
                        ...prev,
                        entries: [
                          ...prev.entries,
                          { key: '', intent: '', implementation: '', dictionaryKey: '' }
                        ]
                      }))
                    }
                  >
                    Add Legend Entry
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  {legendInfo.implicit && (
                    <Button
                      variant="outlined"
                      onClick={() => materializeSystemNode('legend', implicitLegendRef)}
                    >
                      Materialize
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    onClick={() =>
                      applySystemNodeData(
                        'legend',
                        { ...(legendInfo.node?.data || {}), entries: legendDraft.entries },
                        setLegendError,
                        implicitLegendRef
                      )
                    }
                  >
                    Apply
                  </Button>
                </Stack>
                {legendError && (
                  <Typography variant="caption" color="error">
                    {legendError}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1">Dictionary</Typography>
                  <Chip
                    size="small"
                    label={dictionaryInfo.implicit ? 'Implicit' : 'Explicit'}
                    color={dictionaryInfo.implicit ? 'warning' : 'success'}
                  />
                  <Chip
                    size="small"
                    label={`${dictionaryCounts.nodeDefs} defs · ${dictionaryCounts.skills} skills · ${dictionaryCounts.views} views`}
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">Node Definitions</Typography>
                        <Chip size="small" label={`${dictionaryCounts.nodeDefs}`} variant="outlined" />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        {dictionaryDraft.nodeDefs.map((entry, index) => (
                          <Paper key={`nodeDef-${index}`} variant="outlined" sx={{ p: 2 }}>
                            <Stack spacing={2}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2">Entry {index + 1}</Typography>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      nodeDefs: prev.nodeDefs.filter((_, i) => i !== index)
                                    }))
                                  }
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                              <TextField
                                label="Key"
                                value={entry.key || ''}
                                onChange={(event) =>
                                  setDictionaryDraft((prev) => ({
                                    ...prev,
                                    nodeDefs: prev.nodeDefs.map((item, i) =>
                                      i === index ? { ...item, key: event.target.value } : item
                                    )
                                  }))
                                }
                                fullWidth
                              />
                              <TextField
                                label="Ref"
                                value={entry.ref || ''}
                                onChange={(event) =>
                                  setDictionaryDraft((prev) => ({
                                    ...prev,
                                    nodeDefs: prev.nodeDefs.map((item, i) =>
                                      i === index ? { ...item, ref: event.target.value } : item
                                    )
                                  }))
                                }
                                fullWidth
                              />
                              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                                <TextField
                                  label="Version"
                                  value={entry.version || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      nodeDefs: prev.nodeDefs.map((item, i) =>
                                        i === index ? { ...item, version: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                                <TextField
                                  label="Source"
                                  value={entry.source || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      nodeDefs: prev.nodeDefs.map((item, i) =>
                                        i === index ? { ...item, source: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                        <Button
                          variant="outlined"
                          onClick={() =>
                            setDictionaryDraft((prev) => ({
                              ...prev,
                              nodeDefs: [
                                ...prev.nodeDefs,
                                { key: '', ref: '', version: '', source: '' }
                              ]
                            }))
                          }
                        >
                          Add Node Definition
                        </Button>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">Skills</Typography>
                        <Chip size="small" label={`${dictionaryCounts.skills}`} variant="outlined" />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        {dictionaryDraft.skills.map((entry, index) => (
                          <Paper key={`skill-${index}`} variant="outlined" sx={{ p: 2 }}>
                            <Stack spacing={2}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2">Entry {index + 1}</Typography>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      skills: prev.skills.filter((_, i) => i !== index)
                                    }))
                                  }
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                              <TextField
                                label="Key"
                                value={entry.key || ''}
                                onChange={(event) =>
                                  setDictionaryDraft((prev) => ({
                                    ...prev,
                                    skills: prev.skills.map((item, i) =>
                                      i === index ? { ...item, key: event.target.value } : item
                                    )
                                  }))
                                }
                                fullWidth
                              />
                              <TextField
                                label="Ref"
                                value={entry.ref || ''}
                                onChange={(event) =>
                                  setDictionaryDraft((prev) => ({
                                    ...prev,
                                    skills: prev.skills.map((item, i) =>
                                      i === index ? { ...item, ref: event.target.value } : item
                                    )
                                  }))
                                }
                                fullWidth
                              />
                              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                                <TextField
                                  label="Version"
                                  value={entry.version || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      skills: prev.skills.map((item, i) =>
                                        i === index ? { ...item, version: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                                <TextField
                                  label="Source"
                                  value={entry.source || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      skills: prev.skills.map((item, i) =>
                                        i === index ? { ...item, source: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                        <Button
                          variant="outlined"
                          onClick={() =>
                            setDictionaryDraft((prev) => ({
                              ...prev,
                              skills: [
                                ...prev.skills,
                                { key: '', ref: '', version: '', source: '' }
                              ]
                            }))
                          }
                        >
                          Add Skill
                        </Button>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">Views</Typography>
                        <Chip size="small" label={`${dictionaryCounts.views}`} variant="outlined" />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        {dictionaryDraft.views.map((entry, index) => (
                          <Paper key={`view-${index}`} variant="outlined" sx={{ p: 2 }}>
                            <Stack spacing={2}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2">Entry {index + 1}</Typography>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      views: prev.views.filter((_, i) => i !== index)
                                    }))
                                  }
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                              <TextField
                                label="Key"
                                value={entry.key || ''}
                                onChange={(event) =>
                                  setDictionaryDraft((prev) => ({
                                    ...prev,
                                    views: prev.views.map((item, i) =>
                                      i === index ? { ...item, key: event.target.value } : item
                                    )
                                  }))
                                }
                                fullWidth
                              />
                              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                                <TextField
                                  label="Intent"
                                  value={entry.intent || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      views: prev.views.map((item, i) =>
                                        i === index ? { ...item, intent: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                                <TextField
                                  label="Payload"
                                  value={entry.payload || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      views: prev.views.map((item, i) =>
                                        i === index ? { ...item, payload: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                              </Stack>
                              <TextField
                                label="Ref"
                                value={entry.ref || ''}
                                onChange={(event) =>
                                  setDictionaryDraft((prev) => ({
                                    ...prev,
                                    views: prev.views.map((item, i) =>
                                      i === index ? { ...item, ref: event.target.value } : item
                                    )
                                  }))
                                }
                                fullWidth
                              />
                              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                                <TextField
                                  label="Version"
                                  value={entry.version || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      views: prev.views.map((item, i) =>
                                        i === index ? { ...item, version: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                                <TextField
                                  label="Source"
                                  value={entry.source || ''}
                                  onChange={(event) =>
                                    setDictionaryDraft((prev) => ({
                                      ...prev,
                                      views: prev.views.map((item, i) =>
                                        i === index ? { ...item, source: event.target.value } : item
                                      )
                                    }))
                                  }
                                  fullWidth
                                />
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                        <Button
                          variant="outlined"
                          onClick={() =>
                            setDictionaryDraft((prev) => ({
                              ...prev,
                              views: [
                                ...prev.views,
                                { key: '', intent: '', payload: '', ref: '', version: '', source: '' }
                              ]
                            }))
                          }
                        >
                          Add View
                        </Button>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Stack direction="row" spacing={1}>
                    {dictionaryInfo.implicit && (
                      <Button
                        variant="outlined"
                        onClick={() => materializeSystemNode('dictionary', implicitDictionaryRef)}
                      >
                        Materialize
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      onClick={() =>
                        applySystemNodeData(
                          'dictionary',
                          {
                            ...(dictionaryInfo.node?.data || {}),
                            nodeDefs: dictionaryDraft.nodeDefs,
                            skills: dictionaryDraft.skills,
                            views: dictionaryDraft.views
                          },
                          setDictionaryError,
                          implicitDictionaryRef
                        )
                      }
                    >
                      Apply
                    </Button>
                  </Stack>
                  {dictionaryError && (
                    <Typography variant="caption" color="error">
                      {dictionaryError}
                    </Typography>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}

        {activeTab === 'collaboration' && (
          <Stack spacing={sectionSpacing} sx={contentPadding}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                Share Link
              </Typography>
              <TextField
                label="Share link"
                value={meta.shareLink}
                onChange={(event) => handleMetaChange('shareLink', event.target.value)}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Copy link">
                        <IconButton size="small" onClick={handleCopyLink}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={meta.allowComments}
                      onChange={(event) => handleMetaChange('allowComments', event.target.checked)}
                    />
                  }
                  label="Allow comments"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={meta.allowEdits}
                      onChange={(event) => handleMetaChange('allowEdits', event.target.checked)}
                    />
                  }
                  label="Allow edits"
                />
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle1">Collaborators</Typography>
                <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 32, height: 32 }}>
                  <GroupAddIcon fontSize="small" />
                </Avatar>
              </Stack>
              <List dense disablePadding>
                {(meta.collaborators || []).map((collaborator) => (
                  <ListItem key={collaborator.id} disableGutters sx={{ mb: 1.5 }}>
                    <ListItemText
                      primary={collaborator.name || collaborator.email}
                      secondary={collaborator.email}
                    />
                    <Select
                      size="small"
                      value={collaborator.role}
                      onChange={(event) => handleCollaboratorRoleChange(collaborator.id, event.target.value)}
                      sx={{ mr: 1.5, minWidth: 120 }}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <MenuItem key={role} value={role} disabled={role === 'Owner' && collaborator.id !== 'owner'}>
                          {role}
                        </MenuItem>
                      ))}
                    </Select>
                    <ListItemSecondaryAction>
                      <Tooltip title="Remove collaborator">
                        <span>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleRemoveCollaborator(collaborator.id)}
                            disabled={collaborator.role === 'Owner'}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label="Name"
                  value={newCollaborator.name}
                  onChange={(event) => setNewCollaborator((prev) => ({ ...prev, name: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Email"
                  value={newCollaborator.email}
                  onChange={(event) => setNewCollaborator((prev) => ({ ...prev, email: event.target.value }))}
                  fullWidth
                />
                <Select
                  size="small"
                  value={newCollaborator.role}
                  onChange={(event) => setNewCollaborator((prev) => ({ ...prev, role: event.target.value }))}
                  sx={{ minWidth: 140 }}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddCollaborator}>
                  Add
                </Button>
              </Stack>
            </Paper>
          </Stack>
        )}

        {activeTab === 'activity' && (
          <Stack spacing={sectionSpacing} sx={contentPadding}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <QueryStatsIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1">Story Timeline</Typography>
              </Stack>
              {resolvedStorySnapshots.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No story snapshots yet.
                </Typography>
              ) : (
                <>
                  <Slider
                    value={storySnapshotIndex}
                    min={0}
                    max={Math.max(resolvedStorySnapshots.length - 1, 0)}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => {
                      const snapshot = resolvedStorySnapshots[value];
                      return snapshot ? `#${snapshot.id}` : `${value + 1}`;
                    }}
                    onChange={(_, value) => {
                      setStorySnapshotIndex(Array.isArray(value) ? value[0] : value);
                    }}
                    onChangeCommitted={(_, value) => {
                      const indexValue = Array.isArray(value) ? value[0] : value;
                      const snapshot = resolvedStorySnapshots[indexValue];
                      if (snapshot) {
                        eventBus.emit('restoreHistoryToIndex', { index: snapshot.historyIndex });
                      }
                    }}
                  />
                  {resolvedStorySnapshots[storySnapshotIndex] && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2">
                        Snapshot #{resolvedStorySnapshots[storySnapshotIndex].id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(resolvedStorySnapshots[storySnapshotIndex].timestamp)} · {resolvedStorySnapshots[storySnapshotIndex].reason}
                      </Typography>
                      {resolvedStorySnapshots[storySnapshotIndex].label && (
                        <Typography variant="body2" color="text.secondary">
                          {resolvedStorySnapshots[storySnapshotIndex].label}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {resolvedStorySnapshots[storySnapshotIndex].nodeCount} nodes • {resolvedStorySnapshots[storySnapshotIndex].edgeCount} edges • {resolvedStorySnapshots[storySnapshotIndex].groupCount} clusters
                      </Typography>
                      {storySnapshotIndex > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Δ {resolvedStorySnapshots[storySnapshotIndex].nodeCount - resolvedStorySnapshots[storySnapshotIndex - 1].nodeCount} nodes • Δ {resolvedStorySnapshots[storySnapshotIndex].edgeCount - resolvedStorySnapshots[storySnapshotIndex - 1].edgeCount} edges • Δ {resolvedStorySnapshots[storySnapshotIndex].groupCount - resolvedStorySnapshots[storySnapshotIndex - 1].groupCount} clusters
                        </Typography>
                      )}
                    </Box>
                  )}
                </>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
                <TextField
                  label="Milestone label"
                  value={storyMilestoneLabel}
                  onChange={(event) => setStoryMilestoneLabel(event.target.value)}
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={() => {
                    eventBus.emit('storyMilestone', { label: storyMilestoneLabel });
                    setStoryMilestoneLabel('');
                  }}
                >
                  Add Milestone
                </Button>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <QueryStatsIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1">Recent Activity</Typography>
              </Stack>
              <List dense disablePadding>
                {resolvedRecentSnapshots.length === 0 ? (
                  <ListItem disableGutters>
                    <ListItemText primary="No history captured yet." />
                  </ListItem>
                ) : (
                  resolvedRecentSnapshots.map((snapshot) => (
                    <ListItem key={snapshot.id} disableGutters sx={{ mb: 1.25 }}>
                      <ListItemText
                        primary={`Snapshot #${snapshot.id}`}
                        secondary={`${snapshot.nodeCount} nodes • ${snapshot.edgeCount} edges • ${snapshot.groupCount} clusters`}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                Quick Actions
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RocketLaunchIcon />}
                  onClick={handleToggleScriptPanel}
                >
                  Toggle Script Panel
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleCopyLink}
                >
                  Copy Share Link
                </Button>
              </Stack>
            </Paper>
          </Stack>
        )}

        {activeTab === 'appearance' && (
          <Stack spacing={sectionSpacing} sx={contentPadding}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                Browser Theme
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Controls the UI theme of the Twilite browser shell.
              </Typography>
              <ThemeButtonGroup
                themeName={browserThemeName}
                setThemeName={handleBrowserThemeChange}
              />
              {browserThemeName === 'custom' && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Current browser theme is custom.
                </Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                Theme
              </Typography>
              <ThemeBuilder
                initialTheme={settings.theme || (currentTheme?.palette ? {
                  mode: currentTheme.palette.mode || 'light',
                  primary: {
                    main: currentTheme.palette.primary?.main || '#1976d2',
                    light: currentTheme.palette.primary?.light || '#42a5f5',
                    dark: currentTheme.palette.primary?.dark || '#1565c0',
                    contrastText: currentTheme.palette.primary?.contrastText || '#ffffff',
                  },
                  secondary: {
                    main: currentTheme.palette.secondary?.main || '#dc004e',
                    light: currentTheme.palette.secondary?.light || '#f50057',
                    dark: currentTheme.palette.secondary?.dark || '#c51162',
                    contrastText: currentTheme.palette.secondary?.contrastText || '#ffffff',
                  },
                  background: {
                    default: currentTheme.palette.background?.default || '#f5f5f5',
                    paper: currentTheme.palette.background?.paper || '#ffffff',
                  },
                  text: {
                    primary: currentTheme.palette.text?.primary || '#000000',
                    secondary: currentTheme.palette.text?.secondary || '#666666',
                  },
                  divider: currentTheme.palette.divider || '#e0e0e0',
                } : null)}
                onThemeChange={(newTheme) => {
                  setSettings((prev) => {
                    const next = { ...prev, theme: newTheme };
                    saveSettings(next);
                    return next;
                  });
                  if (host === 'vscode') {
                    eventBus.emit('updateEditorTheme', newTheme);
                  } else {
                    eventBus.emit('updateDocumentTheme', newTheme);
                  }
                }}
              />
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                Canvas & Background
              </Typography>
              <BackgroundControls backgroundUrl={backgroundUrl} backgroundInteractive={false} />
            </Paper>
          </Stack>
        )}

        {activeTab === 'github' && (
          <Stack spacing={sectionSpacing} sx={contentPadding}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" gutterBottom>
                GitHub Sync (PAT)
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Personal Access Token (PAT)"
                  type="password"
                  value={githubPat}
                  onChange={(event) => {
                    const next = event.target.value;
                    setGithubPat(next);
                    try {
                      if (typeof window !== 'undefined') {
                        if (next) {
                          localStorage.setItem('githubPat', next);
                        } else {
                          localStorage.removeItem('githubPat');
                        }
                      }
                    } catch (err) {
                      // ignore storage errors
                    }
                  }}
                  fullWidth
                  helperText="Stored locally in this browser. Required for commit/load."
                />
                <TextField
                  label="Repository (owner/name)"
                  value={docSettings.github?.repo || ''}
                  onChange={(event) => handleGithubSettingsChange({ repo: event.target.value })}
                  fullWidth
                />
                <TextField
                  label="File path in repo"
                  value={docSettings.github?.path || ''}
                  onChange={(event) => handleGithubSettingsChange({ path: event.target.value })}
                  fullWidth
                  placeholder="graphs/my-graph.node"
                />
                <TextField
                  label="Branch"
                  value={docSettings.github?.branch || 'main'}
                  onChange={(event) => handleGithubSettingsChange({ branch: event.target.value })}
                  fullWidth
                />
                <TextField
                  label="Commit message"
                  value={githubCommitMessage}
                  onChange={(event) => setGithubCommitMessage(event.target.value)}
                  fullWidth
                  placeholder="Update graph"
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      eventBus.emit('githubCommit', {
                        token: githubPat,
                        settings: docSettings.github || {},
                        message: githubCommitMessage
                      });
                    }}
                  >
                    Commit to GitHub
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      eventBus.emit('githubLoad', {
                        token: githubPat,
                        settings: docSettings.github || {}
                      });
                    }}
                  >
                    Load from GitHub
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions
        sx={isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 3, pb: 3 } : { px: 3, pb: 3 }}
      >
        <Button onClick={handleReset} color="secondary" fullWidth={isMobile}>
          Reset to Defaults
        </Button>
        <Button onClick={onClose} color="primary" fullWidth={isMobile}>
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" fullWidth={isMobile}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
