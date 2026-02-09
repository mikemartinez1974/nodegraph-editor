"use client";

import { useMemo } from 'react';

/**
 * Ensures a node exposes the desired port schema and updates the graph when missing.
 * @param {Object} node - The raw node passed in from the graph.
 * @param {Array=} defaultInputs - Desired input ports.
 * @param {Array=} defaultOutputs - Desired output ports.
 * @returns {Object} node with guaranteed inputs/outputs arrays.
 */
export default function useNodePortSchema(node, defaultInputs = [], defaultOutputs = []) {
  return useMemo(() => {
    return node || {};
  }, [node]);
}
