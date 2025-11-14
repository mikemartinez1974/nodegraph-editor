import React, { useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  Paper,
  Card,
  CardContent,
  CardActionArea,
  Divider,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import HistoryIcon from '@mui/icons-material/History';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import eventBus from '../../NodeGraph/eventBus';

const formatSnapshotLabel = (snapshot) => {
  if (!snapshot) return 'Snapshot';
  const { nodeCount = 0, edgeCount = 0, groupCount = 0 } = snapshot;
  return `${nodeCount} nodes • ${edgeCount} edges${groupCount ? ` • ${groupCount} groups` : ''}`;
};

export default function NewTabPage({
  onCreateBlank,
  onImportGraph,
  onShowMessage,
  recentSnapshots = [],
  isFreeUser = false
}) {
  const fileInputRef = useRef(null);

  const hasRecentSnapshots = Array.isArray(recentSnapshots) && recentSnapshots.length > 0;

  const recentSnapshotItems = useMemo(() => {
    if (!hasRecentSnapshots) return [];
    return recentSnapshots.slice().reverse().map((snapshot) => ({
      id: snapshot.id,
      label: formatSnapshotLabel(snapshot)
    }));
  }, [recentSnapshots, hasRecentSnapshots]);

  const handleCreateBlank = () => {
    if (typeof onCreateBlank === 'function') {
      onCreateBlank();
      onShowMessage?.('Blank graph ready', 'info');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        const nodesToLoad = jsonData.nodes || [];
        const edgesToLoad = jsonData.edges || [];
        const groupsToLoad = jsonData.groups || [];

        if (nodesToLoad.length === 0 && edgesToLoad.length === 0) {
          throw new Error('File does not contain any nodes or edges.');
        }

        onImportGraph?.(nodesToLoad, edgesToLoad, groupsToLoad);
        onShowMessage?.(`Loaded ${file.name}`, 'success');

        eventBus.emit('setAddress', `local://${file.name}`);
        eventBus.emit('loadSaveFile', {
          settings: jsonData.settings || {},
          viewport: jsonData.viewport || {},
          scripts: jsonData.scripts || null,
          filename: file.name
        });
      } catch (err) {
        console.error('Failed to import graph', err);
        onShowMessage?.(err.message || 'Failed to import graph file', 'error');
      }
    };

    reader.onerror = () => {
      onShowMessage?.('Unable to read file', 'error');
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const handleBrowseTemplates = () => {
    eventBus.emit('toggleTemplateGallery');
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, md: 6 },
        py: { xs: 6, md: 8 },
        bgcolor: (theme) => theme.palette.background.default,
        overflowY: 'auto'
      }}
    >
      <Paper
        elevation={4}
        sx={{
          width: '100%',
          maxWidth: 960,
          p: { xs: 3, md: 5 },
          borderRadius: 4
        }}
      >
        <Stack spacing={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Start a new graph, import an existing project, or pick up where you left off.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateBlank}
              size="large"
              sx={{ flex: 1, minHeight: 56 }}
              color="primary"
            >
              Create blank graph
            </Button>

            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={handleImportClick}
              size="large"
              sx={{ flex: 1, minHeight: 56 }}
            >
              Import .node file
            </Button>

            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleBrowseTemplates}
              size="large"
              sx={{ flex: 1, minHeight: 56 }}
              disabled={isFreeUser}
            >
              Browse templates
            </Button>
          </Stack>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.node"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <Divider />

          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <HistoryIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                Recent snapshots
              </Typography>
              {!hasRecentSnapshots && (
                <Chip label="Empty" size="small" variant="outlined" color="info" />
              )}
            </Stack>

            {hasRecentSnapshots ? (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                {recentSnapshotItems.map((snapshot) => (
                  <Card key={snapshot.id} sx={{ flex: 1, minWidth: 200 }}>
                    <CardActionArea
                      onClick={() => eventBus.emit('restoreHistoryToIndex', { index: snapshot.id - 1 })}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Snapshot {snapshot.id}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {snapshot.label}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Your recent edits will appear here once you start a graph.
              </Typography>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
