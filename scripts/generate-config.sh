#!/bin/bash
# Generate runtime config based on environment

cat > /app/public/config.js << EOF
window.__ZEAL_CONFIG__ = {
  CRDT_SERVER_URL: "${NEXT_PUBLIC_CRDT_SERVER_URL:-ws://localhost:8080}",
  ENABLE_COLLABORATION: ${NEXT_PUBLIC_ENABLE_COLLABORATION:-true}
};
EOF