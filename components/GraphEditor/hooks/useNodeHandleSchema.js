"use client";

import { useEffect, useMemo } from 'react';
import eventBus from '../../NodeGraph/eventBus';

/**
 * Ensures a node exposes the desired handle schema and updates the graph when missing.
 * @param {Object} node - The raw node passed in from the graph.
 * @param {Array=} defaultInputs - Desired input handles.
 * @param {Array=} defaultOutputs - Desired output handles.
 * @returns {Object} node with guaranteed inputs/outputs arrays.
 */
export default function useNodeHandleSchema(node, defaultInputs = [], defaultOutputs = []) {
  useEffect(() => {
    if (!node?.id) return;

    const needsInputs = !Array.isArray(node.inputs) || node.inputs.length === 0;
    const needsOutputs = !Array.isArray(node.outputs) || node.outputs.length === 0;

    if (!needsInputs && !needsOutputs) return;

    eventBus.emit('nodeUpdate', {
      id: node.id,
      updates: {
        ...(needsInputs ? { inputs: defaultInputs || [] } : {}),
        ...(needsOutputs ? { outputs: defaultOutputs || [] } : {}),
      }
    });
  }, [node?.id, node?.inputs, node?.outputs, defaultInputs, defaultOutputs]);

  return useMemo(() => {
    if (!node) {
      return {
        inputs: defaultInputs || [],
        outputs: defaultOutputs || []
      };
    }

    const safeInputs = Array.isArray(node.inputs) && node.inputs.length > 0
      ? node.inputs
      : (defaultInputs || []);
    const safeOutputs = Array.isArray(node.outputs) && node.outputs.length > 0
      ? node.outputs
      : (defaultOutputs || []);

    return {
      ...node,
      inputs: safeInputs,
      outputs: safeOutputs
    };
  }, [node, defaultInputs, defaultOutputs]);
}
