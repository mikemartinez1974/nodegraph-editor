#!/usr/bin/env node
/*
  replace-graphapi-access.js
  Simple utility to replace direct cross-frame graphAPI property reads
  (e.g. window.parent.graphAPI, window.top.graphAPI, parent.graphAPI)
  with a safe inline accessor to avoid cross-origin SecurityError exceptions.

  Usage: node scripts/replace-graphapi-access.js
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['public', 'components'];
const BACKUP_EXT = '.bak.graphapi';

const patterns = [
  /window\.parent\.graphAPI/g,
  /window\.top\.graphAPI/g,
  /parent\.graphAPI/g,
  /top\.graphAPI/g,
  /window\['parent'\]\.graphAPI/g,
  /window\['top'\]\.graphAPI/g
];

const replacement = `(() => { try { return (typeof window !== 'undefined' && window.graphAPI) || (typeof window !== 'undefined' && window.parent && window.parent.graphAPI) || (typeof window !== 'undefined' && window.top && window.top.graphAPI) || null; } catch (err) { try { return (typeof window !== 'undefined' && window.graphAPI) || null; } catch (e) { return null; } } })()`;

function walkDir(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, cb);
    } else if (entry.isFile()) {
      cb(full);
    }
  }
}

function processFile(filePath) {
  if (!/\.(js|ts|jsx|tsx|mjs)$/.test(filePath)) return;
  try {
    const rel = path.relative(ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = content;
    let replaced = false;
    for (const pat of patterns) {
      if (pat.test(modified)) {
        modified = modified.replace(pat, replacement);
        replaced = true;
      }
    }
    if (replaced) {
      // backup
      fs.writeFileSync(filePath + BACKUP_EXT, content, 'utf8');
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`Patched: ${rel}`);
    }
  } catch (err) {
    console.warn(`Failed to process ${filePath}:`, err.message);
  }
}

for (const td of TARGET_DIRS) {
  const dir = path.join(ROOT, td);
  if (!fs.existsSync(dir)) continue;
  walkDir(dir, processFile);
}

console.log('Done. Review .bak.graphapi files for backups.');
