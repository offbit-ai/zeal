#!/bin/bash

# Generate proper Dockerfiles for Railway deployment
# Based on actual Zeal requirements from start-dev.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RAILWAY_DIR="$SCRIPT_DIR"

log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Create start script for Next.js app
generate_nextjs_start_script() {
    log $BLUE "📝 Creating start-nextjs.sh for Next.js application..."
    
    cat > "$RAILWAY_DIR/start-nextjs.sh" << 'EOF'
#!/bin/sh
set -e

# Handle auth policies from environment variable
if [ -n "$ZEAL_AUTH_POLICIES_CONTENT" ]; then
  echo "Setting up auth policies from environment..."
  mkdir -p /app/config
  echo "$ZEAL_AUTH_POLICIES_CONTENT" > /app/config/auth-policies.json
  echo "Auth policies written to /app/config/auth-policies.json"
fi

# Wait for databases to be ready (Railway handles this, but add safety)
echo "Checking database connectivity..."
for i in $(seq 1 30); do
  if pg_isready -h ${DATABASE_HOST:-postgres} -p ${DATABASE_PORT:-5432} > /dev/null 2>&1; then
    echo "✅ Database is ready"
    break
  fi
  echo "Waiting for database... ($i/30)"
  sleep 2
done

# Log configuration
echo "=== Configuration ==="
echo "Node.js: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Port: ${PORT:-3000}"
echo "CRDT Server: ${NEXT_PUBLIC_CRDT_SERVER_URL:-NOT_CONFIGURED}"
if [ "$ZEAL_AUTH_ENABLED" = "true" ]; then
  echo "Authorization: ENABLED (Mode: ${ZEAL_AUTH_MODE:-production})"
  if [ "$ZEAL_AUTH_MODE" = "production" ]; then
    echo "JWT Issuer: ${AUTH_JWT_ISSUER:-NOT_CONFIGURED}"
    if [ "${AUTH_JWT_ISSUER:-NOT_CONFIGURED}" = "NOT_CONFIGURED" ] || [ "${AUTH_JWT_ISSUER}" = "https://please-configure-your-idp.com" ]; then
      echo "WARNING: JWT configuration is not properly set. Update AUTH_JWT_* environment variables."
    fi
  fi
else
  echo "Authorization: DISABLED (Not recommended for production)"
fi
echo "Storage Provider: ${AWS_S3_BUCKET:+AWS S3}${AZURE_STORAGE_ACCOUNT:+Azure Blob}${GCS_BUCKET:+Google Cloud Storage}${MINIO_ENDPOINT:+MinIO}"
echo "=================="

# Start Next.js application (using correct command)
echo "Starting Next.js application..."
exec npm run start
EOF
    
    chmod +x "$RAILWAY_DIR/start-nextjs.sh"
    log $GREEN "✅ Created start-nextjs.sh script"
}

# Generate main application Dockerfile (WITHOUT CRDT server)
generate_main_dockerfile() {
    log $BLUE "📦 Generating Dockerfile for main Next.js application..."
    
    # First create the start script
    generate_nextjs_start_script
    
    cat > "$RAILWAY_DIR/Dockerfile.nextjs" << 'EOF'
# Dockerfile for Zeal Next.js application (CRDT server is separate)
FROM node:20-alpine AS base

# Install system dependencies needed for builds
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client \
    curl \
    bash \
    git

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci --include=dev

# Next.js Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code (paths relative to project root)
COPY app ./app
COPY public ./public
COPY data ./data
COPY hooks ./hooks
COPY lib ./lib
COPY pages ./pages
COPY store ./store
COPY utils ./utils
COPY components ./components
COPY packages ./packages
COPY types ./types
COPY services ./services
COPY scripts ./scripts
COPY next.config.js ./
COPY tsconfig.json ./
COPY package.json ./
COPY package-lock.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY init.sql ./
COPY timescaledb-init.sql ./

# Build the application (includes templates:ingest and graphrag:build)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js and prepare data files
RUN npm run templates:ingest && \
    npm run graphrag:build && \
    next build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl

# Create necessary directories
RUN mkdir -p /app/data /app/public /app/.next /app/config && \
    chown -R nextjs:nodejs /app

# Copy production build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

# Copy data files (templates, graphrag)
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

# Copy start script
COPY --chown=nextjs:nodejs deployments/railway/start-nextjs.sh /app/start.sh

# Copy SQL initialization files for reference (not for container init)
# COPY --chown=nextjs:nodejs init.sql timescaledb-init.sql ./

# Make start script executable
RUN chmod +x /app/start.sh

# Switch to non-root user
USER nextjs

# Expose port (Railway provides PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

# Use the start script
CMD ["/app/start.sh"]
EOF
    
    log $GREEN "✅ Generated deployments/railway/Dockerfile.nextjs"
}

