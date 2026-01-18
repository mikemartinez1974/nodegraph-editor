// lib/themes.js
import { createTheme } from '@mui/material/styles';

// ============================================
// MATCHED LIGHT/DARK THEME PAIRS (10 total)
// ============================================

export const auroraLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#2e7d32', light: '#60ad5e', dark: '#005005' },
        secondary: { main: '#00897b', light: '#4ebaaa', dark: '#005b4f' },
        background: { default: '#e8f5e9', paper: '#ffffff' },
    },
    textColors: {
        default: '#1b5e20',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#4caf50',
    },
});

export const auroraDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#66bb6a', light: '#98ee99', dark: '#338a3e' },
        secondary: { main: '#26a69a', light: '#64d8cb', dark: '#00766c' },
        background: { default: '#0b1f14', paper: '#13261a' },
    },
    textColors: {
        default: '#b9f6ca',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#81c784',
    },
});

export const emberLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#bf360c', light: '#f9683a', dark: '#870000' },
        secondary: { main: '#ff6f00', light: '#ffa040', dark: '#c43e00' },
        background: { default: '#fff3e0', paper: '#ffffff' },
    },
    textColors: {
        default: '#4e342e',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#ff8a65',
    },
});

export const emberDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#ff7043', light: '#ffa270', dark: '#c63f17' },
        secondary: { main: '#ffa726', light: '#ffd95b', dark: '#c77800' },
        background: { default: '#1b0f0a', paper: '#2a1610' },
    },
    textColors: {
        default: '#ffccbc',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#ffab91',
    },
});

export const tideLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#0277bd', light: '#58a5f0', dark: '#004c8c' },
        secondary: { main: '#00acc1', light: '#5ddef4', dark: '#007c91' },
        background: { default: '#e1f5fe', paper: '#ffffff' },
    },
    textColors: {
        default: '#01579b',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#4fc3f7',
    },
});

export const tideDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#4fc3f7', light: '#8bf6ff', dark: '#0093c4' },
        secondary: { main: '#26c6da', light: '#6ff9ff', dark: '#0095a8' },
        background: { default: '#08131b', paper: '#0f1d29' },
    },
    textColors: {
        default: '#b3e5fc',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#81d4fa',
    },
});

export const orchardLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#6a1b9a', light: '#9c4dcc', dark: '#38006b' },
        secondary: { main: '#ab47bc', light: '#df78ef', dark: '#790e8b' },
        background: { default: '#f3e5f5', paper: '#ffffff' },
    },
    textColors: {
        default: '#4a148c',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#ba68c8',
    },
});

export const orchardDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#ce93d8', light: '#ffc4ff', dark: '#9c64a6' },
        secondary: { main: '#f48fb1', light: '#ffc1e3', dark: '#bf5f82' },
        background: { default: '#150f1b', paper: '#211226' },
    },
    textColors: {
        default: '#f3e5f5',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#e1bee7',
    },
});

export const canyonLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#8d6e63', light: '#be9c91', dark: '#5f4339' },
        secondary: { main: '#ff8f00', light: '#ffc046', dark: '#c56000' },
        background: { default: '#efebe9', paper: '#ffffff' },
    },
    textColors: {
        default: '#4e342e',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#a1887f',
    },
});

export const canyonDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#a1887f', light: '#d3b8ae', dark: '#725b53' },
        secondary: { main: '#ffb74d', light: '#ffe97d', dark: '#c88719' },
        background: { default: '#1a1411', paper: '#241b16' },
    },
    textColors: {
        default: '#d7ccc8',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#bcaaa4',
    },
});

export const frostLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#546e7a', light: '#819ca9', dark: '#29434e' },
        secondary: { main: '#90a4ae', light: '#c1d5e0', dark: '#62757f' },
        background: { default: '#eceff1', paper: '#ffffff' },
    },
    textColors: {
        default: '#263238',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#78909c',
    },
});

export const frostDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#90a4ae', light: '#c1d5e0', dark: '#62757f' },
        secondary: { main: '#b0bec5', light: '#e2f1f8', dark: '#808e95' },
        background: { default: '#0f1416', paper: '#1a2226' },
    },
    textColors: {
        default: '#cfd8dc',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#b0bec5',
    },
});

