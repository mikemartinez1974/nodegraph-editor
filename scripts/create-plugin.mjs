#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

const getFlagValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
};

const showUsage = () => {
  console.log(`\nUsage: npm run create-plugin -- --id com.example.my-plugin --name "My Plugin" [--slug custom-slug]\n`);
};

if (args.includes('--help') || args.includes('-h')) {
  showUsage();
  process.exit(0);
}

const pluginId = getFlagValue('--id') || args[0];
if (!pluginId) {
  console.error('Error: plugin id is required.');
  showUsage();
  process.exit(1);
}

const pluginName = getFlagValue('--name') || pluginId;
const slugArg = getFlagValue('--slug');
const version = getFlagValue('--version') || '0.1.0';

const slugFromId = pluginId
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '');
let pluginSlug = (slugArg || slugFromId || 'plugin')
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '');
if (!pluginSlug) {
  pluginSlug = 'plugin';
}

const rootDir = path.resolve(process.cwd());
const templateDir = path.resolve(rootDir, 'templates', 'plugin-starter');
const targetDir = path.resolve(rootDir, 'public', 'plugins', pluginSlug);

if (!fs.existsSync(templateDir)) {
  console.error('Error: template directory templates/plugin-starter is missing.');
  process.exit(1);
}

if (fs.existsSync(targetDir)) {
  console.error(`Error: target directory ${path.relative(rootDir, targetDir)} already exists.`);
  process.exit(1);
}

const createdAt = new Date().toISOString();

const replacements = {
  '__PLUGIN_ID__': pluginId,
  '__PLUGIN_NAME__': pluginName,
  '__PLUGIN_SLUG__': pluginSlug,
  '__PLUGIN_VERSION__': version,
  '__CREATED_AT__': createdAt
};

const applyReplacements = (content) => {
  return Object.entries(replacements).reduce((acc, [token, value]) => acc.split(token).join(value), content);
};

const copyTemplate = (source, destination) => {
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyTemplate(srcPath, destPath);
    } else {
      const raw = fs.readFileSync(srcPath, 'utf8');
      const output = applyReplacements(raw);
      fs.writeFileSync(destPath, output, 'utf8');
    }
  }
};

copyTemplate(templateDir, targetDir);

console.log(`\nCreated plugin scaffold in ${path.relative(rootDir, targetDir)}\n`);
console.log('Next steps:');
console.log(`  1. npm run dev`);
console.log(`  2. Install http://localhost:3000/plugins/${pluginSlug}/manifest.json from the Plugin Manager.`);
console.log('  3. Customize plugin.js + manifest.json and rebuild as needed.\n');
