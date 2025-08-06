#!/bin/bash

# Zeal Minikube Quick Setup
# Non-interactive version for CI/CD or quick local testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY_PORT="${REGISTRY_PORT:-5001}"  # Default to 5001 to avoid macOS AirPlay conflict
MINIKUBE_PROFILE="zeal"
K8S_NAMESPACE="zeal"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Default configuration values
export ZEAL_NAMESPACE="$K8S_NAMESPACE"
export ZEAL_DOMAIN="zeal.local"
export ZEAL_NEXTJS_IMAGE="localhost:$REGISTRY_PORT/zeal-nextjs:$IMAGE_TAG"
export ZEAL_CRDT_IMAGE="localhost:$REGISTRY_PORT/zeal-crdt:$IMAGE_TAG"
export ZEAL_REDIS_IMAGE="redis:7-alpine"
export ZEAL_NEXTJS_REPLICAS="2"
export ZEAL_CRDT_REPLICAS="1"
export ZEAL_NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}"
export ZEAL_NEXTAUTH_URL="http://zeal.local"
export ZEAL_ENABLE_TLS="false"

# Use Supabase by default (matching the interactive script default)
export USE_SUPABASE="yes"
export ZEAL_USE_SUPABASE="true"
export ZEAL_DATABASE_URL="postgresql://postgres:postgres@supabase-db:5432/postgres"
export ZEAL_SUPABASE_URL="http://supabase-gateway:8000"
export ZEAL_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwNjk3OTA1OTgsImlhdCI6MTc1NDQzMDU5OH0.L6odhxPbMcLeEqiFXIIZbC0cNGQjcc8n9vnZNXLSiRo"
export ZEAL_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA2OTc5MDU5OCwiaWF0IjoxNzU0NDMwNTk4fQ.Zpmigdx8mkloUQhtD-ZtwKWp9LmmbgSbHXU45KSqOHA"

echo -e "${GREEN}🚀 Zeal Minikube Quick Setup${NC}"
echo -e "${GREEN}===========================${NC}"
echo

# Quick port check
echo -e "${YELLOW}Checking port availability...${NC}"
if ! lsof -Pi :$REGISTRY_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Registry port $REGISTRY_PORT is available${NC}"
else
    echo -e "${YELLOW}⚠️  Registry port $REGISTRY_PORT is in use${NC}"
    if [[ "$OSTYPE" == "darwin"* ]] && [ "$REGISTRY_PORT" = "5000" ]; then
        echo -e "${YELLOW}   This might be macOS AirPlay Receiver${NC}"
    fi
    echo -e "${YELLOW}   The setup script will find an alternative port${NC}"
fi
echo

# Start everything
echo -e "${YELLOW}Starting setup...${NC}"
./scripts/minikube-setup.sh setup

echo -e "${GREEN}✅ Quick setup complete!${NC}"