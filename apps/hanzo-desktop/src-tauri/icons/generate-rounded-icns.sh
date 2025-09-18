#!/bin/bash

# Generate rounded ICNS file for macOS
# Creates macOS-style rounded corners on the icon

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_DIR="$SCRIPT_DIR"
ICONSET_DIR="$ICON_DIR/icon-rounded.iconset"
SOURCE_ICON="$ICON_DIR/icon.png"
TEMP_ROUNDED="$ICON_DIR/icon-rounded-temp.png"

# Create iconset directory
mkdir -p "$ICONSET_DIR"

# Function to create rounded corner mask
create_rounded_icon() {
    local size=$1
    local output=$2
    local corner_radius=$((size * 18 / 100))  # macOS uses ~18% corner radius

    # Create a rounded rectangle mask and apply it to the icon
    magick "$SOURCE_ICON" \
        -resize ${size}x${size} \
        \( +clone -alpha extract \
           -draw "fill black polygon 0,0 0,$corner_radius $corner_radius,0 fill white circle $corner_radius,$corner_radius $corner_radius,0" \
           \( +clone -flip \) -compose Multiply -composite \
           \( +clone -flop \) -compose Multiply -composite \
        \) -alpha off -compose CopyOpacity -composite \
        "$output"
}

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "ImageMagick is required but not installed. Installing via Homebrew..."
    brew install imagemagick
fi

# Generate all required sizes with rounded corners
echo "Generating rounded icons..."
create_rounded_icon 16 "$ICONSET_DIR/icon_16x16.png"
create_rounded_icon 32 "$ICONSET_DIR/icon_16x16@2x.png"
create_rounded_icon 32 "$ICONSET_DIR/icon_32x32.png"
create_rounded_icon 64 "$ICONSET_DIR/icon_32x32@2x.png"
create_rounded_icon 128 "$ICONSET_DIR/icon_128x128.png"
create_rounded_icon 256 "$ICONSET_DIR/icon_128x128@2x.png"
create_rounded_icon 256 "$ICONSET_DIR/icon_256x256.png"
create_rounded_icon 512 "$ICONSET_DIR/icon_256x256@2x.png"
create_rounded_icon 512 "$ICONSET_DIR/icon_512x512.png"
create_rounded_icon 1024 "$ICONSET_DIR/icon_512x512@2x.png"

# Convert to ICNS
iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon-rounded.icns"

# Clean up
rm -rf "$ICONSET_DIR"

# Replace the original icon.icns with the rounded version
mv "$ICON_DIR/icon.icns" "$ICON_DIR/icon-square-backup.icns" 2>/dev/null || true
cp "$ICON_DIR/icon-rounded.icns" "$ICON_DIR/icon.icns"

echo "✅ Generated rounded icon.icns and replaced the original"
echo "💾 Original backed up as icon-square-backup.icns"