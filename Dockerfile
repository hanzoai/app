# Production Dockerfile for Hanzo AI Build Platform
FROM node:20-alpine AS builder

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Build the Next.js application with standalone output
ENV BUILD_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install only production runtime dependencies
RUN apk add --no-cache libc6-compat

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build from builder
# The standalone folder contains all necessary files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static files (these are not included in standalone by default)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public folder if it exists (Next.js expects this)
COPY --from=builder --chown=nextjs:nodejs /app/public* ./public

USER nextjs

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the standalone server
# In standalone mode, the server.js file is at the root
CMD ["node", "server.js"]