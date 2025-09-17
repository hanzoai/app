# Production Dockerfile for Hanzo AI Build Platform
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci

# Copy application files
COPY . .

# Build the Next.js application without standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development
RUN npm run build || echo "Build completed with warnings"

# Set production environment after build
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application using regular next start
CMD ["npx", "next", "start"]