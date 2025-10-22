// lib/themes.js
import { createTheme } from '@mui/material/styles';

// ============================================
// CORE THEMES (Light & Dark)
// ============================================

export const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
        secondary: { main: '#dc004e', light: '#ff4081', dark: '#9a0036' },
        background: { default: '#e8eaf6', paper: '#ffffff' },
    },
    textColors: {
        default: '#212121',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#757575',
    },
});

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#90caf9', light: '#b3e5fc', dark: '#6a89cc' },
        secondary: { main: '#f48fb1', light: '#f8bbd0', dark: '#c2185b' },
        background: { default: '#0a0a0a', paper: '#2d2d2d' },
    },
    textColors: {
        default: '#e0e0e0',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#9e9e9e',
    },
});

// ============================================
// NATURE-INSPIRED THEMES
// ============================================

export const forestTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#2e7d32', light: '#60ad5e', dark: '#005005' },
        secondary: { main: '#8d6e63', light: '#be9c91', dark: '#5f4339' },
        background: { default: '#dcedc8', paper: '#f1f8e9' },
    },
    textColors: {
        default: '#1b5e20',
        light: '#ffffff',
        dark: '#004d40',
        contrast: '#ffffff',
        muted: '#66bb6a',
    },
});

export const oceanTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#0288d1', light: '#4fc3f7', dark: '#01579b' },
        secondary: { main: '#00acc1', light: '#4dd0e1', dark: '#006064' },
        background: { default: '#b3e5fc', paper: '#e1f5fe' },
    },
    textColors: {
        default: '#01579b',
        light: '#ffffff',
        dark: '#004d40',
        contrast: '#ffffff',
        muted: '#4fc3f7',
    },
});

export const desertTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#d84315', light: '#ff6f43', dark: '#9f0000' },
        secondary: { main: '#ef6c00', light: '#ff9d3f', dark: '#b53d00' },
        background: { default: '#ffe0b2', paper: '#fff8e1' },
    },
    textColors: {
        default: '#5d4037',
        light: '#ffffff',
        dark: '#3e2723',
        contrast: '#ffffff',
        muted: '#a1887f',
    },
});

export const sakuraTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ec407a', light: '#ff77a9', dark: '#b4004e' },
        secondary: { main: '#ab47bc', light: '#df78ef', dark: '#790e8b' },
        background: { default: '#f8bbd0', paper: '#fce4ec' },
    },
    textColors: {
        default: '#880e4f',
        light: '#ffffff',
        dark: '#4a148c',
        contrast: '#ffffff',
        muted: '#f48fb1',
    },
});

export const arcticTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#0097a7', light: '#56c8d8', dark: '#006978' },
        secondary: { main: '#b2dfdb', light: '#e5ffff', dark: '#82ada9' },
        background: { default: '#b2dfdb', paper: '#e0f2f1' },
    },
    textColors: {
        default: '#004d40',
        light: '#ffffff',
        dark: '#00251a',
        contrast: '#ffffff',
        muted: '#80cbc4',
    },
});

// ============================================
// VIBRANT & ENERGETIC THEMES
// ============================================

export const sunsetTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ff6f00', light: '#ffa040', dark: '#c43e00' },
        secondary: { main: '#f50057', light: '#ff5983', dark: '#bb002f' },
        background: { default: '#ffcc80', paper: '#fff3e0' },
    },
    textColors: {
        default: '#e65100',
        light: '#ffffff',
        dark: '#bf360c',
        contrast: '#ffffff',
        muted: '#ffb74d',
    },
});

export const neonTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#00e676', light: '#66ffa6', dark: '#00b248' },
        secondary: { main: '#ff1744', light: '#ff616f', dark: '#c4001d' },
        background: { default: '#000000', paper: '#1a1a1a' },
    },
    textColors: {
        default: '#00e676',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#69f0ae',
    },
});

export const retroTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ff6f00', light: '#ffa040', dark: '#c43e00' },
        secondary: { main: '#00e5ff', light: '#6effff', dark: '#00b2cc' },
        background: { default: '#fff59d', paper: '#fffde7' },
    },
    textColors: {
        default: '#f57f17',
        light: '#ffffff',
        dark: '#f57c00',
        contrast: '#000000',
        muted: '#ffd54f',
    },
});

export const cyberpunkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#ff0266', light: '#ff5c8d', dark: '#c4003f' },
        secondary: { main: '#00e5ff', light: '#6effff', dark: '#00b2cc' },
        background: { default: '#0d0221', paper: '#1f0a3d' },
    },
    textColors: {
        default: '#ff0266',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#ff5c8d',
    },
});

