const logNodeId = 'lifecycle-log';
const now = new Date().toISOString();
const nodes = await api.getNodes();
const logNode = nodes.find((n) => n && n.id === logNodeId);
if (!logNode) {
  await api.log('warn', '[LifecycleSmoke] Missing lifecycle log node');
  return { hook: 'onCreate', logged: false };
}
const prev = String(logNode?.data?.markdown || '# Lifecycle Hook Log\n\n');
const line = `- ${now} :: onCreate fired`;
await api.updateNode(logNodeId, { data: { markdown: `${prev}\n${line}` } });
return { hook: 'onCreate', logged: true, at: now };
