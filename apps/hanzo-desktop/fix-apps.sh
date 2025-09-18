#!/bin/bash

# Fix both Hanzo.app and Hanzo Dev.app in /Applications

set -e

PROJECT_DIR="/Users/z/work/hanzo/app/apps/hanzo-desktop"
RELEASE_BINARY="/Users/z/work/hanzo/app/target/release/hanzo-desktop"
ICON_PATH="${PROJECT_DIR}/src-tauri/icons/icon.icns"

echo "🔧 Fixing Hanzo Desktop Apps in /Applications"
echo "=============================================="

# Function to create/fix an app bundle
create_app_bundle() {
    local APP_NAME=$1
    local APP_IDENTIFIER=$2
    local IS_DEV=$3

    local APP_PATH="/Applications/${APP_NAME}.app"
    local CONTENTS_PATH="${APP_PATH}/Contents"

    echo ""
    echo "📦 Setting up ${APP_NAME}.app..."

    # Remove old app if exists
    if [ -d "${APP_PATH}" ]; then
        echo "  → Removing old app..."
        rm -rf "${APP_PATH}"
    fi

    # Create directory structure
    mkdir -p "${CONTENTS_PATH}/MacOS"
    mkdir -p "${CONTENTS_PATH}/Resources"

    # Build release binary if not exists
    if [ ! -f "$RELEASE_BINARY" ]; then
        echo "  → Building release binary..."
        cd "${PROJECT_DIR}/src-tauri"
        cargo build --release
    fi

    # Copy binary
    echo "  → Copying binary..."
    cp "$RELEASE_BINARY" "${CONTENTS_PATH}/MacOS/hanzo-desktop"
    chmod +x "${CONTENTS_PATH}/MacOS/hanzo-desktop"

    # Copy icon
    if [ -f "$ICON_PATH" ]; then
        echo "  → Copying icon..."
        cp "$ICON_PATH" "${CONTENTS_PATH}/Resources/icon.icns"
    fi

    # Create Info.plist
    echo "  → Creating Info.plist..."
    cat > "${CONTENTS_PATH}/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>hanzo-desktop</string>
    <key>CFBundleIdentifier</key>
    <string>${APP_IDENTIFIER}</string>
    <key>CFBundleName</key>
    <string>${APP_NAME%.app}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME%.app}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.5.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
EOF

    # Add dev environment for dev app
    if [ "$IS_DEV" = "true" ]; then
        cat >> "${CONTENTS_PATH}/Info.plist" << EOF
    <key>LSEnvironment</key>
    <dict>
        <key>TAURI_ENV</key>
        <string>development</string>
        <key>RUST_LOG</key>
        <string>warn</string>
    </dict>
EOF
    fi

    cat >> "${CONTENTS_PATH}/Info.plist" << EOF
</dict>
</plist>
EOF

    # Clear extended attributes
    echo "  → Clearing attributes..."
    xattr -c "${APP_PATH}" 2>/dev/null || true

    # Code sign the app
    echo "  → Code signing..."
    codesign --force --deep --sign - "${APP_PATH}"

    echo "  ✅ ${APP_NAME} is ready!"
}

# Kill any running instances
echo "Stopping any running instances..."
killall hanzo-desktop 2>/dev/null || true

# Fix Hanzo.app (Production)
create_app_bundle "Hanzo" "ai.hanzo.desktop" "false"

# Fix Hanzo Dev.app (Development)
create_app_bundle "Hanzo Dev" "ai.hanzo.desktop.dev" "true"

echo ""
echo "=========================================="
echo "✅ Both apps have been fixed and are ready!"
echo ""
echo "📱 Production App:"
echo "   /Applications/Hanzo.app"
echo "   → Stable release build"
echo ""
echo "🔧 Development App:"
echo "   /Applications/Hanzo Dev.app"
echo "   → Also using stable release build"
echo "   → Development environment variables set"
echo ""
echo "To test:"
echo "  open '/Applications/Hanzo.app'           # Production"
echo "  open '/Applications/Hanzo Dev.app'       # Development"
echo ""
echo "For hot reload development, use:"
echo "  make hot-tauri                          # In the project directory"