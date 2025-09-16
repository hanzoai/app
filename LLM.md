# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hanzo AI is an AI-powered web development platform built with Next.js 15 that allows users to generate complete websites through natural language prompts. It integrates multiple AI providers (primarily Qwen and DeepSeek models) to create, modify, and deploy websites without coding.

## Core Development Commands

```bash
# Install dependencies
npm install

# Development server with Turbopack
npm run dev

# Production build
npm run build

# Start production server  
npm start

# Run linter
npm run lint
```

## High-Level Architecture

### AI Integration Pattern

The application follows a sophisticated AI-first architecture where:

1. **AI Providers**: Multiple providers (Fireworks AI, Nebius, SambaNova, etc.) are abstracted in `/lib/providers.ts` with automatic fallback mechanisms
2. **Streaming Responses**: AI responses stream via Server-Sent Events, handled by `/hooks/useCallAi.ts`
3. **Structured Output**: AI generates HTML with special markers for multi-page parsing:
   ```
   <<<<<<< START_TITLE page_name.html >>>>>>> END_TITLE
   ```

### Key Architectural Components

**App Router Structure (`/app`)**: Uses Next.js 15 App Router with:
- Route groups: `(public)` for unauthenticated access
- Server actions in `/app/actions/` for data mutations
- API routes in `/app/api/` for AI interactions and auth

**Component System (`/components`)**: Composite architecture with:
- Shadcn/ui components in `/components/ui/`
- Feature components in `/components/space/` and `/components/editor/`
- Context providers for state management

**State Management**: 
- TanStack Query for server state
- React Context for app-wide state
- Custom hooks in `/hooks/` for business logic

### Authentication Flow

Uses Hugging Face OAuth:
1. Login redirects to HF OAuth
2. Callback at `/auth/callback` handles token
3. Cookie-based session management via `/lib/auth.ts`
4. Server-side validation in layout and API routes

For local development, set `HF_TOKEN` environment variable to bypass auth.

### Database Schema

MongoDB with Mongoose:
- **Project Model**: Stores website HTML, prompts history, user association
- Connection managed in `/lib/mongodb.ts`
- Auto-timestamps on all models

### AI Prompt Engineering

System prompts in `/lib/prompts.ts`:
- `INITIAL_SYSTEM_PROMPT`: New website generation
- `FOLLOW_UP_SYSTEM_PROMPT`: Modifications
- Enforces structured HTML output with page markers
- Supports both single-page and multi-page websites

### Environment Variables

Required for production:
- `MONGODB_URI`: MongoDB connection string
- `HF_CLIENT_ID`: Hugging Face OAuth client ID
- `HF_CLIENT_SECRET`: Hugging Face OAuth client secret
- `HF_TOKEN`: (Optional) For local development auth bypass

API Keys for AI providers (optional, for specific provider usage):
- `FIREWORKS_API_KEY`
- `SAMBANOVA_API_KEY`
- `NOVITA_API_KEY`
- `HYPERBOLIC_API_KEY`
- `TOGETHER_API_KEY`
- `GROQ_API_KEY`
- `NEBIUS_API_KEY`

### Project-Specific Patterns

**Multi-Page Website Generation**:
- AI generates multiple HTML files in one response
- Pages parsed by special markers in response
- Navigation automatically generated between pages

**Live Preview System**:
- Sandpack integration for instant preview
- Monaco Editor for code editing
- Broadcast channel for cross-tab updates

**Error Handling**:
- Provider fallback on AI failures
- Rate limiting with user upgrade prompts
- Graceful degradation for missing features

### TypeScript Configuration

- Path alias `@/*` maps to root directory
- Strict mode enabled
- Target ES2017 with modern features

### Deployment

- Docker support via `Dockerfile`
- Designed for Hugging Face Spaces deployment
- Configurable via environment variables
- Port 3000 by default

## Key Files to Understand

- `/app/api/ask-ai/route.ts` - Core AI interaction endpoint
- `/hooks/useCallAi.ts` - Client-side AI streaming logic
- `/lib/providers.ts` - AI provider configuration
- `/lib/prompts.ts` - System prompts for AI
- `/components/editor/app-editor.tsx` - Main editor component
- `/app/projects/new/page.tsx` - New project creation flow

## Development Notes

- Always maintain structured HTML output format for AI responses
- Preserve multi-page support when modifying prompt engineering
- Test with different AI providers as they have varying token limits
- Keep authentication flow compatible with HF OAuth
- Maintain dark theme consistency (app is dark-mode only)