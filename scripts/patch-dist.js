#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Patching @hanzo/ui dist files to fix missing dependencies...');

// Find the actual @hanzo/ui location in pnpm
const findHanzoPath = () => {
  try {
    // List all @hanzo+ui directories in .pnpm
    const pnpmPath = path.join(__dirname, '../node_modules/.pnpm');
    if (fs.existsSync(pnpmPath)) {
      const dirs = fs.readdirSync(pnpmPath);
      const hanzoDir = dirs.find(d => d.startsWith('@hanzo+ui@'));
      if (hanzoDir) {
        return path.join(pnpmPath, hanzoDir, 'node_modules/@hanzo/ui');
      }
    }
  } catch (e) {
    console.log('Error finding pnpm path:', e.message);
  }

  // Fallback to direct path
  const directPath = path.join(__dirname, '../node_modules/@hanzo/ui');
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  return null;
};

const hanzoPath = findHanzoPath();
if (!hanzoPath) {
  console.log('Warning: Could not find @hanzo/ui package');
  process.exit(0); // Exit gracefully
}

console.log('Found @hanzo/ui at:', hanzoPath);

// Patch dist/index.mjs
const distMjsPath = path.join(hanzoPath, 'dist/index.mjs');
if (fs.existsSync(distMjsPath)) {
  let content = fs.readFileSync(distMjsPath, 'utf8');

  // Comment out problematic imports
  content = content.replace(/import\s+.*?from\s+['"]@hanzo_network\/hanzo-i18n['"]/g, '// Stubbed: @hanzo_network/hanzo-i18n');
  content = content.replace(/import\s+.*?from\s+['"]@hanzo_network\/hanzo-node-state.*?['"]/g, '// Stubbed: hanzo-node-state');
  content = content.replace(/import\s+.*?from\s+['"]@tauri-apps\/plugin-dialog['"]/g, 'const dialog = {}; // Stubbed: tauri dialog');
  content = content.replace(/import\s+.*?from\s+['"]@tauri-apps\/plugin-fs['"]/g, 'const fs = {}; // Stubbed: tauri fs');
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+['"]filesize['"]/g, 'const filesize = (b) => `${b}B`; // Stubbed: filesize');
  content = content.replace(/import\s+filesize\s+from\s+['"]filesize['"]/g, 'const filesize = (b) => `${b}B`; // Stubbed: filesize');

  fs.writeFileSync(distMjsPath, content, 'utf8');
  console.log('Patched: dist/index.mjs');
}

// Patch dist/index.js if it exists
const distJsPath = path.join(hanzoPath, 'dist/index.js');
if (fs.existsSync(distJsPath)) {
  let content = fs.readFileSync(distJsPath, 'utf8');

  // Apply same patches
  content = content.replace(/require\(['"]@hanzo_network\/hanzo-i18n['"]\)/g, '({}) // Stubbed: hanzo-i18n');
  content = content.replace(/require\(['"]@hanzo_network\/hanzo-node-state.*?['"]\)/g, '({}) // Stubbed: hanzo-node-state');
  content = content.replace(/require\(['"]@tauri-apps\/plugin-dialog['"]\)/g, '({}) // Stubbed: tauri dialog');
  content = content.replace(/require\(['"]@tauri-apps\/plugin-fs['"]\)/g, '({}) // Stubbed: tauri fs');
  content = content.replace(/require\(['"]filesize['"]\)/g, '((b) => `${b}B`) // Stubbed: filesize');

  fs.writeFileSync(distJsPath, content, 'utf8');
  console.log('Patched: dist/index.js');
}

console.log('Dist patching complete!');