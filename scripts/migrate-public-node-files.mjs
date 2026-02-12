#!/usr/bin/env node
import fs from "fs";
import path from "path";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const rootDir = "public";

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".node")) {
      files.push(fullPath);
    }
  }
};

const toObjectData = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
};

const migrateFile = (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  let json;
  try {
    json = JSON.parse(source);
  } catch (err) {
    return { filePath, changed: false, changes: [`invalid-json: ${err.message}`], skipped: true };
  }

  const changes = [];
  let touched = false;
  const next = { ...json };

  if (!Array.isArray(next.clusters) && Array.isArray(next.groups)) {
    next.clusters = next.groups;
    delete next.groups;
    touched = true;
    changes.push("top-level groups -> clusters");
  }

  if (!Array.isArray(next.nodes)) {
    return { filePath, changed: false, changes, skipped: false };
  }

  next.nodes = next.nodes.map((node) => {
    if (!node || typeof node !== "object") return node;
    const migratedNode = { ...node };

    if ("handles" in migratedNode && !("ports" in migratedNode)) {
      migratedNode.ports = migratedNode.handles;
      delete migratedNode.handles;
      touched = true;
      changes.push(`node ${migratedNode.id || "unknown"}: handles -> ports`);
    }

    if (!("data" in migratedNode) || typeof migratedNode.data !== "object" || migratedNode.data === null || Array.isArray(migratedNode.data)) {
      migratedNode.data = toObjectData(migratedNode.data);
      touched = true;
      changes.push(`node ${migratedNode.id || "unknown"}: data normalized to object`);
    }

    if (migratedNode.type === "manifest") {
      const manifestData = { ...migratedNode.data };
      const dependencies = manifestData.dependencies && typeof manifestData.dependencies === "object"
        ? { ...manifestData.dependencies }
        : {};
      const schemaVersions = dependencies.schemaVersions && typeof dependencies.schemaVersions === "object"
        ? { ...dependencies.schemaVersions }
        : {};
      if ("handles" in schemaVersions && !("ports" in schemaVersions)) {
        schemaVersions.ports = schemaVersions.handles;
        delete schemaVersions.handles;
        dependencies.schemaVersions = schemaVersions;
        manifestData.dependencies = dependencies;
        migratedNode.data = manifestData;
        touched = true;
        changes.push(`node ${migratedNode.id || "unknown"}: schemaVersions.handles -> schemaVersions.ports`);
      }
      if (manifestData.intent?.kind === "fragment") {
        const intent = { ...(manifestData.intent || {}) };
        intent.kind = "graph";
        manifestData.intent = intent;
        migratedNode.data = manifestData;
        touched = true;
        changes.push(`node ${migratedNode.id || "unknown"}: intent.kind fragment -> graph`);
      }
    }

    return migratedNode;
  });

  if (Array.isArray(next.edges)) {
    next.edges = next.edges.map((edge) => {
      if (!edge || typeof edge !== "object") return edge;
      const migratedEdge = { ...edge };
      if ("sourceHandle" in migratedEdge && !("sourcePort" in migratedEdge)) {
        migratedEdge.sourcePort = migratedEdge.sourceHandle;
        delete migratedEdge.sourceHandle;
        touched = true;
        changes.push(`edge ${migratedEdge.id || "unknown"}: sourceHandle -> sourcePort`);
      }
      if ("targetHandle" in migratedEdge && !("targetPort" in migratedEdge)) {
        migratedEdge.targetPort = migratedEdge.targetHandle;
        delete migratedEdge.targetHandle;
        touched = true;
        changes.push(`edge ${migratedEdge.id || "unknown"}: targetHandle -> targetPort`);
      }
      return migratedEdge;
    });
  }

  const nextSource = JSON.stringify(next, null, 2);
  const changed = touched;
  return { filePath, changed, nextSource, changes, skipped: false };
};

if (!fs.existsSync(rootDir)) {
  console.error(`Missing directory: ${rootDir}`);
  process.exit(1);
}

walk(rootDir);

let changedFiles = 0;
let skippedFiles = 0;
const changedDetail = [];
const skippedDetail = [];

for (const filePath of files) {
  const result = migrateFile(filePath);
  if (result.skipped) {
    skippedFiles += 1;
    skippedDetail.push(result);
    continue;
  }
  if (!result.changed) continue;
  changedFiles += 1;
  changedDetail.push(result);
  if (apply) {
    fs.writeFileSync(filePath, result.nextSource, "utf8");
  }
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  scanned: files.length,
  changedFiles,
  skippedFiles,
  changed: changedDetail.map((entry) => ({
    file: entry.filePath,
    changes: entry.changes
  })),
  skipped: skippedDetail.map((entry) => ({
    file: entry.filePath,
    issues: entry.changes
  }))
}, null, 2));
