// TemplateGallery.js
"use client";

import { useMemo, useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import LaunchIcon from '@mui/icons-material/Launch';
import LockIcon from '@mui/icons-material/Lock';
import TagIcon from '@mui/icons-material/Tag';

import { TEMPLATE_GALLERY, TEMPLATE_TAGS } from './templateGalleryData';

const getTemplateUrl = (href) => {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (typeof window === 'undefined') return href;
  const url = new URL(href, window.location.origin);
  // Force https for non-local hosts to avoid mixed content warnings
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    url.protocol = 'https:';
  }
  return url.toString();
};

const matchesQuery = (template, query) => {
  if (!query) return true;
  const safeQuery = query.trim().toLowerCase();
  if (!safeQuery) return true;
  const haystack = [
    template.title,
    template.description,
    template.publisher,
    ...(template.tags || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(safeQuery);
};

export default function TemplateGallery({ open, onClose, onSelect }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);

  // Reset filters every time the dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
      setActiveTag(null);
    }
  }, [open]);

  const filteredTemplates = useMemo(() => {
    return TEMPLATE_GALLERY.filter((template) => {
      const byTag = !activeTag || (template.tags || []).includes(activeTag);
      const byQuery = matchesQuery(template, search);
      return byTag && byQuery;
    });
  }, [search, activeTag]);

  const handleLaunch = (template) => {
    if (!template) return;
    const url = getTemplateUrl(template.href);
    if (onSelect) onSelect({
      ...template,
      resolvedUrl: url
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6">Template Gallery</Typography>
          <Typography variant="body2" color="text.secondary">
            Curated starter graphs hosted over TLS so you can launch safely in one click.
          </Typography>
        </Box>
        <IconButton aria-label="Close gallery" onClick={onClose} sx={{ ml: 1 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ backgroundColor: theme.palette.mode === 'dark' ? 'background.default' : '#f7f9fc' }}>
        <Stack spacing={3}>
          <Box>
            <TextField
              autoFocus={!fullScreen}
              placeholder="Search templates by name, tag, or publisher..."
              variant="outlined"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                )
              }}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 2 }}>
              <Chip
                label="All templates"
                icon={<TagIcon />}
                onClick={() => setActiveTag(null)}
                color={activeTag ? 'default' : 'primary'}
                variant={activeTag ? 'outlined' : 'filled'}
                clickable
              />
              {TEMPLATE_TAGS.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                  color={activeTag === tag ? 'primary' : 'default'}
                  variant={activeTag === tag ? 'filled' : 'outlined'}
                  clickable
                />
              ))}
            </Box>
          </Box>

          <Divider flexItem />

          {filteredTemplates.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
                textAlign: 'center'
              }}
            >
              <Typography variant="h6" gutterBottom>
                No templates found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try a different search term or clear your filters to explore the full gallery.
              </Typography>
              <Button
                sx={{ mt: 3 }}
                variant="text"
                onClick={() => {
                  setSearch('');
                  setActiveTag(null);
                }}
              >
                Reset Filters
              </Button>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {filteredTemplates.map((template) => {
                const secure = template.href && template.href.startsWith('https://');
                return (
                  <Grid item xs={12} sm={6} md={4} key={template.id}>
                    <Card
                      elevation={3}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 2,
                        overflow: 'hidden'
                      }}
                    >
                      {template.preview ? (
                        <CardMedia
                          component="img"
                          alt={`${template.title} preview`}
                          height="160"
                          image={template.preview}
                          sx={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <Box
                          sx={{
                            height: 160,
                            background: `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`
                          }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                          <Typography variant="subtitle1" component="div">
                            {template.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {template.description}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {template.tags?.slice(0, 3).map((tag) => (
                            <Chip key={tag} label={tag} size="small" />
                          ))}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {template.publisher} • {template.estimatedTime}
                        </Typography>
                      </CardContent>
                      <CardActions
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 2,
                          pb: 2
                        }}
                      >
                        <Tooltip title={secure ? 'Served over TLS' : 'Will be upgraded to HTTPS at load time'}>
                          <Chip
                            icon={<LockIcon fontSize="small" />}
                            label={secure ? 'TLS ready' : 'HTTPS upgrade'}
                            size="small"
                            color={secure ? 'success' : 'default'}
                            variant={secure ? 'filled' : 'outlined'}
                          />
                        </Tooltip>
                        <Button
                          variant="contained"
                          endIcon={<LaunchIcon />}
                          onClick={() => handleLaunch(template)}
                          aria-label={`Launch ${template.title}`}
                        >
                          Use template
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
