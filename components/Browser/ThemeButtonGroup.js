import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { themeCategories, themeMap } from './themes';

const formatThemeLabel = (name) => name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const getThemeSwatch = (name) => themeMap[name]?.palette?.primary?.main || '#888';

const getThemeTextColor = (name, swatch) => {
  const palette = themeMap[name]?.palette;
  if (palette?.getContrastText) {
    return palette.getContrastText(swatch);
  }
  return palette?.mode === 'dark' ? '#fff' : '#000';
};

export default function ThemeButtonGroup({ themeName, setThemeName }) {
  return (
    <Box sx={{ my: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(themeCategories).map(([category, themeNames]) => (
        <Box key={category}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
            {category}
          </Typography>
          <ButtonGroup variant="contained" size="small" sx={{ mt: 1, flexWrap: 'wrap' }}>
            {themeNames.map((name) => {
              const swatch = getThemeSwatch(name);
              const textColor = getThemeTextColor(name, swatch);
              const isActive = themeName === name;
              return (
                <Button
                  key={name}
                  onClick={() => setThemeName(name)}
                  sx={{
                    backgroundColor: swatch,
                    color: textColor,
                    textTransform: 'none',
                    border: isActive ? '2px solid #fff' : '1px solid transparent',
                    '&:hover': { backgroundColor: swatch, opacity: 0.9 }
                  }}
                >
                  {formatThemeLabel(name)}
                </Button>
              );
            })}
          </ButtonGroup>
        </Box>
      ))}
    </Box>
  );
}
