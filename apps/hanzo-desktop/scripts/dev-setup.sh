#!/bin/bash

# Development Setup Script for Hanzo Desktop
# This creates a development app that uses your source code directly

set -e

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${BLUE}🔧 Hanzo Desktop Development Setup${NC}"
echo -e "${YELLOW}This will create a development app that uses your source code directly${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "$PROJECT_DIR/src-tauri/tauri.conf.json" ]; then
    echo -e "${RED}❌ Not in hanzo-desktop directory!${NC}"
    exit 1
fi

# Option 1: Symlinked Development App
setup_symlinked_app() {
    echo -e "${BLUE}Creating symlinked development app...${NC}"

    # Build debug binary
    echo -e "${YELLOW}Building debug binary...${NC}"
    cd "$PROJECT_DIR/src-tauri" && cargo build

    # Create app bundle structure
    APP_PATH="/Applications/Hanzo-Dev.app"
    rm -rf "$APP_PATH"
    mkdir -p "$APP_PATH/Contents/MacOS"
    mkdir -p "$APP_PATH/Contents/Resources"

    # Create symlinks to source
    ln -sf "$PROJECT_DIR/../../target/debug/hanzo-desktop" "$APP_PATH/Contents/MacOS/hanzo-desktop"

    # Create Info.plist
    cat > "$APP_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>hanzo-desktop</string>
    <key>CFBundleIdentifier</key>
    <string>ai.hanzo.desktop.dev</string>
    <key>CFBundleName</key>
    <string>Hanzo Dev</string>
    <key>CFBundleDisplayName</key>
    <string>Hanzo Dev</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.5.0-dev</string>
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
</dict>
</plist>
EOF

    # Link icon
    if [ -f "$PROJECT_DIR/src-tauri/icons/icon.icns" ]; then
        ln -sf "$PROJECT_DIR/src-tauri/icons/icon.icns" "$APP_PATH/Contents/Resources/icon.icns"
    fi

    echo -e "${GREEN}✅ Symlinked app created at $APP_PATH${NC}"
    echo -e "${YELLOW}This app will use the development binary and load from localhost:1420${NC}"
}

# Option 2: Tauri Dev Mode Launcher
create_dev_launcher() {
    echo -e "${BLUE}Creating development launcher script...${NC}"

    LAUNCHER_PATH="$PROJECT_DIR/dev-launcher.sh"
    cat > "$LAUNCHER_PATH" << 'EOF'
#!/bin/bash

# Hanzo Desktop Development Launcher
# This starts both the Vite dev server and the Tauri app

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Hanzo Desktop in development mode${NC}"
echo -e "${YELLOW}Frontend will hot reload on changes${NC}"
echo -e "${CYAN}Press Ctrl+C to stop${NC}"

# Start Tauri in dev mode (this also starts Vite)
pnpm tauri:dev
EOF

    chmod +x "$LAUNCHER_PATH"
    echo -e "${GREEN}✅ Created launcher at $LAUNCHER_PATH${NC}"
}

# Main setup
echo -e "${BLUE}Select setup option:${NC}"
echo "1) Create symlinked app (recommended)"
echo "2) Create launcher script"
echo "3) Both"
read -p "Choice (1-3): " choice

case $choice in
    1)
        setup_symlinked_app
        ;;
    2)
        create_dev_launcher
        ;;
    3)
        setup_symlinked_app
        create_dev_launcher
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Development setup complete!${NC}"
echo ""
echo -e "${YELLOW}To start developing:${NC}"
echo -e "  1. Run: ${CYAN}make hot-tauri${NC}     (starts dev server + app)"
echo -e "  2. Or:  ${CYAN}make hot${NC}          (just the web UI at localhost:1420)"
echo -e "  3. Or:  ${CYAN}open /Applications/Hanzo-Dev.app${NC} (if symlinked app created)"
echo ""
echo -e "${YELLOW}Tips:${NC}"
echo -e "  • Frontend changes reload instantly"
echo -e "  • Rust changes require restart"
echo -e "  • The dev app loads from http://localhost:1420"
echo -e "  • Your source files are in: $PROJECT_DIR"