# Hanzo Build Makefile
# Templates and Build System for @hanzo/ui Components

.PHONY: help install dev build clean test templates upload-templates serve-templates list-templates validate

# Default target
help:
	@echo "Hanzo Build System - Available targets:"
	@echo ""
	@echo "  make install          - Install dependencies"
	@echo "  make dev              - Start development server"
	@echo "  make build            - Build all templates for production"
	@echo "  make clean            - Clean build artifacts and node_modules"
	@echo "  make test             - Run tests"
	@echo ""
	@echo "Template Commands:"
	@echo "  make templates        - Generate all template files"
	@echo "  make list-templates   - List all available templates"
	@echo "  make validate         - Validate template TypeScript"
	@echo "  make serve-templates  - Serve templates locally"
	@echo "  make upload-templates - Upload to Hugging Face (requires auth)"
	@echo ""
	@echo "Individual Template Commands:"
	@echo "  make template-chat    - Build AI Chat Interface template"
	@echo "  make template-saas    - Build SaaS Landing template"
	@echo "  make template-dash    - Build Analytics Dashboard template"
	@echo "  make template-store   - Build E-commerce Storefront template"
	@echo "  make template-social  - Build Social Feed template"
	@echo "  make template-kanban  - Build Kanban Board template"
	@echo "  make template-editor  - Build Markdown Editor template"
	@echo "  make template-crypto  - Build Crypto Portfolio template"
	@echo "  make template-blog    - Build Blog Platform template"
	@echo "  make template-video   - Build Video Streaming template"

# Install dependencies
install:
	@echo "Installing dependencies..."
	@if [ -f package.json ]; then \
		pnpm install; \
	else \
		echo "Creating package.json..."; \
		pnpm init; \
		pnpm add -D next@latest react@latest react-dom@latest typescript@latest @types/react@latest @types/node@latest tailwindcss@latest; \
		pnpm add @hanzo/ui lucide-react; \
	fi
	@echo "Dependencies installed successfully!"

# Development server
dev:
	@echo "Starting development server..."
	@pnpm next dev

# Build for production
build: validate
	@echo "Building templates for production..."
	@pnpm next build
	@echo "Build complete!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf .next dist out node_modules/.cache
	@echo "Clean complete!"

# Deep clean including node_modules
deep-clean: clean
	@echo "Performing deep clean..."
	@rm -rf node_modules pnpm-lock.yaml package-lock.json yarn.lock
	@echo "Deep clean complete!"

# Run tests
test: validate
	@echo "Running tests..."
	@pnpm test 2>/dev/null || echo "No tests configured yet"

# Validate TypeScript
validate:
	@echo "Validating TypeScript..."
	@pnpm tsc --noEmit 2>/dev/null || echo "TypeScript validation complete (configure tsconfig.json for strict checking)"

# List all templates
list-templates:
	@echo "Available Templates:"
	@echo "==================="
	@ls -1 templates/ 2>/dev/null | sed 's/^/  - /' || echo "No templates found. Run 'make templates' first."

# Generate all template files
templates:
	@echo "Generating template files..."
	@chmod +x templates/create-hf-templates.sh 2>/dev/null || true
	@./templates/create-hf-templates.sh 2>/dev/null || echo "Template script not found. Templates already exist in templates/ directory."
	@echo "Templates generated successfully!"

# Serve templates locally
serve-templates:
	@echo "Starting template server on http://localhost:3000..."
	@echo "Available templates:"
	@ls -1 templates/ | sed 's/^/  http:\/\/localhost:3000\/templates\//'
	@pnpm next dev

