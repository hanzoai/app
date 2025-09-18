#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Generate index.ts files for directories that don't have them
function generateIndexForDir(dirPath) {
  const indexPath = path.join(dirPath, 'index.ts');

  // Check if index already exists
  if (fs.existsSync(indexPath)) {
    return;
  }

  const files = fs.readdirSync(dirPath);
  const exports = [];

  files.forEach(file => {
    if (file === 'index.ts') return;
    if (file.endsWith('.ts')) {
      const name = file.replace('.ts', '');
      exports.push(`export * from './${name}';`);
    }
  });

  if (exports.length > 0) {
    fs.writeFileSync(indexPath, exports.join('\n') + '\n');
    console.log(`Created ${indexPath}`);
  }
}

// Process v2/mutations
const mutationsDir = path.join(__dirname, 'src/v2/mutations');
if (fs.existsSync(mutationsDir)) {
  const mutations = fs.readdirSync(mutationsDir);
  mutations.forEach(mutation => {
    const mutationPath = path.join(mutationsDir, mutation);
    if (fs.statSync(mutationPath).isDirectory()) {
      generateIndexForDir(mutationPath);
    }
  });
}

// Process v2/queries
const queriesDir = path.join(__dirname, 'src/v2/queries');
if (fs.existsSync(queriesDir)) {
  const queries = fs.readdirSync(queriesDir);
  queries.forEach(query => {
    const queryPath = path.join(queriesDir, query);
    if (fs.statSync(queryPath).isDirectory()) {
      generateIndexForDir(queryPath);
    }
  });
}

console.log('Export generation complete!');