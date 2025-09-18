# Simple, working production Dockerfile
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci

# Copy all files
COPY . .

# Build the Next.js application (regular build, not standalone)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the application with npm start
CMD ["npm", "start"]