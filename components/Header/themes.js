// lib/themes.js
import { createTheme } from '@mui/material/styles';

// Original 4
export const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
        secondary: { main: '#dc004e', light: '#ff4081', dark: '#9a0036' },
        background: { default: '#f4f4f4', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#90caf9', light: '#b3e5fc', dark: '#6a89cc' },
        secondary: { main: '#f48fb1', light: '#f8bbd0', dark: '#c2185b' },
        background: { default: '#121212', paper: '#1e1e1e' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const oceanTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#0077be', light: '#4eb3ff', dark: '#005b8e' },
        secondary: { main: '#00a86b', light: '#33cc7f', dark: '#007f50' },
        background: { default: '#e6f2ff', paper: '#f0f8ff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const sunsetTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ff6b6b', light: '#ff9f9f', dark: '#c25e5e' },
        secondary: { main: '#4ecdc4', light: '#7fded6', dark: '#3aa093' },
        background: { default: '#fff5e6', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

// The 25 extra themes
export const forestTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#2e7d32', light: '#60ad5e', dark: '#005005' },
        secondary: { main: '#8d6e63', light: '#be9c91', dark: '#5f4339' },
        background: { default: '#f1f8e9', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const lavenderTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#7e57c2', light: '#b085f5', dark: '#4d2c91' },
        secondary: { main: '#f06292', light: '#f48fb1', dark: '#ab47bc' },
        background: { default: '#f3e5f5', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const midnightTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#0d47a1', light: '#5472d3', dark: '#002171' },
        secondary: { main: '#ff7043', light: '#ffa270', dark: '#c63f17' },
        background: { default: '#0a0a0a', paper: '#1a1a1a' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const coffeeTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#6d4c41', light: '#9c786c', dark: '#40241a' },
        secondary: { main: '#d7ccc8', light: '#ffffff', dark: '#a69b97' },
        background: { default: '#efebe9', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const desertTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#d2691e', light: '#ff9f67', dark: '#9a3f00' },
        secondary: { main: '#cdb79e', light: '#fff0db', dark: '#9d8a73' },
        background: { default: '#faf0e6', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const emeraldTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#2ecc71', light: '#6dff9f', dark: '#009f42' },
        secondary: { main: '#27ae60', light: '#5dffa1', dark: '#006f34' },
        background: { default: '#eafaf1', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const rubyTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#c2185b', light: '#fa5788', dark: '#8c0032' },
        secondary: { main: '#f57c00', light: '#ffad42', dark: '#bb4d00' },
        background: { default: '#fff0f3', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const sapphireTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#1565c0', light: '#5e92f3', dark: '#003c8f' },
        secondary: { main: '#ffca28', light: '#fff350', dark: '#c79a00' },
        background: { default: '#e3f2fd', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const neonTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#00ffcc', light: '#66ffe0', dark: '#00bfa5' },
        secondary: { main: '#ff00ff', light: '#ff66ff', dark: '#c600c7' },
        background: { default: '#000000', paper: '#121212' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const retroTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ff9800', light: '#ffc947', dark: '#c66900' },
        secondary: { main: '#8bc34a', light: '#bef67a', dark: '#5a9216' },
        background: { default: '#fffde7', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const cyberpunkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#ff0099', light: '#ff66cc', dark: '#b0006d' },
        secondary: { main: '#00e5ff', light: '#6effff', dark: '#00b2cc' },
        background: { default: '#0d0d0d', paper: '#1a1a1a' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const vintageTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#795548', light: '#a98274', dark: '#4b2c20' },
        secondary: { main: '#d4af37', light: '#ffdf6e', dark: '#a17f00' },
        background: { default: '#faf3e0', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const arcticTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#00bcd4', light: '#62efff', dark: '#008ba3' },
        secondary: { main: '#e1f5fe', light: '#ffffff', dark: '#b3e5fc' },
        background: { default: '#f0faff', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const flameTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#e53935', light: '#ff6f60', dark: '#ab000d' },
        secondary: { main: '#ffb300', light: '#ffe54c', dark: '#c68400' },
        background: { default: '#1c0b0b', paper: '#2c1818' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const iceTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#81d4fa', light: '#b6ffff', dark: '#4ba3c7' },
        secondary: { main: '#cfd8dc', light: '#ffffff', dark: '#9ea7aa' },
        background: { default: '#e0f7fa', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const roseGoldTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#b76e79', light: '#e89ca5', dark: '#83434f' },
        secondary: { main: '#ffd1dc', light: '#ffffff', dark: '#caa0ad' },
        background: { default: '#fff0f5', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const noirTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#212121', light: '#484848', dark: '#000000' },
        secondary: { main: '#e0e0e0', light: '#ffffff', dark: '#aeaeae' },
        background: { default: '#121212', paper: '#1e1e1e' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const jungleTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#388e3c', light: '#66bb6a', dark: '#00600f' },
        secondary: { main: '#ffeb3b', light: '#ffff72', dark: '#c8b900' },
        background: { default: '#e8f5e9', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const coralReefTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ff7043', light: '#ffa270', dark: '#c63f17' },
        secondary: { main: '#26c6da', light: '#6ff9ff', dark: '#0095a8' },
        background: { default: '#fff3e0', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const twilightTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#512da8', light: '#8559da', dark: '#140078' },
        secondary: { main: '#ff4081', light: '#ff79b0', dark: '#c60055' },
        background: { default: '#1a0033', paper: '#2a003f' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const peachTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ffab91', light: '#ffddc1', dark: '#c97b63' },
        secondary: { main: '#f48fb1', light: '#ffc1e3', dark: '#bf5f82' },
        background: { default: '#fff8f6', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const steelTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#607d8b', light: '#8eacbb', dark: '#34515e' },
        secondary: { main: '#cfd8dc', light: '#ffffff', dark: '#9ea7aa' },
        background: { default: '#1c1c1c', paper: '#2a2a2a' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const sunriseTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ffb74d', light: '#ffe97d', dark: '#c88719' },
        secondary: { main: '#e57373', light: '#ffa4a2', dark: '#af4448' },
        background: { default: '#fff9e6', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const galaxyTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#7e57c2', light: '#b085f5', dark: '#4d2c91' },
        secondary: { main: '#26c6da', light: '#6ff9ff', dark: '#0095a8' },
        background: { default: '#0d0221', paper: '#1a0933' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

export const candyTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ff69b4', light: '#ff9fd4', dark: '#c2185b' },
        secondary: { main: '#87ceeb', light: '#b5ffff', dark: '#4aa3c7' },
        background: { default: '#fff0f7', paper: '#ffffff' },
    },
    textColors: {
        default: '#222',
        light: '#fff',
        dark: '#111',
        contrast: '#fff',
        muted: '#888',
    },
});

// Theme map (export this and import where you need it)
export const themeMap = {
    default: lightTheme, // default points to light
    light: lightTheme,
    dark: darkTheme,
    ocean: oceanTheme,
    sunset: sunsetTheme,

    forest: forestTheme,
    lavender: lavenderTheme,
    midnight: midnightTheme,
    coffee: coffeeTheme,
    desert: desertTheme,
    emerald: emeraldTheme,
    ruby: rubyTheme,
    sapphire: sapphireTheme,
    neon: neonTheme,
    retro: retroTheme,
    cyberpunk: cyberpunkTheme,
    vintage: vintageTheme,
    arctic: arcticTheme,
    flame: flameTheme,
    ice: iceTheme,
    roseGold: roseGoldTheme,
    noir: noirTheme,
    jungle: jungleTheme,
    coralReef: coralReefTheme,
    twilight: twilightTheme,
    peach: peachTheme,
    steel: steelTheme,
    sunrise: sunriseTheme,
    galaxy: galaxyTheme,
    candy: candyTheme,
};

export default themeMap;
export const themeNames = Object.keys(themeMap); // handy list
