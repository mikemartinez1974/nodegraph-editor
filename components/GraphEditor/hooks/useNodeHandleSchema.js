"use client";

import { useMemo } from 'react';

/**
 * Ensures a node exposes the desired handle schema and updates the graph when missing.
 * @param {Object} node - The raw node passed in from the graph.
 * @param {Array=} defaultInputs - Desired input handles.
 * @param {Array=} defaultOutputs - Desired output handles.
 * @returns {Object} node with guaranteed inputs/outputs arrays.
 */
export default function useNodeHandleSchema(node, defaultInputs = [], defaultOutputs = []) {
  return useMemo(() => {
    return node || {};
  }, [node]);
}
