# Hanzo Application - LLM Context

## Project Overview
Hanzo Desktop is a privacy-focused AI assistant application built with Tauri 2.x, React, and TypeScript. It provides local AI capabilities through a desktop interface with support for multiple platforms including macOS, Windows, Linux, iOS, and Android.

## Company Information
- **Company**: Hanzo Industries Inc
- **Domain**: hanzo.ai
- **Product**: Hanzo Desktop - Private Local AI Assistant

## Architecture

### Tech Stack
- **Desktop Framework**: Tauri 2.x (Rust backend, React frontend)
- **Frontend**: React 18+ with TypeScript
- **Build System**: NX Monorepo
- **Styling**: Tailwind CSS with custom Hanzo UI components
- **State Management**: Zustand
- **Backend Services**: Rust-based Hanzo Node

### Key Directories
```
/apps/hanzo-desktop/
├── src/                   # React application source
│   ├── components/       # UI components
│   ├── pages/           # Route pages
│   ├── lib/             # Utilities and services
│   └── store/           # Zustand stores
├── src-tauri/           # Rust backend
│   ├── src/             # Rust source code
│   ├── icons/           # Application icons
│   └── capabilities/    # Tauri capabilities
└── external-binaries/   # Platform-specific binaries

/libs/
├── hanzo-ui/           # Shared UI component library
├── hanzo-i18n/         # Internationalization
├── hanzo-node-state/   # State management utilities
└── hanzo-message-ts/   # TypeScript message definitions
```

## Recent Changes (Hanzo Rebranding)

### Completed
1. **Visual Rebranding**:
   - Changed color scheme from red to black/white
   - Background: Pure black (#000000)
   - Primary buttons: White with black text
   - Updated all UI components for proper WCAG contrast

2. **Icon Updates**:
   - Generated new macOS icons with rounded corners (18% radius)
   - Created iOS icons with proper sizing (10% radius)
   - Applied gradient overlays for native look

3. **Naming Updates**:
   - Renamed to "Hanzo" throughout codebase
   - Updated package names to @hanzo_network
   - Changed product name to "Hanzo Desktop"
   - Updated company references to "Hanzo Industries Inc"
   - Renamed all binaries from shinkai-node to hanzo-node

4. **Mobile Support**:
   - Initialized iOS support with Tauri 2.x
   - Generated all required iOS icon sizes
   - Prepared Android support (pending SDK setup)

5. **Quality Assurance**:
   - Added WCAG contrast testing
   - Integrated contrast tests in CI pipeline
   - Fixed all button and checkbox contrast issues

### Pending Items
- Full integration testing with hanzo/node backend
- Android SDK configuration for mobile builds
- Production deployment configuration

## Testing

### Contrast Testing
```bash
npm run test:contrast
```

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
npm run test:e2e
```

## Build Commands

### Desktop
```bash
# Development
npm run dev

# Production build
npx nx build hanzo-desktop --configuration=production

# Package for distribution
npx tauri build
```

### Mobile
```bash
# iOS Development
npx tauri ios dev

# iOS Build
npx tauri ios build --ci --export-method debugging

# Android (requires SDK setup)
npx tauri android init
npx tauri android dev
```

## Environment Variables
```bash
# Required for development
NODE_OPTIONS="--max-old-space-size=16384"  # For memory-intensive builds
TAURI_SIGNING_PRIVATE_KEY                   # For app signing
TAURI_SIGNING_PRIVATE_KEY_PASSWORD          # Signing key password
```

## CI/CD Pipeline

### GitHub Actions Workflows
- **pr-ci-healthchecks.yml**: Runs on all PRs
  - Linting
  - Type checking
  - Unit tests
  - Contrast tests
  - Build verification

- **release-dev.yml**: Development releases
- **release-prod.yml**: Production releases

## Known Issues

1. **Memory Usage**: Frontend build requires increased Node memory (16GB)
2. **Mobile Builds**: Android requires SDK configuration

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow React 18+ best practices
- Maintain WCAG AA contrast standards
- Use Hanzo UI components for consistency

### Git Workflow
1. Create feature branch from main
2. Make changes with clear commits
3. Ensure all tests pass
4. Submit PR with description
5. Wait for CI checks

### Component Patterns
- Use functional components with hooks
- Implement proper error boundaries
- Follow atomic design principles
- Maintain accessibility standards

## Integration Points

### Hanzo Node Backend
- Local node runs on `http://127.0.0.1:9550`
- WebSocket connections for real-time updates
- REST API for data operations

### External Services
- Ollama for local LLM inference
- MCP (Model Context Protocol) servers
- Various AI model providers

## Performance Optimizations

1. **Code Splitting**: Dynamic imports for route-based splitting
2. **Lazy Loading**: Components loaded on demand
3. **Memoization**: React.memo for expensive components
4. **Virtual Scrolling**: For large lists
5. **Asset Optimization**: Compressed images and icons

## Security Considerations

1. **Local-First**: All data processed locally by default
2. **Encryption**: End-to-end encryption for sensitive data
3. **Sandboxing**: Tauri security features enabled
4. **CSP**: Content Security Policy configured
5. **Updates**: Secure auto-update mechanism

## Deployment

### Desktop Platforms
- **macOS**: DMG installer with notarization
- **Windows**: NSIS installer with signing
- **Linux**: AppImage and deb packages

### Mobile Platforms
- **iOS**: TestFlight for beta, App Store for production
- **Android**: Play Store distribution (pending)

## Support and Documentation

- GitHub Issues: Bug reports and feature requests
- Documentation: Internal docs in `/docs` directory
- API Reference: Generated from TypeScript definitions

---

*Last Updated: December 2024*
*Version: 1.1.13*
