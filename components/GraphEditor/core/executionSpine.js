export function createExecutionSpine({
  listeners = [],
  emitTelemetry = () => {},
  isDraftMode = () => false,
  getAuthorityContext = () => ({}),
  validateGraph = null,
  normalizeDeltas = null,
  commitDeltas = null,
  onCommit = null,
  onReject = null
} = {}) {
  const coerceDeltas = (result) => {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.deltas)) return result.deltas;
    return [];
  };

  const executeIntent = async (intent, token) => {
    if (token?.aborted) {
      emitTelemetry('canceled', intent);
      return { status: 'canceled' };
    }

    emitTelemetry('received', intent);
    emitTelemetry('flow_control', intent, { tokenId: token?.id });

    const context = getAuthorityContext?.(intent) || {};
    const proposedDeltas = [];

    for (const listener of listeners) {
      if (token?.aborted) {
        emitTelemetry('canceled', intent);
        return { status: 'canceled' };
      }
      if (!listener?.matches?.(intent, context)) continue;
      emitTelemetry('skill_start', intent, { skill: listener.id });
      try {
        const result = await listener.handle?.(intent, token, context);
        proposedDeltas.push(...coerceDeltas(result));
      } catch (err) {
        console.warn(`[ExecutionSpine] listener ${listener.id} failed:`, err);
      }
      emitTelemetry('skill_finish', intent, { skill: listener.id });
    }

    if (token?.aborted) {
      emitTelemetry('canceled', intent);
      return { status: 'canceled' };
    }

    if (isDraftMode?.()) {
      emitTelemetry('validator', intent, { skipped: true, reason: 'draft' });
      await onCommit?.({ intent, deltas: proposedDeltas, context, draft: true });
      emitTelemetry('done', intent);
      return { status: 'draft', deltas: proposedDeltas };
    }

    emitTelemetry('validator', intent);
    const validation = validateGraph?.({ intent, deltas: proposedDeltas, context });
    if (validation && validation.ok === false) {
      await onReject?.({ intent, context, errors: validation.errors || [], reason: 'validation' });
      return { status: 'blocked', errors: validation.errors || [] };
    }

    const normalizedDeltas = normalizeDeltas
      ? normalizeDeltas(proposedDeltas, context)
      : proposedDeltas;

    if (normalizedDeltas.length > 0) {
      await commitDeltas?.(normalizedDeltas, context);
    }

    await onCommit?.({ intent, deltas: normalizedDeltas, context, draft: false });
    emitTelemetry('done', intent);
    return { status: 'committed', deltas: normalizedDeltas };
  };

  return { executeIntent };
}
