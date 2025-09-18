#!/bin/bash

# Setup shared model storage between Hanzo Desktop and Hanzo Node
# Both will use ~/.hanzo for model storage

set -e

echo "🔗 Setting up shared model storage for Hanzo"
echo "==========================================="

# Create ~/.hanzo directories if they don't exist
echo "📁 Creating ~/.hanzo structure..."
mkdir -p ~/.hanzo/models
mkdir -p ~/.hanzo/ollama/models
mkdir -p ~/.hanzo/node_storage

# Link Ollama models to ~/.hanzo if Ollama is using default location
if [ -d ~/.ollama/models ] && [ ! -L ~/.ollama/models ]; then
    echo "🔄 Moving existing Ollama models to ~/.hanzo..."

    # Move existing models if any
    if [ "$(ls -A ~/.ollama/models)" ]; then
        cp -R ~/.ollama/models/* ~/.hanzo/ollama/models/ 2>/dev/null || true
    fi

    # Backup and create symlink
    mv ~/.ollama/models ~/.ollama/models.backup
    ln -sf ~/.hanzo/ollama/models ~/.ollama/models
    echo "✅ Ollama models linked to ~/.hanzo/ollama/models"
elif [ -L ~/.ollama/models ]; then
    echo "✓ Ollama models already linked"
else
    echo "📝 Creating Ollama models symlink..."
    mkdir -p ~/.ollama
    ln -sf ~/.hanzo/ollama/models ~/.ollama/models
fi

# Setup app data directories to use ~/.hanzo
APP_SUPPORT_DIR="$HOME/Library/Application Support"

# For com.hanzo.desktop (production app)
if [ ! -d "$APP_SUPPORT_DIR/com.hanzo.desktop" ]; then
    mkdir -p "$APP_SUPPORT_DIR/com.hanzo.desktop"
fi

# Link node_storage to ~/.hanzo
if [ ! -L "$APP_SUPPORT_DIR/com.hanzo.desktop/node_storage" ]; then
    echo "🔗 Linking node_storage for production app..."
    rm -rf "$APP_SUPPORT_DIR/com.hanzo.desktop/node_storage"
    ln -sf ~/.hanzo/node_storage "$APP_SUPPORT_DIR/com.hanzo.desktop/node_storage"
fi

# For ai.hanzo.desktop.dev (dev app)
if [ ! -d "$APP_SUPPORT_DIR/ai.hanzo.desktop.dev" ]; then
    mkdir -p "$APP_SUPPORT_DIR/ai.hanzo.desktop.dev"
fi

# Link node_storage to ~/.hanzo
if [ ! -L "$APP_SUPPORT_DIR/ai.hanzo.desktop.dev/node_storage" ]; then
    echo "🔗 Linking node_storage for dev app..."
    rm -rf "$APP_SUPPORT_DIR/ai.hanzo.desktop.dev/node_storage"
    ln -sf ~/.hanzo/node_storage "$APP_SUPPORT_DIR/ai.hanzo.desktop.dev/node_storage"
fi

# Create a models info file
cat > ~/.hanzo/README.md << 'EOF'
# Hanzo Shared Model Storage

This directory contains shared models and data for:
- Hanzo Desktop app
- Hanzo Node
- Ollama integration

## Directory Structure

```
~/.hanzo/
├── models/           # Hanzo-specific models
├── ollama/
│   └── models/       # Ollama models (symlinked from ~/.ollama/models)
├── node_storage/     # Shared node storage
└── README.md         # This file
```

## Model Management

### Download models via Desktop App:
1. Open Hanzo or Hanzo Dev app
2. Go to Node Manager
3. Download models through the UI

### Download models via CLI:
```bash
# Using Ollama directly
ollama pull llama2
ollama pull mistral

# Models will be stored in ~/.hanzo/ollama/models
```

### Check available models:
```bash
ls -la ~/.hanzo/ollama/models/manifests/
```

## Notes
- Both Hanzo.app and Hanzo Dev.app share this storage
- Models downloaded in one app are available in the other
- The Hanzo node can also access these models
EOF

echo ""
echo "==========================================="
echo "✅ Shared model storage setup complete!"
echo ""
echo "📍 Model Locations:"
echo "   ~/.hanzo/models/         - Hanzo models"
echo "   ~/.hanzo/ollama/models/  - Ollama models"
echo "   ~/.hanzo/node_storage/   - Node data"
echo ""
echo "🔗 Symlinks Created:"
echo "   ~/.ollama/models → ~/.hanzo/ollama/models"
echo "   ~/Library/Application Support/com.hanzo.desktop/node_storage → ~/.hanzo/node_storage"
echo "   ~/Library/Application Support/ai.hanzo.desktop.dev/node_storage → ~/.hanzo/node_storage"
echo ""
echo "💡 Next Steps:"
echo "   1. Open Hanzo.app or Hanzo Dev.app"
echo "   2. Go to Node Manager to download models"
echo "   3. Models will be stored in ~/.hanzo"
echo ""
echo "🤖 To download a model now:"
echo "   ollama pull llama2:7b"
echo "   ollama pull mistral"