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

# Install runtime dependencies for OpenSCAD and headless rendering
# Add gcompat for glibc compatibility on Alpine (musl)
RUN apk add --no-cache \
  xvfb \
  xvfb-run \
  mesa-gl \
  mesa-dri-gallium \
  git \
  wget \
  bash \
  fuse \
  gcompat \
  libstdc++ \
  libgcc \
  glib \
  cairo \
  pango \
  gdk-pixbuf \
  libx11 \
  libxext \
  libxrender \
  fontconfig \
  freetype \
  && rm -rf /var/cache/apk/*

# Download and extract OpenSCAD AppImage
# Extract manually since --appimage-extract-and-run needs glibc
RUN mkdir -p /tmp/openscad-extract \
  && wget -q https://github.com/openscad/openscad/releases/download/openscad-2021.01/openscad-2021.01-x86_64.AppImage -O /tmp/openscad.AppImage \
  && chmod +x /tmp/openscad.AppImage \
  && cd /tmp/openscad-extract \
  && /tmp/openscad.AppImage --appimage-extract 2>&1 | head -20 || true \
  && if [ -d squashfs-root ]; then \
       mv squashfs-root /opt/openscad && \
       ln -s /opt/openscad/AppRun /usr/local/bin/openscad; \
     else \
       # Fallback: try direct execution with gcompat \
       ln -s /tmp/openscad.AppImage /usr/local/bin/openscad; \
     fi \
  && rm -rf /tmp/openscad-extract /tmp/openscad.AppImage || true

# Clone Gridfinity Extended library
RUN git clone --depth 1 https://github.com/ostat/gridfinity_extended_openscad.git /opt/gridfinity_extended_openscad

# Set up non-root user for security
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Create directories for temp files and set permissions
# Also ensure Gridfinity library is readable by nextjs user
RUN mkdir -p /tmp/snap-caddy /data/snap-caddy \
  && chown -R nextjs:nodejs /tmp/snap-caddy /data/snap-caddy \
  && chmod -R a+r /opt/gridfinity_extended_openscad

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# OpenSCAD configuration
ENV OPENSCAD_PATH=/usr/local/bin/openscad
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
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Create public directory (Next.js standalone includes public files, but ensure dir exists)
RUN mkdir -p ./public

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
