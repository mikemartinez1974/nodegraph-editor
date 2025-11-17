"use client";

import { useEffect, useState } from 'react';
import PluginRegistry from '../plugins/pluginRegistry';

export function usePluginManager() {
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    setPlugins(PluginRegistry.getInstalledPlugins());
  }, []);

  return {
    plugins
  };
}

export default usePluginManager;