export const tropicalTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#00bfa5', light: '#5df2d6', dark: '#008e76' },
        secondary: { main: '#ffab00', light: '#ffdd4b', dark: '#c67c00' },
        background: { default: '#a7ffeb', paper: '#e0f2f1' },
    },
    textColors: {
        default: '#00695c',
        light: '#ffffff',
        dark: '#003d33',
        contrast: '#ffffff',
        muted: '#4db6ac',
    },
});

// ============================================
// SOPHISTICATED & ELEGANT THEMES
// ============================================

export const midnightTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#3949ab', light: '#6f74dd', dark: '#00227b' },
        secondary: { main: '#5e35b1', light: '#9162e4', dark: '#280680' },
        background: { default: '#0a0e27', paper: '#1a1f3a' },
    },
    textColors: {
        default: '#9fa8da',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#7986cb',
    },
});

export const royalTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#512da8', light: '#8559da', dark: '#140078' },
        secondary: { main: '#c2185b', light: '#fa5788', dark: '#8c0032' },
        background: { default: '#d1c4e9', paper: '#f3e5f5' },
    },
    textColors: {
        default: '#4a148c',
        light: '#ffffff',
        dark: '#311b92',
        contrast: '#ffffff',
        muted: '#9575cd',
    },
});

export const charcoalTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#546e7a', light: '#819ca9', dark: '#29434e' },
        secondary: { main: '#78909c', light: '#a7c0cd', dark: '#4b636e' },
        background: { default: '#1c1c1c', paper: '#353535' },
    },
    textColors: {
        default: '#cfd8dc',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#90a4ae',
    },
});

export const champagneTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#9c7a3c', light: '#d1a866', dark: '#6a4f1b' },
        secondary: { main: '#8d6e63', light: '#be9c91', dark: '#5f4339' },
        background: { default: '#e8d7b0', paper: '#f5f5dc' },
    },
    textColors: {
        default: '#4e342e',
        light: '#ffffff',
        dark: '#3e2723',
        contrast: '#ffffff',
        muted: '#a1887f',
    },
});

export const slateTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#607d8b', light: '#8eacbb', dark: '#34515e' },
        secondary: { main: '#78909c', light: '#a7c0cd', dark: '#4b636e' },
        background: { default: '#263238', paper: '#455a64' },
    },
    textColors: {
        default: '#cfd8dc',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#90a4ae',
    },
});

// ============================================
// WARM & COZY THEMES
// ============================================

export const autumnTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#bf360c', light: '#f9683a', dark: '#870000' },
        secondary: { main: '#ff6f00', light: '#ffa040', dark: '#c43e00' },
        background: { default: '#ffccbc', paper: '#fff3e0' },
    },
    textColors: {
        default: '#bf360c',
        light: '#ffffff',
        dark: '#870000',
        contrast: '#ffffff',
        muted: '#ff8a65',
    },
});

export const cafeTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#6d4c41', light: '#9c786c', dark: '#40241a' },
        secondary: { main: '#d7ccc8', light: '#ffffff', dark: '#a69b97' },
        background: { default: '#d7ccc8', paper: '#efebe9' },
    },
    textColors: {
        default: '#3e2723',
        light: '#ffffff',
        dark: '#1b0000',
        contrast: '#ffffff',
        muted: '#8d6e63',
    },
});

export const amberTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#ff8f00', light: '#ffc046', dark: '#c56000' },
        secondary: { main: '#ffb300', light: '#ffe54c', dark: '#c68400' },
        background: { default: '#ffecb3', paper: '#fff8e1' },
    },
    textColors: {
        default: '#ff6f00',
        light: '#ffffff',
        dark: '#c43e00',
        contrast: '#000000',
        muted: '#ffb74d',
    },
});

export const terracottaTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#d84315', light: '#ff6f43', dark: '#9f0000' },
        secondary: { main: '#8d6e63', light: '#be9c91', dark: '#5f4339' },
        background: { default: '#ffccbc', paper: '#fbe9e7' },
    },
    textColors: {
        default: '#bf360c',
        light: '#ffffff',
        dark: '#870000',
        contrast: '#ffffff',
        muted: '#ff8a65',
    },
});

// ============================================
// COOL & CALMING THEMES
// ============================================

export const mintTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#00897b', light: '#4ebaaa', dark: '#005b4f' },
        secondary: { main: '#26a69a', light: '#64d8cb', dark: '#00766c' },
        background: { default: '#b2dfdb', paper: '#e0f2f1' },
    },
    textColors: {
        default: '#004d40',
        light: '#ffffff',
        dark: '#00251a',
        contrast: '#ffffff',
        muted: '#4db6ac',
    },
});

