const REF_PATTERN = /^(github:\/\/|local:\/\/|tlz:\/\/|\/|https?:\/\/).+/i;
const NODE_TYPE_PATTERN = /^[a-z][a-z0-9-]*$/;
const ALLOWED_SOURCES = new Set(["local", "github", "http", "https", "tlz", "external"]);
const ALLOWED_VIEW_INTENTS = new Set(["node", "editor", "preview", "inspector", "runtime"]);
const ALLOWED_DATA_MODES = new Set(["replace", "merge-shallow", "merge-deep"]);

const normalizeSource = (value) => {
  const source = String(value || "").trim().toLowerCase();
  if (ALLOWED_SOURCES.has(source)) return source;
  return "external";
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const validatePortDefinition = (port, path) => {
  const errors = [];
  if (!isObject(port)) {
    errors.push(`${path} must be an object.`);
    return errors;
  }
  if (!String(port.id || "").trim()) errors.push(`${path}.id is required.`);
  if (!String(port.label || "").trim()) errors.push(`${path}.label is required.`);
  if (!["input", "output", "bidirectional"].includes(String(port.direction || "").trim())) {
    errors.push(`${path}.direction must be input, output, or bidirectional.`);
  }
  if (!String(port.dataType || "").trim()) errors.push(`${path}.dataType is required.`);
  if (!isObject(port.position)) {
    errors.push(`${path}.position is required.`);
  } else {
    if (!["left", "right", "top", "bottom"].includes(String(port.position.side || "").trim())) {
      errors.push(`${path}.position.side must be left|right|top|bottom.`);
    }
    const offset = Number(port.position.offset);
    if (!Number.isFinite(offset) || offset < 0 || offset > 1) {
      errors.push(`${path}.position.offset must be between 0 and 1.`);
    }
  }
  return errors;
};

const validateViewBinding = (view, path) => {
  const errors = [];
  if (!isObject(view)) {
    errors.push(`${path} must be an object.`);
    return errors;
  }
  const intent = String(view.intent || "").trim();
  if (!ALLOWED_VIEW_INTENTS.has(intent)) {
    errors.push(`${path}.intent is invalid.`);
  }
  if (!String(view.payload || "").trim()) errors.push(`${path}.payload is required.`);
  if (!REF_PATTERN.test(String(view.ref || "").trim())) errors.push(`${path}.ref is invalid.`);
  if (!String(view.source || "").trim()) errors.push(`${path}.source is required.`);
  if (!String(view.version || "").trim()) errors.push(`${path}.version is required.`);
  return errors;
};

export const validateNodeClassContractV1 = (contract) => {
  const errors = [];
  if (!isObject(contract)) return ["Contract must be an object."];

  if (contract.contractVersion !== "1.0.0") {
    errors.push("contractVersion must be 1.0.0.");
  }

  const nodeType = String(contract.nodeType || "").trim();
  if (!NODE_TYPE_PATTERN.test(nodeType)) {
    errors.push("nodeType must match ^[a-z][a-z0-9-]*$.");
  }

  if (!REF_PATTERN.test(String(contract.classRef || "").trim())) {
    errors.push("classRef must be a valid ref (github://, local://, tlz://, /, http(s)://).");
  }

  if (!String(contract.classVersion || "").trim()) {
    errors.push("classVersion is required.");
  }

  if (!ALLOWED_SOURCES.has(String(contract.source || "").trim().toLowerCase())) {
    errors.push("source must be one of local|github|http|https|tlz|external.");
  }

  if (!(typeof contract.dataSchema === "boolean" || isObject(contract.dataSchema))) {
    errors.push("dataSchema must be an object or boolean.");
  }

  if (!isObject(contract.defaults)) {
    errors.push("defaults is required.");
  } else {
    if (!String(contract.defaults.label || "").trim()) errors.push("defaults.label is required.");
    if (!isObject(contract.defaults.size)) {
      errors.push("defaults.size is required.");
    } else {
      const width = Number(contract.defaults.size.width);
      const height = Number(contract.defaults.size.height);
      if (!Number.isFinite(width) || width < 40) errors.push("defaults.size.width must be >= 40.");
      if (!Number.isFinite(height) || height < 40) errors.push("defaults.size.height must be >= 40.");
    }
    if (!isObject(contract.defaults.data)) errors.push("defaults.data must be an object.");
    if (!Array.isArray(contract.defaults.ports)) {
      errors.push("defaults.ports must be an array.");
    } else {
      contract.defaults.ports.forEach((port, index) => {
        errors.push(...validatePortDefinition(port, `defaults.ports[${index}]`));
      });
    }
  }

  if (!isObject(contract.views) || !contract.views.node) {
    errors.push("views.node is required.");
  } else {
    errors.push(...validateViewBinding(contract.views.node, "views.node"));
    if (contract.views.editor) {
      errors.push(...validateViewBinding(contract.views.editor, "views.editor"));
    }
  }

  if (!isObject(contract.validation)) {
    errors.push("validation is required.");
  } else {
    if (!Array.isArray(contract.validation.requiredDataKeys)) {
      errors.push("validation.requiredDataKeys must be an array.");
    }
    if (!Array.isArray(contract.validation.rules)) {
      errors.push("validation.rules must be an array.");
    }
    if (!["block", "warn"].includes(String(contract.validation.onError || "").trim())) {
      errors.push("validation.onError must be block or warn.");
    }
  }

  if (!isObject(contract.overrides)) {
    errors.push("overrides is required.");
  } else {
    ["allowLabel", "allowSize", "allowColor", "allowPorts", "allowData"].forEach((key) => {
      if (typeof contract.overrides[key] !== "boolean") {
        errors.push(`overrides.${key} must be boolean.`);
      }
    });
    if (!ALLOWED_DATA_MODES.has(String(contract.overrides.dataMode || "").trim())) {
      errors.push("overrides.dataMode must be replace|merge-shallow|merge-deep.");
    }
  }

  return errors;
};

export const buildNodeClassContractFromDictionary = ({ key, nodeDef, views }) => {
  const safeKey = String(key || "").trim();
  const nodeView = (views || []).find((entry) => (
    String(entry?.intent || "").trim() === "node" &&
    String(entry?.payload || "").trim() === "node.web"
  )) || (views || []).find((entry) => String(entry?.intent || "").trim() === "node");
  const editorView = (views || []).find((entry) => (
    String(entry?.intent || "").trim() === "editor" &&
    String(entry?.payload || "").trim() === "editor.web"
  )) || (views || []).find((entry) => String(entry?.intent || "").trim() === "editor");

  return {
    contractVersion: "1.0.0",
    nodeType: safeKey,
    classRef: String(nodeDef?.ref || "").trim(),
    classVersion: String(nodeDef?.version || "").trim(),
    source: normalizeSource(nodeDef?.source),
    dataSchema: {
      type: "object",
      additionalProperties: true
    },
    defaults: {
      label: safeKey,
      size: { width: 320, height: 180 },
      data: {},
      ports: [
        {
          id: "root",
          label: "Root",
          direction: "bidirectional",
          dataType: "any",
          position: { side: "right", offset: 0.5 }
        }
      ]
    },
    views: {
      node: nodeView
        ? {
            intent: String(nodeView.intent || "node").trim(),
            payload: String(nodeView.payload || "node.web").trim(),
            ref: String(nodeView.ref || nodeDef?.ref || "").trim(),
            source: String(nodeView.source || nodeDef?.source || "external").trim(),
            version: String(nodeView.version || nodeDef?.version || "").trim()
          }
        : null,
      ...(editorView
        ? {
            editor: {
              intent: String(editorView.intent || "editor").trim(),
              payload: String(editorView.payload || "editor.web").trim(),
              ref: String(editorView.ref || nodeDef?.ref || "").trim(),
              source: String(editorView.source || nodeDef?.source || "external").trim(),
              version: String(editorView.version || nodeDef?.version || "").trim()
            }
          }
        : {})
    },
    validation: {
      requiredDataKeys: [],
      rules: [],
      onError: "warn"
    },
    overrides: {
      allowLabel: true,
      allowSize: true,
      allowColor: true,
      allowPorts: true,
      allowData: true,
      dataMode: "merge-deep"
    }
  };
};

export const validateDictionaryAgainstNodeClassContract = (nodeDefs, views) => {
  const errors = [];
  const safeNodeDefs = Array.isArray(nodeDefs) ? nodeDefs : [];
  const safeViews = Array.isArray(views) ? views : [];

  safeNodeDefs.forEach((entry) => {
    const key = String(entry?.key || "").trim();
    if (!key) return;
    const keyedViews = safeViews.filter((view) => String(view?.key || "").trim() === key);
    const contract = buildNodeClassContractFromDictionary({ key, nodeDef: entry, views: keyedViews });
    const contractErrors = validateNodeClassContractV1(contract);
    contractErrors.forEach((message) => {
      errors.push(`[${key}] ${message}`);
    });
  });

  return errors;
};
