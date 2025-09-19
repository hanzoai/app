#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the problematic index file
const indexPath = path.resolve(__dirname, '../node_modules/@hanzo/ui/primitives/index-common.ts');

console.log('Patching @hanzo/ui to remove components with missing dependencies...');

// Read the file
let content = fs.readFileSync(indexPath, 'utf8');

// Comment out problematic components
const problematicImports = [
  // Chat components with missing @hanzo_network dependencies
  "export { ChatInput } from './chat/chat-input'",
  "export { ChatInputArea } from './chat/chat-input-area'",
  "export { FileList } from './chat/files-preview'",
  "export { default as JsonForm } from './chat/json-form'",
  // Components with missing npm dependencies
  "export { FileUploader } from './file-uploader'",
  "export { MarkdownText, MarkdownPreview } from './markdown-preview'",
];

problematicImports.forEach(line => {
  const regex = new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, `// ${line} // Commented out due to missing dependencies`);
});

// Write back the modified content
fs.writeFileSync(indexPath, content, 'utf8');

console.log('Patch applied successfully!');