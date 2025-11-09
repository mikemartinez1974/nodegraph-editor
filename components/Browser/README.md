# Header components

## Overview

This folder contains the top-level header and theme controls for the NodeGraph editor. It provides the application header bar, a theme selector group, and a theme drawer for advanced theme settings.

## Files

- `Header.js` — The main header bar component. Typically contains the app title, primary actions, and theme controls.
- `ThemeButtonGroup.js` — Compact button group for switching between predefined themes (light/dark/custom). Use for quick theme toggles.
- `ThemeDrawer.js` — Drawer UI that exposes advanced theme settings and preferences. Can be used to adjust palette colors, toggles, and persist theme choices.
- `themes.js` — Defines available theme presets and utilities for creating MUI theme objects.

## Usage

- Import `Header.js` into your app layout and place it at the top of the page. The header reads and mutates theme via context or props depending on your app setup.
- `ThemeButtonGroup` exposes simple callbacks (`onChange`) to switch theme presets.
- `ThemeDrawer` can be toggled from `Header` and provides finer-grained theme customization.

## Extension points

- Add new theme presets in `themes.js` and wire them into `ThemeButtonGroup`.
- Persist theme changes to `localStorage` or user settings in `settingsManager`.
- Add accessibility attributes and keyboard shortcuts to Header controls.

## Notes

- Keep MUI theme creation centralized in `themes.js` to ensure consistent palette and typography across the app.
- When adding new controls to the header, use small, focused components and register actions via the GraphEditor `eventBus` where appropriate.

