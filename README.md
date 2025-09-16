---
title: Hanzo AI
emoji: ⚔️
colorFrom: black
colorTo: black
sdk: docker
pinned: true
app_port: 3000
license: mit
short_description: Generate any application with AI
models:
  - Qwen/Qwen3-Next-80B-A3B-Thinking
  - deepseek-ai/DeepSeek-V3-0324
  - deepseek-ai/DeepSeek-R1-0528
---

# Hanzo AI ⚔️

Hanzo AI is a cutting-edge coding platform powered by advanced AI models, designed to make web development instant and effortless. Built for developers, designers, and entrepreneurs, it transforms ideas into fully functional websites using the power of AI.

## Features

- 🤖 AI-powered website generation using multiple LLM providers
- 🎨 Live preview with Sandpack integration
- 📝 Code editing with Monaco Editor
- 🔐 Authentication via Hugging Face OAuth
- 💾 Project persistence with MongoDB
- 🚀 Multi-page website support

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB (or use Docker Compose)
- At least one AI provider API key

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/hanzoai/build.git
cd build
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

4. Start development server:
```bash
npm run dev
```

Visit http://localhost:3000

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

2. The application will be available at http://localhost:3000

## Deployment Options

### 1. Hanzo Cloud (Recommended)

The application is automatically deployed to Hanzo Cloud on push to main branch.

Production URL: https://build.hanzo.ai

### 2. Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hanzoai/build)

### 3. Docker

```bash
docker build -t hanzo-build .
docker run -p 3000:3000 --env-file .env hanzo-build
```

### 4. Hugging Face Spaces

This project is configured for Hugging Face Spaces deployment. See the [original space](https://huggingface.co/spaces/enzostvs/hanzo) for reference.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `HF_CLIENT_ID` | Yes | Hugging Face OAuth client ID |
| `HF_CLIENT_SECRET` | Yes | Hugging Face OAuth secret |
| `HF_TOKEN` | No | Optional for local dev auth bypass |
| `FIREWORKS_API_KEY` | No* | Fireworks AI API key |
| `SAMBANOVA_API_KEY` | No* | SambaNova API key |
| `TOGETHER_API_KEY` | No* | Together AI API key |
| `GROQ_API_KEY` | No* | Groq API key |

*At least one AI provider API key is required

## Architecture

- **Frontend**: Next.js 15 with App Router, Tailwind CSS
- **Backend**: API Routes for AI interaction and auth
- **Database**: MongoDB for project storage
- **Auth**: Hugging Face OAuth
- **AI Providers**: Multiple LLM providers with automatic fallback

## CI/CD Pipeline

The project includes GitHub Actions workflows for:
- Continuous Integration (linting, building)
- Docker image building and pushing to GitHub Container Registry
- Automated deployment to Hanzo Cloud
- Optional deployment to Vercel

## Development

### Running Tests

```bash
npm run lint
npm run build
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## License

MIT - See [LICENSE](LICENSE) file for details

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/hanzoai/build/issues) page.

## Credits

Originally based on the HF Spaces project by @enzostvs. Enhanced and maintained by the Hanzo AI team