# Create start script for CRDT server
generate_crdt_start_script() {
    log $BLUE "📝 Creating start-crdt.sh for CRDT server..."
    
    cat > "$RAILWAY_DIR/start-crdt.sh" << 'EOF'
#!/bin/sh

# Log configuration
echo "Starting CRDT server..."
echo "Redis URL: ${REDIS_URL:0:20}..."
echo "Port: ${PORT:-8080}"
echo "Max clients per room: ${MAX_CLIENTS_PER_ROOM:-100}"
echo "Client timeout: ${CLIENT_TIMEOUT_MINUTES:-30} minutes"

# Start server with all arguments
exec /usr/local/bin/server \
  --port ${PORT:-8080} \
  ${VERBOSE:+--verbose} \
  ${DISABLE_REDIS_PERSISTENCE:+--disable-redis-persistence}
EOF
    
    chmod +x "$RAILWAY_DIR/start-crdt.sh"
    log $GREEN "✅ Created start-crdt.sh script"
}

# Generate CRDT server standalone Dockerfile (separate service)
generate_crdt_standalone_dockerfile() {
    log $BLUE "🦀 Generating standalone Dockerfile for CRDT server..."
    
    # First create the start script
    generate_crdt_start_script
    
    cat > "$RAILWAY_DIR/Dockerfile.crdt" << 'EOF'
# Standalone Dockerfile for CRDT Server
FROM rust:1.82-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    pkgconfig \
    gcc \
    make

WORKDIR /app

# Copy CRDT server source (path relative to project root)
COPY crdt-server ./crdt-server

# Build CRDT server
WORKDIR /app/crdt-server
RUN cargo build --release

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    openssl \
    libgcc \
    curl \
    bash

# Create non-root user
RUN addgroup -g 1001 -S crdt && \
    adduser -S crdt -u 1001

# Copy binary from builder
COPY --from=builder /app/crdt-server/target/release/server /usr/local/bin/server

# Copy start script (from context, not builder)
COPY deployments/railway/start-crdt.sh /usr/local/bin/start.sh

# Set ownership and permissions
RUN chown crdt:crdt /usr/local/bin/server /usr/local/bin/start.sh && \
    chmod +x /usr/local/bin/server /usr/local/bin/start.sh

# Switch to non-root user
USER crdt

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Use the start script
CMD ["/usr/local/bin/start.sh"]
EOF
    
    log $GREEN "✅ Generated deployments/railway/Dockerfile.crdt"
}

# Generate railway.json for Railway deployment configuration
generate_railway_json() {
    log $BLUE "📄 Generating railway.json for deployment configuration..."
    
    cat > "$RAILWAY_DIR/railway.json" << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./deployments/railway/Dockerfile.nextjs"
  },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "services": [
    {
      "name": "web",
      "source": {
        "repo": "."
      },
      "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "./deployments/railway/Dockerfile.nextjs"
      },
      "deploy": {
        "healthcheckPath": "/api/health",
        "healthcheckTimeout": 30,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 3
      }
    },
    {
      "name": "crdt-server",
      "source": {
        "repo": "."
      },
      "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "./deployments/railway/Dockerfile.crdt"
      },
      "deploy": {
        "healthcheckPath": "/health",
        "healthcheckTimeout": 30,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 3,
        "port": 8080
      }
    }
  ],
  "databases": [
    {
      "name": "postgres",
      "plugin": "postgresql@latest",
      "config": {
        "extensions": ["uuid-ossp", "pgvector", "pg_trgm"]
      }
    },
    {
      "name": "timescaledb",
      "plugin": "postgresql@latest",
      "config": {
        "extensions": ["timescaledb"],
        "databaseName": "zeal_traces"
      }
    }
  ],
  "plugins": [
    {
      "name": "redis",
      "plugin": "redis@latest"
    }
  ]
}
EOF
    
    log $GREEN "✅ Generated deployments/railway/railway.json"
}