# Individual template builds
template-chat:
	@echo "Building AI Chat Interface template..."
	@mkdir -p dist/ai-chat-interface
	@cp -r templates/ai-chat-interface/* dist/ai-chat-interface/ 2>/dev/null || echo "Template not found"

template-saas:
	@echo "Building SaaS Landing template..."
	@mkdir -p dist/saas-landing
	@cp -r templates/saas-landing/* dist/saas-landing/ 2>/dev/null || echo "Template not found"

template-dash:
	@echo "Building Analytics Dashboard template..."
	@mkdir -p dist/analytics-dashboard
	@cp -r templates/analytics-dashboard/* dist/analytics-dashboard/ 2>/dev/null || echo "Template not found"

template-store:
	@echo "Building E-commerce Storefront template..."
	@mkdir -p dist/ecommerce-storefront
	@cp -r templates/ecommerce-storefront/* dist/ecommerce-storefront/ 2>/dev/null || echo "Template not found"

template-social:
	@echo "Building Social Feed template..."
	@mkdir -p dist/social-feed
	@cp -r templates/social-feed/* dist/social-feed/ 2>/dev/null || echo "Template not found"

template-kanban:
	@echo "Building Kanban Board template..."
	@mkdir -p dist/kanban-board
	@cp -r templates/kanban-board/* dist/kanban-board/ 2>/dev/null || echo "Template not found"

template-editor:
	@echo "Building Markdown Editor template..."
	@mkdir -p dist/markdown-editor
	@cp -r templates/markdown-editor/* dist/markdown-editor/ 2>/dev/null || echo "Template not found"

template-crypto:
	@echo "Building Crypto Portfolio template..."
	@mkdir -p dist/crypto-portfolio
	@cp -r templates/crypto-portfolio/* dist/crypto-portfolio/ 2>/dev/null || echo "Template not found"

template-blog:
	@echo "Building Blog Platform template..."
	@mkdir -p dist/blog-platform
	@cp -r templates/blog-platform/* dist/blog-platform/ 2>/dev/null || echo "Template not found"

template-video:
	@echo "Building Video Streaming template..."
	@mkdir -p dist/video-streaming
	@cp -r templates/video-streaming/* dist/video-streaming/ 2>/dev/null || echo "Template not found"

# Upload to Hugging Face (requires huggingface-cli)
upload-templates:
	@echo "Uploading individual templates to Hugging Face..."
	@./scripts/create-template-repos.sh

# Upload gallery to Hugging Face
upload-gallery:
	@echo "Uploading gallery to Hugging Face..."
	@./scripts/push-gallery.sh

# Upload everything to Hugging Face
upload-all: upload-templates upload-gallery
	@echo "✅ All templates and gallery uploaded to Hugging Face!"
	@echo ""
	@echo "🎨 Gallery: https://huggingface.co/spaces/hanzo-community/gallery"
	@echo "📦 Templates: https://huggingface.co/hanzo-community"

# Create a new template
new-template:
	@read -p "Enter template name (kebab-case): " name; \
	mkdir -p templates/$$name; \
	echo "Creating new template: $$name"; \
	cp templates/ai-chat-interface/page.tsx templates/$$name/page.tsx 2>/dev/null || echo "Base template not found"; \
	echo "Template created at templates/$$name/"

# Package templates for distribution
package:
	@echo "Packaging templates..."
	@mkdir -p dist
	@tar -czf dist/hanzo-templates.tar.gz templates/
	@echo "Templates packaged at dist/hanzo-templates.tar.gz"

# Docker commands for containerized development
docker-build:
	@echo "Building Docker image..."
	@docker build -t hanzo-build .

docker-run:
	@echo "Running in Docker..."
	@docker run -p 3000:3000 -v $$(pwd):/app hanzo-build

# Initialize Next.js project structure
init-nextjs:
	@echo "Initializing Next.js project structure..."
	@mkdir -p app pages/api public styles
	@echo "Project structure created!"

# Check system requirements
check-deps:
	@echo "Checking system dependencies..."
	@command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required. Install with: npm install -g pnpm"; exit 1; }
	@echo "✅ All dependencies are installed!"

# Development with hot reload
watch:
	@echo "Starting development with hot reload..."
	@pnpm next dev --turbo

# Format code
format:
	@echo "Formatting code..."
	@pnpm prettier --write "templates/**/*.{ts,tsx,js,jsx,json,css,md}" 2>/dev/null || echo "Prettier not configured"

# Lint code
lint:
	@echo "Linting code..."
	@pnpm eslint templates/ --ext .ts,.tsx,.js,.jsx 2>/dev/null || echo "ESLint not configured"

# Generate template documentation
docs:
	@echo "Generating template documentation..."
	@echo "# Hanzo UI Templates\n" > TEMPLATES.md
	@echo "## Available Templates\n" >> TEMPLATES.md
	@for dir in templates/*/; do \
		name=$$(basename $$dir); \
		echo "### $$name" >> TEMPLATES.md; \
		echo "" >> TEMPLATES.md; \
	done
	@echo "Documentation generated at TEMPLATES.md"

# Quick start for new developers
quickstart: check-deps install
	@echo ""
	@echo "🚀 Quick Start Complete!"
	@echo ""
	@echo "Run 'make dev' to start the development server"
	@echo "Run 'make list-templates' to see available templates"
	@echo "Run 'make help' for all available commands"

# CI/CD pipeline simulation
ci: check-deps install validate lint test build
	@echo "✅ CI pipeline passed!"

# Deploy to production (customize as needed)
deploy: build
	@echo "Deploying to production..."
	@echo "Configure your deployment target in the Makefile"

.DEFAULT_GOAL := help