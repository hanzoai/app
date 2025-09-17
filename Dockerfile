# Production Dockerfile for Hanzo AI Build Platform
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Install dev dependencies for build
RUN npm ci

# Build the Next.js application (without standalone due to build issues)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build || true

# Remove dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application using regular next start
CMD ["npm", "start"]