# syntax=docker/dockerfile:1

# ============================================
# Snap Caddy Dockerfile
# Multi-stage build for Next.js app with OpenSCAD
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json bun.lock* package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies based on available lock file
RUN \
  if [ -f bun.lock ]; then \
    npm install -g bun && bun install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then \
    yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm i --frozen-lockfile; \
  else \
    echo "No lockfile found." && npm install; \
  fi


# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build


# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install system dependencies for OpenSCAD and headless rendering
RUN apk add --no-cache \
  openscad \
  xvfb \
  xvfb-run \
  mesa-gl \
  mesa-dri-gallium \
  git \
  && rm -rf /var/cache/apk/*

# Clone Gridfinity Extended library
RUN git clone --depth 1 https://github.com/ostat/gridfinity_extended_openscad.git /opt/gridfinity_extended_openscad

# Set up non-root user for security
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Create directories for temp files and set permissions
RUN mkdir -p /tmp/snap-caddy /data/snap-caddy \
  && chown -R nextjs:nodejs /tmp/snap-caddy /data/snap-caddy

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# OpenSCAD configuration
ENV OPENSCAD_PATH=/usr/bin/openscad
ENV GRIDFINITY_LIB_PATH=/opt/gridfinity_extended_openscad
ENV OPENSCAD_USE_XVFB=true
ENV OPENSCAD_TIMEOUT=300000

# File storage configuration
ENV TEMP_DIR=/data/snap-caddy
ENV MAX_FILE_SIZE=10485760
ENV FILE_RETENTION_MS=3600000

# Rate limiting defaults
ENV RATE_LIMIT_REQUESTS=10
ENV RATE_LIMIT_WINDOW=60000

# Feature flags
ENV GENERATE_PREVIEWS=false
ENV ENABLE_ASYNC_GENERATION=false

# Logging
ENV LOG_LEVEL=info

# Copy built application from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Set the port
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "server.js"]
