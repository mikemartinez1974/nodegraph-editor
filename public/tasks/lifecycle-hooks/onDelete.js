const logNodeId = 'lifecycle-log';
const now = new Date().toISOString();
const nodes = await api.getNodes();
const logNode = nodes.find((n) => n && n.id === logNodeId);
if (!logNode) {
  await api.log('warn', '[LifecycleSmoke] Missing lifecycle log node');
  return { hook: 'onDelete', logged: false };
}
const prev = String(logNode?.data?.markdown || '# Lifecycle Hook Log\n\n');
const line = `- ${now} :: onDelete fired`;
await api.updateNode(logNodeId, { data: { markdown: `${prev}\n${line}` } });
return { hook: 'onDelete', logged: true, at: now };
