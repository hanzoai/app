# Simple, working production Dockerfile
FROM node:20-alpine

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy all files
COPY . .

# Build the Next.js application (regular build, not standalone)
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the application with pnpm start
CMD ["pnpm", "start"]