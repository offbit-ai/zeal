# Next.js Application Dockerfile
FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies for node-gyp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application (skip Rust build since it's built separately)
ENV NEXT_TELEMETRY_DISABLED 1
# Build with console logs disabled
RUN NEXT_PUBLIC_DISABLE_CONSOLE_LOGS=true npx next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_PUBLIC_DISABLE_CONSOLE_LOGS true
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
# Copy standalone output - this includes server.js and all dependencies
COPY --from=builder /app/.next/standalone ./
# Copy static files
COPY --from=builder /app/.next/static ./.next/static
# Copy public directory
COPY --from=builder /app/public ./public
# Copy config generation script
COPY scripts/generate-config.sh /app/scripts/generate-config.sh
RUN chmod +x /app/scripts/generate-config.sh

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["/bin/sh", "-c", "/app/scripts/generate-config.sh && node server.js"]