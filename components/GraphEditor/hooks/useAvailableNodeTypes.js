"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import eventBus from "../../NodeGraph/eventBus";
import { getNodeTypeList, getNodeTypesByCategory } from "../nodeTypeRegistry";
import usePluginRegistry from "./usePluginRegistry";
import {
  shouldShowInTypeSelectors,
  HIDDEN_SYSTEM_SELECTOR_TYPES
} from "../constants/nodeTypeSelectorConfig";

const getDictionaryNodeDefs = (dictionary) => {
  const nodeDefs = dictionary?.data?.nodeDefs;
  return Array.isArray(nodeDefs) ? nodeDefs : [];
};

const buildDictionaryTypeMeta = (entry) => {
  const type = entry?.key || entry?.type || entry?.nodeType;
  if (!type || typeof type !== "string") return null;
  return {
    type,
    label: entry?.label || entry?.title || type,
    description: entry?.description || entry?.ref || entry?.source || "",
    icon: entry?.icon || "Extension",
    category: "definitions",
    source: "dictionary",
    definition: entry
  };
};

export default function useAvailableNodeTypes() {
  const { plugins } = usePluginRegistry();
  const registryList = useMemo(
    () =>
      getNodeTypeList().filter(
        (meta) => shouldShowInTypeSelectors(meta?.type)
      ),
    [plugins]
  );
  const registryByCategory = useMemo(() => getNodeTypesByCategory(), [plugins]);
  const registryTypeSet = useMemo(
    () => new Set(registryList.map((meta) => meta?.type).filter(Boolean)),
    [registryList]
  );

  const [dictionaryTypeList, setDictionaryTypeList] = useState([]);

  const buildDictionaryTypeList = useCallback(
    (dictionary) => {
      const next = [];
      const seen = new Set();
      getDictionaryNodeDefs(dictionary).forEach((entry) => {
        const meta = buildDictionaryTypeMeta(entry);
        if (!meta || !meta.type) return;
        // Keep dictionary-defined custom types visible in selectors.
        // Only suppress core system types (manifest/legend/dictionary).
        if (HIDDEN_SYSTEM_SELECTOR_TYPES.has(meta.type)) return;
        if (registryTypeSet.has(meta.type) || seen.has(meta.type)) return;
        seen.add(meta.type);
        next.push(meta);
      });
      return next;
    },
    [registryTypeSet]
  );

  useEffect(() => {
    const handleDictionaryResolved = ({ dictionary } = {}) => {
      setDictionaryTypeList(buildDictionaryTypeList(dictionary));
    };

    eventBus.on("dictionaryResolved", handleDictionaryResolved);
    eventBus.emit("dictionaryRequest");

    if (typeof window !== "undefined" && window.graphAPI?.getNodes) {
      try {
        const nodes = window.graphAPI.getNodes() || [];
        const dictionaryNode = nodes.find((node) => node?.type === "dictionary") || null;
        if (dictionaryNode) {
          setDictionaryTypeList(buildDictionaryTypeList(dictionaryNode));
        } else {
          setDictionaryTypeList([]);
        }
      } catch {
        // ignore graphAPI lookup failures
      }
    }

    return () => {
      eventBus.off("dictionaryResolved", handleDictionaryResolved);
    };
  }, [buildDictionaryTypeList]);

  const nodeTypeList = useMemo(() => {
    if (!dictionaryTypeList.length) return registryList;
    return [...registryList, ...dictionaryTypeList];
  }, [dictionaryTypeList, registryList]);

  const nodesByCategory = useMemo(() => {
    const filteredBase = Object.entries(registryByCategory || {}).reduce((acc, [category, nodes]) => {
      acc[category] = (Array.isArray(nodes) ? nodes : []).filter(
        (meta) => shouldShowInTypeSelectors(meta?.type)
      );
      return acc;
    }, {});
    if (!dictionaryTypeList.length) return filteredBase;
    return {
      ...filteredBase,
      definitions: [...(filteredBase.definitions || []), ...dictionaryTypeList]
    };
  }, [dictionaryTypeList, registryByCategory]);

  const nodeTypeOptions = useMemo(
    () =>
      nodeTypeList.map((meta) => ({
        value: meta.type,
        label: meta.label || meta.type
      })),
    [nodeTypeList]
  );

  return {
    nodeTypeList,
    nodesByCategory,
    nodeTypeOptions
  };
}
