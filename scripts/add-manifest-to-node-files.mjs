#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

const skipDirNames = new Set([
  ".git",
  "node_modules",
  ".next",
  "out",
  "dist",
  ".turbo"
]);

const shouldSkipDir = (dirName, parentDir) => {
  if (skipDirNames.has(dirName)) return true;
  if (dirName === ".twilite" && parentDir === ".") return true;
  return false;
};

const makeId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
};

const nowIso = () => new Date().toISOString();

const titleFromFilePath = (filePath) => {
  const base = path.basename(filePath, ".node");
  if (!base) return "Untitled Graph";
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

const createManifestNode = (filePath) => {
  const now = nowIso();
  return {
    id: makeId(),
    label: "Manifest",
    type: "manifest",
    position: { x: -260, y: -160 },
    width: 360,
    height: 220,
    data: {
      identity: {
        graphId: makeId(),
        name: titleFromFilePath(filePath),
        version: "0.1.0",
        description: "",
        createdAt: now,
        updatedAt: now
      },
      intent: {
        kind: "graph",
        scope: "mixed"
      },
      dependencies: {
        nodeTypes: ["manifest", "legend", "dictionary", "default", "markdown"],
        portContracts: ["core"],
        skills: [],
        schemaVersions: {
          nodes: ">=1.0.0",
          ports: ">=1.0.0"
        },
        optional: []
      },
      authority: {
        mutation: {
          allowCreate: true,
          allowUpdate: true,
          allowDelete: true,
          appendOnly: false
        },
        actors: {
          humans: true,
          agents: true,
          tools: true
        },
        styleAuthority: "descriptive",
        history: {
          rewriteAllowed: false,
          squashAllowed: false
        }
      },
      document: {
        url: ""
      },
      settings: {
        theme: null,
        backgroundImage: null,
        defaultNodeColor: "#1976d2",
        defaultEdgeColor: "#666666",
        snapToGrid: false,
        gridSize: 20,
        edgeRouting: "auto",
        layout: null,
        github: {
          repo: "",
          path: "",
          branch: "main"
        },
        autoSave: false
      }
    }
  };
};

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name, dir)) continue;
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".node")) {
      files.push(fullPath);
    }
  }
};

walk(".");

const changed = [];
const skipped = [];

for (const filePath of files) {
  let json;
  const source = fs.readFileSync(filePath, "utf8");
  try {
    json = JSON.parse(source);
  } catch (err) {
    skipped.push({ file: filePath, reason: `invalid-json: ${err.message}` });
    continue;
  }

  if (!json || typeof json !== "object" || !Array.isArray(json.nodes)) {
    skipped.push({ file: filePath, reason: "missing-nodes-array" });
    continue;
  }

  const hasManifest = json.nodes.some((node) => node && node.type === "manifest");
  if (hasManifest) continue;

  const next = { ...json, nodes: [createManifestNode(filePath), ...json.nodes] };
  const nextSource = JSON.stringify(next, null, 2);

  if (apply) fs.writeFileSync(filePath, nextSource, "utf8");
  changed.push(filePath);
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      scanned: files.length,
      changedCount: changed.length,
      skippedCount: skipped.length,
      changed,
      skipped
    },
    null,
    2
  )
);
