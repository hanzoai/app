# Production Dockerfile with robust build
FROM node:20-alpine

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Copy all source files
COPY . .

# Patch @hanzo/ui to fix build issues
RUN node scripts/patch-hanzo-ui.js || true

# Build the Next.js application with proper error handling
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build && \
    # Verify build artifacts exist
    if [ ! -d ".next" ]; then \
      echo "Build failed: .next directory not created" && exit 1; \
    fi

# Prune dev dependencies after successful build
RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the production server
CMD ["pnpm", "start"]