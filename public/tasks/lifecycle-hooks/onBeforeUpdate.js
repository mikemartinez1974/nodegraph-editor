const logNodeId = 'lifecycle-log';
const now = new Date().toISOString();
const nodes = await api.getNodes();
const logNode = nodes.find((n) => n && n.id === logNodeId);
if (!logNode) {
  await api.log('warn', '[LifecycleSmoke] Missing lifecycle log node');
  return { hook: 'onBeforeUpdate', logged: false };
}
const prev = String(logNode?.data?.markdown || '# Lifecycle Hook Log\n\n');
const line = `- ${now} :: onBeforeUpdate fired`;
await api.updateNode(logNodeId, { data: { markdown: `${prev}\n${line}` } });
return { hook: 'onBeforeUpdate', logged: true, at: now };
