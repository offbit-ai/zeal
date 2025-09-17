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
