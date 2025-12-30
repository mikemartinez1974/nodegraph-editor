const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function generateGraph(title, items, parentDir = null) {
  const nodes = [];
  const edges = [];
  
  // Header node
  nodes.push({
    id: 'header',
    type: 'markdown',
    label: `📂 ${title}`,
    position: { x: 0, y: -200 },
    width: 600,
    height: 100,
    data: {
      markdown: `# Index of ${title}\nExplore the nodegraphs in this directory.`
    }
  });

  // Back node if parent exists
  if (parentDir !== null) {
    const parentPath = parentDir ? `/${parentDir}/index.node` : '/index.node';
    nodes.push({
      id: 'back',
      type: 'default',
      label: '⬅️ Back to Parent',
      position: { x: -300, y: -200 },
      width: 180,
      height: 60,
      data: {
        link: `tlz://${parentPath.replace(/\/+/g, '/')}`
      }
    });
  }

  // File nodes
  const cols = 4;
  items.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    const id = `node-${index}`;
    const itemPath = item.relPath.startsWith('/') ? item.relPath : `/${item.relPath}`;
    nodes.push({
      id,
      type: 'default',
      label: item.name.replace('.node', ''),
      position: { x: col * 220 - (cols * 110) + 110, y: row * 120 },
      width: 200,
      height: 80,
      data: {
        link: `tlz://${itemPath.replace(/\/+/g, '/')}`
      }
    });
  });

  return {
    fileVersion: "1.0",
    metadata: {
      title: `Index of ${title}`,
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    },
    settings: {
      theme: {
        mode: "dark",
        primary: { main: "#1976d2" },
        background: { default: "#121212", paper: "#1e1e1e" },
        text: { primary: "#ffffff", secondary: "rgba(255, 255, 255, 0.7)" }
      }
    },
    viewport: {
      pan: { x: 400, y: 300 },
      zoom: 0.8
    },
    nodes,
    edges,
    groups: []
  };
}

function scanDir(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  
  let hasNodeFiles = false;
  const nodeFiles = [];
  const subDirs = [];

  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      subDirs.push(file);
    } else if (file.endsWith('.node') && file !== 'index.node') {
      hasNodeFiles = true;
      nodeFiles.push({
        name: file,
        relPath: path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, '/')
      });
    }
  });

  if (hasNodeFiles) {
    const relDir = path.relative(PUBLIC_DIR, dir).replace(/\\/g, '/') || 'Root';
    const parentRelDir = relDir === 'Root' ? null : (path.dirname(relDir) === '.' ? '' : path.dirname(relDir));
    
    console.log(`Generating index for ${relDir}...`);
    const graph = generateGraph(relDir, nodeFiles, parentRelDir);
    fs.writeFileSync(path.join(dir, 'index.node'), JSON.stringify(graph, null, 2));
    
    results.push({
      name: relDir,
      relPath: (relDir === 'Root' ? '' : relDir + '/') + 'index.node'
    });
  }

  subDirs.forEach(sub => {
    const subResults = scanDir(path.join(dir, sub));
    results.push(...subResults);
  });

  return results;
}

// Start scanning
console.log('Scanning public directory...');
const dirIndexes = scanDir(PUBLIC_DIR);

// Create a master index if it doesn't exist
const rootIndexFile = path.join(PUBLIC_DIR, 'index.node');
console.log('Generating master index...');
const masterItems = dirIndexes.map(idx => ({
    name: idx.name,
    relPath: idx.relPath
}));

const masterGraph = generateGraph('All Graphs', masterItems);
fs.writeFileSync(rootIndexFile, JSON.stringify(masterGraph, null, 2));

console.log('Done!');
