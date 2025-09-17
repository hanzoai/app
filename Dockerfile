# Production-ready Dockerfile for Hanzo AI Build Platform
# Multi-stage build optimized for Next.js applications

# ===== Base Stage =====
FROM node:20-alpine AS base

# Install system dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    dumb-init \
    tini \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# Create app directory with proper permissions
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

# ===== Dependencies Stage =====
FROM base AS deps

# Copy package files
COPY --chown=nextjs:nodejs package.json package-lock.json* ./
COPY --chown=nextjs:nodejs .npmrc* ./

# Switch to nextjs user for security
USER nextjs

# Install dependencies with exact versions
RUN npm ci --only=production && \
    npm cache clean --force

# ===== Dev Dependencies Stage =====
FROM deps AS dev-deps

# Install all dependencies including dev
USER root
COPY --chown=nextjs:nodejs package.json package-lock.json* ./
USER nextjs
RUN npm ci && \
    npm cache clean --force

# ===== Builder Stage =====
FROM dev-deps AS builder

# Copy source code
COPY --chown=nextjs:nodejs . .

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# ===== Development Stage =====
FROM dev-deps AS development

# Copy source code
COPY --chown=nextjs:nodejs . .

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=development
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').request({hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET'}, (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1)).end();" || exit 1

# Development command with hot reload
CMD ["npm", "run", "dev"]

# ===== Production Stage =====
FROM base AS production

# Install only production dependencies
WORKDIR /app
COPY --chown=nextjs:nodejs package.json package-lock.json* ./
USER nextjs
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy other necessary files
COPY --chown=nextjs:nodejs prisma ./prisma

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').request({hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET'}, (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1)).end();" || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Production command
CMD ["npm", "start"]

# ===== Default to production =====
FROM production