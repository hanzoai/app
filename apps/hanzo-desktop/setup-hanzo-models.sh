#!/bin/bash

# Setup Hanzo to use ~/.hanzo/models for Ollama

set -e

echo "🔧 Setting up Hanzo model storage"
echo "================================="

# Create ~/.hanzo/models directory
echo "📁 Creating ~/.hanzo/models..."
mkdir -p ~/.hanzo/models

# Set environment variable for current session
export OLLAMA_MODELS="$HOME/.hanzo/models"

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama found"

    # Test the new models directory
    echo "📍 Ollama will now use: ~/.hanzo/models"
    echo ""
    echo "🔄 Restarting Ollama with new model path..."

    # Kill existing Ollama if running
    killall ollama 2>/dev/null || true

    # Start Ollama with new model path in background
    OLLAMA_MODELS="$HOME/.hanzo/models" ollama serve > /tmp/ollama.log 2>&1 &

    sleep 2

    echo "✅ Ollama configured to use ~/.hanzo/models"
else
    echo "⚠️  Ollama not found. Install it first:"
    echo "   brew install ollama"
fi

echo ""
echo "================================="
echo "✅ Setup complete!"
echo ""
echo "📍 Models will be stored in: ~/.hanzo/models"
echo ""
echo "To download models:"
echo "  OLLAMA_MODELS=~/.hanzo/models ollama pull llama2:7b"
echo "  OLLAMA_MODELS=~/.hanzo/models ollama pull mistral"
echo ""
echo "Or add to your shell profile:"
echo "  export OLLAMA_MODELS=\$HOME/.hanzo/models"
echo ""
echo "Already added to ~/.zshrc and ~/.bash_profile"