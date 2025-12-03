export const convertHandlesObjectToArray = (handleConfig) => {
  if (!handleConfig || typeof handleConfig !== 'object') return undefined;

  const handles = [];
  const pushHandles = (entries, direction) => {
    if (!Array.isArray(entries)) return;
    entries.forEach((handle) => {
      if (!handle) return;
      const id = handle.id || handle.key || handle.name;
      if (!id) return;
      handles.push({
        id,
        label: handle.label || handle.name || id,
        direction,
        dataType: handle.dataType || handle.handleType || handle.type || 'value'
      });
    });
  };

  pushHandles(handleConfig.inputs, 'input');
  pushHandles(handleConfig.outputs, 'output');
  return handles.length > 0 ? handles : undefined;
};
