"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  installPluginFromUrl,
  installManifestObject,
  getInstalledPlugins,
  setPluginEnabled,
  uninstallPlugin,
  subscribe
} from '../plugins/pluginRegistry';

export function usePluginRegistry() {
  const [plugins, setPlugins] = useState([]);
  const [status, setStatus] = useState({ installing: false, error: null });

  useEffect(() => {
    const unsubscribe = subscribe((entries) => {
      setPlugins(entries);
    });
    return unsubscribe;
  }, []);

  const refresh = useCallback(() => {
    setPlugins(getInstalledPlugins());
  }, []);

  const installFromUrl = useCallback(async (url) => {
    setStatus({ installing: true, error: null });
    const result = await installPluginFromUrl(url);
    if (!result.success) {
      setStatus({ installing: false, error: result.error });
      return result;
    }
    refresh();
    setStatus({ installing: false, error: null });
    return result;
  }, [refresh]);

  const installManifest = useCallback((manifest, manifestUrl = '') => {
    const result = installManifestObject(manifest, manifestUrl);
    if (result.success) {
      refresh();
    }
    return result;
  }, [refresh]);

  const togglePlugin = useCallback((pluginId, enabled) => {
    const result = setPluginEnabled(pluginId, enabled);
    if (result.success) {
      refresh();
    }
    return result;
  }, [refresh]);

  const removePlugin = useCallback((pluginId) => {
    const result = uninstallPlugin(pluginId);
    if (result.success) {
      refresh();
    }
    return result;
  }, [refresh]);

  const state = useMemo(() => ({ installing: status.installing, error: status.error }), [status]);

  return {
    plugins,
    status: state,
    installFromUrl,
    installManifest,
    togglePlugin,
    removePlugin,
    refresh
  };
}

export default usePluginRegistry;