# Generate docker-compose for local testing
generate_docker_compose() {
    log $BLUE "🐳 Generating docker-compose.railway.yml for local testing..."
    
    cat > "$RAILWAY_DIR/docker-compose.railway.yml" << 'EOF'
# Docker Compose for testing Railway deployment locally
# This mimics the Railway environment

version: '3.8'

services:
  # PostgreSQL with pgvector
  postgres:
    image: pgvector/pgvector:pg15
    container_name: railway-postgres
    environment:
      POSTGRES_DB: zeal_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../../init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - railway-network

  # TimescaleDB for traces
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    container_name: railway-timescaledb
    environment:
      POSTGRES_DB: zeal_traces
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${TIMESCALE_PASSWORD:-postgres}
    volumes:
      - timescale_data:/var/lib/postgresql/data
      - ../../timescaledb-init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - railway-network

  # Redis
  redis:
    image: redis:7-alpine
    container_name: railway-redis
    command: redis-server --requirepass ${REDIS_PASSWORD:-redispass}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-redispass}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - railway-network

  # CRDT Server (separate service)
  crdt-server:
    build:
      context: ../..
      dockerfile: deployments/railway/Dockerfile.crdt
    container_name: railway-crdt-server
    depends_on:
      redis:
        condition: service_healthy
    environment:
      REDIS_URL: redis://:${REDIS_PASSWORD:-redispass}@redis:6379
      PORT: 8080
      VERBOSE: true
      MAX_CLIENTS_PER_ROOM: 100
      CLIENT_TIMEOUT_MINUTES: 30
    ports:
      - "8080:8080"
    networks:
      - railway-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Main Next.js Application
  app:
    build:
      context: ../..
      dockerfile: deployments/railway/Dockerfile.nextjs
    container_name: railway-app
    depends_on:
      postgres:
        condition: service_healthy
      timescaledb:
        condition: service_healthy
      redis:
        condition: service_healthy
      crdt-server:
        condition: service_healthy
    environment:
      # Database
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@postgres:5432/zeal_db?schema=public
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      
      # TimescaleDB
      TIMESCALE_HOST: timescaledb
      TIMESCALE_PORT: 5432
      TIMESCALE_DATABASE: zeal_traces
      TIMESCALE_USER: postgres
      TIMESCALE_PASSWORD: ${TIMESCALE_PASSWORD:-postgres}
      
      # Redis
      REDIS_URL: redis://:${REDIS_PASSWORD:-redispass}@redis:6379
      
      # CRDT Server (now external service)
      NEXT_PUBLIC_CRDT_SERVER_URL: ws://crdt-server:8080
      
      # Application
      NODE_ENV: production
      PORT: 3000
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-development-secret-change-in-production}
      
      # Features
      NEXT_PUBLIC_ENABLE_COLLABORATION: true
      NEXT_PUBLIC_ENABLE_FLOW_TRACING: true
      NEXT_PUBLIC_ENABLE_VERSION_HISTORY: true
      NEXT_PUBLIC_EMBED_ENABLED: true
      
      # Auth (enabled by default in production)
      ZEAL_AUTH_ENABLED: true
      ZEAL_AUTH_MODE: production
      ZEAL_SECRET_KEY: ${ZEAL_SECRET_KEY:-development-secret}
      
      # Storage (MinIO for local testing)
      MINIO_ENDPOINT: host.docker.internal:9000
      MINIO_BUCKET: zeal-uploads
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin123
      MINIO_USE_SSL: false
      NEXT_PUBLIC_MINIO_URL: http://localhost:9000
      
    ports:
      - "3000:3000"
    networks:
      - railway-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # MinIO for local S3-compatible storage
  minio:
    image: minio/minio:latest
    container_name: railway-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - railway-network

volumes:
  postgres_data:
  timescale_data:
  redis_data:
  minio_data:

networks:
  railway-network:
    driver: bridge
EOF
    
    log $GREEN "✅ Generated deployments/railway/docker-compose.railway.yml"
}

# Main execution
main() {
    log $MAGENTA "
╔══════════════════════════════════════════════════════════════╗
║        🚂 Generating Railway Dockerfiles 🚂                  ║
╚══════════════════════════════════════════════════════════════╝"
    
    generate_main_dockerfile
    generate_crdt_standalone_dockerfile
    generate_railway_json
    generate_docker_compose
    
    log $GREEN "
✅ Generated all Railway deployment configurations!

Files created in deployments/railway/:
  - Dockerfile.nextjs (Next.js app)
  - Dockerfile.crdt (CRDT server)
  - start-nextjs.sh (Next.js start script)
  - start-crdt.sh (CRDT start script)
  - railway.json (Railway configuration)
  - docker-compose.railway.yml (local testing)

To test locally:
  cd deployments/railway
  docker-compose -f docker-compose.railway.yml up --build

To deploy to Railway:
  1. Push these files to your repository
  2. In Railway, use deployments/railway/railway.json
  3. Or run: railway up from the project root

Note: The CRDT server and Next.js app are now completely separate services,
      communicating via WebSocket connections.
"
}

main "$@"