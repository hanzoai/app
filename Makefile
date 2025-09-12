# Hanzo Desktop App Makefile
# Commands for building and managing the Hanzo desktop application

# Variables
DESKTOP_DIR = apps/hanzo-desktop
TAURI_DIR = $(DESKTOP_DIR)/src-tauri
ICONS_DIR = $(TAURI_DIR)/icons
PYTHON = python3

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
NC = \033[0m # No Color

.PHONY: help
help: ## Show this help message
	@echo "$(GREEN)Hanzo Desktop App Makefile$(NC)"
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

.PHONY: icons
icons: ## Generate all application icons for macOS, Windows, and Linux
	@echo "$(GREEN)🎨 Generating Hanzo icons...$(NC)"
	@cd $(shell pwd) && $(PYTHON) generate_hanzo_icons.py
	@echo "$(GREEN)✅ Icons generated successfully!$(NC)"

.PHONY: icons-check
icons-check: ## Check if required tools for icon generation are installed
	@echo "$(GREEN)Checking icon generation dependencies...$(NC)"
	@which rsvg-convert > /dev/null 2>&1 && echo "✅ rsvg-convert found" || echo "❌ rsvg-convert not found - install with: brew install librsvg"
	@which inkscape > /dev/null 2>&1 && echo "✅ inkscape found" || echo "⚠️  inkscape not found (optional) - install with: brew install inkscape"
	@which convert > /dev/null 2>&1 && echo "✅ ImageMagick found" || echo "❌ ImageMagick not found - install with: brew install imagemagick"
	@which iconutil > /dev/null 2>&1 && echo "✅ iconutil found (macOS)" || echo "⚠️  iconutil not found (only available on macOS)"

.PHONY: install-deps
install-deps: ## Install dependencies for the desktop app
	@echo "$(GREEN)Installing dependencies...$(NC)"
	cd $(DESKTOP_DIR) && pnpm install
	@echo "$(GREEN)✅ Dependencies installed!$(NC)"

.PHONY: dev
dev: ## Run the desktop app in development mode
	@echo "$(GREEN)Starting Hanzo desktop app in development mode...$(NC)"
	cd $(DESKTOP_DIR) && pnpm tauri dev

.PHONY: build
build: icons ## Build the desktop app for production
	@echo "$(GREEN)Building Hanzo desktop app...$(NC)"
	cd $(DESKTOP_DIR) && pnpm tauri build
	@echo "$(GREEN)✅ Build complete!$(NC)"

.PHONY: build-mac
build-mac: icons ## Build the desktop app for macOS only
	@echo "$(GREEN)Building Hanzo desktop app for macOS...$(NC)"
	cd $(DESKTOP_DIR) && pnpm tauri build --target universal-apple-darwin
	@echo "$(GREEN)✅ macOS build complete!$(NC)"

.PHONY: clean
clean: ## Clean build artifacts and generated files
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf $(DESKTOP_DIR)/dist
	rm -rf $(TAURI_DIR)/target
	rm -rf $(DESKTOP_DIR)/node_modules/.vite
	@echo "$(GREEN)✅ Cleaned!$(NC)"

.PHONY: clean-icons
clean-icons: ## Clean generated icon files
	@echo "$(YELLOW)Cleaning icon files...$(NC)"
	rm -f $(ICONS_DIR)/*.png
	rm -f $(ICONS_DIR)/*.ico
	rm -f $(ICONS_DIR)/*.icns
	@echo "$(GREEN)✅ Icons cleaned!$(NC)"

.PHONY: regenerate-icons
regenerate-icons: clean-icons icons ## Clean and regenerate all icons

.PHONY: setup-macos
setup-macos: ## Install required tools for icon generation on macOS
	@echo "$(GREEN)Installing icon generation tools for macOS...$(NC)"
	@which brew > /dev/null 2>&1 || (echo "$(RED)Homebrew not found! Please install from https://brew.sh$(NC)" && exit 1)
	brew install librsvg imagemagick
	@echo "$(GREEN)✅ Tools installed!$(NC)"

.PHONY: test
test: ## Run tests for the desktop app
	@echo "$(GREEN)Running tests...$(NC)"
	cd $(DESKTOP_DIR) && pnpm test

.PHONY: lint
lint: ## Run linting for the desktop app
	@echo "$(GREEN)Running linter...$(NC)"
	cd $(DESKTOP_DIR) && pnpm lint

.PHONY: format
format: ## Format code using prettier
	@echo "$(GREEN)Formatting code...$(NC)"
	cd $(DESKTOP_DIR) && pnpm format

.PHONY: update-tauri
update-tauri: ## Update Tauri dependencies
	@echo "$(GREEN)Updating Tauri...$(NC)"
	cd $(DESKTOP_DIR) && pnpm update @tauri-apps/cli @tauri-apps/api

.PHONY: rust-check
rust-check: ## Check Rust code in src-tauri
	@echo "$(GREEN)Checking Rust code...$(NC)"
	cd $(TAURI_DIR) && cargo check

.PHONY: rust-fmt
rust-fmt: ## Format Rust code in src-tauri
	@echo "$(GREEN)Formatting Rust code...$(NC)"
	cd $(TAURI_DIR) && cargo fmt

.PHONY: screenshots
screenshots: ## Generate screenshots for documentation (requires app to be running)
	@echo "$(GREEN)Generating screenshots...$(NC)"
	@echo "$(YELLOW)Note: Make sure the Hanzo app is running first!$(NC)"
	@echo "Screenshots will be saved to assets/"
	@mkdir -p assets/screenshots
	@echo "$(YELLOW)Please manually take screenshots and save them to assets/screenshots/$(NC)"
	@echo "Required screenshots:"
	@echo "  1. Main window (dock icon visible)"
	@echo "  2. Menu bar icon and dropdown"
	@echo "  3. In-app icon usage"
	@echo "  4. Getting started screen"

.PHONY: check-env
check-env: ## Check if the development environment is properly set up
	@echo "$(GREEN)Checking development environment...$(NC)"
	@node --version > /dev/null 2>&1 && echo "✅ Node.js: $$(node --version)" || echo "❌ Node.js not found"
	@pnpm --version > /dev/null 2>&1 && echo "✅ pnpm: v$$(pnpm --version)" || echo "❌ pnpm not found - install with: npm install -g pnpm"
	@cargo --version > /dev/null 2>&1 && echo "✅ Rust: $$(cargo --version)" || echo "❌ Rust not found - install from: https://rustup.rs"
	@rustc --version > /dev/null 2>&1 && echo "✅ rustc: $$(rustc --version)" || echo "❌ rustc not found"
	@$(PYTHON) --version > /dev/null 2>&1 && echo "✅ Python: $$($(PYTHON) --version)" || echo "❌ Python 3 not found"

.PHONY: all
all: icons build ## Generate icons and build the app

# Default target
.DEFAULT_GOAL := help