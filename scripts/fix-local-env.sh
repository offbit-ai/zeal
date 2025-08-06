#!/bin/bash

# Script to fix local environment after database schema changes
set -e

echo "🔧 Fixing Local Environment"
echo "=========================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Must run from project root directory"
    exit 1
fi

echo -e "${YELLOW}1. Restarting PostgREST to reload schema cache...${NC}"
kubectl rollout restart deployment/supabase-rest -n zeal
kubectl rollout status deployment/supabase-rest -n zeal --timeout=30s

echo -e "${YELLOW}2. Building Next.js Docker image with fixes...${NC}"
docker build -t localhost:5001/zeal-nextjs:latest -f Dockerfile .

echo -e "${YELLOW}3. Pushing image to local registry...${NC}"
docker push localhost:5001/zeal-nextjs:latest

echo -e "${YELLOW}4. Updating Next.js deployment...${NC}"
kubectl rollout restart deployment/nextjs-deployment -n zeal
kubectl rollout status deployment/nextjs-deployment -n zeal --timeout=60s

echo -e "${GREEN}✅ Environment fixed!${NC}"
echo ""
echo "Test with:"
echo "  curl -X POST http://zeal.local:8080/api/workflows \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA2OTc5MDU5OCwiaWF0IjoxNzU0NDMwNTk4fQ.Zpmigdx8mkloUQhtD-ZtwKWp9LmmbgSbHXU45KSqOHA' \\"
echo "    -d '{\"name\": \"Test Workflow\", \"graphs\": [{\"id\": \"main\", \"nodes\": [], \"connections\": []}]}'"