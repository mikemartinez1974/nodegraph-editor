import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Paper, Box, Button, TextField, Typography, FormControlLabel, Switch, Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemButton, ListItemText, Collapse, Alert } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import eventBus from '../../NodeGraph/eventBus';

// Custom hook for localStorage persistence
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`Failed to persist ${key}:`, err);
    }
  }, [key, value]);

  return [value, setValue];
}

export default function ScriptPanel() {
  // Core state using custom hooks
  const [scripts, setScripts] = useLocalStorage('scripts', []);
  const [selectedId, setSelectedId] = useState(scripts[0]?.id || '');
  const [source, setSource] = useState('');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  // UI state
  const defaultSize = { width: 700, height: 500 };
  const defaultPos = typeof window !== 'undefined' 
    ? { left: Math.max(16, window.innerWidth - defaultSize.width - 16), top: Math.max(56, window.innerHeight - defaultSize.height - 56) }
    : { left: 200, top: 120 };
  
  const [size, setSize] = useLocalStorage('scriptPanelSize', defaultSize);
  const [pos, setPos] = useLocalStorage('scriptPanelPos', defaultPos);
  const [visible, setVisible] = useLocalStorage('scriptPanelVisible', true);

  // Script options
  const [allowMutations, setAllowMutations] = useLocalStorage('scriptAllowMutations', false);
  const [dryRun, setDryRun] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Proposals
  const [proposals, setProposals] = useState(null);

  // Dialogs
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // Memoized selected script
  const selectedScript = useMemo(() => 
    scripts.find(s => s.id === selectedId),
    [scripts, selectedId]
  );

  // Sync source when selection changes
  useEffect(() => {
    if (selectedScript) {
      setSource(selectedScript.source || '');
    } else if (scripts.length > 0) {
      setSelectedId(scripts[0].id);
    }
  }, [selectedId, selectedScript, scripts]);

  // External toggle handler
  useEffect(() => {
    const toggle = () => setVisible(v => !v);
    eventBus.on('toggleScriptPanel', toggle);
    return () => eventBus.off('toggleScriptPanel', toggle);
  }, [setVisible]);

  // Drag and resize refs
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: size.width, h: size.height });

  // Drag handlers
  const startDrag = useCallback((ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    const clientX = ev.clientX ?? ev.touches?.[0]?.clientX;
    const clientY = ev.clientY ?? ev.touches?.[0]?.clientY;
    draggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY, left: pos.left, top: pos.top };

    const onMove = (e) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      const dx = cx - dragStartRef.current.x;
      const dy = cy - dragStartRef.current.y;
      setPos({ 
        left: Math.max(8, dragStartRef.current.left + dx), 
        top: Math.max(8, dragStartRef.current.top + dy) 
      });
    };

    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [pos, setPos]);

  // Resize handlers
  const startResize = useCallback((ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    const clientX = ev.clientX ?? ev.touches?.[0]?.clientX;
    const clientY = ev.clientY ?? ev.touches?.[0]?.clientY;
    resizingRef.current = true;
    resizeStartRef.current = { x: clientX, y: clientY, w: size.width, h: size.height };

    const onMove = (e) => {
      if (!resizingRef.current) return;
      e.preventDefault();
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      const dx = cx - resizeStartRef.current.x;
      const dy = cy - resizeStartRef.current.y;
      setSize({
        width: Math.max(500, resizeStartRef.current.w + dx),
        height: Math.max(400, resizeStartRef.current.h + dy)
      });
    };

    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [size, setSize]);

  // Script operations
  const handleNew = useCallback(() => {
    const id = `script_${Date.now()}`;
    const newScript = {
      id,
      name: 'New Script',
      source: '// Write your script here\n// Available API:\n//   api.getNodes()\n//   api.getNode(id)\n//   api.getEdges()\n//   api.createNode(data)\n//   api.updateNode(id, patch)\n//   api.deleteNode(id)\n//   api.createEdge(data)\n//   api.deleteEdge(id)\n//   api.log(level, message)\n\nconst nodes = await api.getNodes();\nreturn { count: nodes.length };',
      tags: ''
    };
    setScripts(prev => [newScript, ...prev]);
    setSelectedId(id);
  }, [setScripts]);

  const handleSave = useCallback(() => {
    if (!selectedId || !selectedScript) return;
    setScripts(prev => prev.map(s => 
      s.id === selectedId 
        ? { ...s, source, name: s.name || 'Untitled' }
        : s
    ));
    setResult({ success: true, message: 'Saved successfully' });
    setTimeout(() => setResult(null), 3000);
  }, [selectedId, selectedScript, source, setScripts]);

  const handleUpdateName = useCallback((newName) => {
    if (!selectedId) return;
    setScripts(prev => prev.map(s => 
      s.id === selectedId ? { ...s, name: newName } : s
    ));
  }, [selectedId, setScripts]);

  const handleUpdateTags = useCallback((newTags) => {
    if (!selectedId) return;
    setScripts(prev => prev.map(s => 
      s.id === selectedId ? { ...s, tags: newTags } : s
    ));
  }, [selectedId, setScripts]);

  const handleRun = useCallback(async (dry = false) => {
    if (typeof window === 'undefined' || !window.__scriptRunner) {
      setResult({ success: false, error: 'Script runner not available' });
      return;
    }
    
    setRunning(true);
    setResult(null);
    
    try {
      const meta = { dry: dry || dryRun, allowMutations: allowMutations };
      const res = await window.__scriptRunner.run(source, meta);
      setResult(res);
      
      const p = res?.proposals || res?.proposed || res?.proposedChanges || null;
      if (p && !res.applied) {
        setProposals(Array.isArray(p) ? p : [p]);
      } else {
        setProposals(null);
      }
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setRunning(false);
    }
  }, [source, dryRun, allowMutations]);

  const handleDuplicate = useCallback(() => {
    if (!selectedScript) return;
    const id = `script_${Date.now()}`;
    const dup = { ...selectedScript, id, name: `${selectedScript.name} (copy)` };
    setScripts(prev => [dup, ...prev]);
    setSelectedId(id);
  }, [selectedScript, setScripts]);

  const handleDelete = useCallback((id) => {
    const next = scripts.filter(s => s.id !== id);
    setScripts(next);
    if (id === selectedId) {
      setSelectedId(next.length > 0 ? next[0].id : '');
    }
  }, [scripts, selectedId, setScripts]);

  const handleApplyProposals = useCallback(() => {
    if (!proposals) return;
    eventBus.emit('applyScriptProposals', { proposals, sourceId: selectedId });
    setProposals(null);
    setResult({ success: true, message: 'Applied proposals successfully' });
  }, [proposals, selectedId]);

  // Import/Export
  const handleExportLibrary = useCallback(() => {
    try {
      const json = JSON.stringify(scripts, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scripts_library_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setResult({ success: true, message: 'Library exported successfully' });
    } catch (err) {
      setResult({ success: false, error: 'Export failed' });
    }
  }, [scripts]);

  const handleImportLibrary = useCallback(() => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        setResult({ success: false, error: 'Invalid format: expected array' });
        return;
      }
      setScripts(parsed);
      setImportDialogOpen(false);
      setImportText('');
      setResult({ success: true, message: `Imported ${parsed.length} script(s)` });
      if (parsed.length > 0) setSelectedId(parsed[0].id);
    } catch (err) {
      setResult({ success: false, error: String(err) });
    }
  }, [importText, setScripts]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!visible) return;
      
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Ctrl/Cmd + Enter to run
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, handleSave, handleRun]);

  if (!visible) return null;

  return (
    <>
      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          left: pos.left,
          top: pos.top,
          width: size.width,
          height: size.height,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderRadius: 2,
          zIndex: 1300,
        }}
      >
        {/* Header */}
        <Box
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          sx={{
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            cursor: 'grab',
            userSelect: 'none',
            '&:active': { cursor: 'grabbing' }
          }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Script Editor
          </Typography>
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); handleExportLibrary(); }}
            sx={{ color: 'inherit', mr: 0.5 }}
            title="Export library"
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); setImportDialogOpen(true); }}
            sx={{ color: 'inherit', mr: 0.5 }}
            title="Import library"
          >
            <UploadIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setVisible(false); }}
            sx={{ color: 'inherit' }}
            title="Close panel"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider />

        {/* Main content area */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Left sidebar - Script list */}
          <Box
            sx={{
              width: 180,
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ p: 1 }}>
              <Button
                fullWidth
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleNew}
                sx={{ mb: 1 }}
              >
                New Script
              </Button>
            </Box>
            
            <Divider />
            
            <List
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                p: 0,
                '& .MuiListItemButton-root': {
                  py: 1,
                  px: 1.5
                }
              }}
            >
              {scripts.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    No scripts yet
                  </Typography>
                </Box>
              ) : (
                scripts.map((script) => (
                  <ListItemButton
                    key={script.id}
                    selected={script.id === selectedId}
                    onClick={() => setSelectedId(script.id)}
                    sx={{
                      borderLeft: script.id === selectedId ? 3 : 0,
                      borderColor: 'primary.main',
                      '&.Mui-selected': {
                        bgcolor: 'action.selected',
                        '&:hover': {
                          bgcolor: 'action.selected'
                        }
                      }
                    }}
                  >
                    <ListItemText
                      primary={script.name}
                      primaryTypographyProps={{
                        variant: 'body2',
                        noWrap: true,
                        fontWeight: script.id === selectedId ? 600 : 400
                      }}
                      secondary={script.tags ? script.tags.split(',')[0].trim() : null}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        noWrap: true
                      }}
                    />
                  </ListItemButton>
                ))
              )}
            </List>
          </Box>

          {/* Right content area */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedScript ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  Select a script or create a new one
                </Typography>
              </Box>
            ) : (
              <>
                {/* Script metadata */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Script Name"
                    value={selectedScript.name}
                    onChange={(e) => handleUpdateName(e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Tags (comma-separated)"
                    value={selectedScript.tags || ''}
                    onChange={(e) => handleUpdateTags(e.target.value)}
                    placeholder="api, utility, example"
                  />
                </Box>

                {/* Code editor */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    variant="outlined"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Write your script here..."
                    sx={{
                      flexGrow: 1,
                      '& .MuiInputBase-root': {
                        height: '100%',
                        alignItems: 'flex-start',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem'
                      },
                      '& textarea': {
                        height: '100% !important',
                        overflow: 'auto !important'
                      }
                    }}
                  />
                </Box>

                {/* Advanced options */}
                <Box sx={{ px: 2, pb: 1 }}>
                  <Button
                    size="small"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                    sx={{ mb: 1 }}
                  >
                    Advanced Options
                  </Button>
                  <Collapse in={showAdvanced}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={allowMutations}
                            onChange={(e) => setAllowMutations(e.target.checked)}
                          />
                        }
                        label="Allow mutations"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={dryRun}
                            onChange={(e) => setDryRun(e.target.checked)}
                          />
                        }
                        label="Dry run"
                      />
                    </Box>
                  </Collapse>
                </Box>

                {/* Results display */}
                {result && (
                  <Box sx={{ px: 2, pb: 1 }}>
                    <Alert
                      severity={result.success ? 'success' : 'error'}
                      onClose={() => setResult(null)}
                      sx={{ fontSize: '0.875rem' }}
                    >
                      {result.success ? (
                        <>
                          <strong>Success:</strong> {result.message || 'Script executed'}
                          {result.result && (
                            <Box
                              component="pre"
                              sx={{
                                mt: 1,
                                p: 1,
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                overflow: 'auto',
                                maxHeight: 200,
                                fontSize: '0.75rem',
                                fontFamily: 'monospace'
                              }}
                            >
                              {JSON.stringify(result.result, null, 2)}
                            </Box>
                          )}
                        </>
                      ) : (
                        <>
                          <strong>Error:</strong> {result.error}
                        </>
                      )}
                    </Alert>
                  </Box>
                )}

                {/* Proposals */}
                {proposals && proposals.length > 0 && (
                  <Box sx={{ px: 2, pb: 1 }}>
                    <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Script has {proposals.length} proposed change(s):
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleApplyProposals}
                        >
                          Apply Changes
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setProposals(null)}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Alert>
                  </Box>
                )}

                {/* Action buttons */}
                <Box
                  sx={{
                    p: 2,
                    borderTop: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center'
                  }}
                >
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => handleRun()}
                    disabled={running || !source.trim()}
                  >
                    {running ? 'Running...' : 'Run'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={!source.trim()}
                  >
                    Save
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton
                    size="small"
                    onClick={handleDuplicate}
                    title="Duplicate script"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeleteTargetId(selectedId);
                      setDeleteConfirmOpen(true);
                    }}
                    title="Delete script"
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    Ctrl+S: Save | Ctrl+Enter: Run
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* Resize handle */}
        <Box
          onMouseDown={startResize}
          onTouchStart={startResize}
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            bgcolor: 'action.hover',
            borderTopLeftRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
              bgcolor: 'action.selected'
            }
          }}
        >
          <Typography variant="caption" sx={{ fontSize: '0.75rem', userSelect: 'none' }}>
            ⇲
          </Typography>
        </Box>
      </Paper>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Script</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this script? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (deleteTargetId) {
                handleDelete(deleteTargetId);
                setDeleteConfirmOpen(false);
                setDeleteTargetId(null);
              }
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Import Scripts Library</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Paste your scripts library JSON here. This will replace your current library.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={12}
            variant="outlined"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[{"id":"script_1","name":"Example","source":"...","tags":""}]'
            sx={{
              '& textarea': {
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImportLibrary}
            variant="contained"
            disabled={!importText.trim()}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}