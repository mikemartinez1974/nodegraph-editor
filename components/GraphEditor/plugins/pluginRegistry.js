// components/GraphEditor/plugins/pluginRegistry.js
// Lightweight plugin registry (Phase 1) - manages manifest installation/persistence.

import validatePluginManifest from './manifestSchema';

const STORAGE_KEY = 'nodegraph.plugins.registry';

const nowIso = () => new Date().toISOString();

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readRegistry = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
};

const writeRegistry = (entries) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[PluginRegistry] Failed to persist registry:', err);
  }
};

const listeners = new Set();

const notifyListeners = () => {
  const snapshot = readRegistry();
  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (err) {
      console.warn('[PluginRegistry] Listener error', err);
    }
  });
};

const sanitizeRecord = (manifest, manifestUrl) => ({
  id: manifest.id,
  manifestUrl,
  installedAt: nowIso(),
  updatedAt: nowIso(),
  enabled: true,
  version: manifest.version,
  permissions: manifest.permissions || [],
  bundle: manifest.bundle,
  nodes: manifest.nodes || [],
  panels: manifest.panels || [],
  metadata: manifest.metadata || {},
  manifest
});

export async function fetchManifest(manifestUrl) {
  if (typeof fetch === 'undefined') {
    throw new Error('fetch is not available in this environment');
  }
  const rawUrl = manifestUrl.trim();
  if (!rawUrl) {
    throw new Error('Manifest URL is required');
  }
  let resolvedUrl = rawUrl;
  if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
    if (typeof window !== 'undefined' && window.location) {
      resolvedUrl = new URL(resolvedUrl, window.location.origin).toString();
    } else {
      throw new Error('Manifest URL must use http or https');
    }
  }
  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest (${response.status})`);
  }
  const data = await response.json();
  return { data, manifestUrl: resolvedUrl };
}

export function getInstalledPlugins() {
  return readRegistry();
}

export function getPluginById(pluginId) {
  const entries = readRegistry();
  return entries.find((entry) => entry.id === pluginId) || null;
}

export function setPluginEnabled(pluginId, enabled) {
  const entries = readRegistry();
  const idx = entries.findIndex((entry) => entry.id === pluginId);
  if (idx === -1) {
    return { success: false, error: 'Plugin not found' };
  }
  entries[idx] = { ...entries[idx], enabled: Boolean(enabled), updatedAt: nowIso() };
  writeRegistry(entries);
  notifyListeners();
  return { success: true, data: entries[idx] };
}

export function uninstallPlugin(pluginId) {
  const entries = readRegistry();
  const next = entries.filter((entry) => entry.id !== pluginId);
  if (next.length === entries.length) {
    return { success: false, error: 'Plugin not found' };
  }
  writeRegistry(next);
  notifyListeners();
  return { success: true };
}

export async function installPluginFromUrl(manifestUrl) {
  try {
    const { data, manifestUrl: resolvedUrl } = await fetchManifest(manifestUrl);
    const { valid, errors, manifest } = validatePluginManifest(data);
    if (!valid) {
      return { success: false, error: errors.join('; ') };
    }
    const entries = readRegistry();
    const existingIndex = entries.findIndex((entry) => entry.id === manifest.id);
    const record = sanitizeRecord(manifest, resolvedUrl);
    if (existingIndex >= 0) {
      entries[existingIndex] = { ...entries[existingIndex], ...record };
    } else {
      entries.push(record);
    }
    writeRegistry(entries);
    notifyListeners();
    return { success: true, data: record };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function installManifestObject(manifest, manifestUrl = '') {
  const { valid, errors, manifest: normalized } = validatePluginManifest(manifest);
  if (!valid) {
    return { success: false, error: errors.join('; ') };
  }
  const entries = readRegistry();
  const record = sanitizeRecord(normalized, manifestUrl);
  const existingIndex = entries.findIndex((entry) => entry.id === normalized.id);
  if (existingIndex >= 0) {
    entries[existingIndex] = { ...entries[existingIndex], ...record };
  } else {
    entries.push(record);
  }
  writeRegistry(entries);
  notifyListeners();
  return { success: true, data: record };
}

export function clearRegistry() {
  writeRegistry([]);
  notifyListeners();
}

export function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  callback(readRegistry());
  return () => listeners.delete(callback);
}

export default {
  installPluginFromUrl,
  installManifestObject,
  getInstalledPlugins,
  getPluginById,
  setPluginEnabled,
  uninstallPlugin,
  clearRegistry,
  subscribe
};
