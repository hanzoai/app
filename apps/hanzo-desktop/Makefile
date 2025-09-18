# Hanzo Desktop Makefile - Complete Build System
.PHONY: help install dev build test clean ios android

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
CYAN := \033[0;36m
MAGENTA := \033[0;35m
WHITE := \033[1;37m
NC := \033[0m # No Color

# Platform detection
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

# Set NODE_OPTIONS for all commands to prevent memory issues
export NODE_OPTIONS := --max-old-space-size=8192

# iOS Simulator Device
IOS_SIMULATOR ?= iPhone 15 Pro

# Android Device/Emulator
ANDROID_DEVICE ?= Pixel_8_Pro_API_34

## Help
help:
	@echo "$(CYAN)╔══════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(CYAN)║$(WHITE)              🎯 Hanzo Desktop Build System                  $(CYAN)║$(NC)"
	@echo "$(CYAN)╠══════════════════════════════════════════════════════════════╣$(NC)"
	@echo "$(CYAN)║$(NC) $(GREEN)Quick Commands:$(NC)                                             $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(YELLOW)make build-ios$(NC)      - Build iOS app                      $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(YELLOW)make build-android$(NC)  - Build Android app                  $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(YELLOW)make dev-ios$(NC)        - Run iOS simulator                  $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(YELLOW)make dev-android$(NC)    - Run Android emulator               $(CYAN)║$(NC)"
	@echo "$(CYAN)╠══════════════════════════════════════════════════════════════╣$(NC)"
	@echo "$(CYAN)║$(NC) $(MAGENTA)Desktop Targets:$(NC)                                            $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)dev$(NC)                 - Start desktop development          $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)build$(NC)               - Build for current platform         $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)build-macos$(NC)         - Build macOS DMG                    $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)build-windows$(NC)       - Build Windows installer            $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)build-linux$(NC)         - Build Linux AppImage               $(CYAN)║$(NC)"
	@echo "$(CYAN)╠══════════════════════════════════════════════════════════════╣$(NC)"
	@echo "$(CYAN)║$(NC) $(MAGENTA)iOS Targets:$(NC) 📱                                             $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)ios-init$(NC)            - Initialize iOS project             $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)ios-dev$(NC)             - Run in iOS simulator               $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)ios-build$(NC)           - Build iOS release                  $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)ios-list$(NC)            - List iOS simulators                $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)ios-open$(NC)            - Open in Xcode                      $(CYAN)║$(NC)"
	@echo "$(CYAN)╠══════════════════════════════════════════════════════════════╣$(NC)"
	@echo "$(CYAN)║$(NC) $(MAGENTA)Android Targets:$(NC) 🤖                                         $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)android-setup$(NC)       - Install Android SDK                $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)android-init$(NC)        - Initialize Android project         $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)android-dev$(NC)         - Run in Android emulator            $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)android-build$(NC)       - Build Android APK                  $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)android-list$(NC)        - List Android devices               $(CYAN)║$(NC)"
	@echo "$(CYAN)╠══════════════════════════════════════════════════════════════╣$(NC)"
	@echo "$(CYAN)║$(NC) $(MAGENTA)Utilities:$(NC)                                                  $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)install$(NC)             - Install all dependencies           $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)clean$(NC)               - Clean build artifacts              $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)test$(NC)                - Run all tests                      $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)lint$(NC)                - Run linters                        $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)format$(NC)              - Format code                        $(CYAN)║$(NC)"
	@echo "$(CYAN)║$(NC)   $(WHITE)icons$(NC)               - Regenerate icons                   $(CYAN)║$(NC)"
	@echo "$(CYAN)╚══════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "  Platform: $(GREEN)$(UNAME_S) ($(UNAME_M))$(NC)"

## Install dependencies
install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)npm is required but not installed.$(NC)"; exit 1; }
	@command -v rustc >/dev/null 2>&1 || { echo "$(RED)Rust is required but not installed. Please install from https://rustup.rs/$(NC)"; exit 1; }
	npm install
	cd src-tauri && cargo fetch
	@echo "$(GREEN)✅ Dependencies installed successfully!$(NC)"

## Desktop Development
dev:
	@echo "$(BLUE)🚀 Starting desktop development server...$(NC)"
	npx nx serve hanzo-desktop

build:
	@echo "$(BLUE)🔨 Building desktop app...$(NC)"
	npm run build
	cd src-tauri && cargo build --release

build-dmg:
	@echo "$(BLUE)📦 Building macOS DMG...$(NC)"
	npx nx build hanzo-desktop --configuration=production

## iOS Development (5-star experience)
ios-check:
	@echo "$(BLUE)🔍 Checking iOS prerequisites...$(NC)"
	@command -v xcrun >/dev/null 2>&1 || { echo "$(RED)Xcode Command Line Tools not installed. Run: xcode-select --install$(NC)"; exit 1; }
	@xcrun simctl list devices | grep -q "iPhone" || { echo "$(RED)No iOS simulators found. Install via Xcode.$(NC)"; exit 1; }
	@echo "$(GREEN)✅ iOS development ready!$(NC)"

ios-init: ios-check
	@echo "$(BLUE)📱 Initializing iOS project...$(NC)"
	@if [ ! -d "src-tauri/gen/apple" ]; then \
		npx tauri ios init; \
		echo "$(GREEN)✅ iOS project initialized!$(NC)"; \
	else \
		echo "$(YELLOW)iOS project already initialized$(NC)"; \
	fi

ios-icons:
	@echo "$(BLUE)🎨 Generating iOS icons...$(NC)"
	python3 generate_ios_icons.py
	@echo "$(GREEN)✅ iOS icons generated!$(NC)"

ios-list:
	@echo "$(BLUE)📱 Available iOS simulators:$(NC)"
	@xcrun simctl list devices | grep -E "iPhone|iPad" | grep -v unavailable

ios-dev: ios-init
	@echo "$(BLUE)🚀 Starting iOS development build...$(NC)"
	@echo "$(YELLOW)Using simulator: $(IOS_SIMULATOR)$(NC)"
	# Start simulator
	@xcrun simctl boot "$(IOS_SIMULATOR)" 2>/dev/null || true
	@open -a Simulator
	# Build and run
	npx tauri ios dev --open

ios-build: ios-init
	@echo "$(BLUE)📦 Building iOS app for release...$(NC)"
	npm run build
	npx tauri ios build --ci --export-method debugging

ios-build-release: ios-init
	@echo "$(BLUE)📦 Building iOS app for App Store...$(NC)"
	npm run build
	npx tauri ios build --ci --export-method app-store-connect

ios-open:
	@echo "$(BLUE)🔧 Opening in Xcode...$(NC)"
	open src-tauri/gen/apple/hanzo-desktop.xcodeproj

ios-clean:
	@echo "$(BLUE)🧹 Cleaning iOS build artifacts...$(NC)"
	rm -rf src-tauri/gen/apple/build
	rm -rf src-tauri/gen/apple/DerivedData
	@echo "$(GREEN)✅ iOS artifacts cleaned!$(NC)"

## Android Development
android-check:
	@echo "$(BLUE)🔍 Checking Android prerequisites...$(NC)"
	@if [ -z "$$ANDROID_HOME" ]; then \
		echo "$(YELLOW)ANDROID_HOME not set. Setting up via Homebrew...$(NC)"; \
		$(MAKE) android-setup; \
	fi
	@command -v adb >/dev/null 2>&1 || { echo "$(RED)ADB not found. Run: make android-setup$(NC)"; exit 1; }
	@echo "$(GREEN)✅ Android development ready!$(NC)"

android-setup:
	@echo "$(BLUE)📦 Setting up Android SDK via Homebrew...$(NC)"
	@command -v brew >/dev/null 2>&1 || { echo "$(RED)Homebrew not installed. Visit https://brew.sh$(NC)"; exit 1; }
	# Install Android SDK via Homebrew
	brew install --cask android-commandlinetools
	brew install --cask android-platform-tools
	# Set environment variables
	@echo "$(YELLOW)Add these to your ~/.zshrc or ~/.bashrc:$(NC)"
	@echo 'export ANDROID_HOME="$$HOME/Library/Android/sdk"'
	@echo 'export PATH="$$PATH:$$ANDROID_HOME/emulator"'
	@echo 'export PATH="$$PATH:$$ANDROID_HOME/platform-tools"'
	@echo 'export PATH="$$PATH:$$ANDROID_HOME/cmdline-tools/latest/bin"'
	# Accept licenses
	yes | sdkmanager --licenses 2>/dev/null || true
	# Install required SDK components
	sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125"
	@echo "$(GREEN)✅ Android SDK setup complete!$(NC)"

android-init: android-check
	@echo "$(BLUE)🤖 Initializing Android project...$(NC)"
	@if [ ! -d "src-tauri/gen/android" ]; then \
		export ANDROID_HOME="$$HOME/Library/Android/sdk" && \
		npx tauri android init; \
		echo "$(GREEN)✅ Android project initialized!$(NC)"; \
	else \
		echo "$(YELLOW)Android project already initialized$(NC)"; \
	fi

android-list:
	@echo "$(BLUE)🤖 Available Android devices:$(NC)"
	@adb devices -l || echo "$(YELLOW)No devices found. Start an emulator or connect a device.$(NC)"

android-emulator:
	@echo "$(BLUE)🤖 Starting Android emulator...$(NC)"
	@command -v emulator >/dev/null 2>&1 || { echo "$(RED)Emulator not found. Run: make android-setup$(NC)"; exit 1; }
	emulator -avd $(ANDROID_DEVICE) &

android-dev: android-init
	@echo "$(BLUE)🚀 Starting Android development build...$(NC)"
	export ANDROID_HOME="$$HOME/Library/Android/sdk" && \
	npx tauri android dev --open

android-build: android-init
	@echo "$(BLUE)📦 Building Android APK...$(NC)"
	npm run build
	export ANDROID_HOME="$$HOME/Library/Android/sdk" && \
	npx tauri android build --ci

android-clean:
	@echo "$(BLUE)🧹 Cleaning Android build artifacts...$(NC)"
	rm -rf src-tauri/gen/android/app/build
	rm -rf src-tauri/gen/android/.gradle
	@echo "$(GREEN)✅ Android artifacts cleaned!$(NC)"

## Testing
test:
	@echo "$(BLUE)🧪 Running tests...$(NC)"
	npm run test:contrast
	cd src-tauri && cargo test
	@echo "$(GREEN)✅ All tests passed!$(NC)"

test-contrast:
	@echo "$(BLUE)🎨 Running contrast tests...$(NC)"
	npm run test:contrast

## Linting
lint:
	@echo "$(BLUE)🔍 Running linters...$(NC)"
	npx eslint src --ext ts,tsx
	cd src-tauri && cargo clippy -- -D warnings
	@echo "$(GREEN)✅ Linting complete!$(NC)"

## Cleaning
clean: ios-clean android-clean
	@echo "$(BLUE)🧹 Cleaning all build artifacts and caches...$(NC)"
	@echo "  → Removing dist directories..."
	rm -rf dist
	rm -rf .next
	@echo "  → Removing Rust target directories..."
	rm -rf src-tauri/target
	rm -rf /Users/z/work/hanzo/app/target
	@echo "  → Removing Vite cache..."
	rm -rf node_modules/.vite
	@echo "  → Removing TypeScript build info..."
	rm -rf tsconfig.tsbuildinfo
	rm -rf src-tauri/tsconfig.tsbuildinfo
	@echo "  → Removing temp files..."
	rm -rf .turbo
	rm -rf .nx
	rm -rf /tmp/hanzo-*
	@echo "  → Killing all running processes..."
	@pkill -f "hanzo-desktop" || true
	@pkill -f "pnpm tauri" || true
	@pkill -f "cargo build" || true
	@pkill -f "hanzod" || true
	@echo "$(GREEN)✅ Clean complete!$(NC)"

clean-all: clean
	@echo "$(BLUE)🧹 Deep cleaning (including dependencies)...$(NC)"
	rm -rf node_modules
	rm -rf pnpm-lock.yaml
	rm -rf package-lock.json
	rm -rf src-tauri/Cargo.lock
	@echo "$(GREEN)✅ Deep clean complete! Run 'make install' to reinstall dependencies.$(NC)"

## Fresh build from scratch
fresh-build: clean
	@echo "$(BLUE)🚀 Building fresh Hanzo Desktop app from scratch...$(NC)"
	@echo "$(YELLOW)Step 1: Installing dependencies...$(NC)"
	pnpm install
	cd src-tauri && cargo fetch
	@echo "$(YELLOW)Step 2: Building release app...$(NC)"
	pnpm tauri build
	@echo "$(YELLOW)Step 3: Deploying to /Applications...$(NC)"
	@rm -rf "/Applications/Hanzo.app"
	@if [ -d "/Users/z/work/hanzo/app/target/release/bundle/macos/Hanzo AI.app" ]; then \
		cp -R "/Users/z/work/hanzo/app/target/release/bundle/macos/Hanzo AI.app" "/Applications/Hanzo.app"; \
		echo "$(GREEN)✅ Deployed from /Users/z/work/hanzo/app/target/release/bundle/macos/$(NC)"; \
	elif [ -d "src-tauri/target/release/bundle/macos/Hanzo AI.app" ]; then \
		cp -R "src-tauri/target/release/bundle/macos/Hanzo AI.app" "/Applications/Hanzo.app"; \
		echo "$(GREEN)✅ Deployed from src-tauri/target/release/bundle/macos/$(NC)"; \
	else \
		echo "$(RED)❌ Could not find built app bundle!$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Fresh build complete! Launching Hanzo.app...$(NC)"
	@open "/Applications/Hanzo.app"

## Development with Hot Reload (No Rust rebuilds needed!)
dev-install: ## 🔗 Install development app with symlinks (one-time setup)
	@echo "$(BLUE)🔗 Creating development app with symlinks...$(NC)"
	@echo "$(YELLOW)This links /Applications/Hanzo-Dev.app to your source code$(NC)"
	# Build a development version first
	@echo "$(CYAN)Building development binary...$(NC)"
	cd src-tauri && cargo build
	# Create the app structure
	@rm -rf "/Applications/Hanzo-Dev.app"
	@mkdir -p "/Applications/Hanzo-Dev.app/Contents/MacOS"
	@mkdir -p "/Applications/Hanzo-Dev.app/Contents/Resources"
	# Symlink the binary from target/debug (development build)
	@ln -sf "$(PWD)/../../target/debug/hanzo-desktop" "/Applications/Hanzo-Dev.app/Contents/MacOS/hanzo-desktop"
	# Copy Info.plist
	@if [ -f "src-tauri/Info.plist" ]; then \
		cp src-tauri/Info.plist "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
	else \
		echo '<?xml version="1.0" encoding="UTF-8"?>' > "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<plist version="1.0"><dict>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<key>CFBundleExecutable</key><string>hanzo-desktop</string>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<key>CFBundleIdentifier</key><string>ai.hanzo.desktop.dev</string>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<key>CFBundleName</key><string>Hanzo Dev</string>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<key>CFBundlePackageType</key><string>APPL</string>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<key>CFBundleShortVersionString</key><string>0.5.0-dev</string>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '<key>LSMinimumSystemVersion</key><string>10.15</string>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
		echo '</dict></plist>' >> "/Applications/Hanzo-Dev.app/Contents/Info.plist"; \
	fi
	# Symlink icon
	@if [ -f "src-tauri/icons/icon.icns" ]; then \
		ln -sf "$(PWD)/src-tauri/icons/icon.icns" "/Applications/Hanzo-Dev.app/Contents/Resources/icon.icns"; \
	fi
	@echo "$(GREEN)✅ Development app installed at /Applications/Hanzo-Dev.app$(NC)"
	@echo "$(CYAN)📝 Edit source files in $(PWD)$(NC)"
	@echo "$(YELLOW)🔄 Run 'make dev-app' to start with hot reload$(NC)"

dev-app: ## 🚀 Run development app with hot reload
	@echo "$(BLUE)🚀 Starting Hanzo Dev app with hot reload...$(NC)"
	@echo "$(GREEN)✅ Frontend changes reload instantly$(NC)"
	@echo "$(YELLOW)⚠️  Rust changes: run 'make dev-rebuild'$(NC)"
	@echo "$(CYAN)🔗 Using symlinked app at /Applications/Hanzo-Dev.app$(NC)"
	# Start Vite dev server in background
	@pnpm dev &
	@sleep 2
	# Run the development app
	@WEBKIT_DISABLE_COMPOSITING_MODE=1 /Applications/Hanzo-Dev.app/Contents/MacOS/hanzo-desktop

build-rust: ## 🦀 Build Rust backend only (debug mode)
	@echo "$(BLUE)🦀 Building Rust backend (debug)...$(NC)"
	cd src-tauri && cargo build
	@echo "$(GREEN)✅ Rust backend built (debug mode)$(NC)"

build-tauri: ## 🚀 Build Rust backend in release mode
	@echo "$(BLUE)🚀 Building Rust backend (release)...$(NC)"
	cd src-tauri && cargo build --release
	@echo "$(GREEN)✅ Rust backend built (release mode)$(NC)"

dev-rebuild: build-rust ## 🔨 Rebuild Rust code only (alias)

hot: ## 🔥 Start hot reload development (frontend only, fastest!)
	@echo "$(BLUE)🔥 Starting HOT RELOAD mode - Frontend changes auto-refresh!$(NC)"
	@echo "$(YELLOW)📝 Edit any .tsx/.ts file and see changes instantly$(NC)"
	@echo "$(YELLOW)🌐 Access at http://localhost:1420$(NC)"
	@echo "$(CYAN)⚡ No rebuilds needed for frontend changes!$(NC)"
	pnpm dev

hot-tauri: ## 🚀 Start Tauri with hot reload (full app experience)
	@echo "$(BLUE)🚀 Starting Tauri with HOT RELOAD enabled!$(NC)"
	@echo "$(GREEN)✅ Frontend: Hot reloads on save$(NC)"
	@echo "$(YELLOW)⚠️  Rust: Requires restart (use Ctrl+C and re-run)$(NC)"
	@echo "$(CYAN)💡 Tip: Use 'make hot' for pure frontend development$(NC)"
	pnpm tauri:dev

hot-ui: ## 🌐 Remote UI mode (develop in browser)
	@echo "$(BLUE)🌐 Starting REMOTE UI mode - Use your browser!$(NC)"
	@echo "$(GREEN)✅ Fastest iteration for UI development$(NC)"
	@echo "$(YELLOW)🔗 Will open in your default browser$(NC)"
	TAURI_REMOTE_UI=1 pnpm tauri:dev

dev-frontend: hot  ## Alias for hot reload
dev-full: hot-tauri  ## Alias for full Tauri hot reload

## Quick commands and aliases
ios: ios-dev  # Alias for iOS development
android: android-dev  # Alias for Android development

# New naming convention aliases (using different separator for make compatibility)
dev-ios: ios-dev
build-ios: ios-build
ios-init-alias: ios-init
ios-devices: ios-list
ios-xcode: ios-open

dev-android: android-dev
build-android: android-build
android-init-alias: android-init
android-devices: android-list

# Desktop platform aliases
build-macos: build-dmg
build-windows:
	@echo "$(RED)Windows builds must be run on Windows or in CI$(NC)"
build-linux:
	@echo "$(RED)Linux builds must be run on Linux or in CI$(NC)"

# Utility aliases
format:
	@echo "$(BLUE)💅 Formatting code...$(NC)"
	npx prettier --write "src/**/*.{ts,tsx,css}"
	cd src-tauri && cargo fmt
	@echo "$(GREEN)✅ Code formatted!$(NC)"

icons:
	@echo "$(BLUE)🎨 Regenerating all icons from hanzo-icon.svg...$(NC)"
	@cd src-tauri/icons && \
	echo "  → Generating PNG icons with proper RGBA format..." && \
	magick hanzo-icon.svg -resize 512x512 -background none -depth 8 -define png:color-type=6 icon.png && \
	magick hanzo-icon.svg -resize 512x512 -background none -depth 8 -define png:color-type=6 app-icon.png && \
	magick hanzo-icon.svg -resize 32x32 -background none -depth 8 -define png:color-type=6 32x32.png && \
	magick hanzo-icon.svg -resize 128x128 -background none -depth 8 -define png:color-type=6 128x128.png && \
	magick hanzo-icon.svg -resize 256x256 -background none -depth 8 -define png:color-type=6 128x128@2x.png && \
	magick hanzo-icon.svg -resize 30x30 -background none -depth 8 -define png:color-type=6 Square30x30Logo.png && \
	magick hanzo-icon.svg -resize 44x44 -background none -depth 8 -define png:color-type=6 Square44x44Logo.png && \
	magick hanzo-icon.svg -resize 71x71 -background none -depth 8 -define png:color-type=6 Square71x71Logo.png && \
	magick hanzo-icon.svg -resize 89x89 -background none -depth 8 -define png:color-type=6 Square89x89Logo.png && \
	magick hanzo-icon.svg -resize 107x107 -background none -depth 8 -define png:color-type=6 Square107x107Logo.png && \
	magick hanzo-icon.svg -resize 142x142 -background none -depth 8 -define png:color-type=6 Square142x142Logo.png && \
	magick hanzo-icon.svg -resize 150x150 -background none -depth 8 -define png:color-type=6 Square150x150Logo.png && \
	magick hanzo-icon.svg -resize 284x284 -background none -depth 8 -define png:color-type=6 Square284x284Logo.png && \
	magick hanzo-icon.svg -resize 310x310 -background none -depth 8 -define png:color-type=6 Square310x310Logo.png && \
	magick hanzo-icon.svg -resize 50x50 -background none -depth 8 -define png:color-type=6 StoreLogo.png && \
	magick hanzo-icon.svg -resize 620x300 -background none -depth 8 -define png:color-type=6 SplashScreen.png && \
	magick hanzo-icon.svg -resize 24x24 -background none -depth 8 -define png:color-type=6 tray-icon.png && \
	magick hanzo-icon.svg -resize 24x24 -background none -depth 8 -define png:color-type=6 tray-icon-macos.png && \
	echo "  → Generating macOS .icns..." && \
	rm -rf /tmp/hanzo-icon.iconset && \
	mkdir -p /tmp/hanzo-icon.iconset && \
	magick hanzo-icon.svg -resize 16x16 /tmp/hanzo-icon.iconset/icon_16x16.png && \
	magick hanzo-icon.svg -resize 32x32 /tmp/hanzo-icon.iconset/icon_16x16@2x.png && \
	magick hanzo-icon.svg -resize 32x32 /tmp/hanzo-icon.iconset/icon_32x32.png && \
	magick hanzo-icon.svg -resize 64x64 /tmp/hanzo-icon.iconset/icon_32x32@2x.png && \
	magick hanzo-icon.svg -resize 128x128 /tmp/hanzo-icon.iconset/icon_128x128.png && \
	magick hanzo-icon.svg -resize 256x256 /tmp/hanzo-icon.iconset/icon_128x128@2x.png && \
	magick hanzo-icon.svg -resize 256x256 /tmp/hanzo-icon.iconset/icon_256x256.png && \
	magick hanzo-icon.svg -resize 512x512 /tmp/hanzo-icon.iconset/icon_256x256@2x.png && \
	magick hanzo-icon.svg -resize 512x512 /tmp/hanzo-icon.iconset/icon_512x512.png && \
	magick hanzo-icon.svg -resize 1024x1024 /tmp/hanzo-icon.iconset/icon_512x512@2x.png && \
	iconutil -c icns /tmp/hanzo-icon.iconset -o icon.icns && \
	echo "  → Generating Windows .ico..." && \
	magick hanzo-icon.svg -resize 16x16 icon-16.png && \
	magick hanzo-icon.svg -resize 32x32 icon-32.png && \
	magick hanzo-icon.svg -resize 48x48 icon-48.png && \
	magick hanzo-icon.svg -resize 64x64 icon-64.png && \
	magick hanzo-icon.svg -resize 128x128 icon-128.png && \
	magick hanzo-icon.svg -resize 256x256 icon-256.png && \
	magick icon-16.png icon-32.png icon-48.png icon-64.png icon-128.png icon-256.png icon.ico && \
	rm -f icon-16.png icon-32.png icon-48.png icon-64.png icon-128.png icon-256.png && \
	echo "  → Generating favicon..." && \
	cp hanzo-icon.svg ../../public/favicon.svg && \
	magick hanzo-icon.svg -resize 32x32 -depth 8 -define png:color-type=6 ../../public/favicon.ico && \
	magick hanzo-icon.svg -resize 180x180 -depth 8 -define png:color-type=6 ../../public/apple-touch-icon.png && \
	magick hanzo-icon.svg -resize 192x192 -depth 8 -define png:color-type=6 ../../public/icon-192.png && \
	magick hanzo-icon.svg -resize 512x512 -depth 8 -define png:color-type=6 ../../public/icon-512.png
	@echo "$(GREEN)✅ All icons regenerated from hanzo-icon.svg!$(NC)"
	@echo "$(GREEN)   • PNG icons for Tauri$(NC)"
	@echo "$(GREEN)   • macOS .icns file$(NC)"
	@echo "$(GREEN)   • Windows .ico file$(NC)"
	@echo "$(GREEN)   • Web favicons$(NC)"

screenshot:
	@echo "$(BLUE)📸 Taking app screenshot...$(NC)"
	@screencapture -x -W public/onboarding.png
	@echo "$(GREEN)✅ Screenshot saved to public/onboarding.png$(NC)"

assets: icons screenshot
	@echo "$(GREEN)✅ All assets generated!$(NC)"

build-hanzo-node:
	@echo "$(BLUE)🔨 Building hanzo-node from ~/work/hanzo/node...$(NC)"
	@cd ~/work/hanzo/node && cargo build --release --bin hanzo_node
	@echo "$(BLUE)📦 Copying hanzo-node binary to src-tauri...$(NC)"
	@cp ~/work/hanzo/node/target/release/hanzo_node src-tauri/hanzo-node-$(UNAME_M)-$(shell echo $(UNAME_S) | tr '[:upper:]' '[:lower:]')
	@echo "$(GREEN)✅ hanzo-node binary installed$(NC)"

# Combined mobile setup
mobile-setup: ios-init android-init
	@echo "$(GREEN)✅ Mobile platforms ready!$(NC)"

# Check all dependencies
check-deps:
	@echo "$(BLUE)🔍 Checking dependencies...$(NC)"
	@command -v node >/dev/null 2>&1 && echo "$(GREEN)✓ node$(NC)" || echo "$(RED)✗ node$(NC)"
	@command -v npm >/dev/null 2>&1 && echo "$(GREEN)✓ npm$(NC)" || echo "$(RED)✗ npm$(NC)"
	@command -v rustc >/dev/null 2>&1 && echo "$(GREEN)✓ rust$(NC)" || echo "$(RED)✗ rust$(NC)"
	@command -v cargo >/dev/null 2>&1 && echo "$(GREEN)✓ cargo$(NC)" || echo "$(RED)✗ cargo$(NC)"
	@command -v xcrun >/dev/null 2>&1 && echo "$(GREEN)✓ xcode$(NC)" || echo "$(RED)✗ xcode$(NC)"
	@[ -n "$$ANDROID_HOME" ] && echo "$(GREEN)✓ android sdk$(NC)" || echo "$(RED)✗ android sdk$(NC)"