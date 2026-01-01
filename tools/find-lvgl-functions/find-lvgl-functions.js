const fs = require('fs');
const path = require('path');

// Configuration
const repoRoot = path.resolve(__dirname, '..');
const packagesDir = path.join(repoRoot, 'packages');
const excludeDir = path.join(repoRoot, 'packages', 'project-editor', 'flow', 'runtime', 'wasm');
const outFile = path.join(__dirname, 'lvgl-functions.json');

function walk(dir) {
  let res = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch (e) {
      continue;
    }
    if (stat.isDirectory()) {
      // Skip excluded directory and common ignores
      const resolved = path.resolve(full);
      if (resolved === path.resolve(excludeDir)) continue;
      if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue;
      res = res.concat(walk(full));
    } else if (stat.isFile()) {
      res.push(full);
    }
  }
  return res;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.tsx', '.js', '.jsx', '.c', '.cpp', '.h', '.json', '.md', '.html', '.css', '.scss'].includes(ext);
}

function extractLvglSymbolsByFile(files) {
  const regex = /\b(_?lv_[A-Za-z0-9_]+)\b/g;
  const map = Object.create(null);

  for (const f of files) {
    if (!isTextFile(f)) continue;
    let txt;
    try {
      txt = fs.readFileSync(f, 'utf8');
    } catch (e) {
      continue;
    }

    let m;
    const set = new Set();
    while ((m = regex.exec(txt)) !== null) {
      let name = m[1];
      if (name.startsWith('_lv_')) name = name.slice(1);
      // ensure it starts with lv_ after normalization
      if (name.startsWith('lv_')) set.add(name);
    }

    if (set.size > 0) {
      const rel = path.relative(repoRoot, f).replace(/\\/g, '/');
      map[rel] = Array.from(set).sort();
    }
  }

  return map;
}

function main() {
  if (!fs.existsSync(packagesDir)) {
    console.error('packages directory not found:', packagesDir);
    process.exit(1);
  }

  const files = walk(packagesDir);

  // build mapping: relative-file -> [functions]
  const map = extractLvglSymbolsByFile(files);

  // also build combined sorted list
  const combinedSet = new Set();
  for (const k of Object.keys(map)) {
    for (const fn of map[k]) combinedSet.add(fn);
  }
  const combined = Array.from(combinedSet).sort();

  const out = {
    byFile: map,
    allLvglFunctions: combined
  };

  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log('Wrote', outFile, 'with', combined.length, 'unique functions across', Object.keys(map).length, 'files');
}

main();
