#!/bin/bash

# Script to ensure hanzod binary is properly linked for development
# This links the Tauri sidecar binary to the real hanzod from ~/work/hanzo/node

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTERNAL_BIN_DIR="$PROJECT_ROOT/src-tauri/external-binaries/hanzo-node"
HANZOD_SOURCE="$HOME/work/hanzo/node/target/debug/hanzod"
HANZOD_DEST="$EXTERNAL_BIN_DIR/hanzod"

echo "🔗 Setting up hanzod symlink for development..."

# Check if source binary exists
if [ ! -f "$HANZOD_SOURCE" ]; then
    echo "❌ Source hanzod not found at: $HANZOD_SOURCE"
    echo "   Please build hanzod first: cd ~/work/hanzo/node && cargo build"
    exit 1
fi

# Create external-binaries directory if it doesn't exist
mkdir -p "$EXTERNAL_BIN_DIR"

# Remove existing file/symlink if present
if [ -e "$HANZOD_DEST" ] || [ -L "$HANZOD_DEST" ]; then
    echo "   Removing existing hanzod..."
    rm -f "$HANZOD_DEST"
fi

# Create symlink
echo "   Creating symlink: $HANZOD_DEST -> $HANZOD_SOURCE"
ln -s "$HANZOD_SOURCE" "$HANZOD_DEST"

# Verify symlink was created
if [ -L "$HANZOD_DEST" ]; then
    echo "✅ Symlink created successfully!"
    ls -la "$HANZOD_DEST"
else
    echo "❌ Failed to create symlink"
    exit 1
fi

echo "
📋 Configuration Summary:
   - Binary source: $HANZOD_SOURCE
   - Symlink location: $HANZOD_DEST
   - Ready for: pnpm tauri dev
"