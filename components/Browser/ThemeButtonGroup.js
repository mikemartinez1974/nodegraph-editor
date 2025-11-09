import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

const themeOptions = [
  { name: 'dark', color: '#222' },
  { name: 'blue', color: '#2196f3' },
  { name: 'green', color: '#4caf50' }
];

export default function ThemeButtonGroup({ themeName, setThemeName }) {
  return (
    <Box sx={{ my: 2 }}>
      <ButtonGroup variant="contained">
        {themeOptions.map(option => (
          <Button
            key={option.name}
            onClick={() => setThemeName(option.name)}
            style={{ background: option.color, border: themeName === option.name ? '2px solid #fff' : undefined }}
          >
            {option.name.charAt(0).toUpperCase() + option.name.slice(1)}
          </Button>
        ))}
      </ButtonGroup>
    </Box>
  );
}
