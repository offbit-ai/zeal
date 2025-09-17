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
