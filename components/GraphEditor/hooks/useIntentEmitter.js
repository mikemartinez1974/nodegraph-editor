"use client";

import { useCallback } from "react";
import eventBus from "../../NodeGraph/eventBus";

const buildPayload = (trigger, metadata) => {
  const timestamp = metadata?.timestamp || new Date().toISOString();
  return {
    trigger,
    timestamp,
    ...metadata
  };
};

export default function useIntentEmitter() {
  const emitEdgeIntent = useCallback((trigger, metadata = {}) => {
    if (!trigger) return;
    const payload = buildPayload(trigger, metadata);
    try {
      eventBus.emit("edgeIntentCaptured", payload);
    } catch (err) {
      console.warn("[EdgeIntent] emit failed", err);
    }
  }, []);

  return { emitEdgeIntent };
}
