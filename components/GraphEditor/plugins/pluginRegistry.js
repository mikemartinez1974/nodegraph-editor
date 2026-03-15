// components/GraphEditor/plugins/pluginRegistry.js
// Lightweight plugin registry (Phase 1) - manages manifest installation/persistence.

import validatePluginManifest from './manifestSchema';
import { BUILTIN_PLUGIN_MANIFESTS } from './builtinManifests';

const STORAGE_KEY = 'nodegraph.plugins.registry';

// Ephemeral runtime state cache (node definitions, telemetry, etc.).
// This never hits localStorage; it's populated by the sandbox hosts while
// plugins are running in the current session.
const runtimeCache = new Map();

const nowIso = () => new Date().toISOString();

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readRegistryRaw = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
};

const readRegistry = () => readRegistryRaw();

const writeRegistry = (entries) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[PluginRegistry] Failed to persist registry:', err);
  }
};

const listeners = new Set();

const mergeRuntimeData = (entry) => {
  if (!entry || typeof entry !== 'object') return entry;
  const runtime = runtimeCache.get(entry.id);
  if (!runtime) {
    return { ...entry };
  }
  return { ...entry, runtime: { ...runtime } };
};

const getBuiltinRecord = (pluginId) => {
  const manifest = BUILTIN_PLUGIN_MANIFESTS.find((entry) => entry?.id === pluginId);
  if (!manifest) return null;
  return sanitizeRecord(manifest, manifest.bundle?.url || '');
};

const getMergedEntries = (entries = []) => {
  const persisted = Array.isArray(entries) ? entries : [];
  const byId = new Map();

  BUILTIN_PLUGIN_MANIFESTS.forEach((manifest) => {
    const record = sanitizeRecord(manifest, manifest.bundle?.url || '');
    byId.set(record.id, record);
  });

  persisted.forEach((entry) => {
    if (!entry?.id) return;
    const existing = byId.get(entry.id);
    byId.set(
      entry.id,
      existing
        ? {
            ...existing,
            ...entry,
            manifest: entry.manifest || existing.manifest,
            bundle: entry.bundle || existing.bundle,
            nodes: entry.nodes || existing.nodes,
            panels: entry.panels || existing.panels,
            metadata: entry.metadata || existing.metadata
          }
        : entry
    );
  });

  return Array.from(byId.values());
};

const getRegistrySnapshot = () => {
  const entries = typeof window === 'undefined' ? [] : readRegistry();
  return getMergedEntries(entries).map((entry) => mergeRuntimeData(entry));
};

const notifyListeners = () => {
  const snapshot = getRegistrySnapshot();
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
  pinnedVersion: null,
  pinnedIntegrity: null,
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
  return getRegistrySnapshot();
}

export function getPluginById(pluginId) {
  const entries = getRegistrySnapshot();
  return entries.find((entry) => entry.id === pluginId) || null;
}

export function setPluginEnabled(pluginId, enabled) {
  const entries = readRegistry();
  const idx = entries.findIndex((entry) => entry.id === pluginId);
  if (idx === -1) {
    const builtin = getBuiltinRecord(pluginId);
    if (!builtin) {
      return { success: false, error: 'Plugin not found' };
    }
    entries.push({ ...builtin, enabled: Boolean(enabled), updatedAt: nowIso() });
    writeRegistry(entries);
    if (enabled === false) {
      runtimeCache.delete(pluginId);
    }
    notifyListeners();
    return { success: true, data: entries[entries.length - 1] };
  }
  entries[idx] = { ...entries[idx], enabled: Boolean(enabled), updatedAt: nowIso() };
  writeRegistry(entries);
  if (enabled === false) {
    runtimeCache.delete(pluginId);
  }
  notifyListeners();
  return { success: true, data: entries[idx] };
}

export function uninstallPlugin(pluginId) {
  const entries = readRegistry();
  const next = entries.filter((entry) => entry.id !== pluginId);
  if (next.length === entries.length) {
    if (getBuiltinRecord(pluginId)) {
      writeRegistry(next);
      runtimeCache.delete(pluginId);
      notifyListeners();
      return { success: true };
    }
    return { success: false, error: 'Plugin not found' };
  }
  writeRegistry(next);
  runtimeCache.delete(pluginId);
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
    const prev = entries[existingIndex];
    entries[existingIndex] = {
      ...prev,
      ...record,
      pinnedVersion: prev.pinnedVersion || null,
      pinnedIntegrity: prev.pinnedIntegrity || null
    };
  } else {
    entries.push(record);
  }
  writeRegistry(entries);
  notifyListeners();
  return { success: true, data: record };
}

export function setPluginPinnedVersion(pluginId, version = null) {
  const entries = readRegistry();
  const idx = entries.findIndex((entry) => entry.id === pluginId);
  if (idx === -1) {
    const builtin = getBuiltinRecord(pluginId);
    if (!builtin) {
      return { success: false, error: 'Plugin not found' };
    }
    const record = {
      ...builtin,
      pinnedVersion: version,
      pinnedIntegrity: version ? builtin.bundle?.integrity || null : null,
      updatedAt: nowIso()
    };
    entries.push(record);
    writeRegistry(entries);
    notifyListeners();
    return { success: true, data: record };
  }
  entries[idx] = {
    ...entries[idx],
    pinnedVersion: version,
    pinnedIntegrity: version ? entries[idx].bundle?.integrity || null : null,
    updatedAt: nowIso()
  };
  writeRegistry(entries);
  notifyListeners();
  return { success: true, data: entries[idx] };
}

export function clearRegistry() {
  writeRegistry([]);
  runtimeCache.clear();
  notifyListeners();
}

export function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  callback(getRegistrySnapshot());
  return () => listeners.delete(callback);
}

export function setPluginRuntimeData(pluginId, runtimeData = {}) {
  if (!pluginId) return;
  const previous = runtimeCache.get(pluginId) || {};
  runtimeCache.set(pluginId, { ...previous, ...runtimeData });
  notifyListeners();
}

export function clearPluginRuntimeData(pluginId) {
  if (pluginId) {
    runtimeCache.delete(pluginId);
  } else {
    runtimeCache.clear();
  }
  notifyListeners();
}

export function findPluginNodeMeta(pluginId, nodeType) {
  if (!pluginId || !nodeType) return null;
  const plugin = getPluginById(pluginId);
  if (!plugin) return null;
  return (plugin.nodes || []).find(node => node && node.type === nodeType) || null;
}

export function getPluginNodeDefinition(pluginId, nodeType) {
  const meta = findPluginNodeMeta(pluginId, nodeType);
  return meta?.definition || null;
}

export default {
  installPluginFromUrl,
  installManifestObject,
  getInstalledPlugins,
  getPluginById,
  setPluginEnabled,
  uninstallPlugin,
  clearRegistry,
  subscribe,
  setPluginRuntimeData,
  clearPluginRuntimeData,
  setPluginPinnedVersion,
  findPluginNodeMeta,
  getPluginNodeDefinition
};
