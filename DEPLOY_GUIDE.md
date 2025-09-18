# Hanzo UI Templates - Deployment Guide

## ✅ Current Status

### What's Ready:
1. **10 Complete Templates** - Each with unique color schemes
2. **Gallery Page** - Works locally at http://localhost:3000/gallery
3. **Deployment Scripts** - Ready to push to Hugging Face
4. **Standalone Apps** - Each template is a complete Next.js app

## 🚀 Deploy to Hugging Face

### Prerequisites

1. **Install HF CLI**:
```bash
pip install huggingface-hub
```

2. **Login to HF**:
```bash
huggingface-cli login
```

### Deploy All Templates

Run this single command to deploy ALL 10 templates as individual repos:

```bash
./scripts/setup-hf-templates.sh
```

This will:
- Create 10 individual Space repos in `hanzo-community` organization
- Each template will be a complete, standalone Next.js app
- Templates will be available at:
  - https://huggingface.co/spaces/hanzo-community/ai-chat-interface
  - https://huggingface.co/spaces/hanzo-community/ecommerce-storefront
  - https://huggingface.co/spaces/hanzo-community/analytics-dashboard
  - https://huggingface.co/spaces/hanzo-community/saas-landing
  - https://huggingface.co/spaces/hanzo-community/social-feed
  - https://huggingface.co/spaces/hanzo-community/kanban-board
  - https://huggingface.co/spaces/hanzo-community/markdown-editor
  - https://huggingface.co/spaces/hanzo-community/crypto-portfolio
  - https://huggingface.co/spaces/hanzo-community/blog-platform
  - https://huggingface.co/spaces/hanzo-community/video-streaming

### Deploy Gallery

After templates are deployed, push the gallery:

```bash
./scripts/push-gallery.sh
```

Gallery will be at: https://huggingface.co/spaces/hanzo-community/gallery

### Or Use Makefile

```bash
# Deploy everything at once
make upload-all

# Or deploy separately
make upload-templates  # Push all 10 templates
make upload-gallery    # Push gallery
```

## 📁 What Gets Created

Each template becomes a complete app with:

```
template-name/
├── app/
│   ├── page.tsx         # Main template component
│   ├── layout.tsx       # Next.js layout
│   └── globals.css      # Tailwind styles
├── components/
│   └── ui/              # Only needed UI components
│       ├── card.tsx
│       ├── button.tsx
│       ├── badge.tsx
│       └── ...
├── lib/
│   └── utils.ts         # cn() utility
├── package.json         # All dependencies
├── next.config.js       # Next.js config
├── tailwind.config.js   # Tailwind config
├── Dockerfile           # For HF Spaces
└── README.md           # HF Space metadata
```

## 🎨 Template Features

Each template has:
- **Unique color scheme** (10 different themes)
- **Standalone deployment** (no external dependencies)
- **Docker support** (runs on HF Spaces)
- **TypeScript** ready
- **Responsive design**
- **Dark mode** support

## 🔧 Local Testing

Before deploying, test locally:

```bash
# View gallery
pnpm dev
open http://localhost:3000/gallery

# Test individual template
open http://localhost:3000/templates/ai-chat-interface

# Check generated template
cd hf-templates/ai-chat-interface
npm install
npm run dev
```

## ⚠️ Important Notes

1. **Organization**: Templates will be created in `hanzo-community` org on HF
2. **Build Time**: Each Space takes 3-5 minutes to build on HF
3. **Permissions**: You need write access to `hanzo-community` org
4. **Overwrite**: Script will force-push (overwrite existing repos)

## 🐛 Troubleshooting

If push fails:

1. **Check HF login**:
```bash
huggingface-cli whoami
```

2. **Check organization access**:
```bash
huggingface-cli repo list hanzo-community
```

3. **Manual push** (if script fails):
```bash
cd hf-templates/[template-name]
git remote add hf https://huggingface.co/spaces/hanzo-community/[template-name]
git push -f hf main
```

4. **Check Space logs**:
Visit the Space URL and check the build logs in the Settings tab.

## 📊 Templates Overview

| Template | Status | Local URL | HF URL |
|----------|--------|-----------|---------|
| AI Chat Interface | ✅ Ready | http://localhost:3000/templates/ai-chat-interface | https://huggingface.co/spaces/hanzo-community/ai-chat-interface |
| E-commerce Storefront | ✅ Ready | http://localhost:3000/templates/ecommerce-storefront | https://huggingface.co/spaces/hanzo-community/ecommerce-storefront |
| Analytics Dashboard | ✅ Ready | http://localhost:3000/templates/analytics-dashboard | https://huggingface.co/spaces/hanzo-community/analytics-dashboard |
| SaaS Landing | ✅ Ready | http://localhost:3000/templates/saas-landing | https://huggingface.co/spaces/hanzo-community/saas-landing |
| Social Feed | ✅ Ready | http://localhost:3000/templates/social-feed | https://huggingface.co/spaces/hanzo-community/social-feed |
| Kanban Board | ✅ Ready | http://localhost:3000/templates/kanban-board | https://huggingface.co/spaces/hanzo-community/kanban-board |
| Markdown Editor | ✅ Ready | http://localhost:3000/templates/markdown-editor | https://huggingface.co/spaces/hanzo-community/markdown-editor |
| Crypto Portfolio | ✅ Ready | http://localhost:3000/templates/crypto-portfolio | https://huggingface.co/spaces/hanzo-community/crypto-portfolio |
| Blog Platform | ✅ Ready | http://localhost:3000/templates/blog-platform | https://huggingface.co/spaces/hanzo-community/blog-platform |
| Video Streaming | ✅ Ready | http://localhost:3000/templates/video-streaming | https://huggingface.co/spaces/hanzo-community/video-streaming |

## 🎉 Ready to Deploy!

Everything is set up and tested. Just run:

```bash
# Deploy all templates and gallery
make upload-all
```

Templates will be live in ~5 minutes!