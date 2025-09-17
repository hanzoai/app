#!/bin/bash

# Generate ICNS file for macOS
# Requires iconutil (comes with Xcode)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_DIR="$SCRIPT_DIR"
ICONSET_DIR="$ICON_DIR/icon.iconset"

# Create iconset directory
mkdir -p "$ICONSET_DIR"

# Use sips to generate required sizes for iconset
sips -z 16 16 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_512x512@2x.png"

# Convert to ICNS
iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"

# Clean up
rm -rf "$ICONSET_DIR"

echo "✅ Generated icon.icns"
