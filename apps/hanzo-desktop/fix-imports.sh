#!/bin/bash

# Fix all deep imports from @hanzo/node/v2/*/use* to import from parent directory

# Find all TypeScript/TSX files
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "@hanzo/node/v2/[^']*/" {} \; | while read file; do
  echo "Fixing imports in $file"

  # Fix imports that end with /useSomething
  sed -i '' -E "s|from '@hanzo/node/v2/([^/]+)/([^/]+)/use[A-Z][^']*'|from '@hanzo/node/v2/\1/\2'|g" "$file"

  # Also handle @hanzo/message imports
  sed -i '' -E "s|from '@hanzo/message/api/([^/]+)/index'|from '@hanzo/message/api/\1'|g" "$file"
done

echo "Import fixes complete!"