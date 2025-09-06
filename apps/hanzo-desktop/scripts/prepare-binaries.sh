#!/bin/bash

# Script to prepare platform-specific hanzod binaries for CI builds
# This creates placeholder binaries for platforms where we don't have the actual binary

BINARY_DIR="src-tauri/external-binaries/hanzo-node"

# Create directory if it doesn't exist
mkdir -p "$BINARY_DIR"

# List of required platform-specific binaries
PLATFORMS=(
  "hanzod-x86_64-pc-windows-msvc.exe"
  "hanzod-i686-pc-windows-msvc.exe"
  "hanzod-aarch64-pc-windows-msvc.exe"
  "hanzod-x86_64-unknown-linux-gnu"
  "hanzod-aarch64-unknown-linux-gnu"
  "hanzod-x86_64-apple-darwin"
  "hanzod-aarch64-apple-darwin"
)

# Check if a base hanzod binary exists
if [ -f "$BINARY_DIR/hanzod" ]; then
  echo "Found base hanzod binary"
  BASE_BINARY="$BINARY_DIR/hanzod"
elif [ -f "$BINARY_DIR/hanzo-node" ]; then
  echo "Found hanzo-node binary, using as base"
  BASE_BINARY="$BINARY_DIR/hanzo-node"
else
  echo "Warning: No base binary found"
  # Create a minimal placeholder
  echo '#!/bin/sh' > "$BINARY_DIR/hanzod"
  echo 'echo "Placeholder hanzod binary"' >> "$BINARY_DIR/hanzod"
  chmod +x "$BINARY_DIR/hanzod"
  BASE_BINARY="$BINARY_DIR/hanzod"
fi

# Create platform-specific binaries if they don't exist
for PLATFORM in "${PLATFORMS[@]}"; do
  TARGET_FILE="$BINARY_DIR/$PLATFORM"
  if [ ! -f "$TARGET_FILE" ]; then
    echo "Creating placeholder for $PLATFORM"
    if [[ "$PLATFORM" == *.exe ]]; then
      # For Windows executables, create a simple batch file
      echo "@echo off" > "$TARGET_FILE"
      echo "echo Placeholder hanzod binary for Windows" >> "$TARGET_FILE"
    else
      # For Unix-like systems, copy the base binary or create a shell script
      if [ -f "$BASE_BINARY" ]; then
        cp "$BASE_BINARY" "$TARGET_FILE"
      else
        echo '#!/bin/sh' > "$TARGET_FILE"
        echo 'echo "Placeholder hanzod binary"' >> "$TARGET_FILE"
      fi
      chmod +x "$TARGET_FILE"
    fi
  else
    echo "$PLATFORM already exists"
  fi
done

echo "Binary preparation complete"
ls -la "$BINARY_DIR"