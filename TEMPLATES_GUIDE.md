# Hanzo UI Templates Guide

## 🎨 Overview

This project contains 10 production-ready templates built exclusively with @hanzo/ui components, each with its own unique color scheme. The templates are designed to be:

1. **Viewed locally** in a gallery at http://localhost:3000/gallery
2. **Pushed to Hugging Face** as individual repos in the hanzo-community organization
3. **Forked and customized** by developers for their own projects

## 📦 Templates

Each template has its own unique theme:

| Template | Color Scheme | HF Space URL |
|----------|-------------|--------------|
| AI Chat Interface | Violet/Purple gradient | https://huggingface.co/spaces/hanzo-community/ai-chat-interface |
| E-commerce Storefront | Orange/Pink gradient | https://huggingface.co/spaces/hanzo-community/ecommerce-storefront |
| Analytics Dashboard | Indigo theme | https://huggingface.co/spaces/hanzo-community/analytics-dashboard |
| SaaS Landing | Emerald/Teal gradient | https://huggingface.co/spaces/hanzo-community/saas-landing |
| Social Feed | Cyan accents | https://huggingface.co/spaces/hanzo-community/social-feed |
| Kanban Board | Amber/Sky multi-color | https://huggingface.co/spaces/hanzo-community/kanban-board |
| Markdown Editor | Blue theme | https://huggingface.co/spaces/hanzo-community/markdown-editor |
| Crypto Portfolio | Yellow/Orange gradient | https://huggingface.co/spaces/hanzo-community/crypto-portfolio |
| Blog Platform | Rose/Pink gradient | https://huggingface.co/spaces/hanzo-community/blog-platform |
| Video Streaming | Red/YouTube theme | https://huggingface.co/spaces/hanzo-community/video-streaming |

## 🚀 Quick Start

### View Templates Locally

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
# or
make dev

# Open gallery in browser
open http://localhost:3000/gallery

# View individual template
open http://localhost:3000/templates/ai-chat-interface
```

### Push to Hugging Face

#### Prerequisites

1. Install Hugging Face CLI:
```bash
pip install huggingface-hub
```

2. Login to Hugging Face:
```bash
huggingface-cli login
```

#### Push Individual Templates

Each template becomes its own repo in the hanzo-community organization:

```bash
# Push all templates as individual repos
make upload-templates
# or
./scripts/create-template-repos.sh
```

This will create repos at:
- https://huggingface.co/spaces/hanzo-community/ai-chat-interface
- https://huggingface.co/spaces/hanzo-community/ecommerce-storefront
- etc...

#### Push Gallery

The gallery itself becomes a standalone Hugging Face Space:

```bash
# Push gallery to HF
make upload-gallery
# or
./scripts/push-gallery.sh
```

Gallery will be at: https://huggingface.co/spaces/hanzo-community/gallery

#### Push Everything

```bash
# Push all templates and gallery
make upload-all
```

## 📂 Project Structure

```
/build
├── app/
│   ├── gallery/          # Gallery page
│   │   └── page.tsx      # Main gallery component
│   └── templates/        # Individual template routes
│       ├── ai-chat-interface/
│       ├── ecommerce-storefront/
│       └── ...
├── templates/            # Template source files
│   ├── ai-chat-interface/
│   │   └── page.tsx
│   ├── ecommerce-storefront/
│   │   └── page.tsx
│   └── ...
├── scripts/
│   ├── create-template-repos.sh  # Push templates to HF
│   └── push-gallery.sh           # Push gallery to HF
└── Makefile             # Build commands
```

## 🛠️ Available Commands

```bash
# Basic Commands
make help               # Show all commands
make install           # Install dependencies
make dev               # Start dev server
make build             # Build for production

# Template Commands
make list-templates    # List all templates
make validate          # Validate TypeScript
make serve-templates   # Serve templates locally

# Hugging Face Commands
make upload-templates  # Push templates to HF
make upload-gallery    # Push gallery to HF
make upload-all        # Push everything to HF

# Individual Template Builds
make template-chat     # Build AI Chat template
make template-saas     # Build SaaS Landing template
# ... etc
```

## 🎨 Gallery Features

The gallery (http://localhost:3000/gallery) provides:

- **Template Cards**: Visual preview of each template with color theme
- **Category Filtering**: Filter by AI, Commerce, Analytics, etc.
- **Search**: Find templates by name or description
- **Quick Actions**:
  - **View**: Opens template on Hugging Face
  - **Fork**: Duplicates template to your HF account
  - **Copy**: Copies clone command to clipboard

## 🔧 How Templates Work

### Local Development

Templates run as pages within the Next.js app:
- Gallery at `/gallery`
- Individual templates at `/templates/[template-name]`

### On Hugging Face

Each template becomes:
1. **Individual Space**: Standalone app that can be forked
2. **Docker Container**: Runs with Node.js and Next.js
3. **Public Repo**: Can be cloned with git

### Forking Templates

Users can fork templates in 3 ways:

1. **From HF Web**: Click "Duplicate this Space" button
2. **From Gallery**: Click "Fork" button on any template
3. **From CLI**:
```bash
# Clone template locally
git clone https://huggingface.co/spaces/hanzo-community/ai-chat-interface

# Or use npx command
npx create-hanzo-app@latest my-app --template ai-chat-interface
```

## 🌟 Key Features

- ✅ **100% @hanzo/ui Components**: No external UI libraries
- 🎨 **Unique Themes**: Each template has distinct colors
- 📱 **Responsive**: Works on all screen sizes
- 🌙 **Dark Mode**: Built-in dark theme support
- ⚡ **Next.js 14**: Latest React features
- 🔧 **TypeScript**: Full type safety

## 📚 Next Steps

1. **Customize Templates**: Modify colors, layouts, and features
2. **Create New Templates**: Use `make new-template` to start
3. **Share with Community**: Push to Hugging Face
4. **Get Feedback**: Share in Discord/GitHub

## 🤝 Contributing

To add a new template:

1. Create template in `/templates/[new-template-name]/`
2. Add to gallery in `/app/gallery/page.tsx`
3. Update scripts to include new template
4. Push to HF with `make upload-templates`

## 📄 License

MIT - Feel free to use these templates in your projects!

---

Built with ❤️ by Hanzo AI