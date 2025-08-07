#!/bin/bash
# Generate runtime config based on environment

# Use environment variable if set, otherwise use default
CRDT_URL="${NEXT_PUBLIC_CRDT_SERVER_URL:-}"

# If no URL is provided, use smart defaults
if [ -z "$CRDT_URL" ]; then
  # In production, this should be set via environment variable
  # For local development fallback
  CRDT_URL="ws://localhost:8080"
fi

cat > /app/public/config.js << EOF
// Runtime configuration for Zeal
// Generated from environment variables
window.__ZEAL_CONFIG__ = {
  CRDT_SERVER_URL: "${CRDT_URL}",
  ENABLE_COLLABORATION: ${NEXT_PUBLIC_ENABLE_COLLABORATION:-true}
};
EOF