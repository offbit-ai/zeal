#!/bin/bash

# Zeal Kubernetes Deployment Script
# Uses environment variables to generate deployment from template

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_ROOT/k8s"
ENV_FILE="$K8S_DIR/.env.k8s"
TEMPLATE_FILE="$K8S_DIR/deployment-template.yaml"
OUTPUT_FILE="$K8S_DIR/deployment-generated.yaml"

echo -e "${GREEN}🚀 Zeal Kubernetes Deployment${NC}"
echo -e "${GREEN}===========================${NC}"
echo

# Check if envsubst is available
if ! command -v envsubst &> /dev/null; then
    echo -e "${RED}❌ envsubst command not found${NC}"
    echo "Please install gettext package:"
    echo "  - macOS: brew install gettext"
    echo "  - Ubuntu/Debian: apt-get install gettext-base"
    echo "  - RHEL/CentOS: yum install gettext"
    exit 1
fi

# Check if template exists
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    echo -e "${RED}❌ Template file not found: $TEMPLATE_FILE${NC}"
    exit 1
fi

# Load environment variables
if [[ -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}Loading environment from: $ENV_FILE${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo -e "${YELLOW}No .env.k8s file found. Using environment variables.${NC}"
fi

# Validate required variables
required_vars=(
    "ZEAL_NEXTJS_IMAGE"
    "ZEAL_CRDT_IMAGE"
    "ZEAL_DOMAIN"
    "ZEAL_NEXTAUTH_SECRET"
    "ZEAL_DATABASE_URL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo
    echo "Please set these variables in $ENV_FILE or your environment"
    echo "See $K8S_DIR/.env.k8s.example for an example"
    exit 1
fi

# If using Supabase, validate Supabase variables
if [[ "$ZEAL_USE_SUPABASE" == "true" ]]; then
    supabase_vars=("ZEAL_SUPABASE_URL" "ZEAL_SUPABASE_ANON_KEY" "ZEAL_SUPABASE_SERVICE_ROLE_KEY")
    missing_supabase=()
    
    for var in "${supabase_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_supabase+=("$var")
        fi
    done
    
    if [[ ${#missing_supabase[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Missing Supabase environment variables:${NC}"
        for var in "${missing_supabase[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
fi

# Generate deployment file
echo -e "${YELLOW}Generating deployment configuration...${NC}"
envsubst < "$TEMPLATE_FILE" > "$OUTPUT_FILE"

echo -e "${GREEN}✅ Deployment configuration generated!${NC}"
echo -e "${GREEN}📄 Output file: $OUTPUT_FILE${NC}"
echo

# Display configuration summary
echo -e "${YELLOW}Configuration Summary:${NC}"
echo "  Namespace: ${ZEAL_NAMESPACE:-zeal}"
echo "  Domain: $ZEAL_DOMAIN"
echo "  Next.js Image: $ZEAL_NEXTJS_IMAGE"
echo "  CRDT Image: $ZEAL_CRDT_IMAGE"
echo "  Redis Image: ${ZEAL_REDIS_IMAGE:-redis:7-alpine}"
echo "  Database: $([ "$ZEAL_USE_SUPABASE" == "true" ] && echo "Supabase" || echo "PostgreSQL")"
echo

# Ask if user wants to apply
if [[ "$1" != "--no-apply" ]]; then
    echo -e "${YELLOW}Do you want to apply this configuration to your cluster? (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Applying configuration...${NC}"
        kubectl apply -f "$OUTPUT_FILE"
        echo
        echo -e "${GREEN}✅ Deployment applied successfully!${NC}"
        echo
        echo -e "${YELLOW}Check deployment status:${NC}"
        echo "  kubectl get all -n ${ZEAL_NAMESPACE:-zeal}"
        echo
        echo -e "${YELLOW}View logs:${NC}"
        echo "  kubectl logs -f deployment/nextjs-deployment -n ${ZEAL_NAMESPACE:-zeal}"
        echo "  kubectl logs -f deployment/crdt-deployment -n ${ZEAL_NAMESPACE:-zeal}"
    else
        echo
        echo -e "${YELLOW}To apply later, run:${NC}"
        echo "  kubectl apply -f $OUTPUT_FILE"
    fi
fi