export const lavenderTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#7e57c2', light: '#b085f5', dark: '#4d2c91' },
        secondary: { main: '#ba68c8', light: '#ee98fb', dark: '#883997' },
        background: { default: '#d1c4e9', paper: '#f3e5f5' },
    },
    textColors: {
        default: '#6a1b9a',
        light: '#ffffff',
        dark: '#4a148c',
        contrast: '#ffffff',
        muted: '#9575cd',
    },
});

export const mistTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#90a4ae', light: '#c1d5e0', dark: '#62757f' },
        secondary: { main: '#b0bec5', light: '#e2f1f8', dark: '#808e95' },
        background: { default: '#cfd8dc', paper: '#eceff1' },
    },
    textColors: {
        default: '#546e7a',
        light: '#ffffff',
        dark: '#263238',
        contrast: '#ffffff',
        muted: '#78909c',
    },
});

export const glacierTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#0288d1', light: '#4fc3f7', dark: '#01579b' },
        secondary: { main: '#81d4fa', light: '#b6ffff', dark: '#4ba3c7' },
        background: { default: '#b3e5fc', paper: '#e1f5fe' },
    },
    textColors: {
        default: '#01579b',
        light: '#ffffff',
        dark: '#002f6c',
        contrast: '#ffffff',
        muted: '#4fc3f7',
    },
});

// ============================================
// DRAMATIC & BOLD THEMES
// ============================================

export const volcanoTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#d32f2f', light: '#ff6659', dark: '#9a0007' },
        secondary: { main: '#ff6f00', light: '#ffa040', dark: '#c43e00' },
        background: { default: '#1a0000', paper: '#3d0a0a' },
    },
    textColors: {
        default: '#ff6659',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#ef5350',
    },
});

export const deepSpaceTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#5e35b1', light: '#9162e4', dark: '#280680' },
        secondary: { main: '#00bcd4', light: '#62efff', dark: '#008ba3' },
        background: { default: '#0a0014', paper: '#1f0d33' },
    },
    textColors: {
        default: '#b39ddb',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#9575cd',
    },
});

export const emeraldTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#00695c', light: '#439889', dark: '#003d33' },
        secondary: { main: '#00897b', light: '#4ebaaa', dark: '#005b4f' },
        background: { default: '#a7ffeb', paper: '#e0f2f1' },
    },
    textColors: {
        default: '#004d40',
        light: '#ffffff',
        dark: '#00251a',
        contrast: '#ffffff',
        muted: '#26a69a',
    },
});

export const crimsonTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#c62828', light: '#ff5f52', dark: '#8e0000' },
        secondary: { main: '#f44336', light: '#ff7961', dark: '#ba000d' },
        background: { default: '#1a0505', paper: '#3d1515' },
    },
    textColors: {
        default: '#ef5350',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#e57373',
    },
});

// ============================================
// THEME MAP & EXPORTS
// ============================================

export const themeMap = {
    // Core
    default: lightTheme,
    light: lightTheme,
    dark: darkTheme,
    
    // Nature
    forest: forestTheme,
    ocean: oceanTheme,
    desert: desertTheme,
    sakura: sakuraTheme,
    arctic: arcticTheme,
    
    // Vibrant
    sunset: sunsetTheme,
    neon: neonTheme,
    retro: retroTheme,
    cyberpunk: cyberpunkTheme,
    tropical: tropicalTheme,
    
    // Sophisticated
    midnight: midnightTheme,
    royal: royalTheme,
    charcoal: charcoalTheme,
    champagne: champagneTheme,
    slate: slateTheme,
    
    // Warm
    autumn: autumnTheme,
    cafe: cafeTheme,
    amber: amberTheme,
    terracotta: terracottaTheme,
    
    // Cool
    mint: mintTheme,
    lavender: lavenderTheme,
    mist: mistTheme,
    glacier: glacierTheme,
    
    // Bold
    volcano: volcanoTheme,
    deepSpace: deepSpaceTheme,
    emerald: emeraldTheme,
    crimson: crimsonTheme,
};

export default themeMap;
export const themeNames = Object.keys(themeMap);

// Theme categories for organized UI
export const themeCategories = {
    'Core': ['light', 'dark'],
    'Nature': ['forest', 'ocean', 'desert', 'sakura', 'arctic'],
    'Vibrant': ['sunset', 'neon', 'retro', 'cyberpunk', 'tropical'],
    'Sophisticated': ['midnight', 'royal', 'charcoal', 'champagne', 'slate'],
    'Warm': ['autumn', 'cafe', 'amber', 'terracotta'],
    'Cool': ['mint', 'lavender', 'mist', 'glacier'],
    'Bold': ['volcano', 'deepSpace', 'emerald', 'crimson'],
};