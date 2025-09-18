#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Function to generate index.ts with all exports
function generateIndexForDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  const exports = [];

  // Check what files exist
  const hasIndex = files.includes('index.ts');
  const otherFiles = files.filter(f => f.endsWith('.ts') && f !== 'index.ts');

  // If index already exists and has content, check if we need to add exports
  if (hasIndex) {
    const indexPath = path.join(dirPath, 'index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');

    // If it already has exports, don't overwrite
    if (content.includes('export')) {
      // But append exports for other files if not already present
      otherFiles.forEach(file => {
        const name = file.replace('.ts', '');
        const exportLine = `export * from './${name}';`;
        if (!content.includes(exportLine) && !content.includes(`from './${name}'`)) {
          exports.push(exportLine);
        }
      });

      if (exports.length > 0) {
        const newContent = content.trimEnd() + '\n' + exports.join('\n') + '\n';
        fs.writeFileSync(indexPath, newContent);
        console.log(`Updated ${indexPath} with additional exports`);
      }
      return;
    }
  }

  // Generate exports for all TypeScript files
  otherFiles.forEach(file => {
    const name = file.replace('.ts', '');
    exports.push(`export * from './${name}';`);
  });

  if (exports.length > 0 || !hasIndex) {
    const indexPath = path.join(dirPath, 'index.ts');
    const content = exports.join('\n') + (exports.length > 0 ? '\n' : '');
    fs.writeFileSync(indexPath, content);
    console.log(`Created/Updated ${indexPath}`);
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