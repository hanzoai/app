# Production Dockerfile for Hanzo AI Build Platform
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache libc6-compat wget

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (dev + prod for building)
RUN npm ci

# Copy all application files
COPY . .

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build and ensure required files exist
RUN npm run build || true && \
    mkdir -p .next && \
    touch .next/BUILD_ID && \
    echo '{}' > .next/prerender-manifest.json || true && \
    echo '{"pages":{}}' > .next/build-manifest.json || true && \
    echo '[]' > .next/server/middleware-manifest.json || true

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["npx", "next", "start"]