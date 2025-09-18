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

## MCP (Model Context Protocol) Architecture

### Overview
Hanzo MCP provides a unified interface for AI tools with both JavaScript and Rust implementations. The architecture separates the MCP server from canonical tool implementations for modularity and reusability.

### Directory Structure
```
/Users/z/work/hanzo/mcp/          # MCP Server implementations
├── js/                            # JavaScript MCP server (existing)
├── rust/                          # Rust MCP server
│   ├── src/
│   │   ├── main.rs               # CLI entry point
│   │   ├── lib.rs                # Core library
│   │   ├── server.rs             # JSON-RPC server
│   │   ├── config.rs             # Configuration
│   │   └── protocol.rs           # MCP protocol definitions
│   └── Cargo.toml

/Users/z/work/hanzo/tools/rust/   # Canonical tool implementations
├── computer-control/              # Screenshot, mouse, keyboard
├── blockchain/                    # Web3 operations
├── vector-store/                  # Embeddings & search
├── file-system/                   # File operations
├── web-search/                    # Web scraping
└── code-execution/                # Safe code sandbox
```

### Key Features
- **Computer Control**: Full desktop automation via enigo
- **Blockchain Integration**: Ethereum/Web3 operations
- **Vector Store**: Shared embeddings across tools
- **Hanzo Node Integration**: Connects to running hanzod process
- **Multi-Language Support**: JS/Rust implementations with Python/TS fallbacks

### Integration Points
- **hanzo-desktop**: MCP tools installed by default
- **hanzo/dev**: Internal MCP client support
- **hanzod**: Node identity changed from "hanzo-desktop-node" to "hanzod"

## Recent Changes (Hanzo Rebranding)

