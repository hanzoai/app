#!/bin/bash

# Build and install both Hanzo.app and Hanzo Dev.app to /Applications
# This script uses the properly built Tauri bundles with full frontend

set -e

PROJECT_DIR="/Users/z/work/hanzo/app/apps/hanzo-desktop"
TAURI_BUNDLE="/Users/z/work/hanzo/app/target/release/bundle/macos/Hanzo AI.app"
INVERTED_ICON="${PROJECT_DIR}/src-tauri/icons/icon-inverted.icns"

echo "🔧 Building and Installing Hanzo Desktop Apps"
echo "============================================="

# Check if we need to build
if [ ! -d "$TAURI_BUNDLE" ] || [ "$1" = "--rebuild" ]; then
    echo "📦 Building Tauri bundle..."
    cd "$PROJECT_DIR"
    pnpm build
    pnpm tauri build
    echo "✅ Build complete!"
fi

# Kill any running instances
echo "Stopping any running instances..."
killall hanzo-desktop 2>/dev/null || true

# Install Hanzo.app
echo ""
echo "📱 Installing Hanzo.app..."
rm -rf /Applications/Hanzo.app
cp -R "$TAURI_BUNDLE" "/Applications/Hanzo.app"

# Update the name from "Hanzo AI" to just "Hanzo"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Hanzo" "/Applications/Hanzo.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Hanzo" "/Applications/Hanzo.app/Contents/Info.plist"

# Install Hanzo Dev.app
echo "🔧 Installing Hanzo Dev.app..."
rm -rf "/Applications/Hanzo Dev.app"
cp -R "$TAURI_BUNDLE" "/Applications/Hanzo Dev.app"

# Update Dev app properties
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 'Hanzo Dev'" "/Applications/Hanzo Dev.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName 'Hanzo Dev'" "/Applications/Hanzo Dev.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier ai.hanzo.desktop.dev" "/Applications/Hanzo Dev.app/Contents/Info.plist"

# Copy inverted icon to Dev app
if [ -f "$INVERTED_ICON" ]; then
    echo "  → Applying inverted icon to Hanzo Dev..."
    cp "$INVERTED_ICON" "/Applications/Hanzo Dev.app/Contents/Resources/icon.icns"
else
    echo "  ⚠️ Inverted icon not found, using standard icon"
fi

# Sign both apps
echo ""
echo "🔐 Signing apps..."
codesign --force --deep --sign - "/Applications/Hanzo.app"
codesign --force --deep --sign - "/Applications/Hanzo Dev.app"

echo ""
echo "============================================="
echo "✅ Both apps successfully installed!"
echo ""
echo "📱 Production App:"
echo "   /Applications/Hanzo.app"
echo "   → Full Tauri bundle with frontend"
echo "   → Ready for AI chat sessions"
echo ""
echo "🔧 Development App:"
echo "   /Applications/Hanzo Dev.app"
echo "   → Same full bundle (inverted icon)"
echo "   → Separate instance for development"
echo ""
echo "🚀 Quick Launch:"
echo "   open '/Applications/Hanzo.app'       # Production"
echo "   open '/Applications/Hanzo Dev.app'   # Development"
echo ""
echo "🤖 Features Available:"
echo "   ✓ Main chat window"
echo "   ✓ Spotlight search (Cmd+K)"
echo "   ✓ Node Manager for local AI"
echo "   ✓ Download models to ~/.hanzo"
echo ""
echo "💡 Tips:"
echo "   - Use Node Manager to download local AI models"
echo "   - Models are stored in ~/Library/Application Support/"
echo "   - Both apps can run simultaneously"