export const meadowLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#7cb342', light: '#aee571', dark: '#4b830d' },
        secondary: { main: '#c0ca33', light: '#f4ff67', dark: '#8c9900' },
        background: { default: '#f1f8e9', paper: '#ffffff' },
    },
    textColors: {
        default: '#33691e',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#9ccc65',
    },
});

export const meadowDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#aed581', light: '#e1ffb1', dark: '#7da453' },
        secondary: { main: '#dce775', light: '#ffffa6', dark: '#aab54a' },
        background: { default: '#121a0f', paper: '#1d2615' },
    },
    textColors: {
        default: '#e6ee9c',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#c5e1a5',
    },
});

export const harborLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#006064', light: '#428e92', dark: '#00363a' },
        secondary: { main: '#00838f', light: '#4fb3bf', dark: '#005662' },
        background: { default: '#e0f7fa', paper: '#ffffff' },
    },
    textColors: {
        default: '#004d40',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#4db6ac',
    },
});

export const harborDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#26a69a', light: '#64d8cb', dark: '#00766c' },
        secondary: { main: '#4dd0e1', light: '#88ffff', dark: '#009faf' },
        background: { default: '#0b1416', paper: '#132025' },
    },
    textColors: {
        default: '#b2dfdb',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#80cbc4',
    },
});

export const duskLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#3949ab', light: '#6f74dd', dark: '#00227b' },
        secondary: { main: '#5c6bc0', light: '#8e99f3', dark: '#26418f' },
        background: { default: '#e8eaf6', paper: '#ffffff' },
    },
    textColors: {
        default: '#1a237e',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#7986cb',
    },
});

export const duskDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#9fa8da', light: '#d1d9ff', dark: '#6f79a8' },
        secondary: { main: '#b39ddb', light: '#e6ceff', dark: '#836fa9' },
        background: { default: '#0d0f1b', paper: '#181c2a' },
    },
    textColors: {
        default: '#c5cae9',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#9fa8da',
    },
});

export const citrusLightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#f9a825', light: '#ffd95a', dark: '#c17900' },
        secondary: { main: '#f4511e', light: '#ff844c', dark: '#b91400' },
        background: { default: '#fff8e1', paper: '#ffffff' },
    },
    textColors: {
        default: '#e65100',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#ffffff',
        muted: '#ffb74d',
    },
});

export const citrusDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#ffd54f', light: '#ffff81', dark: '#c8a415' },
        secondary: { main: '#ff8a65', light: '#ffbb93', dark: '#c75b39' },
        background: { default: '#1a1206', paper: '#251a0b' },
    },
    textColors: {
        default: '#ffe0b2',
        light: '#ffffff',
        dark: '#000000',
        contrast: '#000000',
        muted: '#ffcc80',
    },
});

// ============================================
// THEME MAP & EXPORTS
// ============================================

export const themeMap = {
    default: auroraLightTheme,
    light: auroraLightTheme,
    dark: auroraDarkTheme,
    auroraLight: auroraLightTheme,
    auroraDark: auroraDarkTheme,
    emberLight: emberLightTheme,
    emberDark: emberDarkTheme,
    tideLight: tideLightTheme,
    tideDark: tideDarkTheme,
    orchardLight: orchardLightTheme,
    orchardDark: orchardDarkTheme,
    canyonLight: canyonLightTheme,
    canyonDark: canyonDarkTheme,
    frostLight: frostLightTheme,
    frostDark: frostDarkTheme,
    meadowLight: meadowLightTheme,
    meadowDark: meadowDarkTheme,
    harborLight: harborLightTheme,
    harborDark: harborDarkTheme,
    duskLight: duskLightTheme,
    duskDark: duskDarkTheme,
    citrusLight: citrusLightTheme,
    citrusDark: citrusDarkTheme,
};

export default themeMap;
export const themeNames = Object.keys(themeMap);

// Theme categories for organized UI
export const themeCategories = {
    'Aurora': ['auroraLight', 'auroraDark'],
    'Ember': ['emberLight', 'emberDark'],
    'Tide': ['tideLight', 'tideDark'],
    'Orchard': ['orchardLight', 'orchardDark'],
    'Canyon': ['canyonLight', 'canyonDark'],
    'Frost': ['frostLight', 'frostDark'],
    'Meadow': ['meadowLight', 'meadowDark'],
    'Harbor': ['harborLight', 'harborDark'],
    'Dusk': ['duskLight', 'duskDark'],
    'Citrus': ['citrusLight', 'citrusDark'],
};