### Completed
1. **Visual Rebranding**:
   - Changed color scheme from red to black/white
   - Background: Pure black (#000000)
   - Primary buttons: White with black text
   - Updated all UI components for proper WCAG contrast

2. **MCP Integration**:
   - Created standalone MCP server in Rust
   - Established canonical tool implementations in /tools/rust
   - Fixed hanzo-node identity issue (now "hanzod")
   - Integrated tauri-remote-ui for browser automation

3. **Brand Management System**:
   - Created centralized @hanzo/brand package for consistent branding
   - Single source of truth for the blocky Hanzo logo SVG
   - Automated icon generation for all platforms (macOS, Windows, iOS)
   - Ensures consistent icon usage across all Hanzo applications

4. **Icon Updates**:
   - Fixed recurring wrong icon issue with centralized brand package
   - Using official blocky logo design across all platforms
   - Generated new macOS icons with rounded corners (18% radius)
   - Created iOS icons with proper sizing (10% radius)
   - Applied gradient overlays for native look
   - All icons generated from single master SVG in @hanzo/brand

5. **Naming Updates**:
   - Renamed to "Hanzo" throughout codebase
   - Updated package names to @hanzo_network
   - Changed product name to "Hanzo AI"
   - Updated company references to "Hanzo Industries Inc"
   - Renamed all binaries from shinkai-node to hanzo-node (now "hanzod")
   - Enforced lowercase "hanzo" for wordmark usage

6. **Mobile Support**:
   - Initialized iOS support with Tauri 2.x
   - Generated all required iOS icon sizes
   - Prepared Android support (pending SDK setup)

7. **Quality Assurance**:
   - Added WCAG contrast testing
   - Integrated contrast tests in CI pipeline
   - Fixed all button and checkbox contrast issues

8. **Onboarding Flow Improvements** (January 17, 2025):
   - Fixed "Get Started" button functionality with unified node management
   - Simplified node spawning by delegating to single `node_start()` approach
   - Added comprehensive node status messages with animated indicators
   - Implemented "Connect Different Node" option for advanced users
   - Fixed React Router navigation issues in onboarding flow
   - Added auto-detection for existing hanzod process on port 3690
   - Updated default models to modern Qwen3 variants (1.7B, 4B, Coder, Next)
   - Created comprehensive E2E tests for onboarding flow

9. **Model Repository System** (January 17, 2025):
   - Replaced Ollama-based model management with custom Hanzo Model Repository
   - Integrated live model fetching from Hugging Face public API
   - Added lmstudio-community models (200+ models)
   - Added mlx-community models for Mac users (200+ optimized models)
   - Implemented real-time search across all Hugging Face models
   - Created size-based filtering slider (0-100GB)
   - Featured Qwen3 models always shown at top
   - Direct Hugging Face URL import support
   - Platform-aware model selection (MLX for Mac, general for others)
   - Live download statistics and popularity metrics
   - No dependency on Ollama for model management

### Pending Items
- Full integration testing with hanzo/node backend
- Android SDK configuration for mobile builds
- Production deployment configuration
- Merge upstream improvements from shinkai-local-ai-agents (MCP Composio, Python Runner, Tool Playground)

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

## Analysis: Local AI Agents Codebase Improvements

*Analysis Date: January 17, 2025*

### Executive Summary
After analyzing a comprehensive local AI agents codebase, I've identified numerous features and improvements that could significantly enhance the Hanzo Desktop application. The analysis focused on UI components, MCP (Model Context Protocol) enhancements, node management, testing infrastructure, and performance optimizations.

## Key Improvement Areas

### 1. UI Components and Design Patterns

#### Enhanced Search Components
- **Advanced Search Input**: Improved search component with clear button, better styling, and configurable classNames for different contexts
- **Real-time Search**: Live filtering capabilities with debounced search for better performance
- **Search Context Preservation**: Maintains search state across navigation

#### Loading and Progress Indicators
- **Dots Loader Component**: Elegant three-dot loading animation with staggered timing
- **Skeleton Loading**: Comprehensive skeleton loading states for grids and lists
- **Progress States**: Better loading states for async operations with proper error handling

#### Form Enhancements
- **Advanced RJSF Integration**: Enhanced React JSON Schema Form components with better validation
- **Field Templates**: Improved field templates for consistent form styling
- **Error Handling**: Better error display and validation feedback

### 2. MCP (Model Context Protocol) Improvements

#### Composio Integration
- **MCP Server Discovery**: Tabbed interface separating "Explore Composio MCPs" from "My MCP Servers"
- **App Store-like Experience**: Visual app cards with icons, descriptions, and one-click installation
- **Installation Workflow**: Seamless GitHub URL import → manual configuration → automatic chat initiation
- **Status Management**: Real-time enable/disable toggles with proper state feedback

#### Enhanced MCP Management
- **GitHub Integration**: Direct MCP server installation from GitHub URLs with automatic parsing
- **Unified MCP Interface**: Better organization of MCP servers with search and filtering
- **Connection Status**: Real-time status indicators for MCP server health
- **Auto-Discovery**: Automatic detection of installed MCP servers from URLs

### 3. Node Management Features

#### Ollama Integration
- **Model Repository**: Comprehensive Ollama model management with quality, speed, and capability tags
- **Model Discovery**: Browse and install models with detailed metadata
- **Installation Status**: Real-time installation progress and status tracking
- **Model Classification**: Tags for model capabilities (text, vision, code, etc.)

#### Enhanced Process Management
- **Background Services**: Better handling of long-running processes with proper cleanup
- **Health Monitoring**: Continuous health checks for node services
- **Resource Monitoring**: System resource usage tracking and alerts
- **Auto-Recovery**: Automatic service restart on failure

### 4. Agent and Tool Functionality

#### Tool Playground Enhancements
- **Integrated Development Environment**: Side-by-side chat and code editor
- **Language Detection**: Automatic programming language detection with proper syntax highlighting
- **Execution Environment**: Isolated execution environment with file synchronization
- **Tool Asset Management**: Copy and manage tool assets between environments
- **Metadata Generation**: AI-powered tool metadata generation

#### Python Code Runner
- **Pyodide Integration**: Browser-based Python execution with full scientific stack
- **File System Sync**: Bi-directional file synchronization between job context and execution environment
- **Web Worker Architecture**: Isolated execution in web workers for better performance
- **Output Handling**: Rich output rendering with support for plots, data, and errors
- **HTTP Request Handling**: Shared buffer communication for external API calls

#### Agent Configuration
- **Tool Override Configuration**: Per-agent tool configuration overrides
- **Agent Publishing**: Share and publish agents with metadata
- **Import/Export**: Agent import from various sources with validation
- **Configuration Templates**: Pre-built agent configurations for common use cases

### 5. Testing Infrastructure

#### Comprehensive Testing Patterns
- **Vitest Integration**: Modern testing framework with better performance than Jest
- **Service Layer Testing**: Proper mocking patterns for file system and API services
- **Component Testing**: React Testing Library integration with accessibility testing
- **Integration Testing**: End-to-end testing for complex workflows

#### Testing Utilities
- **Mock Factories**: Comprehensive mock factories for API responses and data structures
- **Test Helpers**: Reusable test utilities for common operations
- **Async Testing**: Proper patterns for testing async operations and side effects
- **Error Scenario Testing**: Comprehensive error handling test coverage

### 6. Performance Optimizations

#### Code Splitting and Lazy Loading
- **Route-based Splitting**: Dynamic imports for major feature areas
- **Component Lazy Loading**: Lazy loading of heavy components like code editors
- **Worker Architecture**: Web workers for CPU-intensive tasks
- **Memory Management**: Better cleanup and garbage collection patterns

#### State Management Improvements
- **Optimized React Query**: Better cache invalidation and query optimization
- **Zustand Patterns**: More efficient state slicing and subscription patterns
- **Context Optimization**: Reduced re-renders through better context structure
- **Background Processing**: Non-blocking background operations

### 7. Bug Fixes and Stability

#### Error Handling
- **Error Boundaries**: Comprehensive error boundary implementation with fallback UI
- **Graceful Degradation**: Fallback modes when services are unavailable
- **Connection Resilience**: Automatic reconnection and retry logic
- **User Feedback**: Better error messages and user guidance

#### Memory and Performance
- **Memory Leak Prevention**: Proper cleanup of subscriptions and listeners
- **Bundle Optimization**: Reduced bundle size through tree shaking and code splitting
- **Rendering Optimization**: Memoization and virtual scrolling for large lists
- **Background Task Management**: Better handling of background processes

## Recommended Implementation Priority

### High Priority (Immediate Benefits)
1. **Enhanced Search Components**: Immediate UX improvement
2. **MCP Composio Integration**: Significantly expands tool ecosystem
3. **Python Code Runner**: Major feature addition for data science workflows
4. **Tool Playground**: Enhanced development experience

### Medium Priority (Strategic Improvements)
1. **Testing Infrastructure**: Long-term maintainability
2. **Error Handling**: Better user experience and debugging
3. **Ollama Model Management**: Enhanced local AI capabilities
4. **Performance Optimizations**: Better resource utilization

### Low Priority (Polish and Enhancement)
1. **UI Component Library**: Gradual migration to enhanced components
2. **Advanced Agent Features**: Power user functionality
3. **Background Service Improvements**: Operational excellence

## Implementation Considerations

### Technical Compatibility
- All identified improvements are compatible with existing Hanzo Desktop architecture
- React 19 compatibility already present in codebase
- Tauri 2.x patterns align with existing implementation
- TypeScript patterns are consistent

### Resource Requirements
- **Development Time**: Estimated 2-3 months for high-priority items
- **Testing Effort**: Requires comprehensive testing for new integrations
- **Documentation**: Need to update user and developer documentation

### Risk Assessment
- **Low Risk**: UI components and testing improvements
- **Medium Risk**: MCP integrations (requires careful API handling)
- **Higher Risk**: Python code runner (security and sandboxing concerns)

## Conclusion

The analyzed codebase contains numerous valuable improvements that would significantly enhance the Hanzo Desktop application. The most impactful additions would be the Composio MCP integration, enhanced tool playground, and Python code runner, which would position Hanzo as a more comprehensive AI development platform.

The improvements maintain consistency with existing architecture while adding substantial new capabilities. Implementation should prioritize user-facing features that provide immediate value while building towards the more complex infrastructure improvements.

---

*Last Updated: January 17, 2025*
*Version: 1.1.13*
