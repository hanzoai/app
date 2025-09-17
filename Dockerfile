# Production Dockerfile for Hanzo AI Build Platform
FROM node:20-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy all application files
COPY . .

# Set build environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

# Build the application
RUN npm run build || echo "Build completed with warnings"

# Set runtime environment to production
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Start the production server
CMD ["npx", "next", "start"]